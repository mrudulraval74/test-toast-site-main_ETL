using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Shared token cache for Microsoft device-code authentication.
/// Caches access tokens and refresh tokens so users only need to sign in once.
/// Used by both CloudFlowCreator and DesktopFlowCreator.
/// </summary>
public class TokenCache
{
    private static readonly HttpClient _http = new();

    // Singleton instance
    private static TokenCache _instance;
    public static TokenCache Instance => _instance ??= new TokenCache();

    // Cached tokens (keyed by scope/resource)
    private string _cachedAccessToken = "";
    private string _cachedRefreshToken = "";
    private DateTime _tokenExpiry = DateTime.MinValue;
    private string _cachedScope = "";

    /// <summary>
    /// Callback to show device code message to user.
    /// Signature: (userCode, verificationUrl, fullMessage) => void
    /// </summary>
    public Action<string, string, string> OnDeviceCodePrompt { get; set; }

    /// <summary>
    /// Last auth error message for diagnostics.
    /// </summary>
    public string LastAuthError { get; private set; } = "";

    /// <summary>
    /// Gets a valid access token, using cached token if available, refreshing if expired,
    /// or initiating device code flow if no cached credentials exist.
    /// </summary>
    public async Task<string> GetAccessTokenAsync(string scope = null)
    {
        scope ??= "https://service.flow.microsoft.com/user_impersonation offline_access openid profile";
        LastAuthError = "";

        // If we have a valid cached token for the same scope, return it
        if (!string.IsNullOrEmpty(_cachedAccessToken)
            && _cachedScope == scope
            && DateTime.UtcNow < _tokenExpiry.AddMinutes(-2))
        {
            Logger.Info("Using cached access token (expires " + _tokenExpiry.ToString("HH:mm:ss") + " UTC).");
            return _cachedAccessToken;
        }

        // If we have a refresh token, try to refresh silently
        if (!string.IsNullOrEmpty(_cachedRefreshToken) && _cachedScope == scope)
        {
            string refreshed = await RefreshAccessTokenAsync(_cachedRefreshToken, scope);
            if (!string.IsNullOrEmpty(refreshed))
            {
                Logger.Info("Silently refreshed access token.");
                return refreshed;
            }
            // Refresh failed — fall through to interactive login
            Logger.Warn("Token refresh failed, falling back to interactive login.");
        }

        // No cached token or refresh failed — do interactive device code flow
        return await InteractiveDeviceCodeLoginAsync(scope);
    }

    /// <summary>
    /// Clears all cached tokens, forcing re-authentication on next call.
    /// </summary>
    public void ClearCache()
    {
        _cachedAccessToken = "";
        _cachedRefreshToken = "";
        _tokenExpiry = DateTime.MinValue;
        _cachedScope = "";
        Logger.Info("Token cache cleared.");
    }

    #region Refresh Token Flow

    private async Task<string> RefreshAccessTokenAsync(string refreshToken, string scope)
    {
        const string clientId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";
        const string tenantId = "common";

        try
        {
            var body = new Dictionary<string, string>
            {
                { "grant_type", "refresh_token" },
                { "client_id", clientId },
                { "refresh_token", refreshToken },
                { "scope", scope },
            };

            var response = await _http.PostAsync(
                $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
                new FormUrlEncodedContent(body));

            string json = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                return ExtractAndCacheTokens(json, scope);
            }

            Logger.Debug("Refresh token request failed: " + json);
        }
        catch (Exception ex)
        {
            Logger.Debug("Refresh token error: " + ex.Message);
        }

        return "";
    }

    #endregion

    #region Device Code Flow

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

    private async Task<string> InteractiveDeviceCodeLoginAsync(string scope)
    {
        const string tenantId = "common";

        try
        {
            DeviceCodeAuthContext authContext =
                await RequestDeviceCodeV2Async(tenantId, scope)
                ?? await RequestDeviceCodeV1Async(tenantId, scope);

            if (authContext == null)
            {
                if (string.IsNullOrWhiteSpace(LastAuthError))
                    LastAuthError = "Unable to start Microsoft sign-in prompt. Check internet/proxy and try again.";
                Logger.Error(LastAuthError);
                return "";
            }

            Logger.Info("Device code auth initialized.");
            TryOpenBrowser(authContext.VerificationUrl);
            OnDeviceCodePrompt?.Invoke(authContext.UserCode, authContext.VerificationUrl, authContext.Message);

            return await PollForAccessTokenAsync(authContext, scope);
        }
        catch (Exception ex)
        {
            LastAuthError = "Authentication failed: " + ex.Message;
            Logger.Error(LastAuthError);
        }

        return "";
    }

    private async Task<DeviceCodeAuthContext> RequestDeviceCodeV2Async(string tenantId, string scope)
    {
        const string clientId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";

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
            LastAuthError = ExtractAuthError("Could not start Microsoft sign-in (v2)", json);
            Logger.Warn(LastAuthError);
            return null;
        }

        var node = JsonNode.Parse(json);
        string deviceCode = node?["device_code"]?.GetValue<string>() ?? "";
        if (string.IsNullOrWhiteSpace(deviceCode))
        {
            LastAuthError = "Sign-in response did not include a device code (v2).";
            Logger.Warn(LastAuthError);
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

    private async Task<DeviceCodeAuthContext> RequestDeviceCodeV1Async(string tenantId, string scope)
    {
        const string clientId = "1950a258-227b-4e31-a9cf-717495945fc2";
        // Extract resource from scope for v1 endpoint
        string resource = "https://service.flow.microsoft.com/";

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
            LastAuthError = ExtractAuthError("Could not start Microsoft sign-in (v1)", json);
            Logger.Warn(LastAuthError);
            return null;
        }

        var node = JsonNode.Parse(json);
        string deviceCode = node?["device_code"]?.GetValue<string>() ?? "";
        if (string.IsNullOrWhiteSpace(deviceCode))
        {
            LastAuthError = "Sign-in response did not include a device code (v1).";
            Logger.Warn(LastAuthError);
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

    private async Task<string> PollForAccessTokenAsync(DeviceCodeAuthContext context, string scope)
    {
        int elapsed = 0;
        int pollInterval = Math.Max(5, context.PollIntervalSeconds);

        while (elapsed < context.MaxWaitSeconds)
        {
            await Task.Delay(pollInterval * 1000);
            elapsed += pollInterval;

            try
            {
                var tokenResponse = await _http.PostAsync(
                    context.TokenEndpoint,
                    new FormUrlEncodedContent(context.TokenRequestBody));
                string tokenJson = await tokenResponse.Content.ReadAsStringAsync();

                if (tokenResponse.IsSuccessStatusCode)
                {
                    string token = ExtractAndCacheTokens(tokenJson, scope);
                    if (!string.IsNullOrEmpty(token))
                    {
                        LastAuthError = "";
                        Logger.Info("Successfully acquired access token.");
                        return token;
                    }
                }
                else
                {
                    var errNode = JsonNode.Parse(tokenJson);
                    string error = errNode?["error"]?.GetValue<string>() ?? "";

                    if (error == "authorization_pending") continue;
                    if (error == "slow_down") { pollInterval = Math.Min(pollInterval + 5, 20); continue; }

                    LastAuthError = ExtractAuthError("Microsoft sign-in failed", tokenJson);
                    Logger.Error(LastAuthError);
                    return "";
                }
            }
            catch (Exception ex)
            {
                Logger.Debug("Token poll error: " + ex.Message);
            }
        }

        LastAuthError = "Timed out waiting for Microsoft sign-in authorization.";
        Logger.Error(LastAuthError);
        return "";
    }

    #endregion

    #region Helpers

    private string ExtractAndCacheTokens(string tokenJson, string scope)
    {
        try
        {
            var tokenNode = JsonNode.Parse(tokenJson);
            string accessToken = tokenNode?["access_token"]?.GetValue<string>() ?? "";
            string refreshToken = tokenNode?["refresh_token"]?.GetValue<string>() ?? "";
            int expiresIn = tokenNode?["expires_in"]?.GetValue<int>() ?? 3600;

            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                _cachedAccessToken = accessToken;
                _cachedScope = scope;
                _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn);

                if (!string.IsNullOrWhiteSpace(refreshToken))
                {
                    _cachedRefreshToken = refreshToken;
                }

                Logger.Info("Token cached. Expires at " + _tokenExpiry.ToString("HH:mm:ss") + " UTC.");
                return accessToken;
            }
        }
        catch (Exception ex)
        {
            Logger.Debug("Failed to parse token response: " + ex.Message);
        }

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
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        }
        catch { }
    }

    #endregion
}
