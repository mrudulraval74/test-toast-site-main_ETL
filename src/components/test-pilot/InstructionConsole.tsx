import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Sparkles, Target, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AGENT_TYPES } from "./types";

interface InstructionConsoleProps {
  projectId: string;
  onInstructionCreated: () => void;
}

const DEFAULT_SUGGESTIONS = [
  "Generate only negative test cases for login",
  "Re-run failed tests on prod-like data",
  "Heal scripts but don't change assertions",
  "Run performance test with 2x last peak traffic",
  "Scan only auth-related APIs for security",
  "Generate boundary and negative test cases for payment APIs. Automate only high-priority ones. Skip UI tests.",
];

const getSuggestionsForInput = (input: string): string[] => {
  const lower = input.toLowerCase().trim();
  if (!lower) return DEFAULT_SUGGESTIONS;

  const suggestionMap: { keywords: string[]; suggestions: string[] }[] = [
    {
      keywords: ["login", "auth", "sign in", "signin", "sso"],
      suggestions: [
        "Generate negative test cases for login flow",
        "Run security scan on authentication endpoints",
        "Automate regression tests for login module",
        "Generate boundary value tests for login fields",
        "Heal broken selectors in login automation",
        "Generate load test for login with 500 concurrent users",
      ],
    },
    {
      keywords: ["api", "endpoint", "rest", "swagger"],
      suggestions: [
        "Generate positive and negative API test cases",
        "Run performance test on APIs with 2x peak traffic",
        "Scan API endpoints for security vulnerabilities",
        "Generate boundary and edge case tests for APIs",
        "Automate contract tests for REST endpoints",
        "Generate data-driven API tests with multiple payloads",
      ],
    },
    {
      keywords: ["performance", "load", "stress", "traffic"],
      suggestions: [
        "Run performance test with 2x last peak traffic",
        "Run load test with gradual ramp-up over 10 minutes",
        "Run spike test to find breaking point",
        "Generate endurance test over 1 hour",
        "Compare performance results with last baseline",
        "Run performance test on staging environment only",
      ],
    },
    {
      keywords: ["report", "summary", "execution", "result"],
      suggestions: [
        "Generate execution report for all failed test cases",
        "Generate test summary grouped by module",
        "Generate report with defect correlation",
        "Generate execution summary for last 7 days",
        "Generate report with trend analysis",
        "Export execution report as PDF for stakeholders",
      ],
    },
    {
      keywords: ["security", "scan", "vulnerability", "owasp", "burp", "zap"],
      suggestions: [
        "Run security scan on all authenticated endpoints",
        "Scan for injection vulnerabilities",
        "Run OWASP Top 10 coverage scan",
        "Scan file upload endpoints for vulnerabilities",
        "Run passive security scan first",
        "Run security scan and generate remediation report",
      ],
    },
    {
      keywords: ["heal", "fix", "broken", "flaky", "failing"],
      suggestions: [
        "Heal broken tests and re-run to verify fixes",
        "Fix flaky tests but preserve all assertions",
        "Heal tests for selector changes only",
        "Fix broken tests and update test data references",
        "Auto-heal all flaky tests in the suite",
        "Heal failing tests and notify on completion",
      ],
    },
    {
      keywords: ["automate", "automation", "script", "selenium", "playwright"],
      suggestions: [
        "Automate high-priority test cases only",
        "Create automation scripts with data-driven approach",
        "Automate and register for scheduled execution",
        "Automate smoke test suite",
        "Create automation with retry logic for flaky steps",
        "Automate tests and push scripts to git repository",
      ],
    },
    {
      keywords: ["test case", "test cases", "generate", "create"],
      suggestions: [
        "Generate test cases with negative scenarios",
        "Generate edge case and boundary value tests",
        "Generate test cases for regression suite",
        "Generate and auto-prioritize test cases by risk",
        "Generate test cases mapped to user stories",
        "Generate test cases including accessibility checks",
      ],
    },
  ];

  for (const group of suggestionMap) {
    if (group.keywords.some((kw) => lower.includes(kw))) {
      return group.suggestions;
    }
  }

  // Generic contextual suggestions
  return [
    "Generate test cases for this module",
    "Automate the described scenarios",
    "Run security scan on related endpoints",
    "Generate performance test for this flow",
    "Create a regression suite",
    "Generate execution report summary",
  ];
};

export const InstructionConsole = ({ projectId, onInstructionCreated }: InstructionConsoleProps) => {
  const { toast } = useToast();
  const [instructionText, setInstructionText] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState<string>("low");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [environment, setEnvironment] = useState<string>("qa");
  const [priority, setPriority] = useState<string>("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any>(null);

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev =>
      prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]
    );
  };

  const handleParse = async () => {
    if (!instructionText.trim()) return;
    setIsParsing(true);
    setParsedPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("instruction-parser", {
        body: { instruction_text: instructionText, project_id: projectId },
      });
      if (error) throw error;
      setParsedPreview(data);
      // Auto-fill from parsed result
      if (data?.target_agents?.length) setSelectedAgents(data.target_agents);
      if (data?.risk_level) setRiskLevel(data.risk_level);
      if (data?.approval_required !== undefined) setApprovalRequired(data.approval_required);
    } catch (err: any) {
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (!instructionText.trim()) {
      toast({ title: "Please enter an instruction", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const constraints = {
        environment,
        priority,
        ...(parsedPreview?.constraints || {}),
      };

      const { data, error } = await supabase.from("qa_instructions").insert({
        project_id: projectId,
        instruction_text: instructionText,
        parsed_intent: parsedPreview || null,
        intent_type: parsedPreview?.intent || null,
        target_agents: selectedAgents.length > 0 ? selectedAgents : (parsedPreview?.target_agents || []),
        scope: parsedPreview?.scope || {},
        constraints,
        risk_level: riskLevel as any,
        confidence: parsedPreview?.confidence || null,
        approval_required: approvalRequired,
        status: approvalRequired ? "pending_approval" : "validated",
        created_by: user.id,
      }).select().single();

      if (error) throw error;

      // Create agent mappings
      const agents = selectedAgents.length > 0 ? selectedAgents : (parsedPreview?.target_agents || []);
      if (agents.length > 0 && data) {
        const agentRows = agents.map((agentType: string, idx: number) => ({
          instruction_id: data.id,
          agent_type: agentType,
          execution_order: idx,
        }));
        await supabase.from("qa_instruction_agents").insert(agentRows);
      }

      // Create audit log
      if (data) {
        await supabase.from("qa_instruction_audit").insert({
          instruction_id: data.id,
          action: "instruction_created",
          actor_id: user.id,
          details: { instruction_text: instructionText, agents, constraints },
        });
      }

      toast({ title: "Instruction submitted", description: `Status: ${approvalRequired ? "Pending Approval" : "Validated"}` });
      setInstructionText("");
      setSelectedAgents([]);
      setParsedPreview(null);
      onInstructionCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instruction Input */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Instruction Console</CardTitle>
          </div>
          <CardDescription>
            Describe what you want the AI agents to do in natural language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              placeholder="e.g., Generate only negative test cases for login API endpoints..."
              className="min-h-[120px] text-base"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {getSuggestionsForInput(instructionText).map((example, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors text-xs"
                  onClick={() => setInstructionText(example)}
                >
                  {example.length > 50 ? example.slice(0, 50) + "…" : example}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleParse} disabled={!instructionText.trim() || isParsing}>
              {isParsing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Parse Intent
            </Button>
          </div>

          {parsedPreview && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Parsed Intent</span>
                  {parsedPreview.confidence && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(parsedPreview.confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{parsedPreview.summary}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{parsedPreview.intent}</Badge>
                  {parsedPreview.target_agents?.map((a: string) => (
                    <Badge key={a} variant="outline">{a}</Badge>
                  ))}
                  <Badge variant={parsedPreview.risk_level === 'high' ? 'destructive' : 'secondary'}>
                    Risk: {parsedPreview.risk_level}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Agent Selection & Constraints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target Agents</CardTitle>
            <CardDescription>Select which agents should execute this instruction (or let AI decide)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {AGENT_TYPES.map((agent) => (
              <div key={agent.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={selectedAgents.includes(agent.id)}
                  onCheckedChange={() => toggleAgent(agent.id)}
                />
                <div>
                  <div className="font-medium text-sm">{agent.label}</div>
                  <div className="text-xs text-muted-foreground">{agent.description}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Constraints
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="qa">QA</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risk Level</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (read-only, reporting)</SelectItem>
                  <SelectItem value="medium">Medium (generation)</SelectItem>
                  <SelectItem value="high">High (execution on prod-like)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                checked={approvalRequired}
                onCheckedChange={(v) => setApprovalRequired(!!v)}
              />
              <Label className="cursor-pointer">Require approval before execution</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={isSubmitting || !instructionText.trim()}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Submit Instruction
        </Button>
      </div>
    </div>
  );
};
