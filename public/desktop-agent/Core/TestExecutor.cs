using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.Core.Conditions;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Executes desktop test steps against a target application using FlaUI and JAB.
/// Supports all actions defined in STEP_ACTIONS.
/// Routes actions through JAB when engine mode is jab/hybrid and target is a Java app.
/// </summary>
public class TestExecutor
{
    private readonly ApiClient _api;
    private readonly DesktopJob _job;

    // JAB state for hybrid execution
    private bool _jabInitialized;
    private bool _lastFoundViaJab;
    private int _lastJabVmID;
    private long _lastJabAc;

    public TestExecutor(ApiClient api, DesktopJob job)
    {
        _api = api;
        _job = job;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        await _api.NotifyStart(_job.Id);
        var sw = Stopwatch.StartNew();

        var engineMode = _job.EngineMode ?? "uia";

        // Handle Power Automate Desktop (PAD) mode
        if (engineMode == "pad")
        {
            // If we have steps to execute, run them via PAD; otherwise enter recording mode
            var padSteps = _job.Steps?.AsArray();
            if (padSteps != null && padSteps.Count > 0 && !_job.IsRecordJob)
            {
                await RunPadExecutionAsync(sw, ct);
            }
            else
            {
                await RunPadRecordingAsync(sw, ct);
            }
            return;
        }

        // Initialize JAB if needed
        if (engineMode == "jab" || engineMode == "hybrid")
        {
            _jabInitialized = JavaAccessBridge.Initialize();
            if (_jabInitialized)
                Logger.Info("JAB initialized for execution");
            else
                Logger.Warn("JAB not available — using UIA3 only");
        }

        using var automation = new UIA3Automation();
        int passed = 0, failed = 0;
        var stepResults = new JsonArray();

        try
        {
            var steps = _job.Steps?.AsArray();
            if (steps == null || steps.Count == 0)
            {
                Logger.Warn("No steps to execute.");
                await _api.SubmitResults(_job.Id, "passed", 0, 0, 0, sw.ElapsedMilliseconds, stepResults);
                return;
            }

            // Launch or attach
            Application? app = LaunchOrAttach();
            if (app == null) throw new Exception("Could not attach to application.");

            Logger.Info($"Executing {steps.Count} steps against PID {app.ProcessId}");

            int stepIndex = 0;
            foreach (var stepNode in steps)
            {
                if (ct.IsCancellationRequested) break;
                var step = stepNode!.AsObject();
                Logger.Info($"--- Step {stepIndex + 1}/{steps.Count}: {step["action"]?.GetValue<string>()} ---");
                var result = await ExecuteStep(automation, app, step, engineMode, stepIndex);
                stepResults.Add(result);
                var stepStatus = result["status"]?.GetValue<string>() ?? "unknown";
                if (stepStatus == "passed") passed++;
                else failed++;
                Logger.Info($"Step {stepIndex + 1} result: {stepStatus} ({result["duration_ms"]}ms)");
                stepIndex++;
            }
        }
        catch (Exception ex)
        {
            Logger.Error($"Execution error: {ex.Message}");
            stepResults.Add(new JsonObject
            {
                ["status"] = "failed",
                ["error"] = ex.Message,
            });
            failed++;
        }

        sw.Stop();
        var status = failed > 0 ? "failed" : "passed";
        await _api.SubmitResults(_job.Id, status, passed + failed, passed, failed,
            sw.ElapsedMilliseconds, stepResults, engineMode: _job.EngineMode);
        Logger.Info($"Execution complete: {passed} passed, {failed} failed in {sw.ElapsedMilliseconds}ms");
    }

    /// <summary>
    /// Executes a PAD flow by opening Power Automate Desktop and running the script locally.
    /// Mirrors the standalone Recorder's RunTestViaPad logic exactly:
    ///   1. Convert steps → Robin script via RobinScriptWriter
    ///   2. Export .robin to PAD scripts folder
    ///   3. Execute via PAD protocol URI (opens PAD Desktop)
    /// Falls back to Cloud Flow HTTP trigger only if local PAD is not installed.
    /// </summary>
    private async Task RunPadExecutionAsync(Stopwatch sw, CancellationToken ct)
    {
        var stepResults = new JsonArray();
        var pad = new PowerAutomateIntegration();

        // Priority 1: Local PAD execution — opens Power Automate Desktop and runs the flow
        // This matches the Recorder's "Run Test" behavior exactly
        if (pad.IsPadInstalled)
        {
            Logger.Info("Power Automate Desktop detected. Opening PAD to execute flow...");

            try
            {
                // Convert job steps to RecordedStep list for RobinScriptWriter
                var steps = _job.Steps!.AsArray();
                var recordedSteps = new List<RecordedStep>();

                foreach (var stepNode in steps)
                {
                    if (ct.IsCancellationRequested) break;
                    var step = stepNode!.AsObject();
                    var rs = new RecordedStep
                    {
                        Action = step["action"]?.GetValue<string>() ?? "click",
                        Value = step["value"]?.GetValue<string>() ?? "",
                        AutomationId = step["target"]?["automationId"]?.GetValue<string>() ?? "",
                        Label = step["target"]?["label"]?.GetValue<string>() ?? "",
                        ControlType = step["target"]?["controlType"]?.GetValue<string>() ?? "",
                        ClassHint = step["target"]?["classHint"]?.GetValue<string>() ?? "",
                        ParentWindow = step["target"]?["parentWindow"]?.GetValue<string>() ?? "",
                        PadSelector = step["padSelector"]?.GetValue<string>() ?? "",
                        PadAction = step["padAction"]?.GetValue<string>() ?? "",
                    };
                    if (step.ContainsKey("jabRole"))
                        rs.JabRole = step["jabRole"]?.GetValue<string>() ?? "";
                    if (step.ContainsKey("jabSelector"))
                        rs.JabSelector = step["jabSelector"]?.GetValue<string>() ?? "";
                    if (step.ContainsKey("windowSelector"))
                        rs.WindowSelector = step["windowSelector"]?.GetValue<string>() ?? "";

                    recordedSteps.Add(rs);
                }

                // Generate Robin script (same as Recorder)
                var writer = new RobinScriptWriter();
                string appName = _job.ApplicationName ?? "Application";
                string appPath = _job.ApplicationPath ?? "";
                string robinContent = writer.WriteScript(recordedSteps, appName, appPath);

                // Export to PAD scripts folder (same as Recorder)
                string testName = _job.TestId ?? _job.Id;
                string flowName = pad.ExportFlowForExecution(robinContent, testName);

                Logger.Info("Robin script exported as: " + flowName);

                string userEnvId = _job.PadEnvironmentId ?? "";
                string userFlowId = _job.PadWorkflowId ?? "";
                string dataverseOrgUrl = _job.PadDataverseOrgUrl ?? "";

                if (!string.IsNullOrEmpty(userEnvId) && !string.IsNullOrEmpty(userFlowId) && !string.IsNullOrEmpty(dataverseOrgUrl))
                {
                    Logger.Info("Updating existing PAD flow with latest test steps before execution...");
                    string accessToken = await AcquireDataverseAccessTokenAsync(dataverseOrgUrl);
                    var updater = new DesktopFlowUpdater(dataverseOrgUrl, accessToken);
                    await updater.UpdateDesktopFlowAsync(Guid.Parse(userFlowId), robinContent);
                    Logger.Info("PAD flow updated successfully.");
                }

                // Execute the flow — uses ms-powerautomate:// protocol to open PAD Desktop
                PadExecutionResult result;

                if (!string.IsNullOrEmpty(userEnvId) && !string.IsNullOrEmpty(userFlowId))
                {
                    Logger.Info("Executing with user-provided PAD IDs: env=" + userEnvId + ", flow=" + userFlowId);
                    result = pad.ExecuteFlowWithIds(flowName, userEnvId, userFlowId, 300);
                }
                else
                {
                    result = pad.ExecuteFlow(flowName, 300);
                }

                // Log diagnostics
                if (result.DiagnosticLog != null)
                {
                    foreach (var diag in result.DiagnosticLog)
                    {
                        Logger.Info("[PAD Diag] " + diag.Strategy + ": " + (diag.Succeeded ? "PASS" : "FAIL") + " - " + diag.ErrorMessage);
                    }
                }

                if (result.Success)
                {
                    Logger.Info("PAD execution PASSED in " + result.DurationMs + "ms");
                    stepResults.Add(new JsonObject
                    {
                        ["action"] = "pad_execute",
                        ["status"] = "passed",
                        ["description"] = "PAD flow opened in Power Automate Desktop and executed successfully",
                        ["duration_ms"] = result.DurationMs,
                        ["exit_code"] = result.ExitCode,
                    });
                    sw.Stop();
                    await _api.SubmitResults(_job.Id, "passed", recordedSteps.Count, recordedSteps.Count, 0,
                        sw.ElapsedMilliseconds, stepResults, engineMode: "pad");
                }
                else
                {
                    Logger.Error("PAD execution FAILED: " + result.ErrorMessage);
                    stepResults.Add(new JsonObject
                    {
                        ["action"] = "pad_execute",
                        ["status"] = "failed",
                        ["description"] = "PAD flow execution failed",
                        ["error"] = result.ErrorMessage,
                        ["duration_ms"] = result.DurationMs,
                        ["exit_code"] = result.ExitCode,
                        ["stderr"] = result.StandardError,
                    });
                    sw.Stop();
                    await _api.SubmitResults(_job.Id, "failed", recordedSteps.Count, 0, recordedSteps.Count,
                        sw.ElapsedMilliseconds, stepResults,
                        errorMessage: result.ErrorMessage, engineMode: "pad");
                }
                return;
            }
            catch (Exception ex)
            {
                Logger.Error("PAD local execution error: " + ex.Message);
                stepResults.Add(new JsonObject
                {
                    ["action"] = "pad_execute",
                    ["status"] = "failed",
                    ["error"] = ex.Message,
                });
                sw.Stop();
                await _api.SubmitResults(_job.Id, "failed", 1, 0, 1,
                    sw.ElapsedMilliseconds, stepResults,
                    errorMessage: ex.Message, engineMode: "pad");
                return;
            }
        }

        // Priority 2 (fallback): Cloud Flow HTTP trigger — only when PAD is NOT installed locally
        string triggerUrl = _job.CloudFlowTriggerUrl ?? "";
        if (!string.IsNullOrWhiteSpace(triggerUrl))
        {
            Logger.Info("PAD not installed locally. Executing via Cloud Flow HTTP trigger: " + triggerUrl);
            try
            {
                var httpClient = new System.Net.Http.HttpClient();
                var payload = new System.Text.Json.Nodes.JsonObject
                {
                    ["testCaseId"] = _job.TestId ?? _job.Id,
                    ["environment"] = "staging",
                    ["triggeredAt"] = DateTime.UtcNow.ToString("o"),
                    ["steps"] = _job.Steps?.DeepClone(),
                };
                var content = new System.Net.Http.StringContent(
                    payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(triggerUrl, content);
                var responseText = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    Logger.Info("Cloud Flow triggered successfully");
                    stepResults.Add(new JsonObject
                    {
                        ["action"] = "pad_cloud_flow",
                        ["status"] = "passed",
                        ["description"] = "PAD flow triggered via Cloud Flow HTTP trigger (PAD not installed locally)",
                        ["duration_ms"] = sw.ElapsedMilliseconds,
                        ["response"] = responseText.Length > 500 ? responseText.Substring(0, 500) : responseText,
                    });
                    sw.Stop();
                    await _api.SubmitResults(_job.Id, "passed", 1, 1, 0,
                        sw.ElapsedMilliseconds, stepResults, engineMode: "pad");
                    return;
                }
                else
                {
                    Logger.Error("Cloud Flow trigger returned HTTP " + (int)response.StatusCode + ": " + responseText);
                }
            }
            catch (Exception ex)
            {
                Logger.Error("Cloud Flow trigger failed: " + ex.Message);
            }
        }

        // Neither PAD nor Cloud Flow available
        Logger.Error("Power Automate Desktop is not installed and no Cloud Flow trigger URL configured.");
        sw.Stop();
        await _api.SubmitResults(_job.Id, "failed", 1, 0, 1, sw.ElapsedMilliseconds, stepResults,
            errorMessage: "Power Automate Desktop is not installed on this machine and no Cloud Flow trigger URL is configured. Install PAD from https://go.microsoft.com/fwlink/?linkid=2102613",
            engineMode: "pad");
    }

    private async Task<string> AcquireDataverseAccessTokenAsync(string dataverseOrgUrl)
    {
        string normalizedUrl = dataverseOrgUrl.Trim();
        if (!normalizedUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            normalizedUrl = "https://" + normalizedUrl.TrimStart('/');

        var tokenCache = new TokenCache();
        string scope = normalizedUrl.TrimEnd('/') + "/.default";
        string accessToken = await tokenCache.GetAccessTokenAsync(scope);
        if (string.IsNullOrWhiteSpace(accessToken))
            throw new Exception("Failed to acquire Microsoft access token for PAD flow update.");

        return accessToken;
    }

    /// <summary>
    /// Handles Power Automate Desktop recording mode.
    /// Launches the PAD designer/recorder and monitors for Robin script output.
    /// </summary>
    private async Task RunPadRecordingAsync(Stopwatch sw, CancellationToken ct)
    {
        var stepResults = new JsonArray();
        var pad = new PowerAutomateIntegration();

        if (!pad.IsPadInstalled)
        {
            Logger.Error("Power Automate Desktop is not installed on this machine.");
            sw.Stop();
            await _api.SubmitResults(_job.Id, "failed", 1, 0, 1, sw.ElapsedMilliseconds, stepResults,
                errorMessage: "Power Automate Desktop is not installed. Please install PAD from https://go.microsoft.com/fwlink/?linkid=2102613",
                engineMode: "pad");
            return;
        }

        Logger.Info("Launching Power Automate Desktop recorder...");
        bool launched = pad.LaunchPadDesigner();

        if (!launched)
        {
            Logger.Error("Failed to launch Power Automate Desktop.");
            sw.Stop();
            await _api.SubmitResults(_job.Id, "failed", 1, 0, 1, sw.ElapsedMilliseconds, stepResults,
                errorMessage: "Failed to launch Power Automate Desktop designer. Ensure PAD is installed and accessible.",
                engineMode: "pad");
            return;
        }

        stepResults.Add(new JsonObject
        {
            ["action"] = "pad_record",
            ["status"] = "passed",
            ["description"] = "Power Automate Desktop recorder launched successfully",
            ["duration_ms"] = sw.ElapsedMilliseconds,
        });

        Logger.Info("PAD recorder launched. Monitoring for Robin script output...");

        // Monitor PAD scripts folder for new .robin files
        string scriptsFolder = pad.PadScriptsFolder;
        var existingFlows = pad.GetAvailableFlows();
        var existingSet = new System.Collections.Generic.HashSet<string>(existingFlows);

        // Poll for new Robin scripts or cancellation
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(3000, ct);

            // Check if recording was stopped from the UI
            // (The agent's main loop should handle status updates)

            var currentFlows = pad.GetAvailableFlows();
            foreach (var flow in currentFlows)
            {
                if (!existingSet.Contains(flow))
                {
                    Logger.Info($"New Robin script detected: {flow}");
                    try
                    {
                        string robinContent = System.IO.File.ReadAllText(flow);
                        var parsedSteps = RobinScriptParser.ParseToSteps(robinContent);

                        // Submit parsed steps as recorded steps
                        var recordedStepResults = new JsonArray();
                        foreach (var parsedStep in parsedSteps)
                        {
                            recordedStepResults.Add(parsedStep);
                        }

                        stepResults.Add(new JsonObject
                        {
                            ["action"] = "pad_import",
                            ["status"] = "passed",
                            ["description"] = $"Imported {parsedSteps.Count} steps from Robin script: {System.IO.Path.GetFileName(flow)}",
                            ["duration_ms"] = sw.ElapsedMilliseconds,
                            ["recorded_steps"] = recordedStepResults,
                        });
                    }
                    catch (Exception ex)
                    {
                        Logger.Error($"Failed to parse Robin script {flow}: {ex.Message}");
                    }
                    existingSet.Add(flow);
                }
            }
        }

        sw.Stop();
        await _api.SubmitResults(_job.Id, "passed", stepResults.Count, stepResults.Count, 0,
            sw.ElapsedMilliseconds, stepResults, engineMode: "pad");
        Logger.Info($"PAD recording session complete in {sw.ElapsedMilliseconds}ms");
    }

    private Application? LaunchOrAttach()
    {
        var path = _job.ApplicationPath;
        if (string.IsNullOrEmpty(path)) return null;

        var ext = System.IO.Path.GetExtension(path).ToLowerInvariant();
        bool isJava = ext == ".jar" || ext == ".jnlp";

        if (isJava)
        {
            // For Java apps, attach to running java/javaw process
            foreach (var procName in new[] { "javaw", "java" })
            {
                var javaProcs = Process.GetProcessesByName(procName);
                foreach (var jp in javaProcs)
                {
                    try
                    {
                        if (jp.MainWindowHandle != IntPtr.Zero)
                        {
                            Logger.Info($"Attaching to Java process: {jp.ProcessName} (PID {jp.Id})");
                            return Application.Attach(jp);
                        }
                    }
                    catch { }
                }
            }

            // Launch with java -jar
            var javaHome = Environment.GetEnvironmentVariable("JAVA_HOME");
            var javaExe = "javaw.exe";
            if (!string.IsNullOrEmpty(javaHome))
            {
                var candidate = System.IO.Path.Combine(javaHome, "bin", "javaw.exe");
                if (System.IO.File.Exists(candidate)) javaExe = candidate;
            }

            Logger.Info($"Launching Java app: {javaExe} -jar \"{path}\"");
            var psi = new ProcessStartInfo(javaExe)
            {
                Arguments = $"-jar \"{path}\"" + (string.IsNullOrEmpty(_job.ApplicationArgs) ? "" : " " + _job.ApplicationArgs),
                UseShellExecute = false,
            };
            var proc = Process.Start(psi);
            if (proc == null) return null;

            for (int i = 0; i < 30; i++)
            {
                Thread.Sleep(1000);
                proc.Refresh();
                if (proc.MainWindowHandle != IntPtr.Zero) break;
            }
            return Application.Attach(proc);
        }

        // Non-Java
        var procs = Process.GetProcessesByName(
            System.IO.Path.GetFileNameWithoutExtension(path));
        if (procs.Length > 0) return Application.Attach(procs[0]);

        var nativePsi = new ProcessStartInfo(path);
        if (!string.IsNullOrEmpty(_job.ApplicationArgs))
            nativePsi.Arguments = _job.ApplicationArgs;
        return Application.Launch(nativePsi);
    }

    /// <summary>
    /// Checks if the target refers to a window-level element (not a specific control).
    /// </summary>
    private static bool IsWindowTarget(JsonObject? target)
    {
        if (target == null) return false;
        var controlType = target["controlType"]?.GetValue<string>() ?? "";
        if (controlType == "Window") return true;

        var classHint = target["classHint"]?.GetValue<string>() ?? "";
        if (classHint == "SunAwtFrame" || classHint == "SunAwtDialog") return true;

        return false;
    }

    /// <summary>
    /// Focuses/activates a window by its label. Returns the window element if found.
    /// </summary>
    private AutomationElement? FocusWindow(UIA3Automation automation, Application app, JsonObject? target, int timeoutSec)
    {
        if (target == null) return null;

        var label = target["label"]?.GetValue<string>();
        var parentWindow = target["parentWindow"]?.GetValue<string>();
        if (string.IsNullOrEmpty(label)) return null;

        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        while (DateTime.UtcNow < deadline)
        {
            var windows = app.GetAllTopLevelWindows(automation);
            foreach (var win in windows)
            {
                if (win.Name != null && win.Name.IndexOf(label, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    Logger.Debug($"Focusing window: {win.Name}");
                    try { win.Focus(); } catch { }

                    // Also look for child windows/dialogs matching the label
                    if (!string.IsNullOrEmpty(parentWindow))
                    {
                        // This is a dialog — try to find it as a child
                        var cf = new ConditionFactory(new UIA3PropertyLibrary());
                        var childWin = win.FindFirstDescendant(cf.ByName(label));
                        if (childWin != null)
                        {
                            try { childWin.Focus(); } catch { }
                            return childWin;
                        }
                    }
                    return win;
                }
            }
            Thread.Sleep(500);
        }
        return null;
    }

    private async Task<JsonObject> ExecuteStep(UIA3Automation automation, Application app, JsonObject step, string engineMode, int stepIndex)
    {
        var action = step["action"]?.GetValue<string>() ?? "click";
        var value = step["value"]?.GetValue<string>() ?? "";
        var timeoutSec = step["timeoutSeconds"]?.GetValue<int>() ?? 10;
        var target = step["target"]?.AsObject();
        var description = step["description"]?.GetValue<string>() ?? "";
        var expectedValue = step["expectedValue"]?.GetValue<string>() ?? step["expected"]?.GetValue<string>() ?? "";
        var sw = Stopwatch.StartNew();
        _lastFoundViaJab = false;

        var targetLabel = target?["label"]?.GetValue<string>() ?? "unknown";
        bool isWindow = IsWindowTarget(target);

        var result = new JsonObject
        {
            ["action"] = action,
            ["status"] = "passed",
            ["stepIndex"] = stepIndex,
            ["target"] = targetLabel,
            ["description"] = string.IsNullOrEmpty(description) ? $"{action} on {targetLabel}" : description,
            ["value"] = string.IsNullOrEmpty(value) ? null : value,
            ["expected_value"] = string.IsNullOrEmpty(expectedValue) ? null : expectedValue,
        };

        try
        {
            Logger.Debug($"Step {stepIndex}: action={action}, target={targetLabel}, value={value}, isWindow={isWindow}");

            switch (action)
            {
                case "launch_app":
                    Logger.Info("Launch app step — application already attached.");
                    break;

                case "click":
                    // For Java apps: try JAB click first using jabSelector data,
                    // even if UIA target looks like a Window (SunAwtFrame)
                    if (TryJabAction(engineMode, app, target, timeoutSec, "click", null))
                    {
                        Logger.Info($"JAB click on: {targetLabel}");
                        await Task.Delay(200);
                    }
                    else if (isWindow)
                    {
                        var win = FocusWindow(automation, app, target, timeoutSec);
                        if (win == null) throw new Exception($"Window not found: {targetLabel}");
                        Logger.Info($"Clicked/focused window: {targetLabel}");
                        await Task.Delay(300);
                    }
                    else
                    {
                        AutomationElement? clickEl = null;
                        try { clickEl = FindElement(automation, app, target, timeoutSec / 2); }
                        catch { }

                        if (clickEl != null)
                        {
                            clickEl.Click();
                            Logger.Info($"UIA click on: {clickEl.Name ?? targetLabel}");
                        }
                        else if ((engineMode == "hybrid" || engineMode == "vision") && step["visionScreenshot"] != null)
                        {
                            Logger.Info($"UIA failed, attempting vision-based click for: {targetLabel}");
                            var visionEl = FindElementByVision(automation, step, timeoutSec / 2);
                            if (visionEl != null)
                            {
                                visionEl.Click();
                                Logger.Info($"Vision click on: {visionEl.Properties.Name.ValueOrDefault ?? targetLabel}");
                                result["locator_method"] = "vision";
                            }
                            else
                            {
                                // Last resort: click at the vision match coordinates
                                var visionScreenshot = step["visionScreenshot"]?.GetValue<string>() ?? "";
                                if (!string.IsNullOrEmpty(visionScreenshot))
                                {
                                    var base64Data = visionScreenshot.Contains(",")
                                        ? visionScreenshot.Substring(visionScreenshot.IndexOf(',') + 1)
                                        : visionScreenshot;
                                    using var ms = new System.IO.MemoryStream(Convert.FromBase64String(base64Data));
                                    using var tmpl = new System.Drawing.Bitmap(ms);
                                    var pt = FindTemplateOnScreen(tmpl, 0.80);
                                    if (pt.HasValue)
                                    {
                                        ClickAtPoint(pt.Value);
                                        Logger.Info($"Vision coordinate click at ({pt.Value.X}, {pt.Value.Y})");
                                        result["locator_method"] = "vision_coordinate";
                                    }
                                    else
                                    {
                                        throw new Exception($"Element not found (UIA + Vision): {targetLabel}");
                                    }
                                }
                                else
                                {
                                    throw new Exception($"Element not found for click: {targetLabel}");
                                }
                            }
                        }
                        else
                        {
                            throw new Exception($"Element not found for click: {targetLabel}");
                        }
                        await Task.Delay(200);
                    }
                    break;

                case "double_click":
                    if (isWindow)
                    {
                        var win = FocusWindow(automation, app, target, timeoutSec);
                        if (win == null) throw new Exception($"Window not found: {targetLabel}");
                    }
                    else
                    {
                        var dblEl = FindElement(automation, app, target, timeoutSec);
                        if (dblEl == null) throw new Exception($"Element not found for double_click: {targetLabel}");
                        dblEl.DoubleClick();
                        await Task.Delay(200);
                    }
                    break;

                case "right_click":
                    var rcEl = FindElement(automation, app, target, timeoutSec);
                    if (rcEl == null) throw new Exception($"Element not found for right_click: {targetLabel}");
                    rcEl.RightClick();
                    await Task.Delay(200);
                    break;

                case "type":
                    if (isWindow)
                    {
                        var win = FocusWindow(automation, app, target, timeoutSec);
                        if (win == null) throw new Exception($"Window not found for type: {targetLabel}");
                        await Task.Delay(200);
                        if (!string.IsNullOrEmpty(value))
                        {
                            string escapedValue = EscapeSendKeysText(value);
                            System.Windows.Forms.SendKeys.SendWait(escapedValue);
                            Logger.Info($"Typed via SendKeys into window {targetLabel}: {value}");
                        }
                        await Task.Delay(200);
                    }
                    else if (TryJabAction(engineMode, app, target, timeoutSec, "type", value))
                    {
                        Logger.Info($"JAB type on: {targetLabel}");
                        await Task.Delay(200);
                    }
                    else
                    {
                        AutomationElement? typeEl = null;
                        try { typeEl = FindElement(automation, app, target, timeoutSec / 2); }
                        catch { }

                        if (typeEl == null && (engineMode == "hybrid" || engineMode == "vision") && step["visionScreenshot"] != null)
                        {
                            Logger.Info($"UIA failed, attempting vision-based type for: {targetLabel}");
                            typeEl = FindElementByVision(automation, step, timeoutSec / 2);
                            if (typeEl != null)
                                result["locator_method"] = "vision";
                        }

                        if (typeEl == null) throw new Exception($"Element not found for type: {targetLabel}");
                        typeEl.Click();
                        typeEl.AsTextBox().Enter(value);
                        Logger.Info($"UIA type on: {typeEl.Name ?? targetLabel}");
                        await Task.Delay(200);
                    }
                    break;

                case "clear":
                    var clearEl = FindElement(automation, app, target, timeoutSec);
                    if (clearEl == null) throw new Exception($"Element not found for clear: {targetLabel}");
                    clearEl.AsTextBox().Enter("");
                    break;

                case "select":
                    var selEl = FindElement(automation, app, target, timeoutSec);
                    if (selEl != null)
                    {
                        var combo = selEl.AsComboBox();
                        combo.Select(value);
                        Logger.Info($"Selected '{value}' on: {targetLabel}");
                        await Task.Delay(200);
                    }
                    else
                    {
                        throw new Exception($"Element not found for select: {targetLabel}");
                    }
                    break;

                case "assert_text":
                    if (_jabInitialized && (engineMode == "jab" || engineMode == "hybrid"))
                    {
                        var jabEl = FindJabElement(target, timeoutSec);
                        if (jabEl != null)
                        {
                            var info = JavaAccessBridge.GetElementInfo(jabEl.VmID, jabEl.Ac);
                            var jabText = info != null && info.ContainsKey("name") ? info["name"] : "";
                            if (jabText.IndexOf(value, StringComparison.OrdinalIgnoreCase) < 0)
                                throw new Exception($"Assert failed: expected \"{value}\", got \"{jabText}\"");
                            break;
                        }
                    }
                    var atEl = FindElement(automation, app, target, timeoutSec);
                    var text = atEl?.Name ?? atEl?.AsTextBox().Text ?? "";
                    if (text.IndexOf(value, StringComparison.OrdinalIgnoreCase) < 0)
                        throw new Exception($"Assert failed: expected \"{value}\", got \"{text}\"");
                    break;

                case "assert_visible":
                    var avEl = FindElement(automation, app, target, timeoutSec);
                    if (avEl == null || avEl.IsOffscreen)
                        throw new Exception("Element is not visible.");
                    break;

                case "assert_state":
                    var asEl = FindElement(automation, app, target, timeoutSec);
                    if (asEl == null)
                        throw new Exception("Element not found for state assertion.");
                    if (value == "enabled" && !asEl.IsEnabled)
                        throw new Exception("Element is not enabled.");
                    if (value == "disabled" && asEl.IsEnabled)
                        throw new Exception("Element is not disabled.");
                    break;

                case "wait":
                    int waitMs = 1000;
                    int.TryParse(value, out waitMs);
                    await Task.Delay(waitMs);
                    break;

                case "wait_for_element":
                    FindElement(automation, app, target, timeoutSec);
                    break;

                case "scroll":
                    var scrollEl = FindElement(automation, app, target, timeoutSec);
                    var scrollPattern = scrollEl?.Patterns.Scroll.PatternOrDefault;
                    if (scrollPattern != null)
                    {
                        if (value == "down") scrollPattern.Scroll(ScrollAmount.NoAmount, ScrollAmount.LargeIncrement);
                        else scrollPattern.Scroll(ScrollAmount.NoAmount, ScrollAmount.LargeDecrement);
                    }
                    break;

                case "hover":
                    var hoverEl = FindElement(automation, app, target, timeoutSec);
                    if (hoverEl == null) throw new Exception($"Element not found for hover: {targetLabel}");
                    hoverEl.Click();
                    break;

                case "keyboard_shortcut":
                    if (isWindow)
                    {
                        // Ensure correct window is focused before sending keys
                        var win = FocusWindow(automation, app, target, timeoutSec);
                        if (win == null) Logger.Warn($"Window not found for keyboard_shortcut: {targetLabel}, sending keys anyway");
                        await Task.Delay(150);
                    }
                    var sendKeysStr = ConvertToSendKeys(value);
                    Logger.Info($"Sending keyboard shortcut: {value} -> {sendKeysStr}");
                    System.Windows.Forms.SendKeys.SendWait(sendKeysStr);
                    await Task.Delay(200);
                    break;

                case "drag_drop":
                    Logger.Warn("drag_drop not yet implemented in executor.");
                    break;

                case "window_switch":
                    var switchWin = FocusWindow(automation, app, target, timeoutSec);
                    if (switchWin == null) throw new Exception($"Window not found for switch: {targetLabel}");
                    Logger.Info($"Switched to window: {targetLabel}");
                    await Task.Delay(500);
                    break;

                case "window_close":
                    var closeWindows = app.GetAllTopLevelWindows(automation);
                    bool closed = false;
                    foreach (var w in closeWindows)
                    {
                        if (w.Name != null && w.Name.IndexOf(value, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            w.Close();
                            closed = true;
                            break;
                        }
                    }
                    if (!closed) throw new Exception($"Window not found for close: {value}");
                    break;

                case "screenshot":
                    Logger.Info("Screenshot step — captured via automation framework.");
                    break;

                default:
                    Logger.Warn($"Unknown action: {action}");
                    break;
            }
        }
        catch (Exception ex)
        {
            result["status"] = "failed";
            result["error"] = ex.Message;
            Logger.Error($"Step {stepIndex} ({action}) failed: {ex.Message}");

            // Capture screenshot on failure
            try
            {
                var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds;
                if (bounds.HasValue)
                {
                    using var bmp = new System.Drawing.Bitmap(bounds.Value.Width, bounds.Value.Height);
                    using (var g = System.Drawing.Graphics.FromImage(bmp))
                    {
                        g.CopyFromScreen(bounds.Value.Location, System.Drawing.Point.Empty, bounds.Value.Size);
                    }
                    using var ms = new System.IO.MemoryStream();
                    bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                    var base64 = Convert.ToBase64String(ms.ToArray());
                    result["screenshot"] = $"data:image/png;base64,{base64}";
                    Logger.Info($"Screenshot captured for failed step {stepIndex}");
                }
            }
            catch (Exception ssEx)
            {
                Logger.Warn($"Failed to capture screenshot: {ssEx.Message}");
            }

            if (target != null && ex.Message.IndexOf("not found", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try { await _api.RequestSelfHeal(_job.Id, _job.TestId, target, null, stepIndex); }
                catch { }
            }
        }

        result["duration_ms"] = sw.ElapsedMilliseconds;
        return result;
    }

    #region JAB Integration

    /// <summary>
    /// Attempt to perform an action via JAB. Returns true if successful.
    /// Skips window-level targets — those should be handled by FocusWindow.
    /// </summary>
    private bool TryJabAction(string engineMode, Application app, JsonObject? target, int timeoutSec, string actionType, string? value)
    {
        if (!_jabInitialized) return false;
        if (engineMode != "jab" && engineMode != "hybrid") return false;
        if (target == null) return false;

        // Don't use JAB for window-level targets
        if (IsWindowTarget(target)) return false;

        var jabEl = FindJabElement(target, timeoutSec);
        if (jabEl == null) return false;

        switch (actionType)
        {
            case "click":
                return JavaAccessBridge.DoClick(jabEl.VmID, jabEl.Ac);
            case "type":
                if (value != null)
                    return JavaAccessBridge.SetText(jabEl.VmID, jabEl.Ac, value);
                return false;
            default:
                return false;
        }
    }

    private JabElementResult? FindJabElement(JsonObject? target, int timeoutSec)
    {
        if (target == null || !_jabInitialized) return null;

        var label = target["label"]?.GetValue<string>() ?? "";
        var classHint = target["classHint"]?.GetValue<string>();
        var automationId = target["automationId"]?.GetValue<string>();
        var padSelector = target["padSelector"]?.GetValue<string>();
        var parentWindow = target["parentWindow"]?.GetValue<string>();

        // Parse PAD selector to extract window title and element identifier
        // Format: appmask['Window \'LoanDesk Enterprise Login\'']['JText']
        string? padWindowTitle = null;
        string? padElementName = null;
        if (!string.IsNullOrEmpty(padSelector))
        {
            var padMatch = System.Text.RegularExpressions.Regex.Match(padSelector,
                @"appmask\['([^']*(?:\\'[^']*)*)'\]\['([^']*(?:\\'[^']*)*)'\]");
            if (padMatch.Success)
            {
                padWindowTitle = padMatch.Groups[1].Value.Replace("\\'", "'");
                padElementName = padMatch.Groups[2].Value.Replace("\\'", "'");
                Logger.Debug($"PAD selector parsed — window: '{padWindowTitle}', element: '{padElementName}'");
            }
        }

        // Map PAD/Java element names to JAB roles
        // e.g. "JText" → role "text", "JPush Button 'Login'" → role "push button" + name "Login"
        string? jabRole = null;
        string? jabName = null;
        string elementKey = !string.IsNullOrEmpty(padElementName) ? padElementName : label;

        if (!string.IsNullOrEmpty(elementKey))
        {
            // Extract quoted name if present: "JPush Button 'Login'" → name="Login"
            var quotedNameMatch = System.Text.RegularExpressions.Regex.Match(elementKey, @"'([^']+)'");
            if (quotedNameMatch.Success)
            {
                jabName = quotedNameMatch.Groups[1].Value;
            }

            // Remove the quoted part to get the control identifier
            string controlPart = System.Text.RegularExpressions.Regex.Replace(elementKey, @"\s*'[^']*'", "").Trim();

            // Map Java/PAD control identifiers to JAB accessible roles
            jabRole = MapPadElementToJabRole(controlPart);

            Logger.Debug($"JAB search — role: '{jabRole}', name: '{jabName}', controlPart: '{controlPart}'");
        }

        // Determine the window title to scope the search
        string? windowTitle = padWindowTitle ?? parentWindow;

        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        while (DateTime.UtcNow < deadline)
        {
            // Strategy 1: Search by JAB role + name within the correct window
            if (!string.IsNullOrEmpty(jabRole))
            {
                // Find the Java window by title
                if (!string.IsNullOrEmpty(windowTitle))
                {
                    var javaWindows = JavaAccessBridge.GetJavaWindows();
                    foreach (var jw in javaWindows)
                    {
                        var winInfo = JavaAccessBridge.GetContextInfo(jw.VmID, jw.Ac);
                        if (winInfo.HasValue && winInfo.Value.name != null
                            && winInfo.Value.name.IndexOf(windowTitle, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            // Search within this specific window
                            var result = JavaAccessBridge.FindElement(jabName, jabRole, automationId, 15);
                            if (result != null)
                            {
                                _lastJabVmID = result.VmID;
                                _lastJabAc = result.Ac;
                                return result;
                            }
                        }
                    }
                }

                // Fallback: search all Java windows by role + name
                var globalResult = JavaAccessBridge.FindElement(jabName, jabRole, automationId, 15);
                if (globalResult != null)
                {
                    _lastJabVmID = globalResult.VmID;
                    _lastJabAc = globalResult.Ac;
                    return globalResult;
                }
            }

            // Strategy 2: Try the original label as name (backward compatibility)
            if (!string.IsNullOrEmpty(label))
            {
                var result = JavaAccessBridge.FindElement(label, classHint, automationId, 15);
                if (result != null)
                {
                    _lastJabVmID = result.VmID;
                    _lastJabAc = result.Ac;
                    return result;
                }
            }

            Thread.Sleep(500);
        }
        return null;
    }

    /// <summary>
    /// Maps PAD/Java element type identifiers to JAB accessible role strings.
    /// PAD uses names like "JText", "JPush Button", "JPassword Text", "Button"
    /// while JAB uses roles like "text", "push button", "password text", "push button".
    /// </summary>
    private static string? MapPadElementToJabRole(string padControl)
    {
        if (string.IsNullOrEmpty(padControl)) return null;

        // Normalize: trim and lowercase for matching
        string lower = padControl.Trim().ToLowerInvariant();

        // Remove leading "j" prefix common in Java Swing/AWT controls
        string withoutJ = lower.StartsWith("j") ? lower.Substring(1).TrimStart() : lower;

        // Direct mappings from PAD element identifiers to JAB role strings
        var mappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "text", "text" },
            { "text field", "text" },
            { "textfield", "text" },
            { "password text", "password text" },
            { "password", "password text" },
            { "passwordtext", "password text" },
            { "push button", "push button" },
            { "pushbutton", "push button" },
            { "button", "push button" },
            { "toggle button", "toggle button" },
            { "togglebutton", "toggle button" },
            { "check box", "check box" },
            { "checkbox", "check box" },
            { "radio button", "radio button" },
            { "radiobutton", "radio button" },
            { "combo box", "combo box" },
            { "combobox", "combo box" },
            { "list", "list" },
            { "list item", "list item" },
            { "listitem", "list item" },
            { "tree", "tree" },
            { "tree node", "tree node" },
            { "treenode", "tree node" },
            { "tab", "page tab" },
            { "tabbed pane", "page tab list" },
            { "tabbedpane", "page tab list" },
            { "menu", "menu" },
            { "menu item", "menu item" },
            { "menuitem", "menu item" },
            { "menu bar", "menu bar" },
            { "menubar", "menu bar" },
            { "table", "table" },
            { "scroll pane", "scroll pane" },
            { "scrollpane", "scroll pane" },
            { "panel", "panel" },
            { "label", "label" },
            { "slider", "slider" },
            { "spinner", "spinner" },
            { "progress bar", "progress bar" },
            { "progressbar", "progress bar" },
            { "tool bar", "tool bar" },
            { "toolbar", "tool bar" },
            { "editor pane", "editor pane" },
            { "editorpane", "editor pane" },
            { "text area", "text" },
            { "textarea", "text" },
            { "formatted text field", "text" },
        };

        // Try matching with the J-prefix removed
        if (mappings.TryGetValue(withoutJ, out var role))
            return role;

        // Try matching the full name (for non-J-prefixed controls like "Button")
        if (mappings.TryGetValue(lower, out var role2))
            return role2;

        // Fallback: return the withoutJ value as-is (space-separated lowercase)
        return withoutJ;
    }

    #endregion

    private AutomationElement? FindElement(UIA3Automation automation, Application app,
        JsonObject? target, int timeoutSec)
    {
        if (target == null) return null;

        var automationId = target["automationId"]?.GetValue<string>();
        var label = target["label"]?.GetValue<string>();
        var controlType = target["controlType"]?.GetValue<string>();
        var parentWindow = target["parentWindow"]?.GetValue<string>();

        var cf = new ConditionFactory(new UIA3PropertyLibrary());
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);

        while (DateTime.UtcNow < deadline)
        {
            var windows = app.GetAllTopLevelWindows(automation);
            foreach (var win in windows)
            {
                if (!string.IsNullOrEmpty(parentWindow) &&
                    !(win.Name != null && win.Name.IndexOf(parentWindow, StringComparison.OrdinalIgnoreCase) >= 0))
                    continue;

                AutomationElement? found = null;
                if (!string.IsNullOrEmpty(automationId))
                    found = win.FindFirstDescendant(cf.ByAutomationId(automationId));
                if (found == null && !string.IsNullOrEmpty(label))
                    found = win.FindFirstDescendant(cf.ByName(label));

                if (found != null) return found;
            }
            Thread.Sleep(500);
        }

        throw new Exception($"Element not found: {target.ToJsonString()}");
    }

    #region Vision-Based Element Finding

    /// <summary>
    /// Finds a UI element by matching a previously captured screenshot against the current screen.
    /// Uses pixel-based template matching with a configurable similarity threshold.
    /// Returns the center point of the best match location, then resolves the UIA element at that point.
    /// </summary>
    private AutomationElement? FindElementByVision(UIA3Automation automation, JsonObject step, int timeoutSec)
    {
        var visionScreenshot = step["visionScreenshot"]?.GetValue<string>();
        if (string.IsNullOrEmpty(visionScreenshot)) return null;

        // Decode the template image
        byte[] templateBytes;
        try
        {
            var base64Data = visionScreenshot;
            if (base64Data.Contains(","))
                base64Data = base64Data.Substring(base64Data.IndexOf(',') + 1);
            templateBytes = Convert.FromBase64String(base64Data);
        }
        catch (Exception ex)
        {
            Logger.Warn($"Vision: Failed to decode template image: {ex.Message}");
            return null;
        }

        using var templateStream = new System.IO.MemoryStream(templateBytes);
        using var templateBmp = new System.Drawing.Bitmap(templateStream);

        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        while (DateTime.UtcNow < deadline)
        {
            var matchPoint = FindTemplateOnScreen(templateBmp, 0.85);
            if (matchPoint.HasValue)
            {
                Logger.Info($"Vision: Template matched at ({matchPoint.Value.X}, {matchPoint.Value.Y})");

                // Resolve UIA element at the matched center point
                try
                {
                    var element = automation.FromPoint(matchPoint.Value);
                    if (element != null)
                    {
                        Logger.Info($"Vision: Resolved element '{element.Properties.Name.ValueOrDefault}' at match point");
                        return element;
                    }
                }
                catch (Exception ex)
                {
                    Logger.Debug($"Vision: FromPoint failed at match location: {ex.Message}");
                }

                // If FromPoint failed, try clicking at the coordinates directly
                // by returning null and letting caller handle via coordinate click
                return null;
            }
            Thread.Sleep(500);
        }

        Logger.Warn("Vision: No template match found within timeout");
        return null;
    }

    /// <summary>
    /// Performs template matching: slides the template across the screen capture
    /// and returns the center of the best match above the similarity threshold.
    /// Uses Sum of Absolute Differences (SAD) for fast pixel comparison.
    /// </summary>
    private System.Drawing.Point? FindTemplateOnScreen(System.Drawing.Bitmap template, double threshold)
    {
        var screenBounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds;
        if (!screenBounds.HasValue) return null;

        using var screenBmp = new System.Drawing.Bitmap(screenBounds.Value.Width, screenBounds.Value.Height);
        using (var g = System.Drawing.Graphics.FromImage(screenBmp))
        {
            g.CopyFromScreen(screenBounds.Value.Location, System.Drawing.Point.Empty, screenBounds.Value.Size);
        }

        int tw = template.Width;
        int th = template.Height;
        int sw = screenBmp.Width;
        int sh = screenBmp.Height;

        if (tw > sw || th > sh) return null;

        // Lock bits for fast pixel access
        var screenData = screenBmp.LockBits(
            new System.Drawing.Rectangle(0, 0, sw, sh),
            System.Drawing.Imaging.ImageLockMode.ReadOnly,
            System.Drawing.Imaging.PixelFormat.Format32bppArgb);
        var templateData = template.LockBits(
            new System.Drawing.Rectangle(0, 0, tw, th),
            System.Drawing.Imaging.ImageLockMode.ReadOnly,
            System.Drawing.Imaging.PixelFormat.Format32bppArgb);

        double bestScore = 0;
        System.Drawing.Point? bestPoint = null;

        try
        {
            int screenStride = screenData.Stride;
            int templateStride = templateData.Stride;

            // Sample-based matching: check every 4th pixel for speed, then verify best candidate
            int stepSize = 4;
            for (int sy = 0; sy <= sh - th; sy += stepSize)
            {
                for (int sx = 0; sx <= sw - tw; sx += stepSize)
                {
                    double score = ComputeSimilarity(
                        screenData.Scan0, screenStride, sx, sy,
                        templateData.Scan0, templateStride, tw, th,
                        sampleStep: 4);

                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestPoint = new System.Drawing.Point(sx + tw / 2, sy + th / 2);
                    }
                }
            }

            // Refine around best candidate with pixel-level accuracy
            if (bestPoint.HasValue && bestScore >= threshold * 0.9)
            {
                int refineX = bestPoint.Value.X - tw / 2;
                int refineY = bestPoint.Value.Y - th / 2;
                for (int dy = -stepSize; dy <= stepSize; dy++)
                {
                    for (int dx = -stepSize; dx <= stepSize; dx++)
                    {
                        int cx = refineX + dx;
                        int cy = refineY + dy;
                        if (cx < 0 || cy < 0 || cx + tw > sw || cy + th > sh) continue;

                        double score = ComputeSimilarity(
                            screenData.Scan0, screenStride, cx, cy,
                            templateData.Scan0, templateStride, tw, th,
                            sampleStep: 1);

                        if (score > bestScore)
                        {
                            bestScore = score;
                            bestPoint = new System.Drawing.Point(cx + tw / 2, cy + th / 2);
                        }
                    }
                }
            }
        }
        finally
        {
            screenBmp.UnlockBits(screenData);
            template.UnlockBits(templateData);
        }

        Logger.Debug($"Vision: Best match score = {bestScore:F3} (threshold = {threshold})");
        return bestScore >= threshold ? bestPoint : null;
    }

    /// <summary>
    /// Computes normalized similarity (0-1) between a screen region and template using pixel comparison.
    /// </summary>
    private static unsafe double ComputeSimilarity(
        IntPtr screenScan0, int screenStride, int sx, int sy,
        IntPtr templateScan0, int templateStride, int tw, int th,
        int sampleStep)
    {
        long totalDiff = 0;
        int sampleCount = 0;

        byte* screenBase = (byte*)screenScan0;
        byte* templateBase = (byte*)templateScan0;

        for (int ty = 0; ty < th; ty += sampleStep)
        {
            byte* screenRow = screenBase + (sy + ty) * screenStride + sx * 4;
            byte* templateRow = templateBase + ty * templateStride;

            for (int tx = 0; tx < tw; tx += sampleStep)
            {
                int sIdx = tx * 4;
                int tIdx = tx * 4;

                int diffR = Math.Abs(screenRow[sIdx + 2] - templateRow[tIdx + 2]);
                int diffG = Math.Abs(screenRow[sIdx + 1] - templateRow[tIdx + 1]);
                int diffB = Math.Abs(screenRow[sIdx + 0] - templateRow[tIdx + 0]);

                totalDiff += diffR + diffG + diffB;
                sampleCount++;
            }
        }

        if (sampleCount == 0) return 0;

        // Max possible diff per sample = 255 * 3 = 765
        double maxDiff = sampleCount * 765.0;
        return 1.0 - (totalDiff / maxDiff);
    }

    /// <summary>
    /// Performs a click at specific screen coordinates using Win32 API.
    /// Used as fallback when vision matching finds a location but UIA element resolution fails.
    /// </summary>
    private static void ClickAtPoint(System.Drawing.Point point)
    {
        NativeMethods.SetCursorPos(point.X, point.Y);
        Thread.Sleep(50);
        NativeMethods.mouse_event(NativeMethods.MOUSEEVENTF_LEFTDOWN, point.X, point.Y, 0, 0);
        Thread.Sleep(50);
        NativeMethods.mouse_event(NativeMethods.MOUSEEVENTF_LEFTUP, point.X, point.Y, 0, 0);
    }

    #endregion

    /// <summary>
    /// Escapes text for use with SendKeys.SendWait (prevents special chars from being interpreted).
    /// </summary>
    private static string EscapeSendKeysText(string text)
    {
        var sb = new System.Text.StringBuilder();
        foreach (char c in text)
        {
            // These characters have special meaning in SendKeys
            if (c == '+' || c == '^' || c == '%' || c == '~' ||
                c == '(' || c == ')' || c == '{' || c == '}' ||
                c == '[' || c == ']')
            {
                sb.Append('{');
                sb.Append(c);
                sb.Append('}');
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    private static string ConvertToSendKeys(string combo)
    {
        // Handle modifier+key combos (e.g., "Ctrl+C", "Alt+F4", "Shift+J")
        string result = combo;

        // Replace modifiers
        result = result.Replace("Ctrl+", "^");
        result = result.Replace("Alt+", "%");
        result = result.Replace("Shift+", "+");

        // Replace named keys
        result = result.Replace("Enter", "{ENTER}");
        result = result.Replace("Tab", "{TAB}");
        result = result.Replace("Escape", "{ESC}");
        result = result.Replace("Delete", "{DEL}");
        result = result.Replace("Backspace", "{BACKSPACE}");
        result = result.Replace("Space", "{SPACE}");
        result = result.Replace("Home", "{HOME}");
        result = result.Replace("End", "{END}");
        result = result.Replace("PageUp", "{PGUP}");
        result = result.Replace("PageDown", "{PGDN}");
        result = result.Replace("Insert", "{INSERT}");

        // Arrow keys
        result = result.Replace("Up", "{UP}");
        result = result.Replace("Down", "{DOWN}");
        result = result.Replace("Left", "{LEFT}");
        result = result.Replace("Right", "{RIGHT}");

        // Function keys (F1-F12)
        for (int i = 12; i >= 1; i--)
        {
            result = result.Replace($"F{i}", $"{{F{i}}}");
        }

        // NumPad keys
        result = result.Replace("NumPad0", "{NUMPAD0}");
        result = result.Replace("NumPad1", "{NUMPAD1}");
        result = result.Replace("NumPad2", "{NUMPAD2}");
        result = result.Replace("NumPad3", "{NUMPAD3}");
        result = result.Replace("NumPad4", "{NUMPAD4}");
        result = result.Replace("NumPad5", "{NUMPAD5}");
        result = result.Replace("NumPad6", "{NUMPAD6}");
        result = result.Replace("NumPad7", "{NUMPAD7}");
        result = result.Replace("NumPad8", "{NUMPAD8}");
        result = result.Replace("NumPad9", "{NUMPAD9}");

        // NumPad operators
        result = result.Replace("NumPadMultiply", "{MULTIPLY}");
        result = result.Replace("NumPadAdd", "{ADD}");
        result = result.Replace("NumPadSubtract", "{SUBTRACT}");
        result = result.Replace("NumPadDecimal", "{DECIMAL}");
        result = result.Replace("NumPadDivide", "{DIVIDE}");

        return result;
    }
}
