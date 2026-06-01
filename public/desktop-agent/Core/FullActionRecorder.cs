using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.Core.Definitions;
using FlaUI.Core.EventHandlers;
using FlaUI.UIA3;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Full-action recorder that captures clicks, typing, double-clicks,
/// right-clicks, keyboard shortcuts, selections, scrolls, and window switches.
/// Uses FlaUI UIA3 event handlers + low-level Win32 input hooks.
/// </summary>
public class FullActionRecorder
{
    private readonly ApiClient _api;
    private readonly DesktopJob _job;
    private readonly IRecorderStepSink? _sink;
    private Application? _app;
    private UIA3Automation? _automation;
    private int _stepCount;
    private IntPtr _keyboardHookId;
    private IntPtr _mouseHookId;
    private NativeMethods.LowLevelKeyboardProc? _keyboardProc;
    private NativeMethods.LowLevelMouseProc? _mouseProc;

    // Track state for composite action detection
    private DateTime _lastClickTime = DateTime.MinValue;
    private string _lastClickElement = "";
    private DateTime _lastRecordedClickTime = DateTime.MinValue;
    private string _lastRecordedClickElement = "";
    private readonly HashSet<int> _pressedModifiers = new();
    private string _typingBuffer = "";
    private AutomationElement? _typingElement;
    private DateTime _lastTypeTime = DateTime.MinValue;
    private int _targetPid;
    private uint _hookThreadId;
    private long _lastPrimaryMouseDownTicks;
    private long _mouseDownSequence;
    private long _lastConsumedMouseDownSequence;

    // Element-at-point capture for precise click recording
    private AutomationElement? _lastMouseDownElement;
    private DateTime _lastMouseDownElementTime = DateTime.MinValue;
    private readonly object _mouseDownElementLock = new();

    // JAB element captured at mouse-down point (for Java apps where UIA returns SunAwtFrame)
    private JabElementResult? _lastMouseDownJabElement;
    private int _lastMouseDownX;
    private int _lastMouseDownY;

    // Last precise interaction target (reused for subsequent typing in Java apps)
    private AutomationElement? _lastInteractionElement;
    private JabElementResult? _lastInteractionJabElement;
    private DateTime _lastInteractionTime = DateTime.MinValue;
    private JabElementResult? _typingJabElement;

    // JAB state (initialized once; used opportunistically for Java windows)
    private bool _jabInitialized;
    private string _engineMode = "uia";

    // Last successfully submitted step signature (global dedupe safety net).
    private DateTime _lastSubmittedStepTime = DateTime.MinValue;
    private string _lastSubmittedStepSignature = "";

    // Minimum interval (ms) between recording the same element as a click.
    // UIA FocusChanged often fires multiple times for a single user click;
    // this debounce ensures only one step is emitted per physical click.
    private const int ClickDebounceMsForSameElement = 400;
    private const int ClickDebounceMsGlobal = 150;

    // Focus-based click capture is only valid when correlated to a real
    // left-mouse press from the target app within this short window.
    private const int FocusToMouseCorrelationMs = 600;

    // Reuse last precise interaction target for typed text emitted right after click.
    private const int TypingTargetReuseMs = 5000;

    // Final guard at submission layer to block duplicate click-like actions.
    private const int SubmitDuplicateDebounceMs = 700;

    public FullActionRecorder(ApiClient api, DesktopJob job)
    {
        _api = api;
        _job = job;
        _sink = null;
    }

    /// <summary>
    /// Constructor with local step sink for standalone recorder dual-write.
    /// </summary>
    public FullActionRecorder(ApiClient api, DesktopJob job, IRecorderStepSink sink)
    {
        _api = api;
        _job = job;
        _sink = sink;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        await _api.NotifyStart(_job.Id);
        _automation = new UIA3Automation();
        _engineMode = (_job.EngineMode ?? "uia").Trim().ToLowerInvariant();

        // Initialize JAB once and use it opportunistically for Java windows,
        // regardless of selected mode (prevents SunAwtFrame-only selectors in recorder UI).
        _jabInitialized = JavaAccessBridge.Initialize();
        if (_jabInitialized)
            Logger.Info("JAB initialized for recording — Java controls will be captured with rich selectors");
        else
            Logger.Warn("JAB not available — Java selectors may remain window-level (run jabswitch /enable)");

        try
        {
            // Attach to application
            _app = AttachOrLaunch();
            if (_app == null)
            {
                Logger.Error("Could not attach to application.");
                return;
            }
            _targetPid = _app.ProcessId;
            Logger.Info($"Attached to PID {_targetPid}");

            // Install UIA event handlers
            InstallUiaHandlers();

            // Start low-level hooks on a dedicated thread with a message pump.
            // WH_KEYBOARD_LL and WH_MOUSE_LL require the installing thread to
            // run a message loop — without it the OS never dispatches hook events.
            var hookReady = new ManualResetEventSlim(false);
            var hookThread = new Thread(() => RunHookMessageLoop(hookReady, ct))
            {
                IsBackground = true,
                Name = "HookMessagePump",
            };
            hookThread.Start();
            hookReady.Wait(TimeSpan.FromSeconds(5)); // wait until hooks are installed

            Logger.Info("Recording started — perform actions in the application...");

            // Poll for stop signal
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(2000, ct);
                var status = await _api.CheckRecordingStatus(_job.Id);
                if (status == "stopped" || status == "completed")
                {
                    Logger.Info("Recording stopped by user.");
                    break;
                }
            }

            // Signal the hook thread to exit its message loop
            if (_hookThreadId != 0)
                NativeMethods.PostThreadMessage(_hookThreadId, NativeMethods.WM_QUIT, IntPtr.Zero, IntPtr.Zero);

            hookThread.Join(TimeSpan.FromSeconds(3));
        }
        finally
        {
            // Flush any pending typing buffer
            await FlushTypingBuffer();

            _automation?.Dispose();
            Logger.Info($"Recording finished. {_stepCount} steps captured.");
        }
    }

    /// <summary>
    /// Runs on a dedicated thread: installs hooks, then pumps messages so
    /// the OS can deliver WH_KEYBOARD_LL / WH_MOUSE_LL callbacks.
    /// </summary>
    private void RunHookMessageLoop(ManualResetEventSlim ready, CancellationToken ct)
    {
        _hookThreadId = NativeMethods.GetCurrentThreadId();
        InstallInputHooks();
        ready.Set();

        // Standard Win32 message loop
        while (!ct.IsCancellationRequested)
        {
            if (NativeMethods.GetMessage(out var msg, IntPtr.Zero, 0, 0))
            {
                NativeMethods.TranslateMessage(ref msg);
                NativeMethods.DispatchMessage(ref msg);
            }
            else
            {
                break; // WM_QUIT received
            }
        }

        UninstallInputHooks();
        Logger.Debug("Hook message pump exited.");
    }

    #region Application Attachment

    private Application? AttachOrLaunch()
    {
        var path = _job.ApplicationPath;
        if (string.IsNullOrEmpty(path))
        {
            Logger.Warn("No application path — attempting to attach to foreground window.");
            return AttachToForeground();
        }

        try
        {
            var ext = System.IO.Path.GetExtension(path).ToLowerInvariant();
            bool isJava = ext is ".jar" or ".jnlp";

            if (isJava)
            {
                // For Java apps, the process name is "java" or "javaw", not the jar name.
                // Try to attach to an already-running Java process whose main window
                // title or command line hints at this JAR.
                var jarName = System.IO.Path.GetFileNameWithoutExtension(path);
                foreach (var procName in new[] { "javaw", "java" })
                {
                    var javaProcs = Process.GetProcessesByName(procName);
                    foreach (var jp in javaProcs)
                    {
                        try
                        {
                            if (jp.MainWindowHandle != IntPtr.Zero)
                            {
                                Logger.Info($"Attaching to Java process: {jp.ProcessName} (PID {jp.Id}, Window: {jp.MainWindowTitle})");
                                return Application.Attach(jp);
                            }
                        }
                        catch { }
                    }
                }

                // Not running yet — launch with java -jar
                var javaPath = FindJavaExecutable();
                Logger.Info($"Launching Java app: {javaPath} -jar \"{path}\"");
                var psi = new ProcessStartInfo(javaPath)
                {
                    Arguments = $"-jar \"{path}\"" + (string.IsNullOrEmpty(_job.ApplicationArgs) ? "" : " " + _job.ApplicationArgs),
                    UseShellExecute = false,
                };
                var proc = Process.Start(psi);
                if (proc == null) { Logger.Error("Failed to start Java process."); return null; }

                // Wait for a main window to appear
                for (int i = 0; i < 30; i++)
                {
                    Thread.Sleep(1000);
                    proc.Refresh();
                    if (proc.MainWindowHandle != IntPtr.Zero)
                        break;
                }
                return Application.Attach(proc);
            }

            // Non-Java: try attach by process name first
            var procs = Process.GetProcessesByName(
                System.IO.Path.GetFileNameWithoutExtension(path));
            if (procs.Length > 0)
            {
                Logger.Info($"Attaching to existing process: {procs[0].ProcessName} (PID {procs[0].Id})");
                return Application.Attach(procs[0]);
            }

            // Launch native executable
            Logger.Info($"Launching: {path}");
            var nativePsi = new ProcessStartInfo(path);
            if (!string.IsNullOrEmpty(_job.ApplicationArgs))
                nativePsi.Arguments = _job.ApplicationArgs;
            return Application.Launch(nativePsi);
        }
        catch (Exception ex)
        {
            Logger.Error($"Attach/launch failed: {ex.Message}");
            return null;
        }
    }

    private static string FindJavaExecutable()
    {
        var javaHome = Environment.GetEnvironmentVariable("JAVA_HOME");
        if (!string.IsNullOrEmpty(javaHome))
        {
            var candidate = System.IO.Path.Combine(javaHome, "bin", "javaw.exe");
            if (System.IO.File.Exists(candidate)) return candidate;
            candidate = System.IO.Path.Combine(javaHome, "bin", "java.exe");
            if (System.IO.File.Exists(candidate)) return candidate;
        }
        // Fall back to PATH
        return "javaw.exe";
    }

    private Application? AttachToForeground()
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        NativeMethods.GetWindowThreadProcessId(hwnd, out uint pid);
        if (pid == 0) return null;
        try { return Application.Attach((int)pid); }
        catch { return null; }
    }

    #endregion

    #region UIA Event Handlers

    private void InstallUiaHandlers()
    {
        if (_automation == null || _app == null) return;

        var desktop = _automation.GetDesktop();

        // Focus changed → detect click on elements
        _automation.RegisterFocusChangedEvent(OnFocusChanged);

        // Structure changed → detect window open/close
        try
        {
            desktop.RegisterStructureChangedEvent(
                FlaUI.Core.Definitions.TreeScope.Subtree,
                OnStructureChanged);
        }
        catch (Exception ex)
        {
            Logger.Debug($"Structure event registration skipped: {ex.Message}");
        }

        Logger.Debug("UIA event handlers installed.");
    }

    private async void OnFocusChanged(AutomationElement el)
    {
        try
        {
            if (!BelongsToTarget(el)) return;

            // Use the precise element captured at mouse-down point
            JabElementResult? jabElement;
            var targetEl = GetClickTargetElement(el, out jabElement);
            var elementId = GetElementIdentifier(targetEl);
            var now = DateTime.UtcNow;

            // --- Global debounce: ignore focus events that arrive too fast ---
            if ((now - _lastRecordedClickTime).TotalMilliseconds < ClickDebounceMsGlobal)
                return;

            // --- Same-element debounce: UIA often fires multiple FocusChanged
            //     events for a single physical click on the same element ---
            if (elementId == _lastRecordedClickElement
                && (now - _lastRecordedClickTime).TotalMilliseconds < ClickDebounceMsForSameElement)
                return;

            // Record at most one focus-derived click step per physical left mouse-down.
            if (!TryReserveRecentPrimaryMouseDown(now))
                return;

            // Flush typing when focus moves
            await FlushTypingBuffer();

            // Detect double-click: same element clicked within 500ms
            if (elementId == _lastClickElement && (now - _lastClickTime).TotalMilliseconds < 500)
            {
                _lastClickTime = now;
                _lastClickElement = elementId;
                _lastRecordedClickTime = now;
                _lastRecordedClickElement = elementId;
                await SendStep("double_click", targetEl, jabElement: jabElement);
                return;
            }

            _lastClickTime = now;
            _lastClickElement = elementId;
            _lastRecordedClickTime = now;
            _lastRecordedClickElement = elementId;

            await SendStep("click", targetEl, jabElement: jabElement);
        }
        catch (Exception ex)
        {
            Logger.Debug($"FocusChanged handler error: {ex.Message}");
        }
    }

    private async void OnStructureChanged(AutomationElement el, StructureChangeType changeType, int[] runtimeId)
    {
        try
        {
            if (changeType == StructureChangeType.ChildAdded)
            {
                var cType = el.ControlType;
                if (cType == ControlType.Window)
                {
                    await SendStep("window_switch", el, extraData: new JsonObject
                    {
                        ["windowTitle"] = el.Name,
                    });
                }
            }
        }
        catch { }
    }

    #endregion

    #region Low-Level Input Hooks

    private void InstallInputHooks()
    {
        _keyboardProc = KeyboardHookCallback;
        _mouseProc = MouseHookCallback;

        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule!;
        var moduleHandle = NativeMethods.GetModuleHandle(curModule.ModuleName);

        _keyboardHookId = NativeMethods.SetWindowsHookEx(
            NativeMethods.WH_KEYBOARD_LL, _keyboardProc, moduleHandle, 0);
        _mouseHookId = NativeMethods.SetWindowsHookEx(
            NativeMethods.WH_MOUSE_LL, _mouseProc, moduleHandle, 0);

        Logger.Debug("Low-level input hooks installed.");
    }

    private void UninstallInputHooks()
    {
        if (_keyboardHookId != IntPtr.Zero)
            NativeMethods.UnhookWindowsHookEx(_keyboardHookId);
        if (_mouseHookId != IntPtr.Zero)
            NativeMethods.UnhookWindowsHookEx(_mouseHookId);
        Logger.Debug("Input hooks uninstalled.");
    }

    private IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && !IsForegroundTargetApp())
            return NativeMethods.CallNextHookEx(_keyboardHookId, nCode, wParam, lParam);

        if (nCode >= 0)
        {
            int vkCode = Marshal.ReadInt32(lParam);
            var key = (ConsoleKey)vkCode;
            bool isKeyDown = wParam == (IntPtr)NativeMethods.WM_KEYDOWN
                          || wParam == (IntPtr)NativeMethods.WM_SYSKEYDOWN;
            bool isKeyUp = wParam == (IntPtr)NativeMethods.WM_KEYUP
                        || wParam == (IntPtr)NativeMethods.WM_SYSKEYUP;

            // Track modifier keys
            if (IsModifier(vkCode))
            {
                if (isKeyDown) _pressedModifiers.Add(vkCode);
                if (isKeyUp) _pressedModifiers.Remove(vkCode);
            }
            else if (isKeyDown)
            {
                if (_pressedModifiers.Count > 0)
                {
                    // This is a keyboard shortcut (e.g., Ctrl+S)
                    _ = HandleKeyboardShortcut(vkCode);
                }
                else if (IsPrintableKey(vkCode))
                {
                    // Accumulate typing
                    HandleTypingKey(vkCode);
                }
                else
                {
                    // Special key press (Enter, Tab, Escape, etc.)
                    _ = HandleSpecialKey(vkCode);
                }
            }
        }

        return NativeMethods.CallNextHookEx(_keyboardHookId, nCode, wParam, lParam);
    }

    private IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && IsForegroundTargetApp())
        {
            if (wParam == (IntPtr)NativeMethods.WM_LBUTTONDOWN)
            {
                MarkPrimaryMouseDown();
                // Capture element at cursor position for precise recording
                var hookStruct = Marshal.PtrToStructure<NativeMethods.MSLLHOOKSTRUCT>(lParam);
                CaptureElementAtPoint(hookStruct.pt.x, hookStruct.pt.y);
            }
            else if (wParam == (IntPtr)NativeMethods.WM_RBUTTONDOWN)
            {
                var hookStruct = Marshal.PtrToStructure<NativeMethods.MSLLHOOKSTRUCT>(lParam);
                CaptureElementAtPoint(hookStruct.pt.x, hookStruct.pt.y);
                _ = HandleRightClick();
            }
            else if (wParam == (IntPtr)NativeMethods.WM_MOUSEWHEEL)
            {
                var hookStruct = Marshal.PtrToStructure<NativeMethods.MSLLHOOKSTRUCT>(lParam);
                int delta = (short)(hookStruct.mouseData >> 16);
                _ = HandleScroll(delta);
            }
        }
        return NativeMethods.CallNextHookEx(_mouseHookId, nCode, wParam, lParam);
    }

    /// <summary>
    /// Resolves the precise UI element at screen coordinates using UIA FromPoint.
    /// For Java apps (where UIA only returns the SunAwtFrame window), also captures
    /// the actual JAB element at the click point using getAccessibleContextAt.
    /// </summary>
    private void CaptureElementAtPoint(int x, int y)
    {
        try
        {
            if (_automation == null) return;
            var point = new System.Drawing.Point(x, y);
            var element = _automation.FromPoint(point);
            if (element != null)
            {
                // Verify element belongs to our target app
                int pid = element.Properties.ProcessId.ValueOrDefault;
                if (pid == _targetPid)
                {
                    lock (_mouseDownElementLock)
                    {
                        _lastMouseDownElement = element;
                        _lastMouseDownElementTime = DateTime.UtcNow;
                        _lastMouseDownX = x;
                        _lastMouseDownY = y;
                        _lastMouseDownJabElement = null;

                        // For Java apps, UIA FromPoint often returns a container/window,
                        // so resolve the actual JAB element at click coordinates.
                        var hwnd = ResolveJavaWindowHandle(element);
                        bool isJavaWindow = IsLikelyJavaElement(element, hwnd);
                        if (isJavaWindow && _jabInitialized && hwnd != IntPtr.Zero)
                        {
                            var jabEl = TryFindJabElementNearPoint(hwnd, x, y);
                            if (jabEl != null)
                            {
                                _lastMouseDownJabElement = jabEl;
                                var jabName = jabEl.Info.name ?? "";
                                var jabRole = jabEl.Info.role_en_US ?? jabEl.Info.role ?? "";
                                Logger.Debug("JAB element at click point: name='" + jabName + "' role='" + jabRole + "'");
                            }
                            else
                            {
                                Logger.Debug("JAB element at click point not found; will try fallback enrichment at submit time.");
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Debug("FromPoint capture failed: " + ex.Message);
        }
    }

    /// <summary>
    /// Returns the element captured at mouse-down point if still within correlation window,
    /// otherwise falls back to the UIA focused element.
    /// Also returns any JAB element captured at that point via out parameter.
    /// </summary>
    private AutomationElement? GetClickTargetElement(AutomationElement? focusedElement, out JabElementResult? jabElement)
    {
        jabElement = null;
        lock (_mouseDownElementLock)
        {
            if (_lastMouseDownElement != null
                && (DateTime.UtcNow - _lastMouseDownElementTime).TotalMilliseconds < FocusToMouseCorrelationMs)
            {
                var captured = _lastMouseDownElement;
                jabElement = _lastMouseDownJabElement;
                _lastMouseDownElement = null; // consume once
                _lastMouseDownJabElement = null;
                return captured;
            }
        }
        return focusedElement;
    }

    #endregion

    #region Action Handlers

    private async Task HandleKeyboardShortcut(int vkCode)
    {
        await FlushTypingBuffer();
        var parts = new List<string>();
        if (_pressedModifiers.Contains(0xA2) || _pressedModifiers.Contains(0xA3)) parts.Add("Ctrl");
        if (_pressedModifiers.Contains(0xA0) || _pressedModifiers.Contains(0xA1)) parts.Add("Shift");
        if (_pressedModifiers.Contains(0xA4) || _pressedModifiers.Contains(0xA5)) parts.Add("Alt");
        parts.Add(((ConsoleKey)vkCode).ToString());

        var combo = string.Join("+", parts);
        Logger.Info($"Keyboard shortcut: {combo}");

        var focused = GetFocusedElement();
        await SendStep("keyboard_shortcut", focused, new JsonObject
        {
            ["value"] = combo,
        });
    }

    private async Task HandleSpecialKey(int vkCode)
    {
        await FlushTypingBuffer();
        var keyName = ((ConsoleKey)vkCode).ToString();
        Logger.Info($"Special key: {keyName}");

        var focused = GetFocusedElement();
        await SendStep("keyboard_shortcut", focused, new JsonObject
        {
            ["value"] = keyName,
        });
    }

    private void HandleTypingKey(int vkCode)
    {
        // Get the actual character using ToUnicode
        var buf = new StringBuilder(4);
        var keyState = new byte[256];
        NativeMethods.GetKeyboardState(keyState);
        int result = NativeMethods.ToUnicode((uint)vkCode, 0, keyState, buf, buf.Capacity, 0);
        if (result > 0)
        {
            var focused = GetFocusedElement();
            bool focusedIsWindowLike = IsWindowLikeElement(focused);

            // Java apps often keep focus on SunAwtFrame while user types in an inner control.
            // Reuse the last precise click target for a short interval to preserve unique selectors.
            if (focusedIsWindowLike
                && _lastInteractionElement != null
                && (DateTime.UtcNow - _lastInteractionTime).TotalMilliseconds < TypingTargetReuseMs)
            {
                focused = _lastInteractionElement;
                _typingJabElement = _lastInteractionJabElement;
            }
            else
            {
                _typingJabElement = null;
            }

            _typingElement = focused;
            _typingBuffer += buf.ToString();
            _lastTypeTime = DateTime.UtcNow;

            // Schedule flush after 1s of inactivity
            _ = Task.Run(async () =>
            {
                await Task.Delay(1000);
                if ((DateTime.UtcNow - _lastTypeTime).TotalMilliseconds >= 900)
                    await FlushTypingBuffer();
            });
        }
    }

    private async Task FlushTypingBuffer()
    {
        if (string.IsNullOrEmpty(_typingBuffer)) return;

        var text = _typingBuffer;
        var el = _typingElement;
        var jabEl = _typingJabElement;
        _typingBuffer = "";
        _typingElement = null;
        _typingJabElement = null;

        Logger.Info($"Typed: \"{text}\"");
        await SendStep("type", el, new JsonObject { ["value"] = text }, jabElement: jabEl);
    }

    private async Task HandleRightClick()
    {
        await FlushTypingBuffer();
        // Use element captured at mouse-down point for precise targeting
        JabElementResult? jabElement;
        var targetEl = GetClickTargetElement(GetFocusedElement(), out jabElement);
        Logger.Info("Right-click detected.");
        await SendStep("right_click", targetEl, jabElement: jabElement);
    }

    private async Task HandleScroll(int delta)
    {
        var focused = GetFocusedElement();
        await SendStep("scroll", focused, new JsonObject
        {
            ["value"] = delta > 0 ? "up" : "down",
            ["scrollDelta"] = delta,
        });
    }

    #endregion

    #region Helpers

    private bool BelongsToTarget(AutomationElement el)
    {
        try
        {
            int pid = el.Properties.ProcessId.ValueOrDefault;
            return pid == _targetPid;
        }
        catch { return false; }
    }

    private bool IsForegroundTargetApp()
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        NativeMethods.GetWindowThreadProcessId(hwnd, out uint pid);
        return (int)pid == _targetPid;
    }

    private void MarkPrimaryMouseDown()
    {
        Interlocked.Exchange(ref _lastPrimaryMouseDownTicks, DateTime.UtcNow.Ticks);
        Interlocked.Increment(ref _mouseDownSequence);
    }

    private bool TryReserveRecentPrimaryMouseDown(DateTime now)
    {
        var ticks = Interlocked.Read(ref _lastPrimaryMouseDownTicks);
        if (ticks <= 0) return false;

        var elapsedMs = (now - new DateTime(ticks, DateTimeKind.Utc)).TotalMilliseconds;
        if (!(elapsedMs >= 0 && elapsedMs <= FocusToMouseCorrelationMs))
            return false;

        var currentSequence = Interlocked.Read(ref _mouseDownSequence);
        if (currentSequence <= 0) return false;

        while (true)
        {
            var consumedSequence = Interlocked.Read(ref _lastConsumedMouseDownSequence);
            if (currentSequence <= consumedSequence)
                return false;

            var previous = Interlocked.CompareExchange(
                ref _lastConsumedMouseDownSequence,
                currentSequence,
                consumedSequence);

            if (previous == consumedSequence)
                return true;
        }
    }

    private AutomationElement? GetFocusedElement()
    {
        try { return _automation?.FocusedElement(); }
        catch { return null; }
    }

    private static bool IsWindowLikeElement(AutomationElement? el)
    {
        if (el == null) return false;
        try
        {
            if (el.ControlType == ControlType.Window) return true;
            var cls = el.Properties.ClassName.ValueOrDefault ?? "";
            return IsLikelyJavaClass(cls);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsLikelyJavaClass(string className)
    {
        return className == "SunAwtFrame" || className == "SunAwtDialog"
            || className == "SunAwtCanvas" || className.StartsWith("SunAwt", StringComparison.Ordinal);
    }

    private bool IsLikelyJavaElement(AutomationElement? el, IntPtr hwnd)
    {
        if (el != null)
        {
            try
            {
                var cls = el.Properties.ClassName.ValueOrDefault ?? "";
                if (IsLikelyJavaClass(cls)) return true;
            }
            catch { }
        }

        if (!_jabInitialized || hwnd == IntPtr.Zero) return false;

        try { return JavaAccessBridge.IsJavaWindow(hwnd); }
        catch { return false; }
    }

    private IntPtr ResolveJavaWindowHandle(AutomationElement? el)
    {
        IntPtr hwnd = IntPtr.Zero;

        if (el != null)
        {
            try
            {
                nint nativeHwnd = el.Properties.NativeWindowHandle.ValueOrDefault;
                if (nativeHwnd != 0)
                    hwnd = (IntPtr)nativeHwnd;
            }
            catch { }
        }

        if (hwnd == IntPtr.Zero)
            hwnd = NativeMethods.GetForegroundWindow();

        if (hwnd != IntPtr.Zero)
        {
            try
            {
                var root = NativeMethods.GetAncestor(hwnd, NativeMethods.GA_ROOT);
                if (root != IntPtr.Zero)
                    hwnd = root;
            }
            catch { }
        }

        return hwnd;
    }

    private JabElementResult? TryFindJabElementNearPoint(IntPtr hwnd, int screenX, int screenY)
    {
        if (!_jabInitialized || hwnd == IntPtr.Zero || screenX < 0 || screenY < 0)
            return null;

        var points = new List<(int x, int y)>();
        AddPointCandidates(points, screenX, screenY);

        if (NativeMethods.GetWindowRect(hwnd, out var rect))
        {
            int localX = screenX - rect.Left;
            int localY = screenY - rect.Top;
            if (localX >= 0 && localY >= 0)
                AddPointCandidates(points, localX, localY);
        }

        foreach (var (x, y) in points)
        {
            if (x < 0 || y < 0) continue;
            var jabElement = JavaAccessBridge.FindElementAtPoint(hwnd, x, y);
            if (IsUsableJabTarget(jabElement))
                return jabElement;
        }

        return null;
    }

    private static void AddPointCandidates(List<(int x, int y)> points, int x, int y)
    {
        var offsets = new (int dx, int dy)[]
        {
            (0, 0),
            (-3, 0), (3, 0), (0, -3), (0, 3),
            (-6, 0), (6, 0), (0, -6), (0, 6),
            (-10, 0), (10, 0), (0, -10), (0, 10),
            (-6, -6), (-6, 6), (6, -6), (6, 6),
            (-10, -10), (-10, 10), (10, -10), (10, 10),
        };

        foreach (var (dx, dy) in offsets)
            points.Add((x + dx, y + dy));
    }

    private static bool IsUsableJabTarget(JabElementResult? jabElement)
    {
        if (jabElement == null) return false;
        var role = jabElement.Info.role_en_US ?? jabElement.Info.role ?? "";
        return !IsGenericJabContainerRole(role);
    }

    private static bool IsGenericJabContainerRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return true;

        var normalized = role.Trim().ToLowerInvariant();
        return normalized == "frame"
            || normalized == "dialog"
            || normalized == "window"
            || normalized == "root pane"
            || normalized == "layered pane"
            || normalized == "panel"
            || normalized == "glass pane"
            || normalized == "content pane"
            || normalized == "scroll pane"
            || normalized == "viewport";
    }

    private string GetElementIdentifier(AutomationElement? el)
    {
        if (el == null) return "";
        var aid = el.Properties.AutomationId.ValueOrDefault ?? "";
        var name = el.Properties.Name.ValueOrDefault ?? "";
        var cls = el.Properties.ClassName.ValueOrDefault ?? "";
        return aid + "|" + name + "|" + cls;
    }

    private JsonObject BuildStepJson(string action, AutomationElement? el)
    {
        var step = new JsonObject { ["action"] = action };
        if (el != null)
        {
            var automationId = el.Properties.AutomationId.ValueOrDefault ?? "";
            var name = el.Properties.Name.ValueOrDefault ?? "";
            var controlType = el.ControlType.ToString();
            var className = el.Properties.ClassName.ValueOrDefault ?? "";

            step["target"] = new JsonObject
            {
                ["automationId"] = automationId,
                ["label"] = name,
                ["controlType"] = controlType,
                ["classHint"] = className,
            };

            // --- OR-compatible enriched metadata ---
            var orMeta = new JsonObject();

            // Framework ID (WPF, WinForm, Win32, etc.)
            try
            {
                var fwId = el.Properties.FrameworkId.ValueOrDefault;
                if (!string.IsNullOrEmpty(fwId))
                    orMeta["frameworkId"] = fwId;
            }
            catch { }

            // Bounding rectangle for visual positioning
            try
            {
                var rect = el.BoundingRectangle;
                if (!rect.IsEmpty)
                {
                    orMeta["boundingRectangle"] = new JsonObject
                    {
                        ["x"] = rect.X,
                        ["y"] = rect.Y,
                        ["width"] = rect.Width,
                        ["height"] = rect.Height,
                    };
                }
            }
            catch { }

            // Item type/status for richer OR descriptors
            try
            {
                var itemType = el.Properties.ItemType.ValueOrDefault;
                if (!string.IsNullOrEmpty(itemType))
                    orMeta["itemType"] = itemType;
            }
            catch { }

            // Is element enabled / keyboard focusable
            try
            {
                orMeta["isEnabled"] = el.Properties.IsEnabled.ValueOrDefault;
                orMeta["isKeyboardFocusable"] = el.Properties.IsKeyboardFocusable.ValueOrDefault;
            }
            catch { }

            // Build hierarchy path for OR tree context
            // Format: Window > Pane > Group > Button (up to 6 levels)
            try
            {
                var hierarchyParts = new List<string>();
                var current = el.Parent;
                int maxDepth = 6;
                while (current != null && maxDepth > 0)
                {
                    var ct = current.ControlType.ToString();
                    var cn = current.Properties.Name.ValueOrDefault ?? "";
                    var cId = current.Properties.AutomationId.ValueOrDefault ?? "";

                    var segment = ct;
                    if (!string.IsNullOrEmpty(cn))
                        segment += "['" + cn + "']";
                    else if (!string.IsNullOrEmpty(cId))
                        segment += "['" + cId + "']";

                    hierarchyParts.Add(segment);

                    if (current.ControlType == ControlType.Window)
                        break;

                    current = current.Parent;
                    maxDepth--;
                }

                if (hierarchyParts.Count > 0)
                {
                    hierarchyParts.Reverse();
                    orMeta["hierarchyPath"] = string.Join(" > ", hierarchyParts) + " > " + controlType;
                }
            }
            catch { }

            // Parent window title
            try
            {
                var parent = el.Parent;
                while (parent != null)
                {
                    if (parent.ControlType == ControlType.Window)
                    {
                        step["target"]!.AsObject()["parentWindow"] = parent.Name;
                        break;
                    }
                    parent = parent.Parent;
                }
            }
            catch { }

            // UIA patterns supported (for OR validation)
            try
            {
                var patterns = new JsonArray();
                if (el.Patterns.Invoke.IsSupported) patterns.Add("Invoke");
                if (el.Patterns.Value.IsSupported) patterns.Add("Value");
                if (el.Patterns.Toggle.IsSupported) patterns.Add("Toggle");
                if (el.Patterns.Selection.IsSupported) patterns.Add("Selection");
                if (el.Patterns.SelectionItem.IsSupported) patterns.Add("SelectionItem");
                if (el.Patterns.ExpandCollapse.IsSupported) patterns.Add("ExpandCollapse");
                if (el.Patterns.Scroll.IsSupported) patterns.Add("Scroll");
                if (el.Patterns.Text.IsSupported) patterns.Add("Text");
                if (patterns.Count > 0)
                    orMeta["supportedPatterns"] = patterns;
            }
            catch { }

            // Current value for Value-pattern elements (edit boxes, combos)
            try
            {
                if (el.Patterns.Value.IsSupported)
                {
                    var val = el.Patterns.Value.Pattern.Value.ValueOrDefault;
                    if (!string.IsNullOrEmpty(val))
                        orMeta["currentValue"] = val;
                }
            }
            catch { }

            // Toggle state for checkboxes/toggle buttons
            try
            {
                if (el.Patterns.Toggle.IsSupported)
                    orMeta["toggleState"] = el.Patterns.Toggle.Pattern.ToggleState.ValueOrDefault.ToString();
            }
            catch { }

            if (orMeta.Count > 0)
                step["orMetadata"] = orMeta;

            // --- Vision-based screenshot capture for hybrid/vision modes ---
            // Only capture here for non-window UIA elements. For window-level targets
            // (e.g. SunAwtFrame), SendStep handles capture using JAB bounds or click-point.
            if (IsVisionModeEnabled() && controlType != "Window")
            {
                var elCls = el.Properties.ClassName.ValueOrDefault ?? "";
                bool isJavaWindow2 = elCls == "SunAwtFrame" || elCls == "SunAwtDialog"
                    || elCls == "SunAwtCanvas" || elCls.StartsWith("SunAwt");
                if (!isJavaWindow2)
                {
                    try
                    {
                        var rect = el.BoundingRectangle;
                        if (!rect.IsEmpty && rect.Width > 0 && rect.Height > 0)
                        {
                            CaptureVisionScreenshotFromBounds(step, (int)rect.X, (int)rect.Y,
                                (int)rect.Width, (int)rect.Height, name);
                        }
                    }
                    catch (Exception vex)
                    {
                        Logger.Debug("Vision screenshot capture failed: " + vex.Message);
                    }
                }
            }

            // Enrich with JAB metadata for Java windows.
            // For Window-level UIA targets we skip broad name-based JAB lookup to avoid
            // generating identical selectors for every step.
            if (_jabInitialized)
            {
                try
                {
                    var hwnd = NativeMethods.GetForegroundWindow();
                    if (JavaAccessBridge.IsJavaWindow(hwnd))
                    {
                        bool isWindowTarget = controlType == "Window";
                        if (!isWindowTarget)
                        {
                            var label = el.Properties.Name.ValueOrDefault ?? "";
                            var jabResult = JavaAccessBridge.FindElementInWindow(hwnd, label, null, null, 10);
                            if (jabResult != null)
                                ApplyJabMetadataToStep(step, jabResult.Info, overrideTarget: false, jabResult);
                        }

                        // Build window selector: <wnd app='java*.exe' cls='SunAwtFrame' title='...' />
                        try
                        {
                            var winTitle = step["target"]?["parentWindow"]?.GetValue<string>() ?? "";
                            if (string.IsNullOrEmpty(winTitle))
                                winTitle = el.Properties.Name.ValueOrDefault ?? "";
                            step["windowSelector"] = BuildWindowSelector(hwnd, className, winTitle, useWildcardForProcess: true);
                        }
                        catch (Exception wex)
                        {
                            Logger.Debug("Window selector build skipped: " + wex.Message);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Logger.Debug("JAB enrichment skipped: " + ex.Message);
                }
            }

            // Build window selector for non-Java or when JAB enrichment did not set it.
            if (step["windowSelector"] == null)
            {
                try
                {
                    var winHwnd = NativeMethods.GetForegroundWindow();
                    NativeMethods.GetWindowThreadProcessId(winHwnd, out uint winPid2);
                    if ((int)winPid2 == _targetPid)
                    {
                        var winTitle2 = step["target"]?["parentWindow"]?.GetValue<string>() ?? "";
                        if (string.IsNullOrEmpty(winTitle2))
                            winTitle2 = el.Properties.Name.ValueOrDefault ?? "";
                        step["windowSelector"] = BuildWindowSelector(winHwnd, className, winTitle2, useWildcardForProcess: false);
                    }
                }
                catch { }
            }
        }
        return step;
    }

    private async Task SendStep(string action, AutomationElement? el, JsonObject? extraData = null, JabElementResult? jabElement = null)
    {
        var step = BuildStepJson(action, el);
        var effectiveJabElement = TryResolveJabElementForStep(action, step, el, jabElement);

        // Track last precise interaction target so typing can reuse it when Java focus stays on window.
        if (el != null || effectiveJabElement != null)
        {
            _lastInteractionElement = el;
            _lastInteractionJabElement = effectiveJabElement;
            _lastInteractionTime = DateTime.UtcNow;
        }

        if (effectiveJabElement != null)
        {
            ApplyJabMetadataToStep(step, effectiveJabElement.Info, overrideTarget: true, effectiveJabElement);
            var jabName = effectiveJabElement.Info.name ?? "";
            var jabRole = effectiveJabElement.Info.role_en_US ?? effectiveJabElement.Info.role ?? "";
            Logger.Info("JAB enriched step target: name='" + jabName + "' role='" + jabRole + "'");
        }

        if (extraData != null)
        {
            foreach (var kv in extraData)
                step[kv.Key] = kv.Value?.DeepClone();
        }

        EnsureJabSelectorFallback(step, el);
        EnsureVisionCapture(step, el, effectiveJabElement);

        // Final safety net: ensure automationId is never empty
        EnsureAutomationId(step, el);

        await SubmitStep(step);
    }

    private JabElementResult? TryResolveJabElementForStep(string action, JsonObject step, AutomationElement? el, JabElementResult? capturedJabElement)
    {
        if (!_jabInitialized) return capturedJabElement;
        if (capturedJabElement != null) return capturedJabElement;

        // Typing immediately after a click in Java apps often keeps UIA focus on the window.
        if (action == "type" && _lastInteractionJabElement != null
            && (DateTime.UtcNow - _lastInteractionTime).TotalMilliseconds < TypingTargetReuseMs)
        {
            return _lastInteractionJabElement;
        }

        var hwnd = ResolveJavaWindowHandle(el);
        if (hwnd == IntPtr.Zero || !IsLikelyJavaElement(el, hwnd))
            return null;

        // Primary fallback: point-based JAB capture from the last click location.
        if (_lastMouseDownX > 0 && _lastMouseDownY > 0)
        {
            var atPoint = TryFindJabElementNearPoint(hwnd, _lastMouseDownX, _lastMouseDownY);
            if (atPoint != null)
                return atPoint;
        }

        var target = step["target"]?.AsObject();
        if (target == null) return null;

        var label = target["label"]?.GetValue<string>() ?? "";
        var role = target["classHint"]?.GetValue<string>() ?? "";
        var automationId = target["automationId"]?.GetValue<string>() ?? "";
        var controlType = target["controlType"]?.GetValue<string>() ?? "";

        // Avoid broad window/container lookups that create non-actionable selectors.
        if (controlType == "Window")
            return null;

        if (IsLikelyJavaClass(role) || IsGenericJabContainerRole(role))
            return null;

        if (string.IsNullOrWhiteSpace(label) && string.IsNullOrWhiteSpace(role) && string.IsNullOrWhiteSpace(automationId))
            return null;

        var resolved = JavaAccessBridge.FindElementInWindow(hwnd, label, role, automationId, 10);
        if (!IsUsableJabTarget(resolved))
            return null;

        return resolved;
    }

    private void EnsureJabSelectorFallback(JsonObject step, AutomationElement? el)
    {
        if (step["jabSelector"] != null || !_jabInitialized)
            return;

        var hwnd = ResolveJavaWindowHandle(el);
        if (hwnd == IntPtr.Zero || !IsLikelyJavaElement(el, hwnd))
            return;

        // One final precise lookup before generating any fallback selector.
        if (_lastMouseDownX > 0 && _lastMouseDownY > 0)
        {
            var precise = TryFindJabElementNearPoint(hwnd, _lastMouseDownX, _lastMouseDownY);
            if (precise != null)
            {
                ApplyJabMetadataToStep(step, precise.Info, overrideTarget: true, precise);
                return;
            }
        }

        var target = step["target"]?.AsObject();
        var controlType = target?["controlType"]?.GetValue<string>() ?? "";
        if (controlType == "Window")
        {
            Logger.Debug("Skipping JAB fallback selector for window-level Java target.");
            return;
        }

        var label = target?["label"]?.GetValue<string>() ?? "";
        var role = step["jabRole"]?.GetValue<string>()
            ?? target?["classHint"]?.GetValue<string>()
            ?? "Custom";
        var parentWindow = target?["parentWindow"]?.GetValue<string>() ?? "";

        if (!string.IsNullOrWhiteSpace(parentWindow)
            && string.Equals(label, parentWindow, StringComparison.OrdinalIgnoreCase))
        {
            label = "";
        }

        // Do not generate generic container selectors like SunAwtFrame.
        if (IsLikelyJavaClass(role) || IsGenericJabContainerRole(role))
        {
            Logger.Debug("Skipping generic JAB fallback selector role='" + role + "'.");
            return;
        }

        if (string.IsNullOrWhiteSpace(label)
            && (string.IsNullOrWhiteSpace(role) || string.Equals(role, "Custom", StringComparison.OrdinalIgnoreCase)))
        {
            Logger.Debug("Skipping weak JAB fallback selector due to missing actionable attributes.");
            return;
        }

        var normalizedRole = NormalizeJabRoleToken(role);
        if (string.IsNullOrWhiteSpace(normalizedRole))
            normalizedRole = "custom";

        if (!string.IsNullOrWhiteSpace(label))
        {
            step["jabSelector"] = $"> {normalizedRole}[Name=\"{EscapeJabPathValue(label)}\"]";
        }
        else
        {
            step["jabSelector"] = $"> {normalizedRole}";
        }
    }

    private bool IsVisionModeEnabled()
    {
        return _engineMode == "hybrid" || _engineMode == "vision";
    }

    private static bool StepHasVisionScreenshot(JsonObject step)
    {
        var visionScreenshot = step["visionScreenshot"]?.GetValue<string>();
        return !string.IsNullOrEmpty(visionScreenshot);
    }

    private void EnsureVisionCapture(JsonObject step, AutomationElement? el, JabElementResult? jabElement)
    {
        if (!IsVisionModeEnabled() || StepHasVisionScreenshot(step))
            return;

        if (jabElement != null && jabElement.Info.width > 0 && jabElement.Info.height > 0)
        {
            var jabName = jabElement.Info.name ?? "jab-target";
            CaptureVisionScreenshotFromBounds(step, jabElement.Info.x, jabElement.Info.y,
                jabElement.Info.width, jabElement.Info.height, jabName);
            if (StepHasVisionScreenshot(step))
                return;
        }

        if (el != null)
        {
            try
            {
                var rect = el.BoundingRectangle;
                if (!rect.IsEmpty && rect.Width > 0 && rect.Height > 0)
                {
                    var elementName = el.Properties.Name.ValueOrDefault ?? "target";
                    CaptureVisionScreenshotFromBounds(step, (int)rect.X, (int)rect.Y,
                        (int)rect.Width, (int)rect.Height, elementName);
                    if (StepHasVisionScreenshot(step))
                        return;
                }
            }
            catch (Exception vex)
            {
                Logger.Debug("Vision fallback capture (UIA bounds) failed: " + vex.Message);
            }
        }

        if (_lastMouseDownX > 0 && _lastMouseDownY > 0)
        {
            CaptureVisionScreenshotFromBounds(step, _lastMouseDownX - 20, _lastMouseDownY - 20,
                40, 40, "click-point");
        }
    }

    private static string EscapeSelectorValue(string input)
    {
        return input.Replace("'", "&apos;");
    }

    private static string EscapeJabPathValue(string input)
    {
        return input.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    private static string NormalizeJabRoleToken(string role)
    {
        if (string.IsNullOrWhiteSpace(role)) return "";
        return role.Trim().ToLowerInvariant().Replace("-", "_").Replace(" ", "_");
    }

    private static string BuildFallbackJabPathSelector(JavaAccessBridge.AccessibleContextInfo info)
    {
        var role = NormalizeJabRoleToken(info.role_en_US ?? info.role ?? "");
        if (string.IsNullOrWhiteSpace(role))
            role = "custom";

        var name = (info.name ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(name))
            return $"> {role}[Name=\"{EscapeJabPathValue(name)}\"]";

        return $"> {role}";
    }

    private static string? TryBuildJabHierarchySelector(JabElementResult? jabElement)
    {
        if (jabElement == null) return null;

        try
        {
            return JavaAccessBridge.BuildSelectorPath(jabElement.VmID, jabElement.Ac);
        }
        catch (Exception ex)
        {
            Logger.Debug("Failed to build hierarchical JAB selector: " + ex.Message);
            return null;
        }
    }

    private static string BuildJabSelector(JavaAccessBridge.AccessibleContextInfo info)
    {
        var parts = new List<string>();
        var name = info.name ?? "";
        var role = info.role_en_US ?? info.role ?? "";
        var description = info.description ?? "";

        if (!string.IsNullOrEmpty(name))
            parts.Add("name='" + EscapeSelectorValue(name) + "'");
        if (!string.IsNullOrEmpty(role))
            parts.Add("role='" + EscapeSelectorValue(role) + "'");
        if (!string.IsNullOrEmpty(description))
            parts.Add("description='" + EscapeSelectorValue(description) + "'");

        if (info.indexInParent >= 0)
            parts.Add("index='" + info.indexInParent + "'");

        if (parts.Count == 0) return "";
        return "<java " + string.Join(" ", parts) + " />";
    }

    private static string BuildWindowSelector(IntPtr hwnd, string className, string windowTitle, bool useWildcardForProcess)
    {
        NativeMethods.GetWindowThreadProcessId(hwnd, out uint winPid);
        var proc = Process.GetProcessById((int)winPid);
        var procName = proc.ProcessName ?? "";
        var appPattern = procName + (useWildcardForProcess ? "*.exe" : ".exe");

        var parts = new List<string>();
        parts.Add("app='" + EscapeSelectorValue(appPattern) + "'");
        if (!string.IsNullOrEmpty(className))
            parts.Add("cls='" + EscapeSelectorValue(className) + "'");
        if (!string.IsNullOrEmpty(windowTitle))
            parts.Add("title='" + EscapeSelectorValue(windowTitle) + "'");

        return "<wnd " + string.Join(" ", parts) + " />";
    }

    private static void ApplyJabMetadataToStep(JsonObject step, JavaAccessBridge.AccessibleContextInfo info, bool overrideTarget, JabElementResult? jabElement = null)
    {
        var jabRole = info.role_en_US ?? info.role ?? "";
        var jabName = info.name ?? "";
        var jabDescription = info.description ?? "";
        var jabStates = info.states_en_US ?? info.states ?? "";

        step["jabRole"] = jabRole;
        step["jabDescription"] = jabDescription;
        step["jabStates"] = jabStates;

        var target = step["target"]?.AsObject();
        if (target != null)
        {
            var currentAutomationId = target["automationId"]?.GetValue<string>() ?? "";
            var originalLabel = target["label"]?.GetValue<string>() ?? "";
            var originalControl = target["controlType"]?.GetValue<string>() ?? "";

            if (overrideTarget)
            {
                if (originalControl == "Window" && !string.IsNullOrEmpty(originalLabel))
                    target["parentWindow"] = originalLabel;

                if (!string.IsNullOrEmpty(jabName))
                    target["label"] = jabName;

                target["controlType"] = MapJabRoleToControlType(jabRole);
            }

            if (!string.IsNullOrEmpty(jabRole))
                target["classHint"] = jabRole;

            if (string.IsNullOrEmpty(currentAutomationId))
            {
                if (!string.IsNullOrEmpty(jabDescription))
                {
                    target["automationId"] = jabDescription;
                }
                else
                {
                    target["automationId"] = GenerateJabAutomationId(jabName, jabRole, info.indexInParent);
                }
            }
        }

        var selector = TryBuildJabHierarchySelector(jabElement);
        if (string.IsNullOrWhiteSpace(selector))
            selector = BuildFallbackJabPathSelector(info);
        if (string.IsNullOrWhiteSpace(selector))
            selector = BuildJabSelector(info);

        if (!string.IsNullOrWhiteSpace(selector))
            step["jabSelector"] = selector;
    }

    /// <summary>
    /// Generates a stable automationId from JAB metadata when neither UIA nor JAB description provides one.
    /// Format: "jab_{role}_{name}_{index}" — e.g. "jab_push_button_Login_2"
    /// </summary>
    private static string GenerateJabAutomationId(string name, string role, int indexInParent)
    {
        var parts = new List<string> { "jab" };
        if (!string.IsNullOrWhiteSpace(role))
            parts.Add(role.Trim().Replace(' ', '_').ToLowerInvariant());
        if (!string.IsNullOrWhiteSpace(name))
            parts.Add(name.Trim().Replace(' ', '_'));
        if (indexInParent >= 0)
            parts.Add(indexInParent.ToString());

        var id = string.Join("_", parts);
        return parts.Count > 1 ? id : "";
    }

    /// <summary>
    /// Final safety net: ensures every step has a non-empty automationId.
    /// Uses UIA RuntimeId, or synthesizes from controlType + label + className.
    /// </summary>
    private static void EnsureAutomationId(JsonObject step, AutomationElement? el)
    {
        var target = step["target"]?.AsObject();
        if (target == null) return;

        var currentId = target["automationId"]?.GetValue<string>() ?? "";
        if (!string.IsNullOrEmpty(currentId)) return;

        // Try UIA RuntimeId as fallback
        if (el != null)
        {
            try
            {
                var runtimeId = el.Properties.RuntimeId.ValueOrDefault;
                if (runtimeId != null && runtimeId.Length > 0)
                {
                    target["automationId"] = "rt_" + string.Join(".", runtimeId);
                    return;
                }
            }
            catch { }
        }

        // Synthesize from available step properties
        var label = target["label"]?.GetValue<string>() ?? "";
        var controlType = target["controlType"]?.GetValue<string>() ?? "";
        var classHint = target["classHint"]?.GetValue<string>() ?? "";

        var synthParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(controlType))
            synthParts.Add(controlType);
        if (!string.IsNullOrWhiteSpace(label))
            synthParts.Add(label.Trim().Replace(' ', '_'));
        else if (!string.IsNullOrWhiteSpace(classHint))
            synthParts.Add(classHint.Trim().Replace(' ', '_'));

        if (synthParts.Count > 0)
            target["automationId"] = string.Join("_", synthParts);
    }


    private static string MapJabRoleToControlType(string jabRole)
    {
        if (string.IsNullOrEmpty(jabRole)) return "Custom";
        var role = jabRole.ToLowerInvariant();
        if (role == "push button" || role == "toggle button") return "Button";
        if (role == "text") return "Edit";
        if (role == "password text") return "Edit";
        if (role == "combo box") return "ComboBox";
        if (role == "check box") return "CheckBox";
        if (role == "radio button") return "RadioButton";
        if (role == "list") return "List";
        if (role == "list item") return "ListItem";
        if (role == "tree") return "Tree";
        if (role == "tree node") return "TreeItem";
        if (role == "menu") return "Menu";
        if (role == "menu item") return "MenuItem";
        if (role == "tab") return "TabItem";
        if (role == "table") return "DataGrid";
        if (role == "label") return "Text";
        if (role == "panel" || role == "scroll pane") return "Pane";
        return "Custom";
    }

    /// <summary>
    /// Captures a padded screenshot of a UI element's bounding rectangle and stores
    /// it as a base64 PNG in visionScreenshot + visionBounds on the step JSON.
    /// Used in hybrid/vision modes for fallback visual matching during execution.
    /// </summary>
    private static void CaptureVisionScreenshotFromBounds(JsonObject step, int elX, int elY, int elW, int elH, string label)
    {
        try
        {
            if (elW <= 0 || elH <= 0) return;

            int pad = 8;
            int cx = Math.Max(0, elX - pad);
            int cy = Math.Max(0, elY - pad);
            int cw = elW + pad * 2;
            int ch = elH + pad * 2;

            using var bmp = new System.Drawing.Bitmap(cw, ch);
            using (var g = System.Drawing.Graphics.FromImage(bmp))
            {
                g.CopyFromScreen(cx, cy, 0, 0, new System.Drawing.Size(cw, ch));
            }
            using var ms = new System.IO.MemoryStream();
            bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
            var base64 = Convert.ToBase64String(ms.ToArray());
            step["visionScreenshot"] = "data:image/png;base64," + base64;
            step["visionBounds"] = new JsonObject
            {
                ["x"] = cx, ["y"] = cy,
                ["width"] = cw, ["height"] = ch,
            };
            Logger.Debug("Vision screenshot captured for element: " + label + " (" + cw + "x" + ch + ")");
        }
        catch (Exception vex)
        {
            Logger.Debug("Vision screenshot capture failed: " + vex.Message);
        }
    }

    private async Task SubmitStep(JsonObject step)
    {
        if (IsDuplicateStep(step))
        {
            Logger.Debug($"Duplicate step suppressed: {step["action"]}");
            return;
        }

        _stepCount++;
        try
        {
            await _api.SubmitRecordStep(_job.Id, step);
            TrackSubmittedStep(step);
            Logger.Debug($"Step #{_stepCount} sent: {step["action"]}");
        }
        catch (Exception ex)
        {
            Logger.Error($"Failed to send step: {ex.Message}");
        }

        // Dual-write to local sink (standalone recorder UI)
        try { _sink?.OnStepCaptured(step); }
        catch (Exception ex) { Logger.Debug($"Local sink error: {ex.Message}"); }
    }

    private bool IsDuplicateStep(JsonObject step)
    {
        var action = step["action"]?.GetValue<string>() ?? "";
        if (!IsClickLikeAction(action)) return false;

        var signature = BuildStepSignature(step);
        var now = DateTime.UtcNow;
        return signature == _lastSubmittedStepSignature
            && (now - _lastSubmittedStepTime).TotalMilliseconds < SubmitDuplicateDebounceMs;
    }

    private void TrackSubmittedStep(JsonObject step)
    {
        _lastSubmittedStepSignature = BuildStepSignature(step);
        _lastSubmittedStepTime = DateTime.UtcNow;
    }

    private static bool IsClickLikeAction(string action)
    {
        return action == "click"
            || action == "double_click"
            || action == "right_click"
            || action == "window_switch";
    }

    private static string BuildStepSignature(JsonObject step)
    {
        var action = step["action"]?.GetValue<string>() ?? "";
        var target = step["target"]?.AsObject();

        var automationId = target?["automationId"]?.GetValue<string>() ?? "";
        var label = target?["label"]?.GetValue<string>() ?? "";
        var controlType = target?["controlType"]?.GetValue<string>() ?? "";
        var classHint = target?["classHint"]?.GetValue<string>() ?? "";
        var parentWindow = target?["parentWindow"]?.GetValue<string>() ?? "";

        var value = step["value"]?.GetValue<string>() ?? "";

        return $"{action}|{automationId}|{label}|{controlType}|{classHint}|{parentWindow}|{value}";
    }

    private static bool IsModifier(int vk) =>
        vk is >= 0xA0 and <= 0xA5 or 0x5B or 0x5C; // Shift, Ctrl, Alt, Win

    private static bool IsPrintableKey(int vk) =>
        (vk >= 0x30 && vk <= 0x39) // 0-9
        || (vk >= 0x41 && vk <= 0x5A) // A-Z
        || (vk >= 0xBA && vk <= 0xC0) // ;=,-./`
        || (vk >= 0xDB && vk <= 0xDE) // [\]'
        || vk == 0x20; // Space

    #endregion
}
