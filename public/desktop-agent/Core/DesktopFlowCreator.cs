using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace WisprDesktopAgent.Core;

public class DesktopFlowCreator
{
    private static readonly HttpClient _http = new();
    private string _lastAuthError = "";

    public Action<string, string, string> OnDeviceCodePrompt { get; set; }

    public async Task<DesktopFlowResult> CreateDesktopFlowAsync(
        string dataverseOrgUrl,
        string flowDisplayName,
        string robinScript)
    {
        var result = new DesktopFlowResult();

        try
        {
            // Normalize URL
            dataverseOrgUrl = dataverseOrgUrl.TrimEnd('/');
            if (!dataverseOrgUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                dataverseOrgUrl = "https://" + dataverseOrgUrl;

            // 🔐 Authenticate
            string accessToken = await GetAccessTokenAsync(dataverseOrgUrl);
            if (string.IsNullOrEmpty(accessToken))
            {
                result.ErrorMessage = string.IsNullOrWhiteSpace(_lastAuthError)
                    ? "Failed to acquire access token."
                    : _lastAuthError;
                return result;
            }

            // 👤 Get current user ID for ownership assignment
            string currentUserId = await GetCurrentUserIdAsync(dataverseOrgUrl, accessToken);

            // 🧠 Build clientdata
            //
            // Dataverse validator requires "properties" at the root of clientdata.
            // Real PAD flow metadata fields go INSIDE properties.
            // Robin script goes inside properties.definition.actions.scriptCode
            //
            // Final structure:
            // {
            //   "schemaVersion": "ROBIN_20211012",
            //   "properties": {
            //     "clientversion": "2.65.145.26040",
            //     "isvalid": true,
            //     "flowGeneratedBy": "PADDesigner",
            //     ... all PAD metadata flags ...
            //     "definition": {
            //       "name": "Main",
            //       "triggers": {},
            //       "actions": {
            //         "metadata": {},
            //         "scriptCode": "<robin script>"
            //       }
            //     },
            //     "language": "desktop_flow_language",
            //     "name": "<flowDisplayName>"
            //   }
            // }
            //
            var clientDataObj = new
            {
                schemaVersion = "ROBIN_20211012",
                properties = new
                {
                    // PAD metadata — matched from real PAD flow comparison
                    clientversion                       = "2.65.145.26040",
                    isvalid                             = true,
                    flowGeneratedBy                     = "PADDesigner",
                    scriptType                          = 0,
                    multipleRequestsState               = 0,
                    disableScreenshotCaptureOnError     = false,
                    containsActiveConnections           = false,
                    containsGptPredictActions           = false,
                    containsActiveCopilotActions        = false,
                    containsActiveWorkQueuesActions     = false,
                    containsActiveLogMessageActions     = false,
                    containsActiveRepairWithAIActions   = false,
                    containsActiveCredentialsActions    = false,
                    missingUiElementRepairType          = (object)null,
                    flowTimeout                         = (object)null,
                    screenResolution                    = (object)null,
                    flowLogsVerbosity                   = (object)null,

                    // Robin script lives here — required by Dataverse validator
                    definition = new
                    {
                        name        = "Main",
                        description = "",
                        triggers    = new { },   // must be object {}, NOT array []
                        actions     = new
                        {
                            metadata   = new { },
                            scriptCode = robinScript
                        }
                    },

                    // Flow identity fields
                    language    = "desktop_flow_language",
                    name        = flowDisplayName,
                    description = "Created by WISPR on " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                }
            };

            string safeClientData = JsonSerializer.Serialize(
                clientDataObj,
                new JsonSerializerOptions { WriteIndented = false });

            // 🏗️ Build workflow entity
            var workflowEntity = new JsonObject
            {
                ["name"]          = flowDisplayName,
                ["type"]          = 1,        // Definition
                ["category"]      = 6,        // Desktop Flow
                ["primaryentity"] = "none",   // Desktop Flows are not entity-bound
                ["mode"]          = 0,        // Background
                ["scope"]         = 4,        // Organization
                ["languagecode"]  = 1033,     // English
                ["ondemand"]      = true,
                ["subprocess"]    = false,
                ["statecode"]     = 0,        // Draft on create (Dataverse requirement)
                ["statuscode"]    = 1,        // Draft on create
                ["ismanaged"]     = false,    // Unmanaged = personal flow in PAD
                ["clientdata"]    = safeClientData,
                ["description"]   = "Created by WISPR on " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            };

            string body = workflowEntity.ToJsonString(new JsonSerializerOptions
            {
                WriteIndented = false
            });

            // 🔍 Debug
            Console.WriteLine("=== Dataverse Payload ===");
            Console.WriteLine(body);

            // 🌐 POST to create the workflow
            string apiUrl = dataverseOrgUrl + "/api/data/v9.2/workflows";

            var request = new HttpRequestMessage(HttpMethod.Post, apiUrl);
            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            request.Headers.Add("OData-MaxVersion", "4.0");
            request.Headers.Add("OData-Version", "4.0");
            request.Headers.Accept.Add(
                new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.Add("MSCRM.SolutionUniqueName", "Default");

            var response = await _http.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                result.ErrorMessage = $"Dataverse API error {(int)response.StatusCode}: {responseBody}";
                result.RawResponse  = responseBody;
                return result;
            }

            // Extract workflow ID from Location header
            string entityIdHeader = response.Headers.Location?.ToString() ?? "";
            if (!string.IsNullOrEmpty(entityIdHeader))
            {
                int start = entityIdHeader.LastIndexOf('(');
                int end   = entityIdHeader.LastIndexOf(')');
                if (start >= 0 && end > start)
                    result.WorkflowId = entityIdHeader.Substring(start + 1, end - start - 1);
            }

            // Fallback: parse from response body
            if (string.IsNullOrEmpty(result.WorkflowId) && !string.IsNullOrWhiteSpace(responseBody))
            {
                try
                {
                    var json = JsonNode.Parse(responseBody);
                    result.WorkflowId = json?["workflowid"]?.GetValue<string>() ?? "";
                }
                catch { }
            }

            if (string.IsNullOrEmpty(result.WorkflowId))
            {
                result.ErrorMessage = "Flow was created but WorkflowId could not be extracted.";
                result.RawResponse  = responseBody;
                return result;
            }

            // 👤 Assign ownership BEFORE activation
            if (!string.IsNullOrEmpty(currentUserId))
                await AssignOwnerAsync(dataverseOrgUrl, result.WorkflowId, currentUserId, accessToken);

            // ⚡ Activate: Draft → Active
            // POST Microsoft.Dynamics.CRM.ActivateWorkflow
            // This also triggers the internal access check PAD requires
            var activated = await ActivateWorkflowAsync(
                dataverseOrgUrl, result.WorkflowId, accessToken);

            if (!activated)
            {
                result.ErrorMessage =
                    $"Flow created (Draft) but activation failed. " +
                    $"Activate manually in PAD. WorkflowId: {result.WorkflowId}";
                result.DataverseOrgUrl = dataverseOrgUrl;
                result.RawResponse     = responseBody;
                result.Success         = true; // partial — flow exists in Draft
                return result;
            }

            result.DataverseOrgUrl = dataverseOrgUrl;
            result.Success         = true;
            result.RawResponse     = responseBody;
        }
        catch (Exception ex)
        {
            result.ErrorMessage = "Desktop flow creation failed: " + ex.Message;
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Activate workflow via Dataverse bound action.
    // Transitions: Draft (statecode=0, statuscode=1)
    //           →  Active (statecode=1, statuscode=2)
    // Also triggers the internal access check that PAD requires.
    // ─────────────────────────────────────────────────────────────────────────
    private async Task<bool> ActivateWorkflowAsync(
        string orgUrl,
        string workflowId,
        string accessToken)
    {
        try
        {
            var url = $"{orgUrl}/api/data/v9.2/workflows({workflowId})" +
                      $"/Microsoft.Dynamics.CRM.ActivateWorkflow";

            var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            req.Headers.Add("OData-MaxVersion", "4.0");
            req.Headers.Add("OData-Version",    "4.0");
            req.Content = new StringContent("{}", Encoding.UTF8, "application/json");

            var res = await _http.SendAsync(req);
            string rb = await res.Content.ReadAsStringAsync();

            Console.WriteLine($"=== ActivateWorkflow {(int)res.StatusCode} ===");
            Console.WriteLine(rb);

            return res.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ActivateWorkflow exception: {ex.Message}");
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Get systemuserid of the authenticated user via WhoAmI
    // ─────────────────────────────────────────────────────────────────────────
    private async Task<string> GetCurrentUserIdAsync(string orgUrl, string accessToken)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, orgUrl + "/api/data/v9.2/WhoAmI");
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            req.Headers.Add("OData-MaxVersion", "4.0");
            req.Headers.Add("OData-Version",    "4.0");

            var res  = await _http.SendAsync(req);
            var json = JsonNode.Parse(await res.Content.ReadAsStringAsync());
            return json?["UserId"]?.ToString() ?? "";
        }
        catch
        {
            return "";
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Assign workflow ownership to a systemuser via PATCH
    // ─────────────────────────────────────────────────────────────────────────
    private async Task AssignOwnerAsync(
        string orgUrl,
        string workflowId,
        string userId,
        string accessToken)
    {
        try
        {
            var patchBody = new JsonObject
            {
                ["ownerid@odata.bind"] = $"/systemusers({userId})"
            };

            var req = new HttpRequestMessage(
                HttpMethod.Patch,
                $"{orgUrl}/api/data/v9.2/workflows({workflowId})");

            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            req.Headers.Add("OData-MaxVersion", "4.0");
            req.Headers.Add("OData-Version",    "4.0");
            req.Content = new StringContent(
                patchBody.ToJsonString(), Encoding.UTF8, "application/json");

            await _http.SendAsync(req);
        }
        catch
        {
            // Non-fatal
        }
    }

    #region Authentication (UNCHANGED)

    private sealed class DeviceCodeAuthContext
    {
        public string UserCode            { get; set; } = "";
        public string VerificationUrl     { get; set; } = "";
        public string DeviceCode          { get; set; } = "";
        public string Message             { get; set; } = "";
        public int    PollIntervalSeconds { get; set; }
        public int    MaxWaitSeconds      { get; set; }
        public string TokenEndpoint       { get; set; } = "";
        public Dictionary<string, string> TokenRequestBody { get; set; } = new();
    }

    private async Task<string> GetAccessTokenAsync(string dataverseOrgUrl)
    {
        const string tenantId = "common";
        _lastAuthError = "";

        try
        {
            var ctx = await RequestDeviceCodeV2Async(tenantId, dataverseOrgUrl);

            if (ctx == null)
            {
                _lastAuthError = "Unable to start Microsoft sign-in.";
                return "";
            }

            TryOpenBrowser(ctx.VerificationUrl);
            OnDeviceCodePrompt?.Invoke(ctx.UserCode, ctx.VerificationUrl, ctx.Message);

            return await PollForAccessTokenAsync(ctx);
        }
        catch (Exception ex)
        {
            _lastAuthError = ex.Message;
        }

        return "";
    }

    private async Task<DeviceCodeAuthContext?> RequestDeviceCodeV2Async(string tenantId, string url)
    {
        const string clientId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";

        var body = new Dictionary<string, string>
        {
            { "client_id", clientId },
            { "scope",     url + "/.default offline_access openid profile" }
        };

        var res = await _http.PostAsync(
            $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/devicecode",
            new FormUrlEncodedContent(body));

        if (!res.IsSuccessStatusCode) return null;

        var json = JsonNode.Parse(await res.Content.ReadAsStringAsync());

        return new DeviceCodeAuthContext
        {
            UserCode            = json?["user_code"]?.ToString()        ?? "",
            VerificationUrl     = json?["verification_uri"]?.ToString() ?? "",
            DeviceCode          = json?["device_code"]?.ToString()      ?? "",
            Message             = json?["message"]?.ToString()          ?? "",
            PollIntervalSeconds = json?["interval"]?.GetValue<int>()    ?? 5,
            MaxWaitSeconds      = json?["expires_in"]?.GetValue<int>()  ?? 300,
            TokenEndpoint       = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
            TokenRequestBody    = new Dictionary<string, string>
            {
                { "grant_type",  "urn:ietf:params:oauth:grant-type:device_code" },
                { "client_id",   clientId },
                { "device_code", json?["device_code"]?.ToString() ?? "" }
            }
        };
    }

    private async Task<string> PollForAccessTokenAsync(DeviceCodeAuthContext ctx)
    {
        int elapsed = 0;

        while (elapsed < ctx.MaxWaitSeconds)
        {
            await Task.Delay(ctx.PollIntervalSeconds * 1000);
            elapsed += ctx.PollIntervalSeconds;

            var res = await _http.PostAsync(ctx.TokenEndpoint,
                new FormUrlEncodedContent(ctx.TokenRequestBody));

            var json = JsonNode.Parse(await res.Content.ReadAsStringAsync());

            if (res.IsSuccessStatusCode)
                return json?["access_token"]?.ToString() ?? "";
        }

        return "";
    }

    private static void TryOpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName        = url,
                UseShellExecute = true
            });
        }
        catch { }
    }

    #endregion
}

public class DesktopFlowResult
{
    public bool   Success         { get; set; }
    public string WorkflowId      { get; set; } = "";
    public string DataverseOrgUrl { get; set; } = "";
    public string ErrorMessage    { get; set; } = "";
    public string RawResponse     { get; set; } = "";
}
