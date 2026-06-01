using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace WisprDesktopAgent.Core;

/// <summary>
/// Handles Power Automate Desktop (PAD) discovery, launching, and execution.
/// Uses PAD CLI (PAD.Console.Host.exe) for flow execution and ms-powerautomate:// protocol for launching.
/// </summary>
public class PowerAutomateIntegration
{
    private string _padConsolePath = "";
    private string _padScriptsFolder = "";

    /// <summary>Whether PAD is installed and discoverable on this machine.</summary>
    public bool IsPadInstalled { get; private set; }

    /// <summary>Path to PAD.Console.Host.exe if found.</summary>
    public string PadConsolePath { get { return _padConsolePath; } }

    /// <summary>Path to PAD scripts folder.</summary>
    public string PadScriptsFolder { get { return _padScriptsFolder; } }

    public PowerAutomateIntegration()
    {
        DiscoverPad();
    }

    /// <summary>
    /// Discovers PAD installation by checking known paths.
    /// </summary>
    private void DiscoverPad()
    {
        // Check common PAD install locations
        var candidates = new List<string>();

        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        // Standard install paths (MSI + legacy locations)
        //candidates.Add(Path.Combine(programFiles, "Power Automate Desktop", "dotnet", "PAD.Console.Host.exe"));
        //candidates.Add(Path.Combine(programFilesX86, "Power Automate Desktop", "dotnet", "PAD.Console.Host.exe"));
        candidates.Add(Path.Combine(programFiles, "Power Automate Desktop", "PAD.Console.Host.exe"));
        candidates.Add(Path.Combine(programFilesX86, "Power Automate Desktop", "PAD.Console.Host.exe"));

        // Microsoft Store install path
        string storeAppsPath = Path.Combine(localAppData, "Microsoft", "WindowsApps");
        if (Directory.Exists(storeAppsPath))
        {
            try
            {
                string[] exeFiles = Directory.GetFiles(storeAppsPath, "PAD.Console.Host.exe", SearchOption.AllDirectories);
                for (int i = 0; i < exeFiles.Length; i++)
                {
                    candidates.Add(exeFiles[i]);
                }
            }
            catch { }
        }

        // Search in Program Files subdirectories
        try
        {
            string[] pfDirs = Directory.GetDirectories(programFiles, "*Power Automate*", SearchOption.TopDirectoryOnly);
            for (int i = 0; i < pfDirs.Length; i++)
            {
                string candidateExe = Path.Combine(pfDirs[i], "PAD.Console.Host.exe");
                candidates.Add(candidateExe);
            }
        }
        catch { }

        // Check each candidate
        for (int i = 0; i < candidates.Count; i++)
        {
            if (File.Exists(candidates[i]))
            {
                _padConsolePath = candidates[i];
                IsPadInstalled = true;
                break;
            }
        }

        // Set scripts folder
        _padScriptsFolder = Path.Combine(localAppData, "Microsoft", "Power Automate Desktop", "Scripts");

        // Also check if PAD can be launched via protocol (even if CLI not found)
        if (!IsPadInstalled)
        {
            // Check registry for ms-powerautomate protocol
            try
            {
                var key = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey("ms-powerautomate");
                if (key != null)
                {
                    IsPadInstalled = true;
                    key.Close();
                }
            }
            catch { }
        }
    }

    /// <summary>
    /// Launches Power Automate Desktop designer via protocol URI or direct exe.
    /// </summary>
    public bool LaunchPadDesigner()
    {
        try
        {
            // Try protocol URI first (works for Store installs)
            var psi = new ProcessStartInfo
            {
                FileName = "ms-powerautomate://",
                UseShellExecute = true,
            };
            Process.Start(psi);
            return true;
        }
        catch
        {
            // Fallback: try launching PAD directly
            try
            {
                string padExe = FindPadMainExe();
                if (!string.IsNullOrEmpty(padExe))
                {
                    Process.Start(new ProcessStartInfo { FileName = padExe, UseShellExecute = true });
                    return true;
                }
            }
            catch { }
        }
        return false;
    }

    /// <summary>
    /// Finds the main PAD application executable (not the console host).
    /// </summary>
    private string FindPadMainExe()
    {
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string candidate = Path.Combine(programFiles, "Power Automate Desktop", "PAD.Designer.Host.exe");
        if (File.Exists(candidate)) return candidate;

        candidate = Path.Combine(programFiles, "Power Automate Desktop", "PAD.Robot.exe");
        if (File.Exists(candidate)) return candidate;

        return "";
    }

    /// <summary>
    /// Gets the list of .robin script files in the PAD scripts directory.
    /// </summary>
    public List<string> GetAvailableFlows()
    {
        var flows = new List<string>();
        if (!Directory.Exists(_padScriptsFolder)) return flows;

        try
        {
            string[] files = Directory.GetFiles(_padScriptsFolder, "*.robin", SearchOption.AllDirectories);
            for (int i = 0; i < files.Length; i++)
            {
                flows.Add(files[i]);
            }
        }
        catch { }
        return flows;
    }

    /// <summary>
    /// Exports a .robin script to the PAD scripts folder for execution.
    /// Returns the flow name used for CLI invocation.
    /// </summary>
    public string ExportFlowForExecution(string robinContent, string flowName)
    {
        if (!Directory.Exists(_padScriptsFolder))
        {
            Directory.CreateDirectory(_padScriptsFolder);
        }

        string sanitizedName = "WisprTest_" + SanitizeFlowName(flowName);
        string filePath = Path.Combine(_padScriptsFolder, sanitizedName + ".robin");
        File.WriteAllText(filePath, robinContent, Encoding.UTF8);
        return sanitizedName;
    }

    /// <summary>
    /// Executes a PAD flow using user-provided Environment ID and Workflow ID directly via protocol URI.
    /// Skips auto-discovery and import steps — goes straight to protocol execution.
    /// </summary>
    public PadExecutionResult ExecuteFlowWithIds(string flowName, string environmentId, string workflowId, int timeoutSeconds)
    {
        var diagLog = new List<PadDiagnosticEntry>();

        diagLog.Add(new PadDiagnosticEntry
        {
            Strategy = "User-Provided IDs",
            FlowName = flowName,
            Succeeded = true,
            Stdout = "EnvironmentId=" + environmentId + ", WorkflowId=" + workflowId,
            ErrorMessage = "Using user-provided IDs (skipping auto-discovery)",
        });

        // Execute directly via protocol URI with user-provided IDs
        var result = ExecuteViaProtocolUri(environmentId, workflowId, flowName, timeoutSeconds);
        diagLog.AddRange(result.DiagnosticLog);
        result.DiagnosticLog = diagLog;
        return result;
    }

    /// <summary>
    /// Executes a PAD flow via CLI and returns the result.
    /// </summary>
    public PadExecutionResult ExecuteFlow(string flowName, int timeoutSeconds)
    {
        var result = new PadExecutionResult();
        var diagLog = new List<PadDiagnosticEntry>();

        // Resolve the .robin file path from the exported flow name
        string robinFilePath = Path.Combine(_padScriptsFolder, flowName + ".robin");

        if (!File.Exists(robinFilePath))
        {
            result.Success = false;
            result.ErrorMessage = "Robin script file not found: " + robinFilePath;
            diagLog.Add(new PadDiagnosticEntry
            {
                Strategy = "File Check",
                FlowName = flowName,
                ErrorMessage = result.ErrorMessage,
                Succeeded = false,
            });
            result.DiagnosticLog = diagLog;
            return result;
        }

        string robinContent = File.ReadAllText(robinFilePath, Encoding.UTF8);

        // Derive a display name for the flow
        string displayName = flowName;
        if (displayName.StartsWith("WisprTest_", StringComparison.OrdinalIgnoreCase))
        {
            displayName = displayName.Substring("WisprTest_".Length).Replace("_", " ");
        }

        // Step 1: Import the .robin script into PAD so the flow is registered
        bool imported = TryImportFlowViaPowerShell(displayName, robinContent);
        if (!imported)
        {
            imported = TryImportViaProtocol(displayName, robinFilePath);
        }

        diagLog.Add(new PadDiagnosticEntry
        {
            Strategy = "Step 1: Import Flow",
            FlowName = displayName,
            Succeeded = imported,
            ErrorMessage = imported ? "Flow imported successfully" : "Could not import flow into PAD",
        });

        // Step 2: Discover environment ID and workflow ID, then execute via protocol URI
        if (imported)
        {
            // Try to discover the PAD environment ID and workflow ID via PowerShell
            var discoveryResult = DiscoverFlowIds(displayName);
            diagLog.Add(new PadDiagnosticEntry
            {
                Strategy = "Step 2: Discover Flow IDs",
                FlowName = displayName,
                Succeeded = discoveryResult.Found,
                Stdout = "EnvironmentId=" + (discoveryResult.EnvironmentId ?? "(null)") + 
                         ", WorkflowId=" + (discoveryResult.WorkflowId ?? "(null)"),
                ErrorMessage = discoveryResult.ErrorMessage,
            });

            if (discoveryResult.Found)
            {
                // Execute via protocol URI: ms-powerautomate://console/flow/run?environmentid=...&workflowid=...&source=Other
                result = ExecuteViaProtocolUri(discoveryResult.EnvironmentId, discoveryResult.WorkflowId, displayName, timeoutSeconds);
                diagLog.AddRange(result.DiagnosticLog);

                if (result.Success)
                {
                    result.DiagnosticLog = diagLog;
                    return result;
                }
            }

            // Fallback: try protocol URI with flow name (no IDs)
            result = ExecuteViaProtocolUriByName(displayName, flowName, timeoutSeconds);
            diagLog.AddRange(result.DiagnosticLog);

            if (result.Success)
            {
                result.DiagnosticLog = diagLog;
                return result;
            }
        }

        // Strategy 3 (fallback): Try running via PAD CLI if available
        if (!string.IsNullOrEmpty(_padConsolePath) && File.Exists(_padConsolePath))
        {
            var cliResult = TryRunViaCli(displayName, flowName, timeoutSeconds);
            diagLog.AddRange(cliResult.DiagnosticLog);

            if (cliResult.Success)
            {
                cliResult.DiagnosticLog = diagLog;
                return cliResult;
            }
            result = cliResult;
        }

        // Strategy 4 (last resort): Launch PAD designer and paste the script via clipboard for manual run.
        if (!result.Success)
        {
            result = TryLaunchWithClipboard(robinContent, robinFilePath, flowName);
            diagLog.Add(new PadDiagnosticEntry
            {
                Strategy = "Strategy 4: Clipboard + Manual Launch",
                FlowName = flowName,
                Succeeded = false,
                ErrorMessage = result.ErrorMessage,
            });
        }

        result.DiagnosticLog = diagLog;
        return result;
    }

    /// <summary>
    /// Discovers the PAD environment ID and workflow ID for a given flow name using PowerShell.
    /// </summary>
    private FlowDiscoveryResult DiscoverFlowIds(string flowDisplayName)
    {
        var result = new FlowDiscoveryResult();

        try
        {
            // PowerShell script to discover environment and flow IDs from PAD
            string psScript =
                "$ErrorActionPreference = 'SilentlyContinue'\n" +
                "try {\n" +
                "  # Method 1: Use PAD PowerShell module\n" +
                "  $padModule = Get-Module -ListAvailable -Name 'Microsoft.PowerAutomate.Desktop' 2>$null\n" +
                "  if ($null -ne $padModule) {\n" +
                "    Import-Module Microsoft.PowerAutomate.Desktop 2>$null\n" +
                "    $flows = Get-PADFlow 2>$null\n" +
                "    if ($flows) {\n" +
                "      $targetFlow = $flows | Where-Object { $_.Name -eq '" + flowDisplayName.Replace("'", "''") + "' } | Select-Object -First 1\n" +
                "      if ($targetFlow) {\n" +
                "        $envId = $targetFlow.EnvironmentId\n" +
                "        if (-not $envId) { $envId = $targetFlow.environmentId }\n" +
                "        $wfId = $targetFlow.WorkflowId\n" +
                "        if (-not $wfId) { $wfId = $targetFlow.workflowId }\n" +
                "        if (-not $wfId) { $wfId = $targetFlow.Id }\n" +
                "        if (-not $wfId) { $wfId = $targetFlow.id }\n" +
                "        Write-Output \"ENV=$envId\"\n" +
                "        Write-Output \"WF=$wfId\"\n" +
                "        exit 0\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "  # Method 2: Query PAD's local SQLite database\n" +
                "  $dbPath = Join-Path $env:LOCALAPPDATA 'Microsoft\\Power Automate Desktop\\Console\\pad.db'\n" +
                "  if (Test-Path $dbPath) {\n" +
                "    # Read environment ID from the database\n" +
                "    Add-Type -Path (Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'System.Data.dll') 2>$null\n" +
                "    Write-Output 'DB_FOUND'\n" +
                "  }\n" +
                "  # Method 3: Try to get environment ID from registry/config\n" +
                "  $padRegKey = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Power Automate Desktop' -ErrorAction SilentlyContinue\n" +
                "  if ($padRegKey -and $padRegKey.EnvironmentId) {\n" +
                "    Write-Output \"ENV=$($padRegKey.EnvironmentId)\"\n" +
                "  }\n" +
                "  # Also check for Default environment via cloud connection\n" +
                "  $padConfig = Join-Path $env:LOCALAPPDATA 'Microsoft\\Power Automate Desktop\\Console\\settings.json'\n" +
                "  if (Test-Path $padConfig) {\n" +
                "    $settings = Get-Content $padConfig -Raw | ConvertFrom-Json 2>$null\n" +
                "    if ($settings -and $settings.environmentId) {\n" +
                "      Write-Output \"ENV=$($settings.environmentId)\"\n" +
                "    }\n" +
                "  }\n" +
                "  # List all flows to find ID\n" +
                "  $flowsDir = Join-Path $env:LOCALAPPDATA 'Microsoft\\Power Automate Desktop\\Console\\Flows'\n" +
                "  if (Test-Path $flowsDir) {\n" +
                "    Get-ChildItem $flowsDir -Filter '*.robin' | ForEach-Object {\n" +
                "      Write-Output \"FLOW_FILE=$($_.BaseName)\"\n" +
                "    }\n" +
                "  }\n" +
                "} catch {\n" +
                "  Write-Output \"ERROR=$($_.Exception.Message)\"\n" +
                "}\n";

            string psScriptPath = Path.Combine(Path.GetTempPath(), "wispr_pad_discover_" + Guid.NewGuid().ToString("N") + ".ps1");
            File.WriteAllText(psScriptPath, psScript, Encoding.UTF8);

            var procResult = RunProcess("powershell.exe",
                "-NoProfile -ExecutionPolicy Bypass -File \"" + psScriptPath + "\"",
                15);

            try { File.Delete(psScriptPath); } catch { }

            string output = procResult.StandardOutput ?? "";
            
            // Parse ENV= and WF= from output
            foreach (string line in output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
            {
                string trimmed = line.Trim();
                if (trimmed.StartsWith("ENV=") && trimmed.Length > 4)
                {
                    result.EnvironmentId = trimmed.Substring(4);
                }
                else if (trimmed.StartsWith("WF=") && trimmed.Length > 3)
                {
                    result.WorkflowId = trimmed.Substring(3);
                }
            }

            result.Found = !string.IsNullOrEmpty(result.EnvironmentId) && !string.IsNullOrEmpty(result.WorkflowId);
            if (!result.Found)
            {
                result.ErrorMessage = "Could not discover flow IDs. Output: " + output.Trim();
            }
        }
        catch (Exception ex)
        {
            result.ErrorMessage = "Discovery error: " + ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Executes a PAD flow using the ms-powerautomate:// protocol URI with environment and workflow IDs.
    /// This uses Process.Start with UseShellExecute=true to trigger the protocol handler.
    /// </summary>
    private PadExecutionResult ExecuteViaProtocolUri(string environmentId, string workflowId, string displayName, int timeoutSeconds)
    {
        var diagLog = new List<PadDiagnosticEntry>();

        string protocolUri = "ms-powerautomate://console/flow/run" +
            "?environmentid=" + Uri.EscapeDataString(environmentId) +
            "&workflowid=" + Uri.EscapeDataString(workflowId) +
            "&source=Other";

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = protocolUri,
                UseShellExecute = true,
            };

            Process.Start(psi);

            // Give PAD service time to pick up and start the flow
            System.Threading.Thread.Sleep(3000);

            diagLog.Add(new PadDiagnosticEntry
            {
                Strategy = "Protocol URI Execution",
                FlowName = displayName,
                Command = "(shell protocol)",
                Arguments = protocolUri,
                Succeeded = true,
                DurationMs = 3000,
                ErrorMessage = "Protocol URI dispatched successfully",
            });

            return new PadExecutionResult
            {
                Success = true,
                DurationMs = 3000,
                StandardOutput = "Flow dispatched via protocol URI: " + protocolUri,
                DiagnosticLog = diagLog,
            };
        }
        catch (Exception ex)
        {
            diagLog.Add(new PadDiagnosticEntry
            {
                Strategy = "Protocol URI Execution",
                FlowName = displayName,
                Command = "(shell protocol)",
                Arguments = protocolUri,
                Succeeded = false,
                ErrorMessage = "Protocol URI failed: " + ex.Message,
            });

            return new PadExecutionResult
            {
                Success = false,
                ErrorMessage = "Protocol URI execution failed: " + ex.Message,
                DiagnosticLog = diagLog,
            };
        }
    }

    /// <summary>
    /// Executes a PAD flow using protocol URI with flow name (fallback when IDs are not available).
    /// Tries multiple URI formats.
    /// </summary>
    private PadExecutionResult ExecuteViaProtocolUriByName(string displayName, string flowName, int timeoutSeconds)
    {
        var diagLog = new List<PadDiagnosticEntry>();
        var candidateNames = BuildProtocolCandidateNames(flowName);

        for (int i = 0; i < candidateNames.Count; i++)
        {
            string name = candidateNames[i];
            // Try both single-slash and double-slash URI formats
            var uris = new List<string>
            {
                "ms-powerautomate://console/flow/run?workflowname=" + Uri.EscapeDataString(name) + "&source=Other",
                "ms-powerautomate:/console/flow/run?workflowname=" + Uri.EscapeDataString(name) + "&source=Other",
            };

            for (int j = 0; j < uris.Count; j++)
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = uris[j],
                        UseShellExecute = true,
                    };

                    Process.Start(psi);
                    System.Threading.Thread.Sleep(3000);

                    diagLog.Add(new PadDiagnosticEntry
                    {
                        Strategy = "Protocol URI by Name (attempt " + (i * 2 + j + 1) + ")",
                        FlowName = name,
                        Command = "(shell protocol)",
                        Arguments = uris[j],
                        Succeeded = true,
                        DurationMs = 3000,
                    });

                    return new PadExecutionResult
                    {
                        Success = true,
                        DurationMs = 3000,
                        StandardOutput = "Flow dispatched via protocol URI: " + uris[j],
                        DiagnosticLog = diagLog,
                    };
                }
                catch (Exception ex)
                {
                    diagLog.Add(new PadDiagnosticEntry
                    {
                        Strategy = "Protocol URI by Name (attempt " + (i * 2 + j + 1) + ")",
                        FlowName = name,
                        Command = "(shell protocol)",
                        Arguments = uris[j],
                        Succeeded = false,
                        ErrorMessage = ex.Message,
                    });
                }
            }
        }

        return new PadExecutionResult
        {
            Success = false,
            ErrorMessage = "All protocol URI by-name attempts failed.",
            DiagnosticLog = diagLog,
        };
    }

    /// <summary>
    /// Fallback: runs a flow via PAD CLI (PAD.Console.Host.exe).
    /// </summary>
    private PadExecutionResult TryRunViaCli(string displayName, string flowName, int timeoutSeconds)
    {
        var diagLog = new List<PadDiagnosticEntry>();
        var candidateArgs = new List<string>
        {
            "run /flowname:\"" + displayName + "\"",
            "run /flowName:\"" + displayName + "\"",
            "run /flowname:\"" + flowName + "\"",
            "run /flowName:\"" + flowName + "\"",
        };

        PadExecutionResult lastResult = null;
        for (int i = 0; i < candidateArgs.Count; i++)
        {
            var processResult = RunProcess(_padConsolePath, candidateArgs[i], timeoutSeconds);

            diagLog.Add(new PadDiagnosticEntry
            {
                Strategy = "CLI Fallback (attempt " + (i + 1) + ")",
                FlowName = displayName,
                Command = _padConsolePath,
                Arguments = candidateArgs[i],
                Stdout = processResult.StandardOutput,
                Stderr = processResult.StandardError,
                ExitCode = processResult.ExitCode,
                DurationMs = processResult.DurationMs,
                Succeeded = processResult.Success,
                ErrorMessage = processResult.ErrorMessage,
            });

            if (processResult.Success)
            {
                processResult.DiagnosticLog = diagLog;
                return processResult;
            }
            lastResult = processResult;
        }

        if (lastResult != null) lastResult.DiagnosticLog = diagLog;
        return lastResult ?? new PadExecutionResult
        {
            Success = false,
            ErrorMessage = "PAD CLI did not execute the flow.",
            DiagnosticLog = diagLog,
        };
    }

    /// <summary>
    /// Attempts to import a .robin script as a PAD flow using PowerShell automation.
    /// </summary>
    private bool TryImportFlowViaPowerShell(string flowDisplayName, string robinContent)
    {
        try
        {
            string escapedContent = robinContent
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("'", "''")
                .Replace("\r\n", "`r`n")
                .Replace("\n", "`n");

            string psScript =
                "$ErrorActionPreference = 'Stop'\n" +
                "try {\n" +
                "  $padModule = Get-Module -ListAvailable -Name 'Microsoft.PowerAutomate.Desktop' 2>$null\n" +
                "  if ($null -ne $padModule) {\n" +
                "    Import-Module Microsoft.PowerAutomate.Desktop\n" +
                "    $flowDef = @{ Name = '" + flowDisplayName.Replace("'", "''") + "'; Definition = @'" + "\n" +
                robinContent + "\n" +
                "'@ }\n" +
                "    New-PADFlow -Name $flowDef.Name -Definition $flowDef.Definition\n" +
                "    Write-Output 'FLOW_CREATED'\n" +
                "  } else {\n" +
                "    $padFlowsDir = Join-Path $env:LOCALAPPDATA 'Microsoft\\Power Automate Desktop\\Console\\Flows'\n" +
                "    if (-not (Test-Path $padFlowsDir)) { New-Item -ItemType Directory -Path $padFlowsDir -Force | Out-Null }\n" +
                "    $flowFile = Join-Path $padFlowsDir ('" + flowDisplayName.Replace("'", "''") + ".robin')\n" +
                "    Set-Content -Path $flowFile -Value @'\n" +
                robinContent + "\n" +
                "'@ -Encoding UTF8\n" +
                "    Write-Output 'FLOW_FILE_CREATED'\n" +
                "  }\n" +
                "} catch {\n" +
                "  Write-Error $_.Exception.Message\n" +
                "  exit 1\n" +
                "}\n";

            string psScriptPath = Path.Combine(Path.GetTempPath(), "wispr_pad_import_" + Guid.NewGuid().ToString("N") + ".ps1");
            File.WriteAllText(psScriptPath, psScript, Encoding.UTF8);

            var result = RunProcess("powershell.exe",
                "-NoProfile -ExecutionPolicy Bypass -File \"" + psScriptPath + "\"",
                30);

            try { File.Delete(psScriptPath); } catch { }

            if (result.Success && (result.StandardOutput.Contains("FLOW_CREATED") || result.StandardOutput.Contains("FLOW_FILE_CREATED")))
            {
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Tries to import a flow by copying the .robin file to PAD's Console\Flows directory.
    /// </summary>
    private bool TryImportViaProtocol(string flowDisplayName, string robinFilePath)
    {
        try
        {
            string padFlowsDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Microsoft", "Power Automate Desktop", "Console", "Flows");

            if (!Directory.Exists(padFlowsDir))
            {
                Directory.CreateDirectory(padFlowsDir);
            }

            string destPath = Path.Combine(padFlowsDir, flowDisplayName + ".robin");
            File.Copy(robinFilePath, destPath, overwrite: true);

            System.Threading.Thread.Sleep(1000);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Last resort: launches PAD designer and copies the script to clipboard for manual run.
    /// </summary>
    private PadExecutionResult TryLaunchWithClipboard(string robinContent, string robinFilePath, string flowName)
    {
        try
        {
            string clipScript = "Set-Clipboard -Value (Get-Content -Raw '" + robinFilePath.Replace("'", "''") + "')";
            RunProcess("powershell.exe", "-NoProfile -Command \"" + clipScript + "\"", 10);

            LaunchPadDesigner();

            return new PadExecutionResult
            {
                Success = false,
                ErrorMessage = "Auto-execution failed. PAD Designer has been launched and the Robin script " +
                    "has been copied to your clipboard.\n\n" +
                    "To run manually:\n" +
                    "1. In Power Automate Desktop, click '+ New flow' and name it '" + flowName + "'\n" +
                    "2. In the flow editor, press Ctrl+V to paste the actions\n" +
                    "3. Click the Run (▶) button\n\n" +
                    "Script location: " + robinFilePath,
            };
        }
        catch (Exception ex)
        {
            return new PadExecutionResult
            {
                Success = false,
                ErrorMessage = "Could not execute or launch PAD flow. Error: " + ex.Message +
                    "\n\nThe .robin script was saved to: " + robinFilePath +
                    "\n\nTo run manually:\n1. Open Power Automate Desktop\n2. Create a new flow\n3. Paste the script content\n4. Click Run",
            };
        }
    }


    private static PadExecutionResult RunProcess(string fileName, string arguments, int timeoutSeconds)
    {
        var result = new PadExecutionResult();

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };

            var sw = Stopwatch.StartNew();
            var process = Process.Start(psi);
            if (process == null)
            {
                result.Success = false;
                result.ErrorMessage = "Failed to start process: " + fileName;
                return result;
            }

            var stdoutTask = new System.Threading.Tasks.Task<string>(() => process.StandardOutput.ReadToEnd());
            var stderrTask = new System.Threading.Tasks.Task<string>(() => process.StandardError.ReadToEnd());
            stdoutTask.Start();
            stderrTask.Start();

            bool exited = process.WaitForExit(timeoutSeconds * 1000);
            sw.Stop();

            if (!exited)
            {
                try { process.Kill(); } catch { }
                result.Success = false;
                result.ErrorMessage = "Execution timed out after " + timeoutSeconds + " seconds.";
                result.DurationMs = sw.ElapsedMilliseconds;
                return result;
            }

            string stdout = "";
            string stderr = "";
            try { stdout = stdoutTask.Result; } catch { }
            try { stderr = stderrTask.Result; } catch { }

            result.ExitCode = process.ExitCode;
            result.StandardOutput = stdout;
            result.StandardError = stderr;
            result.DurationMs = sw.ElapsedMilliseconds;

            // Detect no-op: exited quickly with no output
            bool emptyOutput = string.IsNullOrWhiteSpace(stdout) && string.IsNullOrWhiteSpace(stderr);
            if (process.ExitCode == 0 && emptyOutput && sw.ElapsedMilliseconds < 2000)
            {
                result.Success = false;
                result.ErrorMessage = "Process exited but did not execute the flow (no output, duration: " + sw.ElapsedMilliseconds + "ms).";
                return result;
            }

            result.Success = process.ExitCode == 0;
            if (!result.Success && string.IsNullOrEmpty(result.ErrorMessage))
            {
                result.ErrorMessage = string.IsNullOrEmpty(stderr)
                    ? "Exited with code " + process.ExitCode
                    : stderr.Trim();
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = "Execution error: " + ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Generates candidate protocol flow names from the exported name.
    /// </summary>
    private static List<string> BuildProtocolCandidateNames(string flowName)
    {
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        AddProtocolCandidate(names, seen, flowName);

        if (!string.IsNullOrEmpty(flowName) && flowName.StartsWith("WisprTest_", StringComparison.OrdinalIgnoreCase))
        {
            string original = flowName.Substring("WisprTest_".Length);
            AddProtocolCandidate(names, seen, original);
            AddProtocolCandidate(names, seen, original.Replace("_", " "));
        }

        AddProtocolCandidate(names, seen, (flowName ?? "").Replace("_", " "));

        return names;
    }

    private static void AddProtocolCandidate(List<string> names, HashSet<string> seen, string candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return;
        string trimmed = candidate.Trim();
        if (seen.Add(trimmed)) names.Add(trimmed);
    }

    private static bool IsFlowNotFoundError(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        return ContainsInsensitive(message, "specified name or ID wasn't found") ||
               ContainsInsensitive(message, "workflow wasn't found") ||
               ContainsInsensitive(message, "flow wasn't found") ||
               ContainsInsensitive(message, "not found");
    }

    private static bool IsNoExecutionError(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        return ContainsInsensitive(message, "did not execute") ||
               ContainsInsensitive(message, "did not report flow execution") ||
               ContainsInsensitive(message, "no output");
    }

    private static bool ContainsInsensitive(string source, string value)
    {
        return source.IndexOf(value, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    /// <summary>
    /// Builds the PAD run URI for CLI invocation.
    /// Supports workflowId when a GUID is passed; otherwise uses workflowName.
    /// </summary>
    private static string BuildRunUri(string flowName)
    {
        var uris = BuildRunUriCandidates(flowName);
        return uris.Count > 0 ? uris[0] : "";
    }

    private static List<string> BuildRunUriCandidates(string flowName)
    {
        var uris = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        string flow = flowName ?? "";

        if (Guid.TryParse(flow, out _))
        {
            string encoded = Uri.EscapeDataString(flow);
            AddRunUri(uris, seen, "ms-powerautomate:/console/flow/run?workflowid=" + encoded);
            AddRunUri(uris, seen, "ms-powerautomate:/console/flow/run?workflowId=" + encoded);
        }
        else
        {
            string encoded = Uri.EscapeDataString(flow);
            AddRunUri(uris, seen, "ms-powerautomate:/console/flow/run?workflowname=" + encoded);
            AddRunUri(uris, seen, "ms-powerautomate:/console/flow/run?workflowName=" + encoded);
        }

        int baseCount = uris.Count;
        for (int i = 0; i < baseCount; i++)
        {
            AddRunUri(uris, seen, uris[i].Replace("ms-powerautomate:/", "ms-powerautomate://"));
        }

        return uris;
    }

    private static void AddRunUri(List<string> uris, HashSet<string> seen, string uri)
    {
        if (string.IsNullOrWhiteSpace(uri)) return;
        if (seen.Add(uri)) uris.Add(uri);
    }

    /// <summary>
    /// Sanitizes a flow name for use as a file name.
    /// </summary>
    private static string SanitizeFlowName(string name)
    {
        if (string.IsNullOrEmpty(name)) return "unnamed";
        var sb = new StringBuilder();
        for (int i = 0; i < name.Length; i++)
        {
            char c = name[i];
            if (char.IsLetterOrDigit(c) || c == '_' || c == '-')
                sb.Append(c);
            else if (c == ' ')
                sb.Append('_');
        }
        string result = sb.ToString();
        if (result.Length == 0) return "unnamed";
        if (result.Length > 50) return result.Substring(0, 50);
        return result;
    }
}

/// <summary>
/// Result of executing a PAD flow via CLI.
/// </summary>
public class PadExecutionResult
{
    public bool Success { get; set; }
    public int ExitCode { get; set; }
    public string StandardOutput { get; set; } = "";
    public string StandardError { get; set; } = "";
    public string ErrorMessage { get; set; } = "";
    public long DurationMs { get; set; }
    /// <summary>Diagnostic log entries from the execution attempt.</summary>
    public List<PadDiagnosticEntry> DiagnosticLog { get; set; } = new();
}

/// <summary>
/// A single diagnostic log entry capturing one strategy attempt during PAD execution.
/// </summary>
public class PadDiagnosticEntry
{
    public string Strategy { get; set; } = "";
    public string FlowName { get; set; } = "";
    public string Command { get; set; } = "";
    public string Arguments { get; set; } = "";
    public string Stdout { get; set; } = "";
    public string Stderr { get; set; } = "";
    public int ExitCode { get; set; }
    public long DurationMs { get; set; }
    public bool Succeeded { get; set; }
    public string ErrorMessage { get; set; } = "";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Result of discovering PAD environment and workflow IDs.
/// </summary>
public class FlowDiscoveryResult
{
    public bool Found { get; set; }
    public string EnvironmentId { get; set; } = "";
    public string WorkflowId { get; set; } = "";
    public string ErrorMessage { get; set; } = "";
}
