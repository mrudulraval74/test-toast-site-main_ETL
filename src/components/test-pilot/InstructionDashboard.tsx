import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, CheckCircle2, Clock, XCircle, Zap, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InstructionDashboardProps {
  projectId: string;
  refreshKey: number;
}

export const InstructionDashboard = ({ projectId, refreshKey }: InstructionDashboardProps) => {
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    failed: 0,
    pending_approval: 0,
    avgConfidence: 0,
  });
  const [recentIntents, setRecentIntents] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("qa_instructions")
          .select("status, confidence, intent_type")
          .eq("project_id", projectId);

        if (error) throw error;

        const all = data || [];
        const completed = all.filter(i => i.status === 'completed').length;
        const in_progress = all.filter(i => i.status === 'in_progress').length;
        const failed = all.filter(i => i.status === 'failed').length;
        const pending = all.filter(i => i.status === 'pending_approval').length;
        const confidences = all.filter(i => i.confidence).map(i => Number(i.confidence));
        const avgConf = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

        setStats({
          total: all.length,
          completed,
          in_progress,
          failed,
          pending_approval: pending,
          avgConfidence: avgConf,
        });

        const intents: Record<string, number> = {};
        all.forEach(i => {
          const type = i.intent_type || 'CUSTOM';
          intents[type] = (intents[type] || 0) + 1;
        });
        setRecentIntents(intents);
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [projectId, refreshKey]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const metricCards = [
    { label: "Total Instructions", value: stats.total, icon: <Zap className="h-5 w-5 text-primary" />, color: "text-foreground" },
    { label: "Completed", value: stats.completed, icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, color: "text-green-600" },
    { label: "In Progress", value: stats.in_progress, icon: <Clock className="h-5 w-5 text-blue-500" />, color: "text-blue-600" },
    { label: "Failed", value: stats.failed, icon: <XCircle className="h-5 w-5 text-destructive" />, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, idx) => (
          <Card key={idx}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {m.icon}
                <span className={`text-2xl font-bold ${m.color}`}>{m.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Avg Confidence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Average Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {stats.avgConfidence > 0 ? `${Math.round(stats.avgConfidence * 100)}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {stats.total} instruction(s)
            </p>
            {stats.pending_approval > 0 && (
              <p className="text-sm text-yellow-600 mt-3">
                {stats.pending_approval} instruction(s) awaiting approval
              </p>
            )}
          </CardContent>
        </Card>

        {/* Intent Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Intent Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(recentIntents).length === 0 ? (
              <p className="text-sm text-muted-foreground">No instructions yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(recentIntents)
                  .sort(([, a], [, b]) => b - a)
                  .map(([intent, count]) => (
                    <div key={intent} className="flex items-center justify-between">
                      <span className="text-sm">{intent.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 bg-primary/20 rounded-full w-24">
                          <div
                            className="h-2 bg-primary rounded-full"
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
