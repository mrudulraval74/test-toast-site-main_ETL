import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Instruction, InstructionAgent, InstructionAudit, STATUS_CONFIG, INTENT_TYPES, AGENT_TYPES } from "./types";

interface InstructionDetailProps {
  instruction: Instruction;
  onBack: () => void;
}

export const InstructionDetail = ({ instruction, onBack }: InstructionDetailProps) => {
  const [agents, setAgents] = useState<InstructionAgent[]>([]);
  const [audit, setAudit] = useState<InstructionAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [agentsRes, auditRes] = await Promise.all([
        supabase.from("qa_instruction_agents").select("*").eq("instruction_id", instruction.id).order("execution_order"),
        supabase.from("qa_instruction_audit").select("*").eq("instruction_id", instruction.id).order("created_at", { ascending: false }),
      ]);
      setAgents((agentsRes.data as any[]) || []);
      setAudit((auditRes.data as any[]) || []);
      setIsLoading(false);
    };
    load();
  }, [instruction.id]);

  const config = STATUS_CONFIG[instruction.status];
  const intentInfo = INTENT_TYPES[instruction.intent_type || ''] || INTENT_TYPES.CUSTOM;

  const agentStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'in_progress': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to History
      </Button>

      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Instruction Detail</CardTitle>
              <Badge className={config.color} variant="secondary">{config.label}</Badge>
              {instruction.intent_type && (
                <Badge className={intentInfo.color} variant="secondary">{intentInfo.label}</Badge>
              )}
            </div>
            {instruction.confidence && (
              <Badge variant="outline">{Math.round(instruction.confidence * 100)}% confidence</Badge>
            )}
          </div>
          <CardDescription>{new Date(instruction.created_at).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-sm font-medium">Instruction:</span>
            <p className="mt-1 text-sm bg-muted p-3 rounded-md">{instruction.instruction_text}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Risk Level</span>
              <Badge variant={instruction.risk_level === 'high' ? 'destructive' : 'secondary'} className="mt-1 block w-fit">
                {instruction.risk_level}
              </Badge>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Approval Required</span>
              <p className="text-sm font-medium mt-1">{instruction.approval_required ? "Yes" : "No"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Target Agents</span>
              <p className="text-sm font-medium mt-1">{instruction.target_agents?.length || 0}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge className={`${config.color} mt-1 block w-fit`} variant="secondary">{config.label}</Badge>
            </div>
          </div>

          {instruction.parsed_intent && (
            <div>
              <span className="text-sm font-medium">Parsed Intent (JSON):</span>
              <pre className="mt-1 text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-60">
                {JSON.stringify(instruction.parsed_intent, null, 2)}
              </pre>
            </div>
          )}

          {instruction.error_message && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {instruction.error_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Agent Execution Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => {
                const agentInfo = AGENT_TYPES.find(a => a.id === agent.agent_type);
                return (
                  <div key={agent.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-3">
                      {agentStatusIcon(agent.status)}
                      <div>
                        <span className="text-sm font-medium">{agentInfo?.label || agent.agent_type}</span>
                        <span className="text-xs text-muted-foreground ml-2">Order: {agent.execution_order}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{agent.status}</Badge>
                      {agent.started_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(agent.started_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20" />
          ) : audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <div className="space-y-2">
              {audit.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-2 text-sm border-l-2 border-muted pl-4">
                  <div className="flex-1">
                    <span className="font-medium">{entry.action.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    {Object.keys(entry.details || {}).length > 0 && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
