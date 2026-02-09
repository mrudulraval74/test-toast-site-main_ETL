import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Activity,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Server,
  Upload,
  Loader2,
  Cpu,
} from "lucide-react";
import {
  RecordedStep,
  TestPlanConfig,
  ExecutionProgress,
  ExecutionMetrics,
  ExecutionSummary,
  ParameterizationConfig,
  CorrelationConfig,
} from "./types";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PerformanceAgent {
  id: string;
  agent_id: string;
  agent_name: string;
  status: string;
  capacity?: number;
  running_jobs?: number;
  last_heartbeat?: string;
}


interface ExecutionTabProps {
  steps: RecordedStep[];
  config: TestPlanConfig;
  parameterization: ParameterizationConfig;
  correlation: CorrelationConfig;
  progress: ExecutionProgress;
  onProgressChange: (progress: ExecutionProgress) => void;
  projectId: string;
}

export const ExecutionTab = ({
  steps,
  config,
  parameterization,
  correlation,
  progress,
  onProgressChange,
  projectId,
}: ExecutionTabProps) => {
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<{
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
    activeThreads: number;
  }>({
    requestsPerSecond: 0,
    avgResponseTime: 0,
    errorRate: 0,
    activeThreads: 0,
  });

  // Performance Agent selection state
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<PerformanceAgent | null>(null);
  const [tempSelectedAgentId, setTempSelectedAgentId] = useState<string>("");
  const [performanceAgents, setPerformanceAgents] = useState<PerformanceAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);


  // Uploaded JMX file (temporary, client-side only)
  const [uploadedJmx, setUploadedJmx] = useState<{ name: string; content: string } | null>(null);
  // Validation errors for start test
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Loading state for starting test
  const [isStartingTest, setIsStartingTest] = useState(false);
  // Current job ID being tracked
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const canStart = progress.status === "idle";
  const isRunning = progress.status === "running";

  // Fetch performance agents from database
  const fetchPerformanceAgents = useCallback(async () => {
    if (!projectId) return;

    setIsLoadingAgents(true);
    try {
      const { data, error } = await supabase
        .from("self_hosted_agents")
        .select("id, agent_id, agent_name, status, capacity, running_jobs, last_heartbeat")
        .eq("project_id", projectId);

      if (error) throw error;
      setPerformanceAgents((data || []) as PerformanceAgent[]);
    } catch (error) {
      console.error("Error fetching performance agents:", error);
      setPerformanceAgents([]);
    } finally {
      setIsLoadingAgents(false);
    }
  }, [projectId]);


  // Fetch agents on mount
  useEffect(() => {
    fetchPerformanceAgents();
  }, [fetchPerformanceAgents]);

  useEffect(() => {
    if (isAgentDialogOpen) {
      fetchPerformanceAgents();
    }
  }, [isAgentDialogOpen, fetchPerformanceAgents]);

  // Poll for job status when running
  useEffect(() => {
    if (!currentJobId || progress.status !== "running") return;

    const pollInterval = setInterval(async () => {
      try {
        // Check job status
        const { data: jobData, error: jobError } = await supabase
          .from("performance_jobs")
          .select("id, status, started_at, finished_at")
          .eq("id", currentJobId)
          .maybeSingle();

        if (jobError) {
          console.error("Error polling job status:", jobError);
          return;
        }

        if (!jobData) return;

        // Check if job completed or failed
        if (jobData.status === "completed" || jobData.status === "failed") {
          // Fetch results
          const { data: resultData, error: resultError } = await supabase
            .from("performance_results")
            .select("id, status, summary")
            .eq("job_id", currentJobId)
            .maybeSingle();

          if (resultData && resultData.summary) {
            const summary = resultData.summary as {
              totalRequests?: number;
              successCount?: number;
              errorCount?: number;
              avgResponseTime?: number;
              minResponseTime?: number;
              maxResponseTime?: number;
              errorRate?: number;
            };

            onProgressChange({
              status: "completed",
              currentIteration: summary.totalRequests || 0,
              totalIterations: summary.totalRequests || 0,
              activeUsers: 0,
              elapsedTime: jobData.started_at && jobData.finished_at
                ? new Date(jobData.finished_at).getTime() - new Date(jobData.started_at).getTime()
                : 0,
              metrics: [],
              summary: {
                totalRequests: summary.totalRequests || 0,
                successfulRequests: summary.successCount || 0,
                failedRequests: summary.errorCount || 0,
                avgResponseTime: summary.avgResponseTime || 0,
                minResponseTime: summary.minResponseTime || 0,
                maxResponseTime: summary.maxResponseTime || 0,
                throughput: 0,
                errorRate: summary.errorRate || 0,
                startTime: jobData.started_at ? new Date(jobData.started_at).getTime() : Date.now(),
                endTime: jobData.finished_at ? new Date(jobData.finished_at).getTime() : Date.now(),
              },
            });

            setLiveMetrics({
              requestsPerSecond: 0,
              avgResponseTime: summary.avgResponseTime || 0,
              errorRate: summary.errorRate || 0,
              activeThreads: 0,
            });

            toast({
              title: jobData.status === "completed" ? "Test Completed" : "Test Failed",
              description: jobData.status === "completed"
                ? `Performance test finished with ${summary.totalRequests} requests.`
                : "Performance test failed. Check results for details.",
              variant: jobData.status === "completed" ? "default" : "destructive",
            });

            setCurrentJobId(null);
          } else if (jobData.status === "failed") {
            onProgressChange({
              status: "stopped",
              currentIteration: 0,
              totalIterations: 0,
              activeUsers: 0,
              elapsedTime: 0,
              metrics: [],
              summary: null,
            });

            toast({
              title: "Test Failed",
              description: "Performance test failed. No results available.",
              variant: "destructive",
            });

            setCurrentJobId(null);
          }
        } else if (jobData.status === "running" && jobData.started_at) {
          // Update elapsed time
          const elapsedMs = Date.now() - new Date(jobData.started_at).getTime();
          onProgressChange({
            ...progress,
            elapsedTime: elapsedMs,
          });
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [currentJobId, progress.status, onProgressChange, toast]);

  const handleJmxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension
    if (!file.name.toLowerCase().endsWith(".jmx")) {
      toast({ title: "Invalid file", description: "Please upload a .jmx file", variant: "destructive" });
      e.currentTarget.value = "";
      return;
    }

    try {
      const text = await file.text();
      // Basic validation: check for the jmeter root tag
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      if (!xml.querySelector("jmeterTestPlan") && !text.includes("<jmeterTestPlan")) {
        toast({ title: "Invalid JMX", description: "File does not appear to be a JMeter JMX", variant: "destructive" });
        e.currentTarget.value = "";
        return;
      }

      setUploadedJmx({ name: file.name, content: text });
      toast({ title: "JMX uploaded", description: `${file.name} loaded` });
    } catch (err) {
      console.error(err);
      toast({ title: "Upload failed", description: "Unable to read file", variant: "destructive" });
    } finally {
      e.currentTarget.value = "";
    }
  };

  const handleAgentSelect = () => {
    const agent = performanceAgents.find((a) => a.id === tempSelectedAgentId || a.agent_id === tempSelectedAgentId);
    if (agent) {
      setSelectedAgent(agent);
      setIsAgentDialogOpen(false);
    } else {
      toast({
        title: "Error",
        description: "Failed to select agent",
        variant: "destructive",
      });
    }
  };

  const openAgentDialog = () => {
    setTempSelectedAgentId(selectedAgent?.id || "");
    setIsAgentDialogOpen(true);
  };

  const executeRequest = async (
    step: RecordedStep,
    variables: Record<string, string>,
    signal: AbortSignal,
  ): Promise<ExecutionMetrics> => {
    const startTime = performance.now();

    // Replace variables in URL and body
    let url = step.url;
    let body = step.body;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\$\\{${key}\\}`, "g");
      url = url.replace(regex, value);
      body = body.replace(regex, value);
    });

    try {
      const headers: Record<string, string> = { ...step.headers };

      const response = await fetch(url, {
        method: step.method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(step.method) ? body : undefined,
        signal,
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Try to get response size
      const responseText = await response.text();
      const bytes = new Blob([responseText]).size;

      return {
        requestName: step.requestName,
        timestamp: Date.now(),
        responseTime,
        statusCode: response.status,
        success: response.ok,
        bytes,
      };
    } catch (error: any) {
      const endTime = performance.now();
      return {
        requestName: step.requestName,
        timestamp: Date.now(),
        responseTime: endTime - startTime,
        statusCode: 0,
        success: false,
        bytes: 0,
        errorMessage: error.name === "AbortError" ? "Request cancelled" : error.message,
      };
    }
  };

  const parseCSVData = (csv: string): Record<string, string>[] => {
    if (!csv.trim()) return [{}];

    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [{}];

    const headers = lines[0].split(",").map((h) => h.trim());
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      data.push(row);
    }

    return data.length > 0 ? data : [{}];
  };

  // Generate UUID v4
  const generateUUID = (): string => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Helper function to validate base64 string
  const isValidBase64 = (str: string): boolean => {
    if (!str || str.trim() === "") return false;
    try {
      // Check if it's valid base64 by attempting to decode
      const decoded = atob(str);
      // Re-encode and compare to verify
      return btoa(decoded) === str;
    } catch {
      return false;
    }
  };

  // Validate inputs before starting test
  const validateTestInputs = useCallback(async (): Promise<{
    valid: boolean;
    errors: string[];
    jmxData: { id: string; base64: string } | null;
  }> => {
    const errors: string[] = [];
    let jmxData: { id: string; base64: string } | null = null;

    // 1. Performance Agent Selection - validate agent is selected
    if (!selectedAgent) {
      errors.push("Please select a Performance Agent.");
      return { valid: false, errors, jmxData };
    }

    // 2. JMX Retrieval - fetch latest JMX file from performance_jmx_files
    if (uploadedJmx) {
      // Use client-uploaded JMX
      const base64 = btoa(unescape(encodeURIComponent(uploadedJmx.content)));
      if (!base64 || base64.trim() === "") {
        errors.push("No JMX file found. Please upload a JMX file.");
        return { valid: false, errors, jmxData };
      }
      // Validate base64 format
      if (!isValidBase64(base64)) {
        errors.push("Invalid JMX file. Please re-upload.");
        return { valid: false, errors, jmxData };
      }

      // Save uploaded JMX to the database
      const jmxId = generateUUID();
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        errors.push("Please log in to upload JMX files.");
        return { valid: false, errors, jmxData };
      }

      const { error: saveError } = await supabase
        .from("performance_jmx_files")
        .insert({
          id: jmxId,
          jmx: uploadedJmx.content,
          jmx_base64: base64,
          project_id: projectId,
          created_by: userId,
        });

      if (saveError) {
        console.error("Failed to save JMX file:", saveError);
        errors.push("Failed to save JMX file. Please try again.");
        return { valid: false, errors, jmxData };
      }

      jmxData = { id: jmxId, base64 };
    } else {
      // Fetch latest JMX from performance_jmx_files table for current project
      try {
        const { data, error } = await supabase
          .from("performance_jmx_files")
          .select("id, jmx")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          errors.push("No JMX file found. Please upload a JMX file.");
          return { valid: false, errors, jmxData };
        }

        const jmxRecord = data as { id: string; jmx: string };

        // Validate jmx is non-empty
        if (!jmxRecord.jmx || jmxRecord.jmx.trim() === "") {
          errors.push("No JMX file found. Please upload a JMX file.");
          return { valid: false, errors, jmxData };
        }

        // Convert JMX content to base64 for the payload
        const jmxBase64 = btoa(unescape(encodeURIComponent(jmxRecord.jmx)));

        // Validate base64 format
        if (!isValidBase64(jmxBase64)) {
          errors.push("Invalid JMX file. Please re-upload.");
          return { valid: false, errors, jmxData };
        }

        jmxData = { id: jmxRecord.id, base64: jmxBase64 };
      } catch (err) {
        console.error("Error fetching JMX file:", err);
        errors.push("No JMX file found. Please upload a JMX file.");
        return { valid: false, errors, jmxData };
      }
    }

    // 3. Load Configuration Mapping - validate all fields are non-null and non-zero
    const virtualUsers = config.virtualUsers;
    const rampUp = config.rampUpTime;
    const duration = config.duration;
    const thinkTime = config.thinkTime;

    if (
      !virtualUsers ||
      virtualUsers <= 0 ||
      rampUp === undefined ||
      rampUp === null ||
      !duration ||
      duration <= 0 ||
      thinkTime === undefined ||
      thinkTime === null
    ) {
      errors.push("Please complete load configuration.");
      return { valid: false, errors, jmxData };
    }

    return { valid: errors.length === 0, errors, jmxData };
  }, [selectedAgent, config, uploadedJmx]);

  // Start performance test with full validation and payload construction
  const startPerformanceTest = useCallback(async () => {
    setIsStartingTest(true);
    setValidationErrors([]);

    try {
      // Validate all inputs
      const validation = await validateTestInputs();

      if (!validation.valid) {
        setValidationErrors(validation.errors);
        toast({
          title: "Validation Failed",
          description: validation.errors[0],
          variant: "destructive",
        });
        return;
      }

      // Get current user
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        toast({
          title: "Authentication Error",
          description: "Please log in to start a performance test.",
          variant: "destructive",
        });
        return;
      }

      // Generate unique job ID
      const jobId = generateUUID();

      // 4. Construct execution payload with exact shape
      const payload = {
        jobId,
        agentId: selectedAgent!.id, // Use UUID instead of string identifier
        jmxId: validation.jmxData!.id,
        jmxBase64: validation.jmxData!.base64,
        config: {
          virtualUsers: config.virtualUsers,
          rampUp: config.rampUpTime,
          duration: config.duration,
          thinkTime: config.thinkTime,
        },
      };

      // Log the payload before sending
      console.log("Performance Job Payload:", payload);

      // 5. Send Payload to Performance Agent by creating job in performance_jobs table
      const { data: job, error: jobError } = await supabase
        .from("performance_jobs")
        .insert([
          {
            id: jobId,
            agent_id: selectedAgent!.id,
            jmx_id: validation.jmxData!.id,
            project_id: projectId,
            threads: config.virtualUsers,
            rampup: config.rampUpTime,
            duration: config.duration,
            status: "queued",
          },
        ])
        .select()
        .single();

      // Log the response from Performance Agent
      console.log("Performance Agent Response:", job);

      if (jobError) {
        console.error("Failed to create performance job:", jobError);
        toast({
          title: "Failed to Start Test",
          description: "Could not create performance job. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Set job ID for polling
      setCurrentJobId(job.id);

      // Update progress to running state
      onProgressChange({
        status: "running",
        currentIteration: 0,
        totalIterations: config.virtualUsers * (config.loopCount || 1),
        activeUsers: config.virtualUsers,
        elapsedTime: 0,
        metrics: [],
        summary: null,
      });

      toast({
        title: "Performance Test Started",
        description: `Test job ${job.id} dispatched to agent ${selectedAgent!.agent_name}. The agent will execute the JMX file.`,
      });

      // Jobs are now displayed in Self-Hosted Agents section

      // Note: The actual test execution happens on the performance agent
      // The agent polls for jobs and executes them, reporting results back
    } catch (error: any) {
      console.error("Error starting performance test:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start performance test.",
        variant: "destructive",
      });
    } finally {
      setIsStartingTest(false);
    }
  }, [validateTestInputs, selectedAgent, config, projectId, onProgressChange, toast]);

  const runLoadTest = useCallback(async () => {
    // Use new validation and execution flow
    await startPerformanceTest();
  }, [startPerformanceTest]);

  const stopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentJobId(null);
    onProgressChange({
      ...progress,
      status: "stopped",
    });
    toast({ title: "Test stopped" });
  };

  const resetTest = () => {
    setCurrentJobId(null);
    onProgressChange({
      status: "idle",
      currentIteration: 0,
      totalIterations: 0,
      activeUsers: 0,
      elapsedTime: 0,
      metrics: [],
      summary: null,
    });
    setLiveMetrics({
      requestsPerSecond: 0,
      avgResponseTime: 0,
      errorRate: 0,
      activeThreads: 0,
    });
  };

  const progressPercent =
    progress.totalIterations > 0 ? (progress.currentIteration / progress.totalIterations) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Execution Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Test Execution
          </CardTitle>
          <CardDescription>Run your performance test and monitor real-time progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Control Buttons */}
          <div className="flex items-center gap-4">
            {!isRunning ? (
              <Button onClick={runLoadTest} disabled={!canStart || isStartingTest} className="gap-2" size="lg">
                {isStartingTest ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                {isStartingTest ? "Starting..." : "Start Test"}
              </Button>
            ) : (
              <Button onClick={stopTest} variant="destructive" className="gap-2" size="lg">
                <Square className="h-5 w-5" />
                Stop Test
              </Button>
            )}

            <Button variant="outline" onClick={resetTest} disabled={isRunning} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>

            <input type="file" accept=".jmx" id="jmx-upload-input" className="hidden" onChange={handleJmxFileChange} />

            <Button variant="outline" onClick={openAgentDialog} disabled={isRunning} className="gap-2">
              <Server className="h-4 w-4" />
              {selectedAgent ? selectedAgent.agent_name : "Select Performance Agent"}
            </Button>

            <Button
              variant="outline"
              onClick={() => document.getElementById("jmx-upload-input")?.click()}
              disabled={isRunning}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload JMX
            </Button>

            {uploadedJmx && (
              <Badge variant="secondary" className="text-xs px-2 py-1">
                {uploadedJmx.name}
              </Badge>
            )}

            <div className="flex-1" />

            <Badge
              variant={
                progress.status === "running"
                  ? "default"
                  : progress.status === "completed"
                    ? "outline"
                    : progress.status === "stopped"
                      ? "destructive"
                      : "secondary"
              }
              className="text-sm px-3 py-1"
            >
              {progress.status.toUpperCase()}
            </Badge>
          </div>

          {/* Validation Warnings */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!selectedAgent && validationErrors.length === 0 && (
            <Alert>
              <Server className="h-4 w-4" />
              <AlertDescription>Select a Performance Agent to start the test.</AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          {(isRunning || progress.status === "completed") && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Iteration {progress.currentIteration} of {progress.totalIterations}
                </span>
                <span>Elapsed: {progress.elapsedTime.toFixed(1)}s</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Queue moved to Self-Hosted Agents section */}

      {/* Live Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{liveMetrics.requestsPerSecond.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Requests/sec</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{liveMetrics.avgResponseTime.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Avg Response (ms)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{liveMetrics.errorRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Error Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isRunning ? config.virtualUsers : 0}</p>
                <p className="text-xs text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Request Log */}
      {progress.metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Log</CardTitle>
            <CardDescription>Real-time request execution details</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {progress.metrics
                  .slice(-50)
                  .reverse()
                  .map((metric, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg text-sm ${metric.success ? "bg-emerald-500/5" : "bg-red-500/5"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {metric.success ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{metric.requestName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={
                            metric.statusCode >= 200 && metric.statusCode < 300
                              ? "border-emerald-500/30"
                              : metric.statusCode >= 400
                                ? "border-red-500/30"
                                : ""
                          }
                        >
                          {metric.statusCode || "ERR"}
                        </Badge>
                        <span>{metric.responseTime.toFixed(0)}ms</span>
                        <span className="text-xs">{(metric.bytes / 1024).toFixed(1)}KB</span>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Performance Agent Selection Dialog */}
      <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Select Performance Agent
            </DialogTitle>
            <DialogDescription>Choose an agent to execute your performance test</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingAgents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading agents...</span>
              </div>
            ) : performanceAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No performance agents found</p>
                <p className="text-sm mt-1">Register a performance agent in the Agent Management section</p>
              </div>
            ) : (
              <RadioGroup value={tempSelectedAgentId} onValueChange={setTempSelectedAgentId} className="space-y-3">
                {performanceAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-xl border cursor-pointer transition-all",
                      tempSelectedAgentId === agent.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border hover:bg-muted/50",
                      agent.status === "offline" ? "opacity-60" : ""
                    )}
                    onClick={() => agent.status === "online" && setTempSelectedAgentId(agent.id)}
                  >
                    <RadioGroupItem value={agent.id} id={`perf-agent-${agent.id}`} disabled={agent.status === "offline"} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`perf-agent-${agent.id}`} className="font-bold text-sm cursor-pointer">
                          {agent.agent_name}
                        </Label>
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-4 font-bold border",
                          agent.status === "online" ? "bg-green-500/10 text-green-600 border-green-200" : "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {agent.status === "online" ? "ONLINE" : "OFFLINE"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-primary/60" />
                          Workload: {agent.running_jobs || 0} / {agent.capacity || 10}
                        </span>
                        {agent.last_heartbeat && (
                          <span className="flex items-center gap-1.5 ml-auto text-[9px] lowercase italic">
                            Last seen: {new Date(agent.last_heartbeat).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAgentSelect} disabled={!tempSelectedAgentId || performanceAgents.length === 0}>
              Select Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
