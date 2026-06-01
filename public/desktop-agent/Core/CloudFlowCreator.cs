using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Creates an Instant Cloud Flow in Power Automate with "When an HTTP request is received" trigger.
/// The flow wraps the recorded desktop test steps so they can be triggered externally via HTTP POST.
/// </summary>
public class CloudFlowCreator
{
    private static readonly HttpClient _http = new();
    private string _lastAuthError = "";

    /// <summary>
    /// Creates a Power Automate Instant Cloud Flow with HTTP Request trigger.
    /// Steps:
    /// 1. Authenticate via interactive browser (Azure AD device-code or PowerShell)
    /// 2. POST flow definition to Power Automate Management API
    /// 3. Return the created flow's workflow ID and HTTP trigger URL.
    /// </summary>
    public async Task<CloudFlowResult> CreateCloudFlowAsync(
        string environmentId,
        string flowDisplayName,
        List<RecordedStep> steps,
        string appName,
        string appPath)
    {
        var result = new CloudFlowResult();

        try
        {
            // Step 1: Get an access token via PowerShell interactive login
            string accessToken = await GetAccessTokenAsync();
            if (string.IsNullOrEmpty(accessToken))
            {
                result.ErrorMessage = string.IsNullOrWhiteSpace(_lastAuthError)
                    ? "Failed to acquire access token. Please sign in when prompted."
                    : _lastAuthError;
                return result;
            }

            // Step 2: Build the flow definition JSON
            string flowDefinition = BuildFlowDefinition(flowDisplayName, steps, appName, appPath);

            // Step 3: Create the flow via Power Automate Management API
            string apiUrl = "https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/"
                + Uri.EscapeDataString(environmentId)
                + "/flows?api-version=2016-11-01";

            var request = new HttpRequestMessage(HttpMethod.Post, apiUrl);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent(flowDefinition, Encoding.UTF8, "application/json");

            var response = await _http.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                result.ErrorMessage = "API error " + (int)response.StatusCode + ": " + responseBody;
                result.RawResponse = responseBody;
                return result;
            }

            // Step 4: Parse the response to get workflow ID and trigger URL
            var responseJson = JsonNode.Parse(responseBody);
            if (responseJson != null)
            {
                // The flow ID is in the 'name' property (which is the workflow GUID)
                result.WorkflowId = responseJson["name"]?.GetValue<string>() ?? "";

                // Try to extract the HTTP trigger URL from the response
                var triggers = responseJson["properties"]?["flowTriggerUri"];
                if (triggers != null)
                {
                    result.HttpTriggerUrl = triggers.GetValue<string>();
                }

                // If trigger URL not in creation response, fetch it separately
                if (string.IsNullOrEmpty(result.HttpTriggerUrl) && !string.IsNullOrEmpty(result.WorkflowId))
                {
                    result.HttpTriggerUrl = await FetchTriggerUrlAsync(
                        environmentId, result.WorkflowId, accessToken);
                }

                result.EnvironmentId = environmentId;
                result.Success = true;
                result.RawResponse = responseBody;
            }
        }
        catch (Exception ex)
        {
            result.ErrorMessage = "Cloud flow creation failed: " + ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Gets an access token for the Power Automate API using Azure AD device-code flow.
    /// Tries modern v2 endpoint first, then falls back to legacy v1 endpoint.
    /// </summary>
    /// <summary>
    /// Callback to show device code message to user (set by caller).
    /// Signature: (userCode, verificationUrl, fullMessage) => void
    /// </summary>
    public Action<string, string, string> OnDeviceCodePrompt { get; set; }

    private sealed class DeviceCodeAuthContext
    {
        public string UserCode { get; set; } = "";
        public string VerificationUrl { get; set; } = "https://microsoft.com/devicelogin";
        public string DeviceCode { get; set; } = "";
        public string Message { get; set; } = "";
        public int PollIntervalSeconds { get; set; } = 5;
        public int MaxWaitSeconds { get; set; } = 300;
        public string TokenEndpoint { get; set; } = "";
        public Dictionary<string, string> TokenRequestBody { get; set; } = new();
    }

    private async Task<string> GetAccessTokenAsync()
    {
        const string tenantId = "common";
        _lastAuthError = "";

        try
        {
            DeviceCodeAuthContext authContext =
                await RequestDeviceCodeV2Async(tenantId)
                ?? await RequestDeviceCodeV1Async(tenantId);

            if (authContext == null)
            {
                if (string.IsNullOrWhiteSpace(_lastAuthError))
                {
                    _lastAuthError = "Unable to start Microsoft sign-in prompt. Check internet/proxy and try again.";
                }
                Logger.Error(_lastAuthError);
                return "";
            }

            Logger.Info("Device code auth initialized.");
            TryOpenBrowser(authContext.VerificationUrl);
            OnDeviceCodePrompt?.Invoke(authContext.UserCode, authContext.VerificationUrl, authContext.Message);

            return await PollForAccessTokenAsync(authContext);
        }
        catch (Exception ex)
        {
            _lastAuthError = "Authentication failed before prompt: " + ex.Message;
            Logger.Error("GetAccessTokenAsync failed: " + ex.Message);
        }

        return "";
    }

    private async Task<DeviceCodeAuthContext?> RequestDeviceCodeV2Async(string tenantId)
    {
        const string clientId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"; // Azure CLI public client
        const string scope = "https://service.flow.microsoft.com/user_impersonation offline_access openid profile";

        var body = new Dictionary<string, string>
        {
            { "client_id", clientId },
            { "scope", scope },
        };

        var response = await _http.PostAsync(
            $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/devicecode",
            new FormUrlEncodedContent(body));

        string json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            _lastAuthError = ExtractAuthError("Could not start Microsoft sign-in (v2 device code)", json);
            Logger.Warn(_lastAuthError);
            return null;
        }

        var node = JsonNode.Parse(json);
        string deviceCode = node?["device_code"]?.GetValue<string>() ?? "";
        if (string.IsNullOrWhiteSpace(deviceCode))
        {
            _lastAuthError = "Microsoft sign-in response did not include a device code (v2).";
            Logger.Warn(_lastAuthError);
            return null;
        }

        int interval = node?["interval"]?.GetValue<int>() ?? 5;
        int expiresIn = node?["expires_in"]?.GetValue<int>() ?? 300;

        return new DeviceCodeAuthContext
        {
            UserCode = node?["user_code"]?.GetValue<string>() ?? "",
            VerificationUrl =
                node?["verification_uri_complete"]?.GetValue<string>()
                ?? node?["verification_uri"]?.GetValue<string>()
                ?? node?["verification_url"]?.GetValue<string>()
                ?? "https://microsoft.com/devicelogin",
            DeviceCode = deviceCode,
            Message = node?["message"]?.GetValue<string>() ?? "Open the verification URL and complete Microsoft sign-in.",
            PollIntervalSeconds = Math.Max(5, interval),
            MaxWaitSeconds = Math.Clamp(expiresIn, 120, 900),
            TokenEndpoint = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
            TokenRequestBody = new Dictionary<string, string>
            {
                { "grant_type", "urn:ietf:params:oauth:grant-type:device_code" },
                { "client_id", clientId },
                { "device_code", deviceCode },
            },
        };
    }

    private async Task<DeviceCodeAuthContext?> RequestDeviceCodeV1Async(string tenantId)
    {
        const string clientId = "1950a258-227b-4e31-a9cf-717495945fc2"; // Azure PowerShell public client
        const string resource = "https://service.flow.microsoft.com/";

        var body = new Dictionary<string, string>
        {
            { "client_id", clientId },
            { "resource", resource },
        };

        var response = await _http.PostAsync(
            $"https://login.microsoftonline.com/{tenantId}/oauth2/devicecode",
            new FormUrlEncodedContent(body));

        string json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            _lastAuthError = ExtractAuthError("Could not start Microsoft sign-in (legacy device code)", json);
            Logger.Warn(_lastAuthError);
            return null;
        }

        var node = JsonNode.Parse(json);
        string deviceCode = node?["device_code"]?.GetValue<string>() ?? "";
        if (string.IsNullOrWhiteSpace(deviceCode))
        {
            _lastAuthError = "Microsoft sign-in response did not include a device code (legacy).";
            Logger.Warn(_lastAuthError);
            return null;
        }

        int interval = node?["interval"]?.GetValue<int>() ?? 5;
        int expiresIn = node?["expires_in"]?.GetValue<int>() ?? 300;

        return new DeviceCodeAuthContext
        {
            UserCode = node?["user_code"]?.GetValue<string>() ?? "",
            VerificationUrl = node?["verification_url"]?.GetValue<string>() ?? "https://microsoft.com/devicelogin",
            DeviceCode = deviceCode,
            Message = node?["message"]?.GetValue<string>() ?? "Open the verification URL and complete Microsoft sign-in.",
            PollIntervalSeconds = Math.Max(5, interval),
            MaxWaitSeconds = Math.Clamp(expiresIn, 120, 900),
            TokenEndpoint = $"https://login.microsoftonline.com/{tenantId}/oauth2/token",
            TokenRequestBody = new Dictionary<string, string>
            {
                { "grant_type", "urn:ietf:params:oauth:grant-type:device_code" },
                { "client_id", clientId },
                { "resource", resource },
                { "code", deviceCode },
            },
        };
    }

    private async Task<string> PollForAccessTokenAsync(DeviceCodeAuthContext context)
    {
        int elapsed = 0;
        int pollInterval = Math.Max(5, context.PollIntervalSeconds);

        while (elapsed < context.MaxWaitSeconds)
        {
            await Task.Delay(pollInterval * 1000);
            elapsed += pollInterval;

            try
            {
                var tokenResponse = await _http.PostAsync(context.TokenEndpoint, new FormUrlEncodedContent(context.TokenRequestBody));
                string tokenJson = await tokenResponse.Content.ReadAsStringAsync();

                if (tokenResponse.IsSuccessStatusCode)
                {
                    var tokenNode = JsonNode.Parse(tokenJson);
                    string token = tokenNode?["access_token"]?.GetValue<string>() ?? "";
                    if (!string.IsNullOrWhiteSpace(token))
                    {
                        _lastAuthError = "";
                        Logger.Info("Successfully acquired access token.");
                        return token;
                    }
                }
                else
                {
                    var errNode = JsonNode.Parse(tokenJson);
                    string error = errNode?["error"]?.GetValue<string>() ?? "";

                    if (error == "authorization_pending")
                    {
                        continue;
                    }

                    if (error == "slow_down")
                    {
                        pollInterval = Math.Min(pollInterval + 5, 20);
                        continue;
                    }

                    _lastAuthError = ExtractAuthError("Microsoft sign-in failed", tokenJson);
                    Logger.Error(_lastAuthError);
                    return "";
                }
            }
            catch (Exception ex)
            {
                Logger.Debug("Token poll error: " + ex.Message);
            }
        }

        _lastAuthError = "Timed out waiting for Microsoft sign-in authorization.";
        Logger.Error(_lastAuthError);
        return "";
    }

    private static string ExtractAuthError(string prefix, string responseBody)
    {
        try
        {
            var node = JsonNode.Parse(responseBody);
            string message =
                node?["error_description"]?.GetValue<string>()
                ?? node?["message"]?.GetValue<string>()
                ?? node?["error"]?.GetValue<string>()
                ?? responseBody;

            return prefix + ": " + message;
        }
        catch
        {
            return prefix + ": " + responseBody;
        }
    }

    private static void TryOpenBrowser(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return;
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true,
            });
        }
        catch
        {
            // best-effort only
        }
    }

    /// <summary>
    /// Builds the Power Automate flow definition JSON with an HTTP Request trigger
    /// and actions that represent the recorded test steps.
    /// </summary>
    private string BuildFlowDefinition(string flowName, List<RecordedStep> steps, string appName, string appPath)
    {
        // Build the actions from recorded steps
        var actionsObj = new JsonObject();
        string previousActionName = null;

        for (int i = 0; i < steps.Count; i++)
        {
            var step = steps[i];
            string actionName = "Step_" + (i + 1) + "_" + SanitizeActionName(step.Action);

            var actionDef = new JsonObject
            {
                ["type"] = "Compose",
                ["inputs"] = new JsonObject
                {
                    ["stepNumber"] = i + 1,
                    ["action"] = step.Action,
                    ["label"] = step.Label,
                    ["automationId"] = step.AutomationId,
                    ["controlType"] = step.ControlType,
                    ["value"] = step.Value,
                    ["parentWindow"] = step.ParentWindow,
                    ["classHint"] = step.ClassHint,
                },
            };

            // Chain actions sequentially using runAfter
            if (previousActionName != null)
            {
                actionDef["runAfter"] = new JsonObject
                {
                    [previousActionName] = new JsonArray("Succeeded"),
                };
            }

            actionsObj[actionName] = actionDef;
            previousActionName = actionName;
        }

        // Add a final Response action to return results
        string responseActionName = "Send_Response";
        var responseAction = new JsonObject
        {
            ["type"] = "Response",
            ["kind"] = "Http",
            ["inputs"] = new JsonObject
            {
                ["statusCode"] = 200,
                ["headers"] = new JsonObject
                {
                    ["Content-Type"] = "application/json",
                },
                ["body"] = new JsonObject
                {
                    ["status"] = "completed",
                    ["flowName"] = flowName,
                    ["totalSteps"] = steps.Count,
                    ["applicationName"] = appName,
                    ["applicationPath"] = appPath,
                    ["executedAt"] = "@{utcNow()}",
                },
            },
        };

        if (previousActionName != null)
        {
            responseAction["runAfter"] = new JsonObject
            {
                [previousActionName] = new JsonArray("Succeeded"),
            };
        }

        actionsObj[responseActionName] = responseAction;

        // Build the HTTP request trigger with JSON schema for incoming test data
        var requestSchemaProperties = new JsonObject
        {
            ["testName"] = new JsonObject { ["type"] = "string" },
            ["environment"] = new JsonObject { ["type"] = "string" },
            ["executionId"] = new JsonObject { ["type"] = "string" },
        };

        var triggerSchema = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = requestSchemaProperties,
        };

        // Build the full flow definition
        var flowDefinition = new JsonObject
        {
            ["properties"] = new JsonObject
            {
                ["displayName"] = flowName,
                ["definition"] = new JsonObject
                {
                    ["$schema"] = "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
                    ["contentVersion"] = "1.0.0.0",
                    ["triggers"] = new JsonObject
                    {
                        ["manual"] = new JsonObject
                        {
                            ["type"] = "Request",
                            ["kind"] = "Http",
                            ["inputs"] = new JsonObject
                            {
                                ["method"] = "POST",
                                ["schema"] = triggerSchema,
                            },
                        },
                    },
                    ["actions"] = actionsObj,
                    ["outputs"] = new JsonObject(),
                },
                ["state"] = "Started",
                ["connectionReferences"] = new JsonObject(),
                ["environment"] = new JsonObject
                {
                    ["name"] = "Default",
                },
            },
        };

        return flowDefinition.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }

    /// <summary>
    /// Fetches the HTTP trigger URL for a created flow by calling the list triggers API.
    /// </summary>
    private async Task<string> FetchTriggerUrlAsync(string environmentId, string workflowId, string accessToken)
    {
        try
        {
            string url = "https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/"
                + Uri.EscapeDataString(environmentId)
                + "/flows/" + Uri.EscapeDataString(workflowId)
                + "/triggers?api-version=2016-11-01";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var response = await _http.SendAsync(request);
            string body = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var json = JsonNode.Parse(body);
                var triggers = json?["value"]?.AsArray();
                if (triggers != null && triggers.Count > 0)
                {
                    // Get the callback URL from the first trigger
                    var callbackUrl = triggers[0]?["properties"]?["callbackUrl"]?.GetValue<string>();
                    return callbackUrl ?? "";
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Debug("Failed to fetch trigger URL: " + ex.Message);
        }

        return "";
    }

    /// <summary>
    /// Sanitizes an action name for use in Power Automate flow definition.
    /// </summary>
    private static string SanitizeActionName(string action)
    {
        if (string.IsNullOrEmpty(action)) return "unknown";
        var sb = new StringBuilder();
        for (int i = 0; i < action.Length && i < 30; i++)
        {
            char c = action[i];
            if (char.IsLetterOrDigit(c) || c == '_')
                sb.Append(c);
            else if (c == ' ')
                sb.Append('_');
        }
        return sb.Length > 0 ? sb.ToString() : "action";
    }
}

/// <summary>
/// Result of creating a Power Automate Cloud Flow.
/// </summary>
public class CloudFlowResult
{
    public bool Success { get; set; }
    public string WorkflowId { get; set; } = "";
    public string EnvironmentId { get; set; } = "";
    public string HttpTriggerUrl { get; set; } = "";
    public string ErrorMessage { get; set; } = "";
    public string RawResponse { get; set; } = "";
}
