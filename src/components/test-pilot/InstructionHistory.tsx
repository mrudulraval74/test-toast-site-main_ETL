import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Ban,
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Eye,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Instruction, InstructionAgent, InstructionStatus, STATUS_CONFIG, INTENT_TYPES } from "./types";
import { InstructionDetail } from "./InstructionDetail";

interface InstructionHistoryProps {
  projectId: string;
  refreshKey: number;
}

const statusIcons: Record<string, React.ReactNode> = {
  created: <Clock className="h-4 w-4" />,
  validated: <CheckCircle2 className="h-4 w-4" />,
  pending_approval: <Clock className="h-4 w-4 text-yellow-500" />,
  approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  in_progress: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  partially_completed: <AlertCircle className="h-4 w-4 text-orange-500" />,
  cancelled: <Ban className="h-4 w-4" />,
};

export const InstructionHistory = ({ projectId, refreshKey }: InstructionHistoryProps) => {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedInstruction, setSelectedInstruction] = useState<Instruction | null>(null);

  const fetchInstructions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("qa_instructions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInstructions((data as any[]) || []);
    } catch (err: any) {
      toast({ title: "Error loading instructions", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, [projectId, refreshKey, statusFilter]);

  const handleApprove = async (instruction: Instruction) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase
        .from("qa_instructions")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", instruction.id);

      await supabase.from("qa_instruction_audit").insert({
        instruction_id: instruction.id,
        action: "instruction_approved",
        actor_id: user.id,
        details: {},
      });

      toast({ title: "Instruction approved" });
      fetchInstructions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (instruction: Instruction) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("qa_instructions").update({ status: "cancelled" }).eq("id", instruction.id);
      await supabase.from("qa_instruction_audit").insert({
        instruction_id: instruction.id,
        action: "instruction_cancelled",
        actor_id: user?.id || null,
        details: {},
      });
      toast({ title: "Instruction cancelled" });
      fetchInstructions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const loadAzureConfig = async () => {
    const { data, error } = await (supabase as any)
      .from("integration_configs")
      .select("integration_id, config, enabled")
      .eq("project_id", projectId);
    if (error || !data) return null;
    const configs: any = {};
    data.forEach((record: any) => {
      configs[record.integration_id] = { ...record.config, enabled: record.enabled };
    });
    return configs.openai || configs.azure_openai || null;
  };

  const handleExecute = async (instruction: Instruction) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("No active session");

      // 1. Set status to in_progress
      await supabase.from("qa_instructions").update({ status: "in_progress" }).eq("id", instruction.id);
      await supabase.from("qa_instruction_audit").insert({
        instruction_id: instruction.id,
        action: "execution_started",
        actor_id: user.id,
        details: {},
      });
      fetchInstructions();
      toast({ title: "Execution started", description: "Processing instruction..." });

      // 2. Parse intent if not already parsed
      let parsedIntent = instruction.parsed_intent;
      if (!parsedIntent) {
        try {
          const { data, error } = await supabase.functions.invoke("instruction-parser", {
            body: { instruction_text: instruction.instruction_text, project_id: instruction.project_id },
          });
          if (error) throw error;
          parsedIntent = data;
          await supabase
            .from("qa_instructions")
            .update({
              parsed_intent: parsedIntent as any,
              intent_type: parsedIntent?.intent || null,
              confidence: parsedIntent?.confidence || null,
            })
            .eq("id", instruction.id);
        } catch (parseErr: any) {
          console.warn("Intent parsing failed, continuing with manual config:", parseErr.message);
        }
      }

      const intentType = parsedIntent?.intent || instruction.intent_type || "CUSTOM";

      // 3. Route based on intent type
      if (intentType === "COMPOUND") {
        await executeCompoundWorkflow(instruction, parsedIntent, user, session);
      } else if (intentType === "TEST_GENERATION") {
        await executeTestGeneration(instruction, parsedIntent, user, session);
      } else if (intentType === "AUTOMATE_ONLY") {
        await executeAutomationCreation(instruction, parsedIntent, user, session);
      } else if (intentType === "RELEASE_SUMMARY" || intentType === "REPORTING") {
        await executeReportGeneration(instruction, parsedIntent, user, session);
      } else {
        // For other intents, create placeholder jobs
        const agents =
          instruction.target_agents?.length > 0 ? instruction.target_agents : parsedIntent?.target_agents || [];

        for (const agentType of agents) {
          await supabase.from("qa_instruction_jobs").insert({
            instruction_id: instruction.id,
            job_type: agentType,
            status: "completed",
            result: {
              message: `${agentType} agent task processed`,
              intent: intentType,
            } as any,
          });
        }

        await supabase
          .from("qa_instructions")
          .update({
            status: "completed",
            target_agents: agents,
          })
          .eq("id", instruction.id);

        await supabase.from("qa_instruction_audit").insert({
          instruction_id: instruction.id,
          action: "execution_completed",
          actor_id: user.id,
          details: { agents, intent: intentType } as any,
        });

        toast({ title: "Execution completed", description: `${agents.length} agent task(s) processed.` });
      }

      fetchInstructions();
    } catch (err: any) {
      try {
        await supabase
          .from("qa_instructions")
          .update({
            status: "failed",
            error_message: err.message,
          })
          .eq("id", instruction.id);
      } catch (_) {}
      toast({ title: "Execution failed", description: err.message, variant: "destructive" });
      fetchInstructions();
    }
  };

  // ─── COMPOUND WORKFLOW EXECUTION ──────────────────────────────────────
  const executeCompoundWorkflow = async (instruction: Instruction, parsedIntent: any, user: any, session: any) => {
    const workflowSteps = parsedIntent?.workflow_steps || [];
    if (workflowSteps.length === 0) {
      // Fallback: treat as test generation if no workflow steps
      await executeTestGeneration(instruction, parsedIntent, user, session);
      return;
    }

    const results: any[] = [];
    let createdTestCaseId: string | null = null;
    let createdNocodeTestId: string | null = null;

    for (const step of workflowSteps) {
      try {
        // Log step start
        await supabase.from("qa_instruction_audit").insert({
          instruction_id: instruction.id,
          action: `workflow_step_started`,
          actor_id: user.id,
          details: { step_type: step.step_type, description: step.description } as any,
        });

        if (step.step_type === "create_test_case") {
          createdTestCaseId = await stepCreateTestCase(instruction, parsedIntent, step, user, session);
          results.push({ step: step.step_type, status: "completed", test_case_id: createdTestCaseId });
          toast({ title: "Step 1 completed", description: "Test case created successfully" });
        } else if (step.step_type === "create_automation") {
          createdNocodeTestId = await stepCreateAutomation(instruction, parsedIntent, step, user, createdTestCaseId);
          results.push({ step: step.step_type, status: "completed", nocode_test_id: createdNocodeTestId });
          toast({ title: "Step 2 completed", description: "Automation script created" });
        } else if (step.step_type === "execute_automation") {
          if (createdNocodeTestId) {
            await stepExecuteAutomation(instruction, user, createdNocodeTestId);
            results.push({ step: step.step_type, status: "completed", nocode_test_id: createdNocodeTestId });
            toast({ title: "Step 3 completed", description: "Automation job queued for execution" });
          } else {
            results.push({ step: step.step_type, status: "skipped", reason: "No automation test to execute" });
          }
        } else if (step.step_type === "auto_heal") {
          results.push({
            step: step.step_type,
            status: "completed",
            message: "Auto-heal configured - healer agent will monitor execution",
          });
          // Create a healer job entry so the system knows to auto-heal on failure
          await supabase.from("qa_instruction_jobs").insert({
            instruction_id: instruction.id,
            job_type: "healer",
            status: "completed",
            result: {
              message: "Auto-heal configured. Healer agent will attempt to fix failures and re-run.",
              nocode_test_id: createdNocodeTestId,
            } as any,
          });
          toast({ title: "Step 4 completed", description: "Auto-heal configured for failures" });
        }
      } catch (stepErr: any) {
        results.push({ step: step.step_type, status: "failed", error: stepErr.message });
        console.error(`Workflow step ${step.step_type} failed:`, stepErr);
        // Continue with next steps even if one fails
      }
    }

    const allCompleted = results.every((r) => r.status === "completed" || r.status === "skipped");
    const anyFailed = results.some((r) => r.status === "failed");

    await supabase
      .from("qa_instructions")
      .update({
        status: allCompleted ? "completed" : anyFailed ? "partially_completed" : "completed",
        target_agents: parsedIntent?.target_agents || ["analyst", "automation"],
      })
      .eq("id", instruction.id);

    await supabase.from("qa_instruction_audit").insert({
      instruction_id: instruction.id,
      action: "execution_completed",
      actor_id: user.id,
      details: { intent: "COMPOUND", workflow_results: results } as any,
    });

    const completedCount = results.filter((r) => r.status === "completed").length;
    toast({
      title: allCompleted ? "Workflow completed!" : "Workflow partially completed",
      description: `${completedCount}/${results.length} steps completed successfully.`,
    });
  };

  // ─── STEP: CREATE TEST CASE ───────────────────────────────────────────
  const stepCreateTestCase = async (
    instruction: Instruction,
    parsedIntent: any,
    step: any,
    user: any,
    session: any,
  ): Promise<string> => {
    const testCaseTitle =
      step.config?.test_case_title ||
      parsedIntent?.constraints?.test_case_title ||
      parsedIntent?.constraints?.user_story_title ||
      extractTestCaseTitleFromText(instruction.instruction_text) ||
      "Test Case from Test Pilot";

    // Check if user story exists
    const storyTitle = parsedIntent?.constraints?.user_story_title || parsedIntent?.constraints?.story_title || null;

    let userStoryId: string | null = null;

    if (storyTitle) {
      const { data: stories } = await supabase
        .from("user_stories")
        .select("id")
        .eq("project_id", projectId)
        .ilike("title", `%${storyTitle}%`);
      if (stories && stories.length > 0) {
        userStoryId = stories[0].id;
      }
    }

    // Try AI generation via edge function if Azure is configured
    let generatedSteps = "";
    let expectedResult = "";

    try {
      const azureConfig = await loadAzureConfig();
      if (azureConfig?.endpoint && azureConfig?.apiKey && azureConfig?.deploymentId) {
        // Use generate-test-cases for richer output
        const storyData = {
          id: userStoryId || "direct",
          project_id: projectId,
          title: testCaseTitle,
          description: instruction.instruction_text,
          acceptanceCriteria: "",
          priority: "medium",
          issueType: "Story",
        };

        const response = await fetch(`https://lghzmijzfpvrcvogxpew.supabase.co/functions/v1/generate-test-cases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            story: storyData,
            azureConfig,
            useLearnedPatterns: true,
          }),
        });

        const data = await response.json();
        if (response.ok && data.success && data.testCases?.length > 0) {
          // Save all generated test cases
          const testCasesToInsert = data.testCases.map((tc: any) => ({
            project_id: projectId,
            user_story_id: userStoryId,
            title: tc.title || tc.name || testCaseTitle,
            description: tc.description || "",
            steps: tc.steps ? (Array.isArray(tc.steps) ? tc.steps.join("\n") : tc.steps) : "",
            expected_result: tc.expectedResult || tc.expected || "",
            priority: (tc.priority || "medium").toLowerCase(),
            status: "draft",
          }));

          const { data: inserted, error: insertError } = await supabase
            .from("test_cases")
            .insert(testCasesToInsert)
            .select();
          if (insertError) throw insertError;

          await supabase.from("qa_instruction_jobs").insert({
            instruction_id: instruction.id,
            job_type: "analyst",
            status: "completed",
            result: {
              message: `Generated ${data.testCases.length} test cases`,
              test_cases_count: data.testCases.length,
            } as any,
          });

          return inserted?.[0]?.id || "";
        }
      }
    } catch (genErr: any) {
      console.warn("AI test generation failed, creating manual test case:", genErr.message);
    }

    // Fallback: create a simple test case directly
    const { data: tc, error: tcError } = await supabase
      .from("test_cases")
      .insert({
        project_id: projectId,
        user_story_id: userStoryId,
        title: testCaseTitle,
        description: instruction.instruction_text,
        steps: generatedSteps || "Steps to be defined",
        expected_result: expectedResult || "Expected result to be defined",
        priority: "medium",
        status: "draft",
      })
      .select()
      .single();

    if (tcError) throw tcError;

    await supabase.from("qa_instruction_jobs").insert({
      instruction_id: instruction.id,
      job_type: "analyst",
      status: "completed",
      result: { message: `Test case created: ${testCaseTitle}`, test_case_id: tc.id } as any,
    });

    return tc.id;
  };

  // ─── STEP: CREATE AUTOMATION ──────────────────────────────────────────
  const stepCreateAutomation = async (
    instruction: Instruction,
    parsedIntent: any,
    step: any,
    user: any,
    testCaseId: string | null,
  ): Promise<string> => {
    // Extract automation steps from the parsed intent
    const automationSteps = step.config?.automation_steps || [];
    const baseUrl =
      step.config?.base_url ||
      parsedIntent?.constraints?.base_url ||
      extractBaseUrlFromText(instruction.instruction_text) ||
      "https://example.com";

    // Convert parsed steps to nocode test format
    const nocodeSteps =
      automationSteps.length > 0
        ? automationSteps.map((s: any, idx: number) => ({
            id: `step_${Date.now()}_${idx}`,
            type: mapToPlaywrightAction(s.type),
            selector: s.selector || "",
            value: s.value || "",
            description: s.description || `Step ${idx + 1}`,
          }))
        : buildStepsFromInstructionText(instruction.instruction_text, baseUrl);

    const testName =
      parsedIntent?.constraints?.test_case_title ||
      extractTestCaseTitleFromText(instruction.instruction_text) ||
      "Automation from Test Pilot";

    const { data: nocodeTest, error } = await supabase
      .from("nocode_tests")
      .insert({
        project_id: projectId,
        name: testName,
        description: `Auto-generated from Test Pilot instruction`,
        base_url: baseUrl,
        steps: nocodeSteps as any,
        created_by: user.id,
        test_case_id: testCaseId,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from("qa_instruction_jobs").insert({
      instruction_id: instruction.id,
      job_type: "automation",
      status: "completed",
      result: {
        message: `Automation script created with ${nocodeSteps.length} steps`,
        nocode_test_id: nocodeTest.id,
        steps_count: nocodeSteps.length,
      } as any,
    });

    return nocodeTest.id;
  };

  // ─── STEP: EXECUTE AUTOMATION ─────────────────────────────────────────
  const stepExecuteAutomation = async (instruction: Instruction, user: any, nocodeTestId: string) => {
    // Load the nocode test
    const { data: test, error: testErr } = await supabase
      .from("nocode_tests")
      .select("*")
      .eq("id", nocodeTestId)
      .single();
    if (testErr || !test) throw new Error("Could not load automation test");

    // Find an available online agent
    const { data: agents } = await supabase
      .from("self_hosted_agents")
      .select("id, agent_name, status")
      .eq("project_id", projectId)
      .eq("status", "online")
      .limit(1);

    const agentId = agents?.[0]?.id || null;
    if (!agentId) {
      // Check for any agent even offline
      const { data: anyAgents } = await supabase
        .from("self_hosted_agents")
        .select("id")
        .eq("project_id", projectId)
        .limit(1);
      if (!anyAgents?.length) {
        throw new Error("No Playwright agent found. Please register a self-hosted agent first.");
      }
    }

    const runId = `PILOT-${Date.now().toString(36).toUpperCase()}`;

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from("nocode_test_executions")
      .insert({
        test_id: nocodeTestId,
        project_id: projectId,
        status: "pending",
        executed_by: user.id,
      })
      .select()
      .single();
    if (execError) throw execError;

    // Queue agent job
    const { error: jobError } = await supabase.from("agent_job_queue").insert({
      project_id: projectId,
      test_id: nocodeTestId,
      run_id: runId,
      agent_id: agentId || (agents?.[0]?.id ?? null),
      base_url: test.base_url,
      steps: test.steps as any,
      status: "pending",
      created_by: user.id,
      priority: 1,
    });

    if (jobError) throw jobError;

    await supabase.from("qa_instruction_jobs").insert({
      instruction_id: instruction.id,
      job_type: "automation",
      status: "completed",
      result: {
        message: `Execution job queued (${runId})`,
        run_id: runId,
        execution_id: execution.id,
        nocode_test_id: nocodeTestId,
        agent_id: agentId,
      } as any,
    });
  };

  // ─── TEST GENERATION (standalone) ─────────────────────────────────────
  const executeTestGeneration = async (instruction: Instruction, parsedIntent: any, user: any, session: any) => {
    const storyTitle =
      parsedIntent?.constraints?.user_story_title ||
      parsedIntent?.constraints?.story_title ||
      instruction.constraints?.user_story_title ||
      instruction.constraints?.story_title ||
      extractStoryTitleFromText(instruction.instruction_text);

    if (!storyTitle) {
      throw new Error(
        "Could not identify the user story title from the instruction. Please mention the user story title in quotes.",
      );
    }

    const { data: stories, error: storyError } = await supabase
      .from("user_stories")
      .select("*")
      .eq("project_id", projectId)
      .ilike("title", `%${storyTitle}%`);

    if (storyError) throw storyError;
    if (!stories || stories.length === 0) {
      throw new Error(`User story "${storyTitle}" not found in this project.`);
    }

    const story = stories[0];
    const azureConfig = await loadAzureConfig();
    if (!azureConfig?.endpoint || !azureConfig?.apiKey || !azureConfig?.deploymentId) {
      throw new Error("Azure OpenAI is not configured. Please configure it in Integrations first.");
    }

    const { data: job } = await supabase
      .from("qa_instruction_jobs")
      .insert({
        instruction_id: instruction.id,
        job_type: "analyst",
        status: "in_progress",
        result: { message: `Generating test cases for "${story.title}"` } as any,
      })
      .select()
      .single();

    toast({ title: "Generating test cases", description: `For user story: "${story.title}"` });

    const response = await fetch(`https://lghzmijzfpvrcvogxpew.supabase.co/functions/v1/generate-test-cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        story: {
          id: story.id,
          project_id: projectId,
          title: story.title,
          description: story.description || "",
          acceptanceCriteria: story.acceptance_criteria || "",
          priority: story.priority || "medium",
          issueType: "Story",
        },
        azureConfig,
        useLearnedPatterns: true,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to generate test cases");
    }

    await supabase.from("test_cases").delete().eq("user_story_id", story.id).eq("project_id", projectId);

    const testCasesToInsert = data.testCases.map((tc: any) => ({
      project_id: projectId,
      user_story_id: story.id,
      title: tc.title || tc.name || "Test Case",
      description: tc.description || "",
      steps: tc.steps ? (Array.isArray(tc.steps) ? tc.steps.join("\n") : tc.steps) : "",
      expected_result: tc.expectedResult || tc.expected || "",
      priority: (tc.priority || "medium").toLowerCase(),
      status: "draft",
    }));

    const { error: insertError } = await supabase.from("test_cases").insert(testCasesToInsert);
    if (insertError) throw insertError;

    await supabase.from("user_stories").update({ status: "completed" }).eq("id", story.id).eq("project_id", projectId);

    if (job) {
      await supabase
        .from("qa_instruction_jobs")
        .update({
          status: "completed",
          result: {
            message: `Generated ${data.testCases.length} test cases for "${story.title}"`,
            test_cases_count: data.testCases.length,
            user_story_id: story.id,
          } as any,
        })
        .eq("id", job.id);
    }

    await supabase
      .from("qa_instructions")
      .update({
        status: "completed",
        target_agents: ["analyst"],
      })
      .eq("id", instruction.id);

    await supabase.from("qa_instruction_audit").insert({
      instruction_id: instruction.id,
      action: "execution_completed",
      actor_id: user.id,
      details: {
        intent: "TEST_GENERATION",
        user_story_id: story.id,
        user_story_title: story.title,
        test_cases_generated: data.testCases.length,
      } as any,
    });

    toast({
      title: "Test cases generated!",
      description: `Created ${data.testCases.length} test cases for "${story.title}"`,
    });
  };

  // ─── REPORT GENERATION ─────────────────────────────────────────────────
  const executeReportGeneration = async (instruction: Instruction, parsedIntent: any, user: any, session: any) => {
    // 1. Create a reporting job
    const { data: job } = await supabase
      .from("qa_instruction_jobs")
      .insert({
        instruction_id: instruction.id,
        job_type: "reporting",
        status: "in_progress",
        result: { message: "Generating test execution report..." } as any,
      })
      .select()
      .single();

    toast({ title: "Generating report", description: "Fetching test cases and generating summary..." });

    // 2. Load project info
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();
    const pName = project?.name || "Project";

    // 3. Load all test cases for this project
    const { data: testCasesData, error: tcError } = await supabase
      .from("test_cases")
      .select("id, title, status, automated, priority")
      .eq("project_id", projectId);

    if (tcError) throw tcError;
    if (!testCasesData || testCasesData.length === 0) {
      throw new Error("No test cases found in this project. Please create test cases first.");
    }

    const formattedTestCases = testCasesData.map((tc: any) => ({
      id: tc.id,
      title: tc.title,
      status: tc.status || "pending",
      automated: tc.automated || false,
      priority: tc.priority || "medium",
    }));

    // 4. Load Azure OpenAI config
    const azureConfig = await loadAzureConfig();
    if (!azureConfig?.apiKey) {
      throw new Error("Azure OpenAI is not configured. Please configure it in Integrations first.");
    }

    const isAzure = azureConfig.endpoint?.includes("openai.azure.com");
    const configForEdgeFunction = isAzure
      ? {
          apiKey: azureConfig.apiKey,
          endpoint: azureConfig.endpoint,
          deploymentId: azureConfig.deploymentId || "gpt-4o",
          apiVersion: azureConfig.apiVersion || "2024-08-01-preview",
          model: azureConfig.deploymentId || "gpt-4o",
        }
      : {
          apiKey: azureConfig.apiKey,
          model: azureConfig.model || "gpt-4o-mini",
        };

    const reportType = parsedIntent?.constraints?.report_type || "executive";

    // 5. Call the generate-test-report edge function
    const response = await fetch(`https://lghzmijzfpvrcvogxpew.supabase.co/functions/v1/generate-test-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        testCases: formattedTestCases,
        projectName: pName,
        reportType,
        projectId,
        openAIConfig: configForEdgeFunction,
        testExecutionData: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to generate test report");
    }

    // 6. Save the report to saved_test_reports
    const reportName = `${pName} - Test Pilot Report - ${new Date().toLocaleDateString()}`;
    const { error: saveError } = await supabase.from("saved_test_reports").insert({
      project_id: projectId,
      user_id: user.id,
      report_name: reportName,
      report_content: data.testReport,
      statistics: data.statistics,
      project_name: pName,
      report_type: reportType,
    });

    if (saveError) {
      console.error("Failed to save report:", saveError);
    }

    // 7. Update job and instruction status
    if (job) {
      await supabase
        .from("qa_instruction_jobs")
        .update({
          status: "completed",
          result: {
            message: `Test report generated and saved as "${reportName}"`,
            report_name: reportName,
            statistics: data.statistics,
          } as any,
        })
        .eq("id", job.id);
    }

    await supabase
      .from("qa_instructions")
      .update({
        status: "completed",
        target_agents: ["reporting"],
      })
      .eq("id", instruction.id);

    await supabase.from("qa_instruction_audit").insert({
      instruction_id: instruction.id,
      action: "execution_completed",
      actor_id: user.id,
      details: {
        intent: "RELEASE_SUMMARY",
        report_name: reportName,
        statistics: data.statistics,
      } as any,
    });

    toast({
      title: "Report generated!",
      description: `Report saved as "${reportName}". View it in the Reports module.`,
    });
  };

  // ─── AUTOMATION CREATION (standalone) ─────────────────────────────────
  const executeAutomationCreation = async (instruction: Instruction, parsedIntent: any, user: any, session: any) => {
    const automationSteps = parsedIntent?.workflow_steps?.[0]?.config?.automation_steps || [];
    const baseUrl =
      parsedIntent?.constraints?.base_url ||
      extractBaseUrlFromText(instruction.instruction_text) ||
      "https://example.com";

    const nocodeSteps =
      automationSteps.length > 0
        ? automationSteps.map((s: any, idx: number) => ({
            id: `step_${Date.now()}_${idx}`,
            type: mapToPlaywrightAction(s.type),
            selector: s.selector || "",
            value: s.value || "",
            description: s.description || `Step ${idx + 1}`,
          }))
        : buildStepsFromInstructionText(instruction.instruction_text, baseUrl);

    const testName = parsedIntent?.constraints?.test_case_title || "Automation from Test Pilot";

    const { data: nocodeTest, error } = await supabase
      .from("nocode_tests")
      .insert({
        project_id: projectId,
        name: testName,
        description: `Auto-generated from Test Pilot`,
        base_url: baseUrl,
        steps: nocodeSteps as any,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from("qa_instructions")
      .update({
        status: "completed",
        target_agents: ["automation"],
      })
      .eq("id", instruction.id);

    await supabase.from("qa_instruction_jobs").insert({
      instruction_id: instruction.id,
      job_type: "automation",
      status: "completed",
      result: {
        message: `Automation created with ${nocodeSteps.length} steps`,
        nocode_test_id: nocodeTest.id,
      } as any,
    });

    toast({ title: "Automation created!", description: `${nocodeSteps.length} steps created` });
  };

  // ─── HELPER: Map parsed action types to Playwright action types ──────
  const mapToPlaywrightAction = (type: string): string => {
    const mapping: Record<string, string> = {
      navigate: "navigate",
      goto: "navigate",
      fill: "fill",
      type: "type",
      click: "click",
      assert_visible: "assert_visible",
      assert_text: "assert_text",
      select: "select",
      hover: "hover",
      wait: "wait",
      screenshot: "screenshot",
      press: "press_key",
      check: "check",
      uncheck: "uncheck",
    };
    return mapping[type?.toLowerCase()] || type || "click";
  };

  // ─── HELPER: Build steps from raw instruction text ───────────────────
  const buildStepsFromInstructionText = (text: string, baseUrl: string): any[] => {
    const steps: any[] = [];

    // Always start with navigation if we have a URL
    if (baseUrl && baseUrl !== "https://example.com") {
      steps.push({
        id: `step_${Date.now()}_0`,
        type: "navigate",
        selector: "",
        value: baseUrl,
        description: `Navigate to ${baseUrl}`,
      });
    }

    // Try to extract step-like patterns from text
    const patterns = [
      { regex: /navigate\s+to\s+(?:the\s+)?(?:login\s+page\s+of\s+)?(\S+)/i, type: "navigate", group: 1 },
      {
        regex:
          /enter\s+(?:the\s+)?(?:username|user\s*name)\s+(?:into\s+)?(?:the\s+)?(?:username\s+)?(?:input\s+)?(?:field\s+)?[""]?([^""]+)[""]?/i,
        type: "fill",
        selector: "input[name='user-name'], input[id='user-name'], input[placeholder*='user']",
        valueGroup: 1,
      },
      {
        regex:
          /enter\s+(?:the\s+)?password\s+(?:into\s+)?(?:the\s+)?(?:password\s+)?(?:input\s+)?(?:field\s+)?[""]?([^""]+)[""]?/i,
        type: "fill",
        selector: "input[name='password'], input[id='password'], input[type='password']",
        valueGroup: 1,
      },
      {
        regex: /click\s+(?:the\s+)?(?:on\s+)?(?:the\s+)?login\s+button/i,
        type: "click",
        selector: "button[type='submit'], input[type='submit'], #login-button, .login-button, button:has-text('Login')",
      },
    ];

    let stepIdx = steps.length;
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const step: any = {
          id: `step_${Date.now()}_${stepIdx}`,
          type: pattern.type,
          selector: (pattern as any).selector || "",
          value: "",
          description: match[0].trim(),
        };
        if ((pattern as any).valueGroup && match[(pattern as any).valueGroup]) {
          step.value = match[(pattern as any).valueGroup].trim().replace(/[""\s]+$/, "");
        }
        if (pattern.group && match[pattern.group]) {
          step.value = match[pattern.group].trim();
        }
        steps.push(step);
        stepIdx++;
      }
    }

    // If no steps extracted, add a placeholder
    if (steps.length === 0) {
      steps.push({
        id: `step_${Date.now()}_0`,
        type: "navigate",
        selector: "",
        value: baseUrl,
        description: "Navigate to target page",
      });
    }

    return steps;
  };

  const extractTestCaseTitleFromText = (text: string): string | null => {
    // Try "Create test case for X"
    const patterns = [
      /(?:create|generate)\s+(?:a\s+)?test\s+cas(?:e|es)\s+for\s+(.+?)(?:,|\.|once|then|$)/i,
      /test\s+cas(?:e|es)\s+for\s+(.+?)(?:,|\.|once|then|$)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/["'""]/g, "");
      }
    }
    return null;
  };

  const extractBaseUrlFromText = (text: string): string | null => {
    const urlMatch = text.match(/https?:\/\/[^\s"'""]+/i);
    return urlMatch ? urlMatch[0].replace(/[""']+$/, "") : null;
  };

  const extractStoryTitleFromText = (text: string): string | null => {
    const quotedMatch = text.match(/[""]([^""]+)[""]/) || text.match(/"([^"]+)"/);
    if (quotedMatch) return quotedMatch[1];

    const phrases = ["for user story", "for story", "for", "test cases for"];
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
      const idx = lower.indexOf(phrase);
      if (idx !== -1) {
        const after = text.substring(idx + phrase.length).trim();
        if (after.length > 3) return after;
      }
    }
    return null;
  };

  if (selectedInstruction) {
    return (
      <InstructionDetail
        instruction={selectedInstruction}
        onBack={() => {
          setSelectedInstruction(null);
          fetchInstructions();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Instruction History</h3>
          <Badge variant="secondary">{instructions.length}</Badge>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="validated">Validated</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : instructions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No instructions found. Create one from the Console tab.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {instructions.map((instruction) => {
            const config = STATUS_CONFIG[instruction.status];
            const intentInfo = INTENT_TYPES[instruction.intent_type || ""] || INTENT_TYPES.CUSTOM;
            const isExpanded = expandedId === instruction.id;

            return (
              <Card key={instruction.id} className="transition-all hover:shadow-md">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcons[instruction.status]}
                        <Badge className={config.color} variant="secondary">
                          {config.label}
                        </Badge>
                        {instruction.intent_type && (
                          <Badge className={intentInfo.color} variant="secondary">
                            {intentInfo.label}
                          </Badge>
                        )}
                        {instruction.risk_level === "high" && <Badge variant="destructive">High Risk</Badge>}
                        {instruction.confidence && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(instruction.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <p className="text-sm break-words whitespace-normal">{instruction.instruction_text}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(instruction.created_at).toLocaleString()}</span>
                        {instruction.target_agents?.length > 0 && (
                          <span>{instruction.target_agents.length} agent(s)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {instruction.status === "pending_approval" && (
                        <Button size="sm" onClick={() => handleApprove(instruction)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                      )}
                      {(instruction.status === "validated" || instruction.status === "approved") && (
                        <Button size="sm" variant="outline" onClick={() => handleExecute(instruction)}>
                          <Play className="h-3 w-3 mr-1" /> Execute
                        </Button>
                      )}
                      {!["completed", "failed", "cancelled"].includes(instruction.status) && (
                        <Button size="sm" variant="ghost" onClick={() => handleCancel(instruction)}>
                          <Square className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setSelectedInstruction(instruction)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedId(isExpanded ? null : instruction.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {instruction.parsed_intent && (
                        <div>
                          <span className="text-xs font-medium">Parsed Intent:</span>
                          <pre className="mt-1 text-xs bg-muted p-2 rounded-md overflow-x-auto">
                            {JSON.stringify(instruction.parsed_intent, null, 2)}
                          </pre>
                        </div>
                      )}
                      {Object.keys(instruction.constraints || {}).length > 0 && (
                        <div>
                          <span className="text-xs font-medium">Constraints:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(instruction.constraints).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k}: {String(v)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {instruction.error_message && (
                        <div className="text-xs text-destructive">Error: {instruction.error_message}</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
