import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  Loader2,
  Users,
  Clock,
  Activity,
  Download,
  Copy,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExecutionSummary {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  totalBytes: number;
}

interface ExecutionHistoryResult {
  id: string;
  job_id: string;
  agent_id: string;
  status: string;
  created_at: string;
  jtl_base64?: string;
  summary: ExecutionSummary | null;
}

interface JobConfig {
  threads: number;
  rampup: number;
  duration: number;
}

interface MultiExecutionAnalysisDialogProps {
  executions: ExecutionHistoryResult[];
  projectId: string;
}

export const MultiExecutionAnalysisDialog = ({ executions, projectId }: MultiExecutionAnalysisDialogProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedExecutions, setSelectedExecutions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [jobConfigs, setJobConfigs] = useState<Record<string, JobConfig>>({});

  // Fetch job configs for selected executions
  const fetchJobConfigs = async (jobIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from("performance_jobs")
        .select("id, threads, rampup, duration")
        .in("id", jobIds);

      if (error) throw error;

      const configs: Record<string, JobConfig> = {};
      data?.forEach((job) => {
        configs[job.id] = {
          threads: job.threads,
          rampup: job.rampup,
          duration: job.duration,
        };
      });
      setJobConfigs(configs);
    } catch (error) {
      console.error("Error fetching job configs:", error);
    }
  };

  const handleSelectionChange = (executionId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedExecutions, executionId]
      : selectedExecutions.filter((id) => id !== executionId);

    setSelectedExecutions(newSelection);

    // Fetch job configs for selected executions
    const selectedExecs = executions.filter((e) => newSelection.includes(e.id));
    const jobIds = selectedExecs.map((e) => e.job_id).filter(Boolean);
    if (jobIds.length > 0) {
      fetchJobConfigs(jobIds);
    }
  };

  const handleSelectAll = () => {
    if (selectedExecutions.length === executions.filter((e) => e.summary).length) {
      setSelectedExecutions([]);
      setJobConfigs({});
    } else {
      const allIds = executions.filter((e) => e.summary).map((e) => e.id);
      setSelectedExecutions(allIds);
      const jobIds = executions.filter((e) => e.summary && e.job_id).map((e) => e.job_id);
      if (jobIds.length > 0) {
        fetchJobConfigs(jobIds);
      }
    }
  };

  const analyzeExecutions = async () => {
    if (selectedExecutions.length < 2) {
      toast({
        title: "Select at least 2 executions",
        description: "Please select two or more executions to compare and analyze",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisReport(null);

    try {
      // Get the auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Prepare execution data for analysis
      const selectedData = executions
        .filter((e) => selectedExecutions.includes(e.id))
        .map((e) => ({
          id: e.id,
          executedAt: e.created_at,
          status: e.status,
          jobConfig: jobConfigs[e.job_id] || null,
          summary: e.summary,
        }));

      // Call the edge function
      const response = await supabase.functions.invoke("analyze-performance-executions", {
        body: {
          projectId,
          executions: selectedData,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Analysis failed");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Analysis failed");
      }

      setAnalysisReport(response.data.report);

      toast({
        title: "Analysis Complete",
        description: "AI has generated a comprehensive performance report",
      });
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze executions",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyReport = () => {
    if (analysisReport) {
      navigator.clipboard.writeText(analysisReport);
      toast({
        title: "Report Copied",
        description: "The analysis report has been copied to clipboard",
      });
    }
  };

  const downloadReport = () => {
    if (analysisReport) {
      const blob = new Blob([analysisReport], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `performance-analysis-${new Date().toISOString().split("T")[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Report Downloaded",
        description: "The analysis report has been saved as markdown",
      });
    }
  };

  const completedExecutions = executions.filter((e) => e.summary);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={completedExecutions.length < 2}>
          <Brain className="h-4 w-4 mr-2" />
          AI Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Multi-Execution Performance Analysis
          </DialogTitle>
          <DialogDescription>
            Select multiple test executions to generate a consolidated AI-powered analysis report
          </DialogDescription>
        </DialogHeader>

        {!analysisReport ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedExecutions.length === completedExecutions.length ? "Deselect All" : "Select All"}
                </Button>
                <Badge variant="secondary">
                  {selectedExecutions.length} of {completedExecutions.length} selected
                </Badge>
              </div>
              <Button onClick={analyzeExecutions} disabled={selectedExecutions.length < 2 || isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze Selected ({selectedExecutions.length})
                  </>
                )}
              </Button>
            </div>

            {/* Execution List */}
            <ScrollArea className="flex-1 max-h-[400px] border rounded-lg overflow-auto">
              <div className="p-4 space-y-3">
                {completedExecutions.map((execution) => {
                  const config = jobConfigs[execution.job_id];
                  return (
                    <div
                      key={execution.id}
                      className={`p-4 border rounded-lg transition-all ${
                        selectedExecutions.includes(execution.id)
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedExecutions.includes(execution.id)}
                          onCheckedChange={(checked) => handleSelectionChange(execution.id, !!checked)}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={execution.status === "completed" ? "default" : "destructive"}>
                                {execution.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(execution.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {execution.summary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <span>{execution.summary.totalRequests} requests</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Avg: {execution.summary.avgResponseTime}ms</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{config?.threads || "?"} users</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {Number(execution.summary.errorRate) > 5 ? (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                                <span>{Number(execution.summary.errorRate || 0).toFixed(1)}% errors</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Analysis Info */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">What the AI Analysis Includes:</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Performance trends and degradation patterns</li>
                      <li>• Root cause analysis for failures and slowdowns</li>
                      <li>• Comparison of test configurations and their impact</li>
                      <li>• Mitigation recommendations and optimization suggestions</li>
                      <li>• Executive summary suitable for client reporting</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Report Actions */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setAnalysisReport(null)}>
                ← Back to Selection
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyReport}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={downloadReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            {/* Report Content */}
            <ScrollArea className="flex-1 max-h-[500px] border rounded-lg overflow-auto">
              <div className="p-6">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{analysisReport}</pre>
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
