import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Play, Loader2, AlertCircle, CheckCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lghzmijzfpvrcvogxpew.supabase.co";

interface PayloadBuilderProps {
  test: {
    id: string;
    name: string;
    steps: any[];
    engine_mode: string;
    application_name: string;
  };
  cloudFlowTriggerUrl: string;
  projectId: string;
  onRunTriggered: () => void;
}

export function PayloadBuilder({ test, cloudFlowTriggerUrl, projectId, onRunTriggered }: PayloadBuilderProps) {
  const { toast } = useToast();
  const [environment, setEnvironment] = useState("staging");
  const [browser, setBrowser] = useState("chrome");
  const [onFailure, setOnFailure] = useState("screenshot_and_continue");
  const [isRunning, setIsRunning] = useState(false);

  const steps = Array.isArray(test.steps) ? test.steps : [];

  const payload = useMemo(() => ({
    testCaseId: test.id,
    environment,
    browser,
    onFailure,
    steps: steps.map((step: any, index: number) => ({
      stepId: index + 1,
      action: step.action || "click",
      params: {
        value: step.value || "",
        selector: step.target?.parentWindow || step.target?.automationId || "",
        label: step.target?.label || "",
        control: step.target?.controlType || "",
      },
    })),
    reportTo: `${SUPABASE_URL}/functions/v1/desktop-agent-api`,
  }), [test.id, test.steps, environment, browser, onFailure]);

  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadJson);
    toast({ title: "Copied to clipboard" });
  };

  const handleRunWithPayload = async () => {
    if (!cloudFlowTriggerUrl.trim()) {
      toast({
        title: "No Cloud Flow URL",
        description: "Set the Cloud Flow HTTP Trigger URL above to enable remote execution.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(cloudFlowTriggerUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadJson,
      });
      const responseText = await response.text();
      let webhookResponse: any = responseText;
      try { webhookResponse = JSON.parse(responseText); } catch { /* keep as string */ }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("test_runs").insert({
          project_id: projectId,
          name: `Cloud Run: ${test.name}`,
          created_by: user.id,
          status: "running",
          run_type: "cloud_flow",
          payload_sent: payload as any,
          webhook_response: webhookResponse,
        } as any);
      }

      if (response.ok) {
        toast({
          title: "☁️ Flow triggered — watching for results...",
          description: `HTTP ${response.status}`,
        });
        onRunTriggered();
      } else {
        toast({
          title: "☁️ Cloud Flow Execution Failed",
          description: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Cloud Flow Trigger Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">Environment</Label>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="local">Local</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Browser</Label>
          <Select value={browser} onValueChange={setBrowser}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="chrome">Chrome</SelectItem>
              <SelectItem value="edge">Edge</SelectItem>
              <SelectItem value="firefox">Firefox</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">On Failure</Label>
          <Select value={onFailure} onValueChange={setOnFailure}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="screenshot_and_continue">Screenshot & Continue</SelectItem>
              <SelectItem value="stop">Stop</SelectItem>
              <SelectItem value="skip">Skip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copy JSON
        </Button>
        <Button size="sm" onClick={handleRunWithPayload} disabled={isRunning}>
          {isRunning ? (
            <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Executing...</>
          ) : (
            <><Play className="mr-1 h-3.5 w-3.5" /> Run with this payload</>
          )}
        </Button>
      </div>

      {/* URL warning */}
      {!cloudFlowTriggerUrl.trim() && (
        <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Set Cloud Flow URL above to enable remote execution
        </div>
      )}
      {cloudFlowTriggerUrl.trim() && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Payload will POST to the configured Cloud Flow trigger URL
        </div>
      )}

      {/* JSON Preview */}
      <Card className="bg-muted/30">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">JSON</Badge>
              <span className="text-xs text-muted-foreground">{steps.length} steps mapped</span>
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            <pre className="p-4 text-xs font-mono text-foreground whitespace-pre overflow-x-auto">
              {payloadJson}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
