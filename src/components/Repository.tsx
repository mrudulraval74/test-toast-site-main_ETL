import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileBrowser from "@/components/FileBrowser";
import GitHistory from "@/components/GitHistory";
import { ExecutionResult } from "@/components/ExecutionResult";
import { FileText, GitBranch, PlayCircle, Download, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface RepositoryProps {
  projectId: string;
}

interface GitConfig {
  git_repository_url?: string;
  git_branch?: string;
  git_sync_status?: string;
}

interface SeleniumAgent {
  id: string;
  agent_name: string;
  status: string;
}

export const Repository: React.FC<RepositoryProps> = ({ projectId }) => {
  const [gitConfig, setGitConfig] = useState<GitConfig>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [seleniumAgents, setSeleniumAgents] = useState<SeleniumAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [creatingJob, setCreatingJob] = useState(false);

  useEffect(() => {
    const fetchGitConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("git_repository_url, git_branch, git_sync_status")
          .eq("id", projectId)
          .single();
        if (error) throw error;
        setGitConfig(data || {});
      } catch (error) {
        console.error("Error fetching git config:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGitConfig();
  }, [projectId]);

  // Fetch online Selenium agents
  useEffect(() => {
    const fetchSeleniumAgents = async () => {
      try {
        const { data, error } = await supabase
          .from("self_hosted_agents")
          .select("id, agent_name, status")
          .eq("project_id", projectId)
          .eq("status", "online");
        
        if (error) throw error;
        setSeleniumAgents(data || []);
      } catch (error) {
        console.error("Error fetching Selenium agents:", error);
      }
    };
    fetchSeleniumAgents();

    // Set up realtime subscription for agent status changes
    const channel = supabase
      .channel('selenium-agents-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'self_hosted_agents',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchSeleniumAgents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const handleRunSeleniumTests = async () => {
    if (!selectedAgentId) {
      toast({ title: "No agent selected", description: "Please select a Selenium agent", variant: "destructive" });
      return;
    }

    setCreatingJob(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create a test run first
      const runId = crypto.randomUUID();

      // Create a pending job for the Selenium agent (no nocode_test needed for repository execution)
      const { error } = await supabase
        .from("agent_job_queue")
        .insert({
          project_id: projectId,
          job_type: "selenium",
          agent_id: selectedAgentId,
          status: "pending",
          run_id: runId,
          test_id: null, // Selenium repository execution doesn't require a test_id
          base_url: gitConfig.git_repository_url || "",
          steps: [],
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Job Created",
        description: "Selenium test job is pending. The agent will pick it up shortly.",
      });

      setSelectedAgentId("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingJob(false);
    }
  };

  const downloadRepository = async (repoData: string, repoName: string, projectName: string) => {
    try {
      setDownloading(true);

      const downloadTime = new Date();

      // FILE NAME TIMESTAMP (your local time for filename)
      const fileTimestamp = downloadTime.toLocaleString('sv-SE').replace(/[\s:]/g, '-'); // 2025-11-21-143055

      // EXECUTION TIMESTAMP IN UTC WITH "Z" — EXACTLY WHAT YOU WANTED
      const executionTimestampUTC = downloadTime.toISOString().slice(0, 19).replace("T", " ") + "Z";
      // → "2025-10-31 07:23:03Z"

      

      const safeProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, "_");

      const baseName = `${safeProjectName}_${fileTimestamp}`;
      
      const zipFileName = `${baseName}.zip`;

      const ps1FileName = `${baseName}.ps1`;
      const batFileName = `${baseName}.bat`;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const zip = new JSZip();

      const { data: files } = await supabase
        .from("git_files")
        .select("file_path, file_content")
        .eq("project_id", projectId);

      if (!files || files.length === 0) {
        toast({ title: "No files", description: "Project is empty", variant: "destructive" });
        return;
      }

      files.forEach(file => zip.file(file.file_path, file.file_content || ""));

      const { data: { user } } = await supabase.auth.getUser();

      const projectInfoProperties = `# Project Configuration Properties
# Downloaded at: ${downloadTime.toLocaleString()}
project.name=${projectName}
project.id=${projectId}
user.id=${user?.id || "local_user"}
download.timestamp=${fileTimestamp}
execution.timestamp.utc=${executionTimestampUTC}
Automation.url=${import.meta.env.VITE_SUPABASE_URL}
superbase.key=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}
# Double-click ${ps1FileName} to run!
`;
      zip.file("project.properties", projectInfoProperties);

      const powerShellScript = `# ==========================
# Local Test Runner - UTC executionDate with Z
# ==========================
$PROJECT_DIR = $PSScriptRoot
Set-Location -Path $PROJECT_DIR

Write-Output "Running Maven tests..."
$TMPFILE = "$PROJECT_DIR\\maven_output.txt"
mvn -q clean test *>&1 | Out-File -FilePath $TMPFILE -Encoding UTF8
$EXIT_CODE = $LASTEXITCODE

$patterns = @("[ERROR]","BUILD FAILURE","COMPILATION ERROR","Could not resolve dependencies","Failed to execute goal")
$lines = Get-Content -Path $TMPFILE
$importantErrors = $lines | Select-String -Pattern $patterns -SimpleMatch

if ($EXIT_CODE -ne 0) {
    $ERR_LOG = "$PROJECT_DIR\\important_errors.txt"
    "===== MAVEN BUILD FAILED =====" | Out-File -FilePath $ERR_LOG -Encoding UTF8
    $importantErrors | Out-File -FilePath $ERR_LOG -Encoding UTF8 -Append
}

$errorText = ($importantErrors -join "\`n")

# Read properties
$props = @{}
Get-Content "$PROJECT_DIR\\project.properties" | Where-Object { $_ -match "=" } | ForEach-Object {
    $key, $value = $_ -split "=", 2
    $props[$key.Trim()] = $value.Trim()
}

# THIS IS THE UTC TIME WITH Z — EXACTLY WHAT YOU ASKED
$executionDate = $props["execution.timestamp.utc"]

$json_result = @{
    tests = @(
        @{
            logs = @()
            error = @{
                type = if ($errorText -match "^(.*?):") { $matches[1] } else { "BuildError" }
                message = $errorText
                stackTrace = $errorText
            }
            status = "FAILED"
            testName = "Maven Build"
            description = $errorText.Substring(0, [Math]::Min(120, $errorText.Length))
            executionTimeMs = $null
        }
    )
    browser = "Local Maven"
    project = $props["project.name"]
    summary = @{ failed=0; passed=0; skipped=0; totalTests=1; totalExecutionTimeMs=0 }
    platform = (Get-CimInstance Win32_OperatingSystem).Caption
    environment = "QA"
    executionDate = $executionDate   # ← "2025-10-31 07:23:03Z"
}

if ($EXIT_CODE -ne 0 -and $importantErrors.Count -gt 0) {
    $payload = @{
        id = [guid]::NewGuid().ToString()
        run_id = "$($props['project.name'])_$($props['download.timestamp'])"
        timestamp = $executionDate
        created_at = $executionDate
        user_id = $props["user.id"]
        project_id = $props["project.id"]
        json_result = $json_result
    } | ConvertTo-Json -Depth 20

    Write-Output ""
    Write-Output "========================================================"
    Write-Output "JSON PAYLOAD THAT WILL BE SENT TO SUPABASE:"
    Write-Output "========================================================"
    Write-Output $payload
    Write-Output "========================================================"
    Write-Output ""

    $url = "${supabaseUrl}/rest/v1/automation_results"
    $key = "${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}"

    try {
        Invoke-RestMethod -Uri $url -Method POST -Headers @{
            "apikey" = $key
            "Authorization" = "Bearer $key"
            "Content-Type" = "application/json"
        } -Body $payload | Out-Null
        Write-Output "Report uploaded successfully!"
    } catch {
        Write-Output "Upload failed: $_"
    }
}

Write-Host ""
Write-Host "Execution Time (UTC): $executionDate" -ForegroundColor Green
Write-Host "Press any key to exit..."
[void][System.Console]::ReadKey($true)
exit $EXIT_CODE`;

      zip.file("run-tests.ps1", powerShellScript);
      zip.file("run-tests.bat", `@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0run-tests.ps1"
pause`);

      const autoRunnerScript = `# AUTO-EXTRACT & RUN
$ErrorActionPreference = "Stop"
$name = [System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Path)
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
$zip = Get-ChildItem "$folder\\$name.zip" | Select-Object -First 1
if (!$zip) { Write-Host "ERROR: $name.zip not found!" -ForegroundColor Red; Read-Host; exit 1 }
$dest = Join-Path $folder $name
Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force
Write-Host "Extracted to: $dest" -ForegroundColor Green
Start-Process (Join-Path $dest "run-tests.bat")
Read-Host "Press Enter to close"`;

      const batLauncher = `@echo off
title ${projectName} - UTC: ${executionTimestampUTC}
echo.
echo Project: ${projectName}
echo UTC Time: ${executionTimestampUTC}
echo Folder: ${baseName}
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0${ps1FileName}"
echo.
echo ALL DONE!
pause`;

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const downloadFile = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      downloadFile(zipBlob, zipFileName);
      downloadFile(new Blob([autoRunnerScript], { type: "text/plain;charset=utf-8" }), ps1FileName);
      downloadFile(new Blob([batLauncher], { type: "text/plain" }), batFileName);

      toast({
        title: "Downloaded 3 files!",
        description: `• ${zipFileName}\n• ${ps1FileName} (double-click to run)\n• ${batFileName}\n\nexecutionDate = ${executionTimestampUTC}`,
      });

    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleExecuteTests = async () => {
    if (!gitConfig.git_repository_url) {
      toast({ title: "No repo", description: "Connect Git first", variant: "destructive" });
      return;
    }
    setDownloading(true);
    toast({ title: "Preparing...", description: "Fetching code..." });
    try {
      const { data, error } = await supabase.functions.invoke("repository-download", { body: { projectId } });
      if (error || !data?.success) throw new Error("Download failed");

      const repoName = gitConfig.git_repository_url?.split("/").pop()?.replace(".git", "") || "repo";
      const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
      const projectName = proj?.name || repoName;

      await downloadRepository(data.data, repoName, projectName);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git Repository
            </div>
            <div className="flex items-center gap-3">
              {/* Selenium Agent Selection */}
              <div className="flex items-center gap-2">
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Selenium Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {seleniumAgents.length === 0 ? (
                      <SelectItem value="none" disabled>No online agents</SelectItem>
                    ) : (
                      seleniumAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.agent_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleRunSeleniumTests} 
                  disabled={!selectedAgentId || creatingJob}
                  variant="default"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {creatingJob ? "Creating..." : "Run Tests"}
                </Button>
              </div>
              {gitConfig.git_repository_url && (
                <Button onClick={handleExecuteTests} disabled={downloading} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  {downloading ? "Preparing..." : "Download & Run Locally"}
                </Button>
              )}
            </div>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : gitConfig.git_repository_url || "No repository connected"}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="files">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="files"><FileText className="h-4 w-4 mr-2" />Files</TabsTrigger>
              <TabsTrigger value="commits"><GitBranch className="h-4 w-4 mr-2" />Commits</TabsTrigger>
              <TabsTrigger value="execution"><PlayCircle className="h-4 w-4 mr-2" />Results</TabsTrigger>
            </TabsList>
            <TabsContent value="files"><FileBrowser projectId={projectId} /></TabsContent>
            <TabsContent value="commits"><GitHistory projectId={projectId} /></TabsContent>
            <TabsContent value="execution"><ExecutionResult projectId={projectId} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};