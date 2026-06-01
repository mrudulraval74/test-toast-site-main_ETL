import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Activity, Camera } from "lucide-react";

interface LiveExecutionLogProps {
  projectId: string;
  testId?: string;
}

interface RunEntry {
  id: string;
  name: string;
  status: string;
  step_results: any[] | null;
  payload_sent: any;
  created_at: string;
}

interface LogLine {
  time: string;
  icon: string;
  text: string;
  type: "info" | "pass" | "fail" | "screenshot";
}

export function LiveExecutionLog({ projectId, testId }: LiveExecutionLogProps) {
  const [activeRuns, setActiveRuns] = useState<RunEntry[]>([]);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch running test_runs
  useEffect(() => {
    const fetchRuns = async () => {
      const query = supabase
        .from("test_runs")
        .select("id, name, status, step_results, payload_sent, created_at")
        .eq("project_id", projectId)
        .in("status", ["running", "passed", "failed"])
        .order("created_at", { ascending: false })
        .limit(5);

      const { data } = await query;
      setActiveRuns((data as any) || []);
    };
    fetchRuns();
  }, [projectId, testId]);

  // Subscribe to realtime changes on test_runs
  useEffect(() => {
    const channel = supabase
      .channel("live-execution-log")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "test_runs",
          filter: `project_id=eq.${projectId}`,
        },
        (payload: any) => {
          const row = payload.new as RunEntry;
          if (!row) return;

          setActiveRuns((prev) => {
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = row;
              return updated;
            }
            return [row, ...prev].slice(0, 5);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Build log lines from active runs
  useEffect(() => {
    const lines: LogLine[] = [];
    for (const run of activeRuns) {
      const time = new Date(run.created_at).toLocaleTimeString("en-US", { hour12: false });
      lines.push({
        time,
        icon: "▶",
        text: `${run.name || "Test Run"} started`,
        type: "info",
      });

      if (run.step_results && Array.isArray(run.step_results)) {
        for (const step of run.step_results) {
          const stepTime = step.timestamp
            ? new Date(step.timestamp).toLocaleTimeString("en-US", { hour12: false })
            : time;
          if (step.status === "passed") {
            lines.push({
              time: stepTime,
              icon: "✅",
              text: `Step ${step.stepId} – ${step.action || "action"}: PASSED${step.duration ? ` (${step.duration}s)` : ""}`,
              type: "pass",
            });
          } else if (step.status === "failed") {
            lines.push({
              time: stepTime,
              icon: "❌",
              text: `Step ${step.stepId} – ${step.action || "action"}: FAILED${step.error ? `\n             ${step.error}` : ""}`,
              type: "fail",
            });
          }
          if (step.screenshot) {
            lines.push({
              time: stepTime,
              icon: "📸",
              text: `Screenshot: ${step.screenshot}`,
              type: "screenshot",
            });
          }
        }
      }

      if (run.status === "passed" || run.status === "failed") {
        lines.push({
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
          icon: run.status === "passed" ? "🎉" : "💥",
          text: `Run ${run.status.toUpperCase()}`,
          type: run.status === "passed" ? "pass" : "fail",
        });
      }
    }
    setLogLines(lines);
  }, [activeRuns]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logLines]);

  const runningRuns = activeRuns.filter((r) => r.status === "running");
  if (activeRuns.length === 0) return null;

  // Progress calculation
  const currentRun = activeRuns[0];
  const totalSteps = currentRun?.payload_sent?.steps?.length || 0;
  const completedSteps = currentRun?.step_results?.length || 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <Card className="mb-4 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            Live Execution Log
            {runningRuns.length > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs">
                {runningRuns.length} running
              </Badge>
            )}
          </CardTitle>
        </div>
        {totalSteps > 0 && currentRun?.status === "running" && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Steps completed: {completedSteps} / {totalSteps}</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {/* Final summary banner */}
        {currentRun && (currentRun.status === "passed" || currentRun.status === "failed") && (
          <div
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
              currentRun.status === "passed"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {currentRun.status === "passed" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Execution {currentRun.status.toUpperCase()} — {completedSteps} step(s) completed
          </div>
        )}

        {/* Log output */}
        <div
          ref={scrollRef}
          className="bg-zinc-950 text-zinc-200 font-mono text-xs p-4 rounded-b-lg overflow-auto max-h-[300px]"
        >
          {logLines.length === 0 ? (
            <div className="text-zinc-500 text-center py-4">Waiting for execution data...</div>
          ) : (
            logLines.map((line, i) => (
              <div
                key={i}
                className={`py-0.5 whitespace-pre-wrap ${
                  line.type === "pass"
                    ? "text-green-400"
                    : line.type === "fail"
                    ? "text-red-400"
                    : line.type === "screenshot"
                    ? "text-yellow-400"
                    : "text-zinc-400"
                }`}
              >
                <span className="text-zinc-600">[{line.time}]</span> {line.icon} {line.text}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
