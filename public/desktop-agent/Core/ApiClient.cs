using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace WisprDesktopAgent.Core;

public class ApiClient
{
    private readonly HttpClient _http = new();
    private readonly string _apiUrl;
    private readonly string _apiToken;

    public ApiClient(string apiUrl, string apiToken)
    {
        _apiUrl = apiUrl;
        _apiToken = apiToken;
    }

    public virtual async Task SendHeartbeat()
    {
        var body = new JsonObject
        {
            ["action"] = "heartbeat",
            ["apiToken"] = _apiToken,
            ["systemInfo"] = new JsonObject
            {
                ["platform"] = Environment.OSVersion.ToString(),
                ["dotnetVersion"] = Environment.Version.ToString(),
                ["agentType"] = "desktop",
                ["machineName"] = Environment.MachineName,
            },
            ["capabilities"] = new JsonObject
            {
                ["engines"] = new JsonArray("uia", "jab"),
                ["recording"] = true,
                ["supportedActions"] = new JsonArray(
                    "click", "double_click", "right_click", "type", "clear",
                    "select", "scroll", "hover", "keyboard_shortcut", "drag_drop",
                    "assert_text", "assert_state", "assert_visible",
                    "wait", "wait_for_element", "window_switch", "window_close",
                    "screenshot", "launch_app"
                ),
            },
        };
        await PostAsync(body);
        Logger.Debug("Heartbeat sent.");
    }

    public async Task<DesktopJob?> PollForJob()
    {
        var body = new JsonObject
        {
            ["action"] = "poll",
            ["apiToken"] = _apiToken,
        };
        var resp = await PostAsync(body);
        var jobs = resp?["jobs"]?.AsArray();
        if (jobs == null || jobs.Count == 0) return null;

        var j = jobs[0]!;
        return new DesktopJob
        {
            Id = j["id"]?.GetValue<string>() ?? "",
            RunId = j["run_id"]?.GetValue<string>(),
            ApplicationPath = j["application_path"]?.GetValue<string>(),
            ApplicationArgs = j["application_args"]?.GetValue<string>(),
            EngineMode = j["engine_mode"]?.GetValue<string>() ?? "uia",
            Steps = j["steps"],
            Selectors = j["selectors"],
            TestId = j["test_id"]?.GetValue<string>(),
            IsRecordJob = DetectRecordJob(j),
            PadEnvironmentId = j["pad_environment_id"]?.GetValue<string>(),
            PadWorkflowId = j["pad_workflow_id"]?.GetValue<string>(),
            CloudFlowTriggerUrl = j["cloud_flow_trigger_url"]?.GetValue<string>(),
            PadDataverseOrgUrl = j["pad_dataverse_org_url"]?.GetValue<string>(),
            ApplicationName = j["application_name"]?.GetValue<string>(),
        };
    }

    private static bool DetectRecordJob(JsonNode j)
    {
        var engineMode = j["engine_mode"]?.GetValue<string>() ?? "";
        if (engineMode == "record") return true;

        var steps = j["steps"]?.AsArray();
        if (steps == null || steps.Count == 0) return true;

        // UI sends steps: [{ action: 'record', ... }] for recording jobs
        var firstAction = steps[0]?["action"]?.GetValue<string>();
        return firstAction == "record";
    }

    public virtual async Task NotifyStart(string jobId)
    {
        await PostAsync(new JsonObject
        {
            ["action"] = "start",
            ["apiToken"] = _apiToken,
            ["jobId"] = jobId,
        });
    }

    public async Task SubmitRecordStep(string jobId, JsonObject step)
    {
        await PostAsync(new JsonObject
        {
            ["action"] = "record-step",
            ["apiToken"] = _apiToken,
            ["jobId"] = jobId,
            ["step"] = step,
        });
    }

    public async Task<string?> CheckRecordingStatus(string jobId)
    {
        var resp = await PostAsync(new JsonObject
        {
            ["action"] = "check-recording-status",
            ["apiToken"] = _apiToken,
            ["jobId"] = jobId,
        });
        return resp?["status"]?.GetValue<string>();
    }

    public virtual async Task SubmitResults(string jobId, string status, int totalSteps,
        int passedSteps, int failedSteps, long durationMs, JsonArray? stepResults,
        string? errorMessage = null, string? failureCategory = null, string? engineMode = null)
    {
        await PostAsync(new JsonObject
        {
            ["action"] = "submit",
            ["apiToken"] = _apiToken,
            ["jobId"] = jobId,
            ["status"] = status,
            ["total_steps"] = totalSteps,
            ["passed_steps"] = passedSteps,
            ["failed_steps"] = failedSteps,
            ["duration_ms"] = durationMs,
            ["step_results"] = stepResults,
            ["error_message"] = errorMessage,
            ["failure_category"] = failureCategory,
            ["engine_mode"] = engineMode,
        });
    }

    public virtual async Task RequestSelfHeal(string jobId, string? testId,
        JsonNode originalSelector, string? uiTreeSnapshot, int stepIndex)
    {
        await PostAsync(new JsonObject
        {
            ["action"] = "self-heal",
            ["apiToken"] = _apiToken,
            ["jobId"] = jobId,
            ["testId"] = testId,
            ["originalSelector"] = originalSelector?.DeepClone(),
            ["uiTreeSnapshot"] = uiTreeSnapshot,
            ["stepIndex"] = stepIndex,
        });
    }

    /// <summary>
    /// Save a recorded test directly from the standalone recorder app.
    /// </summary>
    public async Task SaveRecordedTest(string testName, string description,
        string appName, string appPath, string engineMode, JsonArray steps)
    {
        await PostAsync(new JsonObject
        {
            ["action"] = "save-recorded-test",
            ["apiToken"] = _apiToken,
            ["testName"] = testName,
            ["description"] = description,
            ["applicationName"] = appName,
            ["applicationPath"] = appPath,
            ["engineMode"] = engineMode,
            ["steps"] = steps,
        });
    }

    /// <summary>
    /// Call the AI step generation endpoint from the standalone recorder.
    /// Returns a JsonArray of generated steps, or null.
    /// </summary>
    public async Task<JsonArray?> AIGenerateSteps(string manualSteps, string appName, string engineMode)
    {
        var resp = await PostAsync(new JsonObject
        {
            ["action"] = "ai-generate-steps",
            ["apiToken"] = _apiToken,
            ["manualSteps"] = manualSteps,
            ["applicationName"] = appName,
            ["engineMode"] = engineMode,
        });
        return resp?["steps"]?.AsArray();
    }

    private async Task<JsonObject?> PostAsync(JsonObject body)
    {
        var content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        var resp = await _http.PostAsync(_apiUrl, content);
        var text = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new Exception($"HTTP {(int)resp.StatusCode}: {text}");
        return JsonNode.Parse(text)?.AsObject();
    }
}

public class DesktopJob
{
    public string Id { get; set; } = "";
    public string? RunId { get; set; }
    public string? ApplicationPath { get; set; }
    public string? ApplicationArgs { get; set; }
    public string EngineMode { get; set; } = "uia";
    public JsonNode? Steps { get; set; }
    public JsonNode? Selectors { get; set; }
    public string? TestId { get; set; }
    public bool IsRecordJob { get; set; }
    public string? PadEnvironmentId { get; set; }
    public string? PadWorkflowId { get; set; }
    public string? CloudFlowTriggerUrl { get; set; }
    public string? PadDataverseOrgUrl { get; set; }
    public string? ApplicationName { get; set; }
}
