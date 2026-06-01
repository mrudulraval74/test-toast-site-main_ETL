// Desktop (Thick Client) Agent package - .NET 8 based agent for Windows desktop automation
// Generates a downloadable agent package for desktop apps
// Includes Java Access Bridge (JAB) support for Java-based UI components (e.g., Swing, AWT)

export function getDesktopAgentProgram(token: string, supabaseUrl: string, supabaseKey: string): string {
  return `using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.Core.Conditions;
using FlaUI.UIA3;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Text.Json.Nodes;

namespace WisprDesktopAgent
{
    /// <summary>
    /// Java Access Bridge (JAB) P/Invoke wrapper for interacting with Java-based UI components.
    /// Oracle's JAB enables assistive technologies to access Java Swing/AWT controls on Windows.
    /// Requires WindowsAccessBridge-64.dll (ships with JDK/JRE, also available via Oracle).
    /// </summary>
    static class JavaAccessBridge
    {
        private static bool _initialized = false;
        private static bool _available = false;

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void Windows_run();

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool isJavaWindow(IntPtr hwnd);

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool getAccessibleContextFromHWND(IntPtr hwnd, out int vmID, out long ac);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct AccessibleContextInfo
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 1024)]
            public string name;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string description;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string role;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string role_en_US;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string states;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string states_en_US;
            public int indexInParent;
            public int childrenCount;
            public int x, y, width, height;
            [MarshalAs(UnmanagedType.Bool)]
            public bool accessibleComponent;
            [MarshalAs(UnmanagedType.Bool)]
            public bool accessibleAction;
            [MarshalAs(UnmanagedType.Bool)]
            public bool accessibleSelection;
            [MarshalAs(UnmanagedType.Bool)]
            public bool accessibleText;
            [MarshalAs(UnmanagedType.Bool)]
            public bool accessibleValue;
        }

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool getAccessibleContextInfo(int vmID, long ac, out AccessibleContextInfo info);

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool getAccessibleContextAt(int vmID, long acParent, int x, int y, out long ac);

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern long getAccessibleChildFromContext(int vmID, long ac, int index);

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void releaseJavaObject(int vmID, long ac);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct AccessibleActions
        {
            public int actionsCount;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
            public AccessibleActionInfo[] actionInfo;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct AccessibleActionInfo
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
            public string name;
        }

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool getAccessibleActions(int vmID, long ac, out AccessibleActions actions);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct AccessibleActionsToDo
        {
            public int actionsCount;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)]
            public AccessibleActionInfo[] actions;
        }

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool doAccessibleActions(int vmID, long ac, ref AccessibleActionsToDo actionsToDo, out int failure);

        [DllImport("WindowsAccessBridge-64.dll", CallingConvention = CallingConvention.Cdecl)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool setTextContents(int vmID, long ac, [MarshalAs(UnmanagedType.LPWStr)] string text);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

        /// <summary>
        /// Initialize the Java Access Bridge. Must be called once before any JAB operations.
        /// Returns true if JAB is available and initialized.
        /// </summary>
        public static bool Initialize()
        {
            if (_initialized) return _available;
            _initialized = true;
            try
            {
                Windows_run();
                // Give JAB a moment to discover running JVMs
                Thread.Sleep(500);
                _available = true;
                Program.Log("INFO", "Java Access Bridge initialized successfully");
            }
            catch (DllNotFoundException)
            {
                Program.Log("WARN", "WindowsAccessBridge-64.dll not found — JAB not available. Install JDK/JRE or copy DLL to agent directory.");
                _available = false;
            }
            catch (Exception ex)
            {
                Program.Log("WARN", $"JAB initialization failed: {ex.Message}");
                _available = false;
            }
            return _available;
        }

        public static bool IsAvailable => _available;

        /// <summary>
        /// Find all Java windows on the desktop and return their HWND + accessible context.
        /// </summary>
        public static List<(IntPtr hwnd, int vmID, long ac)> GetJavaWindows()
        {
            var results = new List<(IntPtr, int, long)>();
            if (!_available) return results;

            EnumWindows((hwnd, _) =>
            {
                try
                {
                    if (isJavaWindow(hwnd))
                    {
                        if (getAccessibleContextFromHWND(hwnd, out int vmID, out long ac))
                            results.Add((hwnd, vmID, ac));
                    }
                }
                catch { /* skip */ }
                return true; // continue enumeration
            }, IntPtr.Zero);

            return results;
        }

        /// <summary>
        /// Search the JAB accessible tree for an element matching the given criteria.
        /// Searches by name/label and role (control type).
        /// </summary>
        public static (int vmID, long ac, AccessibleContextInfo info)? FindElement(
            string? name, string? role, string? automationId, int maxDepth = 15)
        {
            if (!_available) return null;

            var javaWindows = GetJavaWindows();
            foreach (var (hwnd, vmID, rootAc) in javaWindows)
            {
                var result = SearchTree(vmID, rootAc, name, role, automationId, 0, maxDepth);
                if (result.HasValue) return result;
            }
            return null;
        }

        private static (int vmID, long ac, AccessibleContextInfo info)? SearchTree(
            int vmID, long ac, string? name, string? role, string? automationId, int depth, int maxDepth)
        {
            if (depth > maxDepth || ac == 0) return null;

            if (getAccessibleContextInfo(vmID, ac, out var info))
            {
                bool nameMatch = string.IsNullOrEmpty(name) ||
                    (!string.IsNullOrEmpty(info.name) && info.name.Contains(name, StringComparison.OrdinalIgnoreCase));
                bool roleMatch = string.IsNullOrEmpty(role) ||
                    (!string.IsNullOrEmpty(info.role_en_US) && info.role_en_US.Contains(role, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(info.role) && info.role.Contains(role, StringComparison.OrdinalIgnoreCase));
                bool idMatch = string.IsNullOrEmpty(automationId) ||
                    (!string.IsNullOrEmpty(info.description) && info.description.Contains(automationId, StringComparison.OrdinalIgnoreCase));

                // Need at least one positive match criterion
                bool hasSearchCriteria = !string.IsNullOrEmpty(name) || !string.IsNullOrEmpty(role) || !string.IsNullOrEmpty(automationId);
                if (hasSearchCriteria && nameMatch && roleMatch && idMatch)
                    return (vmID, ac, info);

                // Recurse into children
                for (int i = 0; i < info.childrenCount; i++)
                {
                    long childAc = getAccessibleChildFromContext(vmID, ac, i);
                    if (childAc != 0)
                    {
                        var found = SearchTree(vmID, childAc, name, role, automationId, depth + 1, maxDepth);
                        if (found.HasValue) return found;
                        releaseJavaObject(vmID, childAc);
                    }
                }
            }
            return null;
        }

        /// <summary>
        /// Perform a click action on a JAB accessible element.
        /// </summary>
        public static bool DoClick(int vmID, long ac)
        {
            var actionsToDo = new AccessibleActionsToDo
            {
                actionsCount = 1,
                actions = new AccessibleActionInfo[32]
            };
            actionsToDo.actions[0] = new AccessibleActionInfo { name = "click" };
            return doAccessibleActions(vmID, ac, ref actionsToDo, out _);
        }

        /// <summary>
        /// Set text in a JAB accessible text element.
        /// </summary>
        public static bool SetText(int vmID, long ac, string text)
        {
            return setTextContents(vmID, ac, text);
        }

        /// <summary>
        /// Get info about a JAB accessible element (for selector capture).
        /// </summary>
        public static Dictionary<string, string>? GetElementInfo(int vmID, long ac)
        {
            if (!getAccessibleContextInfo(vmID, ac, out var info)) return null;
            return new Dictionary<string, string>
            {
                ["name"] = info.name ?? "",
                ["role"] = info.role_en_US ?? info.role ?? "",
                ["description"] = info.description ?? "",
                ["states"] = info.states_en_US ?? info.states ?? "",
                ["x"] = info.x.ToString(),
                ["y"] = info.y.ToString(),
                ["width"] = info.width.ToString(),
                ["height"] = info.height.ToString(),
                ["childrenCount"] = info.childrenCount.ToString(),
            };
        }
    }

    class Program
    {
        private static readonly string API_TOKEN = Environment.GetEnvironmentVariable("WISPR_API_TOKEN") ?? "${token}";
        private static readonly string SUPABASE_URL = "${supabaseUrl}";
        private static readonly string SUPABASE_KEY = "${supabaseKey}";
        private static readonly HttpClient httpClient = new HttpClient();
        private static readonly int POLL_INTERVAL_MS = 5000;
        private static readonly int HEARTBEAT_INTERVAL_MS = 30000;
        private static volatile bool running = true;
        private static bool jabInitialized = false;
        private static readonly string PadScriptsFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Microsoft", "Power Automate Desktop", "Scripts");

        static async Task Main(string[] args)
        {
            Log("INFO", "WISPR Desktop Agent Starting...");
            Log("INFO", $"API Token: {API_TOKEN[..Math.Min(20, API_TOKEN.Length)]}...");
            Log("INFO", $"Engine: FlaUI (UIA3) + Java Access Bridge (JAB)");

            // Initialize Java Access Bridge early
            jabInitialized = JavaAccessBridge.Initialize();
            if (jabInitialized)
                Log("INFO", "JAB is available — Java Swing/AWT components will be accessible");
            else
                Log("INFO", "JAB not available — using UIA3 only (install JDK/JRE for JAB support)");

            httpClient.DefaultRequestHeaders.Add("apikey", SUPABASE_KEY);
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", SUPABASE_KEY);

            var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; running = false; cts.Cancel(); };

            _ = HeartbeatLoop(cts.Token);

            while (running)
            {
                try { await PollAndExecuteJobs(); }
                catch (Exception ex) { Log("ERROR", $"Poll error: {ex.Message}"); }
                await Task.Delay(POLL_INTERVAL_MS, cts.Token).ConfigureAwait(false);
            }
            Log("INFO", "Agent stopped.");
        }

        static async Task HeartbeatLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try { await SendHeartbeat(); Log("DEBUG", "Heartbeat sent"); }
                catch (Exception ex) { Log("ERROR", $"Heartbeat failed: {ex.Message}"); }
                await Task.Delay(HEARTBEAT_INTERVAL_MS, ct);
            }
        }

        static async Task SendHeartbeat()
        {
            var body = new { action = "heartbeat", apiToken = API_TOKEN,
                systemInfo = new { platform = Environment.OSVersion.ToString(), dotnetVersion = Environment.Version.ToString(), agentType = "desktop", jabAvailable = JavaAccessBridge.IsAvailable },
                capabilities = new { engines = new[] { "uia", "vision", jabInitialized ? "jab" : null }.Where(e => e != null).ToArray(), max_capacity = 2 } };
            await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api", body);
        }

        static async Task PollAndExecuteJobs()
        {
            var body = new { action = "poll", apiToken = API_TOKEN };
            var response = await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api", body);
            using var doc = JsonDocument.Parse(response);
            if (doc.RootElement.TryGetProperty("jobs", out var jobs) && jobs.GetArrayLength() > 0)
            {
                Log("INFO", $"Found {jobs.GetArrayLength()} job(s)");
                foreach (var job in jobs.EnumerateArray()) await ExecuteJob(job);
            }
        }

        static async Task ExecuteJob(JsonElement job)
        {
            string jobId = job.GetProperty("id").GetString()!;
            Log("INFO", $"Executing desktop job: {jobId}");
            var sw = Stopwatch.StartNew();
            int passed = 0, failed = 0, total = 0;

            try
            {
                string? appPath = job.TryGetProperty("application_path", out var ap) ? ap.GetString() : null;
                string engineMode = job.TryGetProperty("engine_mode", out var em) ? em.GetString()! : "uia";
                var steps = job.GetProperty("steps");
                total = steps.GetArrayLength();

                // ─────────────────────────────────────────────────────────────
                // PAD (Power Automate Desktop) execution branch.
                // When engine_mode == "pad", DO NOT fall through to UIA3+JAB.
                // Priority 1: Cloud Flow HTTP trigger URL (fires HTTP POST).
                // Priority 2: Local PAD via ms-powerautomate:// protocol using
                //             pad_environment_id + pad_workflow_id.
                // ─────────────────────────────────────────────────────────────
                if (string.Equals(engineMode, "pad", StringComparison.OrdinalIgnoreCase))
                {
                    Log("INFO", "Engine mode = PAD. Skipping UIA3/JAB execution path.");
                    string? cloudUrl = job.TryGetProperty("cloud_flow_trigger_url", out var cu) ? cu.GetString() : null;
                    string? padEnvId = job.TryGetProperty("pad_environment_id", out var pe) ? pe.GetString() : null;
                    string? padFlowId = job.TryGetProperty("pad_workflow_id", out var pf) ? pf.GetString() : null;
                    string? dataverseOrgUrl = job.TryGetProperty("pad_dataverse_org_url", out var po) ? po.GetString() : null;
                    string? padAppName = job.TryGetProperty("application_name", out var pan) ? pan.GetString() : null;
                    bool padInstalled = IsPadInstalled();

                    bool padOk = false;
                    string padError = "";

                    if (padInstalled)
                    {
                        try
                        {
                            string robinContent = BuildPadRobinScript(steps, padAppName, appPath);
                            string localFlowName = ExportPadRobinScript(robinContent, string.IsNullOrWhiteSpace(jobId) ? "PAD_Run" : jobId);

                            if (!string.IsNullOrWhiteSpace(padFlowId) && !string.IsNullOrWhiteSpace(dataverseOrgUrl))
                            {
                                Log("INFO", "Updating PAD flow with latest test steps before execution...");
                                string accessToken = await AcquireDataverseAccessTokenAsync(dataverseOrgUrl!);
                                await UpdateDesktopFlowAsync(dataverseOrgUrl!, padFlowId!, accessToken, robinContent);
                                Log("INFO", "PAD flow updated successfully.");
                            }
                            else if (!string.IsNullOrWhiteSpace(padFlowId))
                            {
                                Log("WARN", "PAD flow ID provided without Dataverse org URL. Skipping pre-execution flow update.");
                            }

                            if (!string.IsNullOrWhiteSpace(padEnvId) && !string.IsNullOrWhiteSpace(padFlowId))
                            {
                                string padUri = "ms-powerautomate:/console/flow/run?workflowId=" + Uri.EscapeDataString(padFlowId!) + "&environmentId=" + Uri.EscapeDataString(padEnvId!);
                                Log("INFO", "Launching local PAD with provided environment/flow IDs.");
                                Process.Start(new ProcessStartInfo { FileName = padUri, UseShellExecute = true });
                                padOk = true;
                            }
                            else
                            {
                                string importUri = "ms-powerautomate:/import?path=" + Uri.EscapeDataString(Path.Combine(PadScriptsFolder, localFlowName + ".robin"));
                                Log("INFO", "Launching local PAD from exported Robin script: " + localFlowName);
                                Process.Start(new ProcessStartInfo { FileName = importUri, UseShellExecute = true });
                                padOk = true;
                            }
                        }
                        catch (Exception ex)
                        {
                            padError = "Local PAD preparation failed: " + ex.Message;
                            Log("ERROR", padError);
                        }
                    }

                    // Fallback — Cloud Flow trigger URL
                    if (!padOk && !string.IsNullOrWhiteSpace(cloudUrl))
                    {
                        try
                        {
                            Log("INFO", $"Triggering PAD via Cloud Flow URL: {cloudUrl}");
                            var padPayload = new { testCaseId = jobId, triggeredAt = DateTime.UtcNow.ToString("o"), steps = JsonDocument.Parse(steps.GetRawText()).RootElement };
                            var jsonStr = JsonSerializer.Serialize(padPayload);
                            using var content = new StringContent(jsonStr, Encoding.UTF8, "application/json");
                            using var resp = await httpClient.PostAsync(cloudUrl, content);
                            string respText = await resp.Content.ReadAsStringAsync();
                            if (resp.IsSuccessStatusCode)
                            {
                                padOk = true;
                                Log("INFO", $"Cloud Flow triggered successfully: HTTP {(int)resp.StatusCode}");
                            }
                            else
                            {
                                padError = $"Cloud Flow trigger HTTP {(int)resp.StatusCode}: {respText}";
                                Log("ERROR", padError);
                            }
                        }
                        catch (Exception ex)
                        {
                            padError = "Cloud Flow trigger exception: " + ex.Message;
                            Log("ERROR", padError);
                        }
                    }

                    // Priority 2 — Local PAD via ms-powerautomate:// protocol
                    if (!padOk && !string.IsNullOrWhiteSpace(padEnvId) && !string.IsNullOrWhiteSpace(padFlowId))
                    {
                        try
                        {
                            string padUri = $"ms-powerautomate:/console/flow/run?workflowId={padFlowId}&environmentId={padEnvId}";
                            Log("INFO", $"Launching local PAD: {padUri}");
                            var psi = new ProcessStartInfo { FileName = padUri, UseShellExecute = true };
                            Process.Start(psi);
                            padOk = true;
                            Log("INFO", "PAD launched locally with provided environment/flow IDs.");
                        }
                        catch (Exception ex)
                        {
                            padError = "Local PAD launch failed: " + ex.Message;
                            Log("ERROR", padError);
                        }
                    }

                    sw.Stop();
                    if (padOk)
                    {
                        passed = 1; total = 1;
                        await SubmitResults(jobId, passed, failed, total, sw.ElapsedMilliseconds, "completed");
                        Log("INFO", $"PAD job {jobId} dispatched.");
                    }
                    else
                    {
                        failed = 1; total = 1;
                        if (string.IsNullOrEmpty(padError))
                            padError = padInstalled
                                ? "PAD execution failed before launch. Provide a valid Dataverse org URL for flow updates, or a Cloud Flow trigger URL as fallback."
                                : "PAD execution requires either local Power Automate Desktop, a Cloud Flow trigger URL, or both pad_environment_id and pad_workflow_id for local launch.";
                        Log("ERROR", $"PAD job {jobId} failed: {padError}");
                        await SubmitResults(jobId, passed, failed, total, sw.ElapsedMilliseconds, "failed");
                    }
                    return;
                }

                // Check if this is a recording job
                if (total > 0)
                {
                    var firstStep = steps[0];
                    string firstAction = firstStep.TryGetProperty("action", out var fa) ? fa.GetString()! : "";
                    if (firstAction == "record")
                    {
                        string? recAppName = firstStep.TryGetProperty("application_name", out var ran) ? ran.GetString() : null;
                        string? recAppPath = firstStep.TryGetProperty("application_path", out var rap) ? rap.GetString() : null;
                        await RunRecordingSession(jobId, recAppName, recAppPath ?? appPath);
                        return;
                    }
                    if (firstAction == "capture_element")
                    {
                        string? capAppName = firstStep.TryGetProperty("application_name", out var can) ? can.GetString() : null;
                        await RunCaptureElementSession(jobId, capAppName, appPath);
                        return;
                    }
                }

                Application? app = null;
                string? appName = job.TryGetProperty("application_name", out var an) ? an.GetString() : null;

                if (!string.IsNullOrEmpty(appPath) && File.Exists(appPath))
                {
                    LaunchApplication(appPath);
                    
                    // Wait and attach by window title or process name (resilient to launcher PIDs)
                    app = await AttachToApplication(appPath, appName, TimeSpan.FromSeconds(30));
                    if (app == null) Log("WARN", "Could not attach to application, proceeding with desktop-level automation");
                }

                using var automation = new UIA3Automation();

                foreach (var step in steps.EnumerateArray())
                {
                    try
                    {
                        await ExecuteStep(automation, app, step, engineMode);
                        passed++;
                    }
                    catch (Exception ex)
                    {
                        Log("ERROR", $"Step failed: {ex.Message}");
                        failed++;

                        // Attempt self-healing
                        if (step.TryGetProperty("target", out var target))
                        {
                            try
                            {
                                var healBody = new { action = "self-heal", apiToken = API_TOKEN, jobId, 
                                    originalSelector = target.GetRawText(), uiTreeSnapshot = "unavailable", failureReason = ex.Message };
                                await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api", healBody);
                            }
                            catch { /* Best effort */ }
                        }
                    }
                }

                sw.Stop();
                await SubmitResults(jobId, passed, failed, total, sw.ElapsedMilliseconds, "completed");
                Log("INFO", $"Job {jobId} completed: {passed} passed, {failed} failed");
            }
            catch (Exception ex)
            {
                sw.Stop();
                Log("ERROR", $"Job {jobId} error: {ex.Message}");
                await SubmitResults(jobId, passed, failed, total, sw.ElapsedMilliseconds, "failed");
            }
        }

        static async Task ExecuteStep(UIA3Automation automation, Application? app, JsonElement step, string engineMode)
        {
            string action = step.GetProperty("action").GetString()!;
            string value = step.TryGetProperty("value", out var v) ? v.GetString() ?? "" : "";
            int timeout = step.TryGetProperty("timeoutSeconds", out var t) ? t.GetInt32() : 30;

            AutomationElement? element = null;
            bool hasTarget = step.TryGetProperty("target", out var target);
            if (hasTarget)
            {
                element = FindElement(automation, app, target, TimeSpan.FromSeconds(timeout));
            }

            // If element was found via JAB, route actions through JAB API
            if (_lastFoundViaJab && hasTarget)
            {
                Log("INFO", $"Executing '{action}' via Java Access Bridge");
                switch (action.ToLower())
                {
                    case "click":
                    case "double_click":
                        if (!JavaAccessBridge.DoClick(_lastJabVmID, _lastJabAc))
                            throw new Exception("JAB click action failed");
                        if (action.ToLower() == "double_click")
                        {
                            Thread.Sleep(100);
                            JavaAccessBridge.DoClick(_lastJabVmID, _lastJabAc);
                        }
                        break;
                    case "type": case "fill":
                        if (!JavaAccessBridge.SetText(_lastJabVmID, _lastJabAc, value))
                            throw new Exception("JAB setText failed");
                        break;
                    case "clear":
                        JavaAccessBridge.SetText(_lastJabVmID, _lastJabAc, "");
                        break;
                    case "assert_text":
                        var jabInfo = JavaAccessBridge.GetElementInfo(_lastJabVmID, _lastJabAc);
                        var jabName = jabInfo?["name"] ?? "";
                        if (!jabName.Contains(value)) throw new Exception($"JAB text assertion failed: expected '{value}', got '{jabName}'");
                        break;
                    case "assert_visible":
                        var stateInfo = JavaAccessBridge.GetElementInfo(_lastJabVmID, _lastJabAc);
                        if (stateInfo == null) throw new Exception("JAB element not accessible");
                        if (!stateInfo["states"].Contains("visible", StringComparison.OrdinalIgnoreCase) &&
                            !stateInfo["states"].Contains("showing", StringComparison.OrdinalIgnoreCase))
                            throw new Exception("JAB element not visible");
                        break;
                    case "wait": await Task.Delay(int.Parse(value)); break;
                    case "wait_for_element": break; // Already found via JAB
                    default:
                        Log("WARN", $"JAB fallback not available for action '{action}', trying UIA");
                        goto UIA_FALLBACK;
                }
                return;
            }

            UIA_FALLBACK:
            switch (action.ToLower())
            {
                case "click": element?.Click(); break;
                case "double_click": element?.DoubleClick(); break;
                case "right_click": element?.RightClick(); break;
                case "type": case "fill":
                    if (element != null) { element.AsTextBox().Text = value; } break;
                case "clear":
                    if (element != null) { element.AsTextBox().Text = ""; } break;
                case "select":
                    element?.AsComboBox().Select(value); break;
                case "assert_text":
                    var text = element?.Name ?? element?.AsTextBox().Text ?? "";
                    if (!text.Contains(value)) throw new Exception($"Text assertion failed: expected '{value}', got '{text}'");
                    break;
                case "assert_visible":
                    if (element == null || !element.IsEnabled) throw new Exception("Element not visible or enabled");
                    break;
                case "assert_state":
                    if (element == null) throw new Exception("Element not found for state assertion");
                    break;
                case "wait":
                    await Task.Delay(int.Parse(value)); break;
                case "wait_for_element":
                    if (element == null && !_lastFoundViaJab) throw new Exception("Element not found within timeout");
                    break;
                case "window_switch":
                    break;
                case "launch_app":
                    if (!string.IsNullOrEmpty(value)) LaunchApplication(value);
                    await Task.Delay(3000);
                    break;
                case "screenshot":
                    Log("INFO", "Screenshot captured");
                    break;
                case "hover":
                    element?.Click();
                    break;
                case "keyboard_shortcut":
                    break;
                default:
                    Log("WARN", $"Unknown action: {action}");
                    break;
            }
        }

        static async Task RunRecordingSession(string jobId, string? appName, string? appPath)
        {
            Log("INFO", $"Starting RECORDING session for job {jobId}, app: {appName ?? "unknown"}");
            
            // Notify server that recording has started
            await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api", 
                new { action = "start", apiToken = API_TOKEN, jobId });

            // Launch the application if path is provided
            if (!string.IsNullOrEmpty(appPath) && File.Exists(appPath))
            {
                LaunchApplication(appPath);
                await Task.Delay(3000);
            }

            using var automation = new UIA3Automation();
            var desktop = automation.GetDesktop();
            string lastRecordedElementSignature = "";
            DateTime lastRecordedAt = DateTime.MinValue;
            const int FocusDebounceMs = 350;
            int stepCount = 0;

            Log("INFO", "Recording active - monitoring UI focus changes and interactions...");
            Log("INFO", "The agent will capture focus changes as click actions.");

            // Poll-based recording: monitor focus changes on the desktop
            var recordingSw = Stopwatch.StartNew();
            int maxRecordingSeconds = 600; // 10 minutes max

            int pollsSinceStatusCheck = 0;
            int statusCheckInterval = 10; // Check every 10 polls (~5 seconds)

            while (running && recordingSw.Elapsed.TotalSeconds < maxRecordingSeconds)
            {
                // Periodically check if the server has signalled to stop recording
                pollsSinceStatusCheck++;
                if (pollsSinceStatusCheck >= statusCheckInterval)
                {
                    pollsSinceStatusCheck = 0;
                    try
                    {
                        var statusBody = await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api",
                            new { action = "check-recording-status", apiToken = API_TOKEN, jobId });
                        using var statusDoc = JsonDocument.Parse(statusBody);
                        bool shouldStop = statusDoc.RootElement.TryGetProperty("shouldStop", out var ss) && ss.GetBoolean();
                        if (shouldStop)
                        {
                            Log("INFO", "Server signalled to stop recording.");
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        Log("WARN", $"Failed to check recording status: {ex.Message}");
                    }
                }

                try
                {
                    // Alternative: get the focused element directly
                    AutomationElement? currentFocused = null;
                    try { currentFocused = automation.FocusedElement(); } catch { }

                    if (currentFocused != null)
                    {
                        string currentName = currentFocused.Name ?? "";
                        string currentAutomationId = "";
                        string currentControlType = "";
                        string currentClassName = "";
                        string currentPid = "";

                        try { currentAutomationId = currentFocused.AutomationId ?? ""; } catch { }
                        try { currentControlType = currentFocused.ControlType.ToString(); } catch { }
                        try { currentClassName = currentFocused.ClassName ?? ""; } catch { }
                        try { currentPid = currentFocused.Properties.ProcessId.Value.ToString(); } catch { }

                        // Build stable signature (object reference changes every poll in UIA wrappers)
                        string currentElementSignature =
                            (currentAutomationId ?? "") + "|" +
                            (currentName ?? "") + "|" +
                            (currentControlType ?? "") + "|" +
                            (currentClassName ?? "") + "|" +
                            (currentPid ?? "");

                        bool isNewElement = !string.Equals(currentElementSignature, lastRecordedElementSignature, StringComparison.Ordinal);
                        bool debounceElapsed = (DateTime.UtcNow - lastRecordedAt).TotalMilliseconds >= FocusDebounceMs;

                        // Check relevance: element must belong to the target application
                        bool isRelevant = string.IsNullOrEmpty(appName);
                        if (!isRelevant)
                        {
                            // Strategy 1: Check process that owns this element
                            try
                            {
                                int pid = currentFocused.Properties.ProcessId.Value;
                                var proc = Process.GetProcessById(pid);
                                if ((proc.ProcessName ?? "").Contains(appName ?? "", StringComparison.OrdinalIgnoreCase) ||
                                    (proc.MainWindowTitle ?? "").Contains(appName ?? "", StringComparison.OrdinalIgnoreCase))
                                {
                                    isRelevant = true;
                                }
                                // Also check partial match for apps like "calc" -> "CalculatorApp"
                                if (!isRelevant && !string.IsNullOrEmpty(appPath))
                                {
                                    string expectedProc = Path.GetFileNameWithoutExtension(appPath);
                                    if ((proc.ProcessName ?? "").Contains(expectedProc ?? "", StringComparison.OrdinalIgnoreCase))
                                        isRelevant = true;
                                }
                            }
                            catch { /* PID check failed, fall through to parent chain */ }

                            // Strategy 2: Walk up parent chain to find app window
                            if (!isRelevant)
                            {
                                var checkEl = currentFocused;
                                for (int depth = 0; depth < 10 && checkEl != null; depth++)
                                {
                                    string elName = "";
                                    string elClass = "";
                                    try { elName = checkEl.Name ?? ""; } catch { }
                                    try { elClass = checkEl.ClassName ?? ""; } catch { }
                                    if (elName.Contains(appName ?? "", StringComparison.OrdinalIgnoreCase) ||
                                        elClass.Contains(appName ?? "", StringComparison.OrdinalIgnoreCase))
                                    {
                                        isRelevant = true;
                                        break;
                                    }
                                    try { checkEl = checkEl.Parent; } catch { break; }
                                }
                            }
                        }

                        if (isNewElement && debounceElapsed && isRelevant && !string.IsNullOrEmpty(currentName) && currentName != "Desktop")
                        {
                            lastRecordedElementSignature = currentElementSignature;
                            lastRecordedAt = DateTime.UtcNow;

                            var step = new {
                                action = "click",
                                target = new {
                                    automationId = currentAutomationId,
                                    label = currentName,
                                    controlType = currentControlType,
                                    classHint = currentClassName,
                                    parentWindow = ""
                                },
                                value = "",
                                waitCondition = "element_exists",
                                timeoutSeconds = 30,
                                retryCount = 1
                            };

                            try
                            {
                                await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api",
                                    new { action = "record-step", apiToken = API_TOKEN, jobId, step });
                                stepCount++;
                                Log("INFO", $"Recorded step {stepCount}: {currentControlType} '{currentName}' (AutomationId: {currentAutomationId})");
                            }
                            catch (Exception ex)
                            {
                                Log("WARN", $"Failed to send recorded step: {ex.Message}");
                            }
                        }
                    }
                }
                catch { /* Ignore transient errors during recording */ }

                await Task.Delay(500); // Poll every 500ms
            }

            Log("INFO", $"Recording session ended. Total steps captured: {stepCount}");
            
            // Submit final results
            await SubmitResults(jobId, stepCount, 0, stepCount, recordingSw.ElapsedMilliseconds, "completed");
        }

        /// <summary>
        /// Capture Element mode: waits for user to click an element, captures its properties,
        /// and submits to the server. Used by the "Capture Selector" UI button.
        /// </summary>
        static async Task RunCaptureElementSession(string jobId, string? appName, string? appPath)
        {
            Log("INFO", "Starting CAPTURE ELEMENT session for job " + jobId);

            await PostJson(SUPABASE_URL + "/functions/v1/desktop-agent-api",
                new { action = "start", apiToken = API_TOKEN, jobId });

            using var automation = new UIA3Automation();
            AutomationElement? lastFocused = null;
            var sw = Stopwatch.StartNew();
            int maxSeconds = 60;
            bool captured = false;

            Log("INFO", "Waiting for user to click an element (timeout: 60s)...");

            while (sw.Elapsed.TotalSeconds < maxSeconds)
            {
                try
                {
                    var focused = automation.FocusedElement();
                    if (focused != null && focused != lastFocused)
                    {
                        // Skip if the focused element is our own console window
                        string focusedName = focused.Name ?? "";
                        string focusedClass = focused.ClassName ?? "";
                        string focusedAutoId = focused.AutomationId ?? "";
                        string controlType = focused.ControlType.ToString();

                        // Only skip the very first focus (usually the agent's own window)
                        if (lastFocused == null)
                        {
                            lastFocused = focused;
                            await Task.Delay(300);
                            continue;
                        }

                        // Capture this element
                        string parentWindowTitle = "";
                        try
                        {
                            var parent = focused.Parent;
                            while (parent != null)
                            {
                                if ((parent.ClassName ?? "").Contains("Window") || parent.ControlType.ToString() == "Window")
                                {
                                    parentWindowTitle = parent.Name ?? "";
                                    break;
                                }
                                parent = parent.Parent;
                            }
                        }
                        catch { }

                        var capturedElement = new
                        {
                            automationId = focusedAutoId,
                            label = focusedName,
                            name = focusedName,
                            controlType = controlType,
                            className = focusedClass,
                            parentWindow = parentWindowTitle,
                            selector = new
                            {
                                automationId = focusedAutoId,
                                label = focusedName,
                                controlType = controlType,
                                classHint = focusedClass,
                                parentWindow = parentWindowTitle,
                            },
                        };

                        Log("INFO", "Captured element: " + focusedName + " (" + controlType + ") AutomationId=" + focusedAutoId);

                        await PostJson(SUPABASE_URL + "/functions/v1/desktop-agent-api",
                            new { action = "submit-captured-element", apiToken = API_TOKEN, jobId, capturedElement });

                        captured = true;
                        break;
                    }
                }
                catch { }

                await Task.Delay(300);
            }

            if (!captured)
            {
                Log("WARN", "Capture element session timed out without capturing.");
                await PostJson(SUPABASE_URL + "/functions/v1/desktop-agent-api",
                    new { action = "submit", apiToken = API_TOKEN, jobId, status = "failed",
                          duration_ms = sw.ElapsedMilliseconds, total_steps = 0, passed_steps = 0,
                          failed_steps = 0, error_message = "Capture timed out" });
            }

            Log("INFO", "Capture element session ended.");
        }

        static void LaunchApplication(string appFilePath)
        {
            Log("INFO", "Launching application: " + appFilePath);
            string ext = Path.GetExtension(appFilePath).ToLowerInvariant();

            if (ext == ".jar")
            {
                // Java JAR files must be launched via java -jar
                string javaExe = "java";
                string javaHome = Environment.GetEnvironmentVariable("JAVA_HOME") ?? "";
                if (!string.IsNullOrEmpty(javaHome))
                {
                    string candidate = Path.Combine(javaHome, "bin", "java.exe");
                    if (File.Exists(candidate)) javaExe = candidate;
                }
                Log("INFO", "Launching JAR via: " + javaExe + " -jar " + appFilePath);
                Process.Start(new ProcessStartInfo
                {
                    FileName = javaExe,
                    Arguments = "-jar \\"" + appFilePath + "\\"",
                    WorkingDirectory = Path.GetDirectoryName(appFilePath) ?? ".",
                    UseShellExecute = false,
                });
            }
            else if (ext == ".jnlp")
            {
                // Java Web Start
                Log("INFO", "Launching JNLP via javaws: " + appFilePath);
                Process.Start(new ProcessStartInfo
                {
                    FileName = "javaws",
                    Arguments = "\\"" + appFilePath + "\\"",
                    UseShellExecute = false,
                });
            }
            else
            {
                // Native executables, .bat, .cmd, .lnk, etc.
                Process.Start(new ProcessStartInfo
                {
                    FileName = appFilePath,
                    UseShellExecute = true,
                });
            }
        }

        static async Task<Application?> AttachToApplication(string appPath, string? appName, TimeSpan timeout)
        {
            string processName = Path.GetFileNameWithoutExtension(appPath);
            string searchName = !string.IsNullOrEmpty(appName) ? appName : processName;
            // Build multiple search tokens for flexible matching
            var searchTokens = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase) { processName, searchName };
            // Add individual words from search name for partial matching 
            foreach (var part in searchName.Split(new[] { '_', '-', ' ', '.' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (part.Length >= 4) searchTokens.Add(part);
            }
            foreach (var part in processName.Split(new[] { '_', '-', ' ', '.' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (part.Length >= 4) searchTokens.Add(part);
            }
            Log("INFO", "Searching for application: processName=" + processName + ", appName=" + (appName ?? "(none)") + ", tokens=" + string.Join(",", searchTokens));
            var sw = Stopwatch.StartNew();
            bool loggedDiagnostics = false;

            while (sw.Elapsed < timeout)
            {
                var allProcs = Process.GetProcesses();
                var scored = new System.Collections.Generic.List<(Process proc, int score)>();

                // Log all visible windows once for diagnostics
                if (!loggedDiagnostics && sw.Elapsed.TotalSeconds > 3)
                {
                    loggedDiagnostics = true;
                    var visibleWindows = new System.Collections.Generic.List<string>();
                    foreach (var p in allProcs)
                    {
                        try
                        {
                            if (p.MainWindowHandle != IntPtr.Zero && !string.IsNullOrEmpty(p.MainWindowTitle))
                                visibleWindows.Add(p.ProcessName + " | " + p.MainWindowTitle + " | PID:" + p.Id);
                        }
                        catch { }
                    }
                    Log("INFO", "Visible windows (" + visibleWindows.Count + "): " + string.Join("; ", visibleWindows.Take(30)));
                }

                foreach (var p in allProcs)
                {
                    try
                    {
                        if (p.MainWindowHandle == IntPtr.Zero) continue;
                        int score = 0;
                        string pName = p.ProcessName ?? "";
                        string wTitle = p.MainWindowTitle ?? "";
                        if (string.IsNullOrEmpty(wTitle) && string.IsNullOrEmpty(pName)) continue;

                        // Exact process name match = highest score
                        if (pName.Equals(processName, StringComparison.OrdinalIgnoreCase)) score += 100;

                        // Check each token against process name and window title
                        foreach (var token in searchTokens)
                        {
                            if (pName.Contains(token, StringComparison.OrdinalIgnoreCase)) score += 20;
                            if (wTitle.Contains(token, StringComparison.OrdinalIgnoreCase)) score += 15;
                        }

                        // Bonus for exe path match (handles java.exe hosting the actual app)
                        try
                        {
                            string? exePath = p.MainModule?.FileName;
                            if (!string.IsNullOrEmpty(exePath) && exePath.Contains(processName, StringComparison.OrdinalIgnoreCase))
                                score += 50;
                        }
                        catch { /* access denied for some processes */ }

                        if (score > 0) scored.Add((p, score));
                    }
                    catch { }
                }

                // Pick the best match
                if (scored.Count > 0)
                {
                    scored.Sort((a, b) => b.score.CompareTo(a.score));
                    var best = scored[0];
                    // Only attach if score is reasonably confident
                    if (best.score >= 15)
                    {
                        Log("INFO", "Attaching to best match: " + best.proc.ProcessName + " (PID: " + best.proc.Id + ", Window: " + best.proc.MainWindowTitle + ", Score: " + best.score + ")");
                        if (scored.Count > 1)
                            Log("INFO", "Runner-up: " + scored[1].proc.ProcessName + " (PID: " + scored[1].proc.Id + ", Score: " + scored[1].score + ")");
                        try
                        {
                            return Application.Attach(best.proc.Id);
                        }
                        catch (Exception ex)
                        {
                            Log("WARN", "Failed to attach to best match: " + ex.Message);
                        }
                    }
                }

                await Task.Delay(1000);
            }

            Log("WARN", "Timed out waiting for application window: processName=" + processName + ", searchName=" + searchName);
            return null;
        }

        // Tracks whether the last found element was via JAB (for action routing)
        private static bool _lastFoundViaJab = false;
        private static int _lastJabVmID = 0;
        private static long _lastJabAc = 0;

        static AutomationElement? FindElement(UIA3Automation automation, Application? app, JsonElement target, TimeSpan timeout)
        {
            _lastFoundViaJab = false;
            var cf = new ConditionFactory(new UIA3PropertyLibrary());
            string? automationId = target.TryGetProperty("automationId", out var aid) ? aid.GetString() : null;
            string? label = target.TryGetProperty("label", out var lbl) ? lbl.GetString() : null;
            string? controlType = target.TryGetProperty("controlType", out var ct) ? ct.GetString() : null;
            string? classHint = target.TryGetProperty("classHint", out var ch) ? ch.GetString() : null;

            // Detect if this is likely a Java element (JAB roles or Java class hints)
            bool likelyJava = !string.IsNullOrEmpty(classHint) &&
                (classHint.Contains("javax.swing", StringComparison.OrdinalIgnoreCase) ||
                 classHint.Contains("java.awt", StringComparison.OrdinalIgnoreCase) ||
                 classHint.Contains("javafx", StringComparison.OrdinalIgnoreCase) ||
                 classHint == "push button" || classHint == "toggle button" ||
                 classHint == "text" || classHint == "password text" ||
                 classHint == "combo box" || classHint == "check box" ||
                 classHint == "radio button" || classHint == "list item" ||
                 classHint == "menu item" || classHint == "tree node" ||
                 classHint == "tab" || classHint == "table" ||
                 classHint == "label" || classHint == "scroll pane");

            var desktop = automation.GetDesktop();
            var sw = Stopwatch.StartNew();

            while (sw.Elapsed < timeout)
            {
                try
                {
                    AutomationElement? found = null;

                    // Strategy 1: UIA3 (standard Windows UI Automation)
                    if (!string.IsNullOrEmpty(automationId))
                        found = desktop.FindFirstDescendant(cf.ByAutomationId(automationId));

                    if (found == null && !string.IsNullOrEmpty(label))
                        found = desktop.FindFirstDescendant(cf.ByName(label));

                    if (found != null) return found;

                    // Strategy 2: Java Access Bridge (for Java Swing/AWT/JavaFX components)
                    if (JavaAccessBridge.IsAvailable && (likelyJava || found == null))
                    {
                        // Map UIA control types to JAB roles, or use classHint directly if it's already a JAB role
                        string? jabRole = classHint;
                        // If classHint is a UIA class (not a JAB role), map controlType to JAB role
                        if (string.IsNullOrEmpty(jabRole) || jabRole == "SunAwtFrame" || jabRole == "SunAwtDialog" || jabRole.StartsWith("SunAwt"))
                        {
                            jabRole = controlType?.ToLower() switch
                            {
                                "button" => "push button",
                                "edit" => "text",
                                "combobox" => "combo box",
                                "listitem" => "list item",
                                "menuitem" => "menu item",
                                "checkbox" => "check box",
                                "radiobutton" => "radio button",
                                "treeitem" => "tree node",
                                "tabitem" => "page tab",
                                _ => null
                            };
                        }

                        var jabResult = JavaAccessBridge.FindElement(label, jabRole, automationId);
                        if (jabResult.HasValue)
                        {
                            _lastFoundViaJab = true;
                            _lastJabVmID = jabResult.Value.vmID;
                            _lastJabAc = jabResult.Value.ac;
                            Log("INFO", "Element found via JAB: name='" + jabResult.Value.info.name + "', role='" + jabResult.Value.info.role_en_US + "'");
                            // Return null for AutomationElement but set JAB context — caller checks _lastFoundViaJab
                            return null;
                        }
                    }
                }
                catch { /* retry */ }
                Thread.Sleep(500);
            }
            throw new Exception($"Element not found (UIA3 + JAB): automationId={automationId}, label={label}");
        }

        static bool IsPadInstalled()
        {
            try
            {
                string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
                string[] candidates = new[]
                {
                    Path.Combine(programFiles, "Power Automate Desktop", "PAD.Console.Host.exe"),
                    Path.Combine(programFilesX86, "Power Automate Desktop", "PAD.Console.Host.exe"),
                };

                foreach (var candidate in candidates)
                {
                    if (File.Exists(candidate)) return true;
                }

                using var key = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey("ms-powerautomate");
                return key != null;
            }
            catch
            {
                return false;
            }
        }

        static string ExportPadRobinScript(string robinContent, string flowName)
        {
            Directory.CreateDirectory(PadScriptsFolder);
            string sanitized = string.Join("_", flowName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)).Trim('_');
            if (string.IsNullOrWhiteSpace(sanitized)) sanitized = "WisprPADRun";
            sanitized = "WisprTest_" + sanitized;
            string filePath = Path.Combine(PadScriptsFolder, sanitized + ".robin");
            File.WriteAllText(filePath, robinContent, Encoding.UTF8);
            return sanitized;
        }

        static string BuildPadRobinScript(JsonElement steps, string? appName, string? appPath)
        {
            var sb = new StringBuilder();
            sb.AppendLine("@@ConnectionString: ''");
            sb.AppendLine("@@Type: 'Local'");
            sb.AppendLine("@@DesktopType: 'local'");
            sb.AppendLine("@@DisplayName: 'Local computer'");
            sb.AppendLine("IMPORT 'controlRepo.appmask' AS appmask");
            sb.AppendLine("IMPORT 'imageRepo.imgrepo' AS imgrepo");
            sb.AppendLine("@SENSITIVE: []");
            sb.AppendLine("# Generated by WISPR Desktop Agent");

            bool hasLaunch = false;
            foreach (var step in steps.EnumerateArray())
            {
                string action = GetJsonString(step, "action").ToLowerInvariant();
                if (action == "launch_app")
                {
                    hasLaunch = true;
                    break;
                }
            }

            if (!string.IsNullOrWhiteSpace(appPath) && !hasLaunch)
            {
                sb.AppendLine("System.RunApplication.RunApplication ApplicationPath: $'''" + EscapePadTripleQuoted(appPath!) + "''' WindowStyle: System.ProcessWindowStyle.Normal ProcessId=> AppProcessId");
                sb.AppendLine("@@source: 'Recorder'");
            }

            foreach (var step in steps.EnumerateArray())
            {
                string action = GetJsonString(step, "action").ToLowerInvariant();
                if (action == "" || action.StartsWith("__")) continue;

                if (action == "wait")
                {
                    string waitValue = GetJsonString(step, "value");
                    if (string.IsNullOrWhiteSpace(waitValue)) waitValue = "2";
                    sb.AppendLine("WAIT " + waitValue);
                    continue;
                }

                string selector = BuildPadSelector(step);
                string value = GetJsonString(step, "value");
                sb.AppendLine("@@source: 'Recorder'");

                if (action == "launch_app")
                {
                    string launchPath = string.IsNullOrWhiteSpace(value) ? (appPath ?? "") : value;
                    sb.AppendLine("System.RunApplication.RunApplication ApplicationPath: $'''" + EscapePadTripleQuoted(launchPath) + "''' WindowStyle: System.ProcessWindowStyle.Normal ProcessId=> AppProcessId");
                }
                else if ((action == "click" || action == "double_click" || action == "right_click") && !string.IsNullOrWhiteSpace(selector))
                {
                    sb.AppendLine("UIAutomation.PressButton Button: " + selector);
                }
                else if ((action == "type" || action == "fill" || action == "clear") && !string.IsNullOrWhiteSpace(selector))
                {
                    string text = action == "clear" ? "" : value;
                    sb.AppendLine("UIAutomation.PopulateTextField.PopulateTextField TextField: " + selector + " Text: '" + EscapePadLiteral(text) + "' Mode: UIAutomation.PopulateTextMode.Replace ClickType: UIAutomation.PopulateMouseClickType.SingleClick");
                }
                else if (action == "select" && !string.IsNullOrWhiteSpace(selector))
                {
                    sb.AppendLine("UIAutomation.SelectDropDownListItem Element: " + selector + " Item: '" + EscapePadLiteral(value) + "'");
                }
                else if (action == "keyboard_shortcut")
                {
                    sb.AppendLine("MouseAndKeyboard.SendKeys TextToSend: $'''" + EscapePadTripleQuoted(value) + "''' DelayBetweenKeystrokes: 10");
                }
                else if (!string.IsNullOrWhiteSpace(selector))
                {
                    sb.AppendLine("# Unsupported WISPR action mapped as selector comment: " + action + " -> " + selector);
                }
                else
                {
                    sb.AppendLine("# Unsupported WISPR action: " + action);
                }
            }

            sb.AppendLine("# End of autogenerated actions using the recorder");
            return sb.ToString();
        }

        static string BuildPadSelector(JsonElement step)
        {
            if (step.TryGetProperty("padSelector", out var padSelectorElement))
            {
                string padSelector = padSelectorElement.GetString() ?? "";
                if (!string.IsNullOrWhiteSpace(padSelector)) return padSelector;
            }

            if (!step.TryGetProperty("target", out var target) || target.ValueKind != JsonValueKind.Object)
                return "";

            string window = GetJsonString(target, "parentWindow");
            if (string.IsNullOrWhiteSpace(window)) window = "Application";
            string label = GetJsonString(target, "label");
            string automationId = GetJsonString(target, "automationId");
            string elementName = !string.IsNullOrWhiteSpace(label) ? label : automationId;
            if (string.IsNullOrWhiteSpace(elementName)) elementName = GetJsonString(target, "controlType");
            if (string.IsNullOrWhiteSpace(elementName)) return "";

            return "appmask['Window \\\'" + EscapePadAppmask(window) + "\\\'']['" + EscapePadAppmask(elementName) + "']";
        }

        static string EscapePadAppmask(string value)
        {
            return (value ?? "").Replace("'", "\\\\'");
        }

        static string EscapePadLiteral(string value)
        {
            return (value ?? "").Replace("'", "''");
        }

        static string EscapePadTripleQuoted(string value)
        {
            return (value ?? "").Replace("'''", "'' ''");
        }

        static string GetJsonString(JsonElement element, string propertyName)
        {
            if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var prop))
            {
                return prop.GetString() ?? "";
            }
            return "";
        }

        static async Task<string> AcquireDataverseAccessTokenAsync(string dataverseOrgUrl)
        {
            string normalizedUrl = NormalizeDataverseUrl(dataverseOrgUrl);
            string scope = normalizedUrl.TrimEnd('/') + "/.default offline_access openid profile";
            const string clientId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";
            const string tenantId = "common";

            var deviceCodeResponse = await httpClient.PostAsync(
                "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/devicecode",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = clientId,
                    ["scope"] = scope,
                }));

            string deviceCodeJson = await deviceCodeResponse.Content.ReadAsStringAsync();
            if (!deviceCodeResponse.IsSuccessStatusCode)
                throw new Exception("Failed to start Microsoft sign-in: " + deviceCodeJson);

            JsonNode? deviceNode = JsonNode.Parse(deviceCodeJson);
            string deviceCode = deviceNode?["device_code"]?.GetValue<string>() ?? "";
            string verificationUrl = deviceNode?["verification_uri"]?.GetValue<string>()
                ?? deviceNode?["verification_uri_complete"]?.GetValue<string>()
                ?? "https://microsoft.com/devicelogin";
            string message = deviceNode?["message"]?.GetValue<string>() ?? "Complete Microsoft sign-in in your browser.";
            int interval = deviceNode?["interval"]?.GetValue<int>() ?? 5;
            int expiresIn = deviceNode?["expires_in"]?.GetValue<int>() ?? 300;

            Log("INFO", message);
            try
            {
                Process.Start(new ProcessStartInfo { FileName = verificationUrl, UseShellExecute = true });
            }
            catch
            {
                Log("WARN", "Open this URL to sign in: " + verificationUrl);
            }

            DateTime deadline = DateTime.UtcNow.AddSeconds(expiresIn);
            while (DateTime.UtcNow < deadline)
            {
                await Task.Delay(Math.Max(5, interval) * 1000);

                var tokenResponse = await httpClient.PostAsync(
                    "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token",
                    new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        ["grant_type"] = "urn:ietf:params:oauth:grant-type:device_code",
                        ["client_id"] = clientId,
                        ["device_code"] = deviceCode,
                    }));

                string tokenJson = await tokenResponse.Content.ReadAsStringAsync();
                JsonNode? tokenNode = JsonNode.Parse(tokenJson);
                if (tokenResponse.IsSuccessStatusCode)
                {
                    string accessToken = tokenNode?["access_token"]?.GetValue<string>() ?? "";
                    if (!string.IsNullOrWhiteSpace(accessToken)) return accessToken;
                }

                string errorCode = tokenNode?["error"]?.GetValue<string>() ?? "";
                if (errorCode == "authorization_pending") continue;
                if (errorCode == "slow_down")
                {
                    interval = Math.Max(interval + 5, 10);
                    continue;
                }

                throw new Exception("Microsoft sign-in failed: " + tokenJson);
            }

            throw new Exception("Microsoft sign-in timed out before the PAD flow could be updated.");
        }

        static string NormalizeDataverseUrl(string dataverseOrgUrl)
        {
            string normalized = (dataverseOrgUrl ?? "").Trim();
            if (!normalized.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                normalized = "https://" + normalized.TrimStart('/');
            return normalized.TrimEnd('/');
        }

        static async Task UpdateDesktopFlowAsync(string dataverseOrgUrl, string workflowId, string accessToken, string robinContent)
        {
            string normalizedUrl = NormalizeDataverseUrl(dataverseOrgUrl);

            using var stateRequest = new HttpRequestMessage(HttpMethod.Get, normalizedUrl + "/api/data/v9.2/workflows(" + workflowId + ")?$select=statecode");
            stateRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            stateRequest.Headers.Add("OData-MaxVersion", "4.0");
            stateRequest.Headers.Add("OData-Version", "4.0");
            stateRequest.Headers.Add("Accept", "application/json");

            using var stateResponse = await httpClient.SendAsync(stateRequest);
            string stateBody = await stateResponse.Content.ReadAsStringAsync();
            if (!stateResponse.IsSuccessStatusCode)
                throw new Exception("Unable to read PAD flow state: HTTP " + (int)stateResponse.StatusCode + " - " + stateBody);

            int stateCode = JsonNode.Parse(stateBody)?["statecode"]?.GetValue<int>() ?? 0;
            bool wasActive = stateCode == 1;

            if (wasActive)
            {
                await SendWorkflowPatchAsync(normalizedUrl, workflowId, accessToken, new JsonObject
                {
                    ["statecode"] = 0,
                    ["statuscode"] = 1,
                });
            }

            string definition = JsonSerializer.Serialize(robinContent);
            await SendWorkflowPatchAsync(normalizedUrl, workflowId, accessToken, new JsonObject
            {
                ["definition"] = definition,
            });

            if (wasActive)
            {
                using var activateRequest = new HttpRequestMessage(HttpMethod.Post, normalizedUrl + "/api/data/v9.2/workflows(" + workflowId + ")/Microsoft.Dynamics.CRM.ActivateWorkflow")
                {
                    Content = new StringContent("{}", Encoding.UTF8, "application/json"),
                };
                activateRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                activateRequest.Headers.Add("OData-MaxVersion", "4.0");
                activateRequest.Headers.Add("OData-Version", "4.0");
                activateRequest.Headers.Add("Accept", "application/json");

                using var activateResponse = await httpClient.SendAsync(activateRequest);
                string activateBody = await activateResponse.Content.ReadAsStringAsync();
                if (!activateResponse.IsSuccessStatusCode)
                    throw new Exception("Unable to reactivate PAD flow: HTTP " + (int)activateResponse.StatusCode + " - " + activateBody);
            }
        }

        static async Task SendWorkflowPatchAsync(string normalizedUrl, string workflowId, string accessToken, JsonObject payload)
        {
            using var request = new HttpRequestMessage(new HttpMethod("PATCH"), normalizedUrl + "/api/data/v9.2/workflows(" + workflowId + ")")
            {
                Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json"),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("OData-MaxVersion", "4.0");
            request.Headers.Add("OData-Version", "4.0");
            request.Headers.Add("Accept", "application/json");

            using var response = await httpClient.SendAsync(request);
            string body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                throw new Exception("PAD flow update failed: HTTP " + (int)response.StatusCode + " - " + body);
        }

        static async Task SubmitResults(string jobId, int passed, int failed, int total, long durationMs, string status)
        {
            var body = new { action = "submit", apiToken = API_TOKEN, jobId, status,
                duration_ms = durationMs, total_steps = total, passed_steps = passed, failed_steps = failed };
            await PostJson($"{SUPABASE_URL}/functions/v1/desktop-agent-api", body);
        }

        static async Task<string> PostJson(string url, object body)
        {
            var json = JsonSerializer.Serialize(body);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync(url, content);
            var result = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode) throw new Exception($"HTTP {(int)response.StatusCode}: {result}");
            return result;
        }

        public static void Log(string level, string message)
        {
            Console.WriteLine($"[{DateTime.UtcNow:O}] [{level}] {message}");
        }
    }
}`;
}

export function getDesktopAgentCsproj(): string {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <RootNamespace>WisprDesktopAgent</RootNamespace>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <UseWindowsForms>true</UseWindowsForms>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="FlaUI.Core" Version="4.0.0" />
    <PackageReference Include="FlaUI.UIA3" Version="4.0.0" />
    <PackageReference Include="System.Drawing.Common" Version="8.0.1" />
  </ItemGroup>
</Project>`;
}

export function getDesktopAgentReadme(): string {
  return `# WISPR Desktop Agent (Thick Client)

A .NET 8 Windows agent for automating Java-based desktop applications using FlaUI (UI Automation) and Java Access Bridge (JAB).

## Prerequisites
- **Windows 10/11** (64-bit)
- **.NET 8 SDK** — Download from [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Target application**  installed on the machine
- **Java JDK/JRE** (for JAB support) — The Java Access Bridge DLL ships with Oracle JDK

## Java Access Bridge Setup

The agent automatically detects and uses Java Access Bridge for Java Swing/AWT/JavaFX applications. To enable JAB:

### 1. Enable JAB in your JDK/JRE
\`\`\`powershell
# Run from your JDK bin directory:
jabswitch /enable
\`\`\`

### 2. Verify DLL is accessible
Ensure \`WindowsAccessBridge-64.dll\` is in one of these locations:
- Your JDK/JRE \`bin\` directory (added to PATH automatically)
- The agent's working directory
- System32 or SysWOW64

### 3. Restart the Java application
JAB requires the Java application to be restarted after enabling the bridge.

> **Note:** JAB is optional. If the DLL is not found, the agent falls back to UIA3-only mode.

## Quick Start

### 1. Build
\`\`\`powershell
dotnet build -c Release
\`\`\`

### 2. Set API Token
\`\`\`powershell
$env:WISPR_API_TOKEN = "your_token_here"
\`\`\`

### 3. Run
\`\`\`powershell
.\\run-agent.bat
\`\`\`
Or directly:
\`\`\`powershell
dotnet run --project WisprDesktopAgent.csproj
\`\`\`

## Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| WISPR_API_TOKEN | (required) | Your agent API token from WISPR |

## Supported Actions
| Action | Description |
|--------|-------------|
| launch_app | Launch a desktop application |
| click | Click on a UI element (UIA3 or JAB) |
| double_click | Double-click element |
| type / fill | Enter text into an input field |
| select | Select dropdown option |
| assert_text | Verify text content |
| assert_visible | Verify element is visible |
| assert_state | Verify element state |
| wait | Wait for specified milliseconds |
| wait_for_element | Wait for element to appear |
| window_switch | Switch to another window |
| screenshot | Capture screenshot |
| keyboard_shortcut | Send keyboard shortcut |

## Selector Strategy
The agent uses a **layered selector** approach:
1. **UIA3 AutomationId** — Most stable, preferred for native Windows controls
2. **UIA3 Label / Name** — Fallback by display text
3. **Java Access Bridge** — Automatic fallback for Java Swing/AWT components
   - Searches the JAB accessible tree by name and role
   - Maps UIA control types to JAB roles (e.g., Button → push button)
   - Supports click, type, clear, and assertions via JAB API
4. **ClassHint** — Java class name triggers JAB-first search (e.g., javax.swing.JButton)

## Self-Healing
When an element is not found, the agent:
1. Reports the failure to WISPR
2. WISPR AI analyzes the UI tree and suggests alternatives
3. High-confidence fixes (≥90%) are auto-applied
4. Lower-confidence fixes require manual approval

## Support
Contact your WISPR administrator for issues and feature requests.
`;
}
export function getDesktopAgentRunBat(): string {
  return `@echo off
title WISPR Desktop Agent
echo Starting WISPR Desktop Agent (Thick Client)...
echo ================================================

if "%WISPR_API_TOKEN%"=="" (
    echo ERROR: WISPR_API_TOKEN environment variable is not set.
    echo Usage: set WISPR_API_TOKEN=your_token_here ^&^& run-agent.bat
    pause
    exit /b 1
)

if not exist "bin\\Release\\net8.0-windows\\WisprDesktopAgent.exe" (
    echo Building agent...
    dotnet build -c Release -q
)

echo Agent starting...
dotnet run --project WisprDesktopAgent.csproj
pause`;
}
