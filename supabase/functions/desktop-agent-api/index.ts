import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const { action, apiToken } = body;

    if (!apiToken) {
      return new Response(JSON.stringify({ error: "Missing apiToken" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate agent by token - agents are registered in self_hosted_agents
    const { data: agent, error: agentError } = await supabaseClient
      .from("self_hosted_agents")
      .select("id, agent_id, agent_name, project_id, agent_type, status, capacity, running_jobs, last_heartbeat")
      .eq("api_token_hash", apiToken)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Invalid agent token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "heartbeat":
        return await handleHeartbeat(supabaseClient, agent, body);
      case "poll":
        return await handlePoll(supabaseClient, agent);
      case "start":
        return await handleStart(supabaseClient, agent, body);
      case "submit":
        return await handleSubmit(supabaseClient, agent, body);
      case "self-heal":
        return await handleSelfHeal(supabaseClient, agent, body);
      case "record-step":
        return await handleRecordStep(supabaseClient, agent, body);
      case "get-recording":
        return await handleGetRecording(supabaseClient, agent, body);
      case "stop-recording":
        return await handleStopRecording(supabaseClient, agent, body);
      case "check-recording-status":
        return await handleCheckRecordingStatus(supabaseClient, agent, body);
      case "submit-captured-element":
        return await handleSubmitCapturedElement(supabaseClient, agent, body);
      case "save-recorded-test":
        return await handleSaveRecordedTest(supabaseClient, agent, body);
      case "ai-generate-steps":
        return await handleAIGenerateSteps(supabaseClient, agent, body);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Desktop agent API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleHeartbeat(supabase: any, agent: any, body: any) {
  const { systemInfo, capabilities } = body;

  // Update self_hosted_agents
  const { error: updateError } = await supabase
    .from("self_hosted_agents")
    .update({
      status: "online",
      last_heartbeat: new Date().toISOString(),
    })
    .eq("id", agent.id);

  if (updateError) {
    console.error("Failed to update self_hosted_agents heartbeat:", updateError);
  }

  // Also update desktop_agents table so the UI reflects online status
  const { error: desktopUpdateError } = await supabase
    .from("desktop_agents")
    .update({
      status: "online",
      last_heartbeat: new Date().toISOString(),
      ...(systemInfo && { system_info: systemInfo }),
      ...(capabilities && { capabilities }),
    })
    .eq("project_id", agent.project_id)
    .eq("name", agent.agent_name);

  if (desktopUpdateError) {
    console.error("Failed to update desktop_agents heartbeat (may not exist):", desktopUpdateError);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      agentId: agent.id,
      engineMode: agent.engine_mode,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handlePoll(supabase: any, agent: any) {
  // Get pending jobs for this project, optionally assigned to this agent
  const { data: jobs } = await supabase
    .from("desktop_job_queue")
    .select("id, run_id, steps, application_path, application_args, engine_mode, priority, test_id, pad_environment_id, pad_workflow_id, cloud_flow_trigger_url")
    .eq("project_id", agent.project_id)
    .in("status", ["pending", "assigned"])
    .or(`agent_id.is.null,agent_id.eq.${agent.id}`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  // If we have a job, enrich it with test metadata for PAD execution
  if (jobs && jobs.length > 0) {
    const job = jobs[0];
    let enrichedJob = { ...job };
    const firstStep = Array.isArray(job.steps) && job.steps.length > 0 ? job.steps[0] : null;

    // Fetch test details for PAD metadata (application_name, etc.)
    if (job.test_id) {
      const { data: testData } = await supabase
        .from("desktop_tests")
        .select("application_name, application_path, application_args, engine_mode")
        .eq("id", job.test_id)
        .single();

      if (testData) {
        enrichedJob.application_name = testData.application_name;
        if (!enrichedJob.application_path && testData.application_path) {
          enrichedJob.application_path = testData.application_path;
        }
        if (!enrichedJob.application_args && testData.application_args) {
          enrichedJob.application_args = testData.application_args;
        }
      }
    }

    // Include PAD metadata if passed during job creation
    // These are stored in the job's metadata or passed through
    if (job.pad_environment_id || firstStep?.__pad_environment_id) {
      enrichedJob.pad_environment_id = job.pad_environment_id || firstStep?.__pad_environment_id;
    }
    if (job.pad_workflow_id || firstStep?.__pad_workflow_id) {
      enrichedJob.pad_workflow_id = job.pad_workflow_id || firstStep?.__pad_workflow_id;
    }
    if (job.cloud_flow_trigger_url || firstStep?.__cloud_flow_trigger_url) {
      enrichedJob.cloud_flow_trigger_url = job.cloud_flow_trigger_url || firstStep?.__cloud_flow_trigger_url;
    }
    if (firstStep?.__pad_dataverse_org_url) {
      enrichedJob.pad_dataverse_org_url = firstStep.__pad_dataverse_org_url;
    }
    // Assign job to this agent
    await supabase
      .from("desktop_job_queue")
      .update({
        agent_id: agent.id,
        status: "assigned",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Fetch selectors for this project
    const { data: selectors } = await supabase
      .from("desktop_selector_repository")
      .select("element_name, selector, fallback_selectors")
      .eq("project_id", agent.project_id)
      .eq("is_active", true);

    return new Response(
      JSON.stringify({
        jobs: [{ ...enrichedJob, selectors: selectors || [] }],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ jobs: [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleStart(supabase: any, agent: any, body: any) {
  const { jobId } = body;

  await supabase
    .from("desktop_job_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSubmit(supabase: any, agent: any, body: any) {
  const {
    jobId,
    status,
    duration_ms,
    total_steps,
    passed_steps,
    failed_steps,
    step_results,
    screenshots,
    error_message,
    failure_category,
    engine_mode,
    trace_id,
  } = body;

  // Get job to find test_id
  const { data: job } = await supabase.from("desktop_job_queue").select("test_id").eq("id", jobId).single();

  // Update job status
  await supabase
    .from("desktop_job_queue")
    .update({
      status: failed_steps > 0 ? "failed" : "passed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // Resolve the desktop_agents ID from project_id + agent_name
  // (self_hosted_agents.id != desktop_agents.id, FK requires desktop_agents.id)
  let desktopAgentId: string | null = null;
  const { data: desktopAgent } = await supabase
    .from("desktop_agents")
    .select("id")
    .eq("project_id", agent.project_id)
    .eq("name", agent.agent_name)
    .maybeSingle();
  if (desktopAgent) {
    desktopAgentId = desktopAgent.id;
  }

  // Insert execution result
  const { error: insertError } = await supabase.from("desktop_execution_results").insert({
    project_id: agent.project_id,
    job_id: jobId,
    agent_id: desktopAgentId,
    test_id: job?.test_id || null,
    status: status || (failed_steps > 0 ? "failed" : "passed"),
    duration_ms,
    total_steps: total_steps || 0,
    passed_steps: passed_steps || 0,
    failed_steps: failed_steps || 0,
    step_results: step_results || [],
    screenshots: screenshots || [],
    error_message,
    failure_category,
    engine_mode,
    trace_id,
  });

  if (insertError) {
    console.error("Failed to insert execution result:", insertError);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Agent sends a captured step during recording
async function handleRecordStep(supabase: any, agent: any, body: any) {
  const { jobId, step } = body;

  if (!jobId || !step) {
    return new Response(JSON.stringify({ error: "Missing jobId or step" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get current recorded steps
  const { data: job } = await supabase.from("desktop_job_queue").select("recorded_steps").eq("id", jobId).single();

  const currentSteps = job?.recorded_steps || [];
  const updatedSteps = [
    ...currentSteps,
    { ...step, stepId: `step-${Date.now()}-${currentSteps.length}`, recordedAt: new Date().toISOString() },
  ];

  await supabase.from("desktop_job_queue").update({ recorded_steps: updatedSteps }).eq("id", jobId);

  return new Response(JSON.stringify({ ok: true, stepCount: updatedSteps.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// UI polls for recorded steps
async function handleGetRecording(supabase: any, agent: any, body: any) {
  const { jobId } = body;

  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: job } = await supabase
    .from("desktop_job_queue")
    .select("recorded_steps, status")
    .eq("id", jobId)
    .single();

  return new Response(
    JSON.stringify({
      ok: true,
      steps: job?.recorded_steps || [],
      jobStatus: job?.status || "unknown",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleStopRecording(supabase: any, agent: any, body: any) {
  const { jobId } = body;
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("desktop_job_queue")
    .update({ status: "stopped", completed_at: new Date().toISOString() })
    .eq("id", jobId);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCheckRecordingStatus(supabase: any, agent: any, body: any) {
  const { jobId } = body;
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: job } = await supabase.from("desktop_job_queue").select("status").eq("id", jobId).single();

  return new Response(
    JSON.stringify({
      ok: true,
      status: job?.status || "unknown",
      shouldStop: job?.status === "stopped" || job?.status === "completed",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Agent submits a captured element from inspect mode
async function handleSubmitCapturedElement(supabase: any, agent: any, body: any) {
  const { jobId, capturedElement } = body;

  if (!jobId || !capturedElement) {
    return new Response(JSON.stringify({ error: "Missing jobId or capturedElement" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Store captured element in the job's recorded_steps field
  await supabase
    .from("desktop_job_queue")
    .update({
      recorded_steps: [capturedElement],
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSelfHeal(supabase: any, agent: any, body: any) {
  const { jobId, testId, originalSelector, uiTreeSnapshot, stepIndex } = body;

  // Use AI to suggest alternative selector
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  let suggestedSelector = null;
  let confidenceScore = 0;
  let aiAnalysis = "";

  if (LOVABLE_API_KEY) {
    const prompt = `You are an expert in Windows UI Automation for  desktop applications .

An element was not found with the original selector. Analyze the UI tree and suggest the best alternative composite selector.

## Original Selector:
${JSON.stringify(originalSelector, null, 2)}

## UI Automation Tree (partial dump):
${uiTreeSnapshot?.substring(0, 8000) || "Not available"}

## Instructions:
1. Analyze the UI tree to find the most likely matching element
2. Consider: AutomationId, Name/Label, ControlType, ClassName, parent-child relationships
3. Provide a confidence score (0.0 to 1.0)
4. Specifically watch for Java Access Bridge elements

Respond with ONLY valid JSON:
{
  "selector": {
    "automationId": "suggested_id_or_null",
    "label": "suggested_label",
    "controlType": "Button|Edit|ComboBox|etc",
    "classHint": "java_class_hint",
    "parentWindow": "parent_window_title",
    "xpath": "/optional/xpath"
  },
  "confidence": 0.85,
  "analysis": "Brief explanation of why this selector was chosen"
}`;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a Windows UI Automation expert. Respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestedSelector = parsed.selector;
          confidenceScore = parsed.confidence || 0;
          aiAnalysis = parsed.analysis || "";
        }
      }
    } catch (e) {
      console.error("AI self-heal error:", e);
    }
  }

  // Determine status based on confidence
  const autoApplyThreshold = 0.9;
  const healStatus = confidenceScore >= autoApplyThreshold ? "auto_applied" : "pending";

  // Log the self-healing attempt
  await supabase.from("desktop_self_healing_logs").insert({
    project_id: agent.project_id,
    test_id: testId || null,
    job_id: jobId || null,
    original_selector: originalSelector,
    suggested_selector: suggestedSelector,
    ui_tree_snapshot: uiTreeSnapshot?.substring(0, 50000),
    confidence_score: confidenceScore,
    status: healStatus,
    ai_analysis: aiAnalysis,
    ...(healStatus === "auto_applied" && { applied_at: new Date().toISOString() }),
  });

  // If auto-applied, update the selector repository
  if (healStatus === "auto_applied" && suggestedSelector) {
    const elementName = originalSelector.label || originalSelector.automationId || "unknown";

    // Try to update existing selector or create new version
    const { data: existing } = await supabase
      .from("desktop_selector_repository")
      .select("id, version")
      .eq("project_id", agent.project_id)
      .eq("element_name", elementName)
      .eq("is_active", true)
      .single();

    if (existing) {
      // Deactivate old version
      await supabase.from("desktop_selector_repository").update({ is_active: false }).eq("id", existing.id);

      // Create new version
      await supabase.from("desktop_selector_repository").insert({
        project_id: agent.project_id,
        element_name: elementName,
        selector: suggestedSelector,
        fallback_selectors: [originalSelector],
        version: existing.version + 1,
        is_active: true,
        last_validated_at: new Date().toISOString(),
        validation_status: "valid",
        created_by: agent.id,
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      suggestedSelector,
      confidence: confidenceScore,
      analysis: aiAnalysis,
      status: healStatus,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Standalone recorder saves a test directly
async function handleSaveRecordedTest(supabase: any, agent: any, body: any) {
  const { testName, description, applicationName, applicationPath, engineMode, steps } = body;

  if (!testName || !steps) {
    return new Response(JSON.stringify({ error: "Missing testName or steps" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insert into desktop_tests
  const { data: test, error: insertError } = await supabase
    .from("desktop_tests")
    .insert({
      project_id: agent.project_id,
      name: testName,
      description: description || null,
      application_name: applicationName || "Desktop App",
      application_path: applicationPath || null,
      engine_mode: engineMode || "uia",
      steps: steps,
      status: "active",
      created_by: agent.id,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to save recorded test:", insertError);
    return new Response(JSON.stringify({ error: "Failed to save test", details: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract unique selectors and save to desktop_element_selectors
  const selectorMap = new Map<string, any>();
  for (const step of steps || []) {
    const target = step.target;
    if (!target) continue;
    const key = target.automationId || target.label || "";
    if (!key || selectorMap.has(key)) continue;
    selectorMap.set(key, {
      project_id: agent.project_id,
      element_name: key,
      application_name: applicationName || "Desktop App",
      selector: target,
      fallback_selectors: [],
      is_active: true,
      validation_status: "unvalidated",
      created_by: agent.id,
    });
  }

  if (selectorMap.size > 0) {
    const selectors = Array.from(selectorMap.values());
    const { error: selError } = await supabase
      .from("desktop_selector_repository")
      .upsert(selectors, { onConflict: "project_id,element_name", ignoreDuplicates: true });
    if (selError) {
      console.error("Failed to save selectors:", selError);
    }
  }

  return new Response(JSON.stringify({ ok: true, testId: test?.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Robust JSON array extraction with truncation repair
function extractJsonArray(raw: string, finishReason?: string): unknown[] {
  // Strip markdown code blocks
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find JSON array boundaries
  const arrStart = cleaned.indexOf("[");
  if (arrStart === -1) throw new Error("No JSON array found in AI response");

  const arrEnd = cleaned.lastIndexOf("]");
  if (arrEnd > arrStart) {
    cleaned = cleaned.substring(arrStart, arrEnd + 1);
  } else {
    // No closing bracket — truncated
    cleaned = cleaned.substring(arrStart);
  }

  // First attempt: direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Continue to repair
  }

  // Fix common issues
  cleaned = cleaned
    .replace(/,\s*}/g, "}") // trailing commas in objects
    .replace(/,\s*]/g, "]") // trailing commas in arrays
    .replace(/[\x00-\x1F\x7F]/g, (ch) => (ch === "\n" || ch === "\r" || ch === "\t" ? ch : "")); // control chars

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Continue to truncation repair
  }

  // Truncation repair: find last complete object and close the array
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0) {
    const repaired = cleaned.substring(0, lastBrace + 1) + "]";
    try {
      const arr = JSON.parse(repaired);
      console.warn("Recovered " + arr.length + " steps from truncated AI response");
      return arr;
    } catch (_) {
      // Final fallback
    }
  }

  throw new Error(
    "Could not parse AI response as JSON array. Response may have been truncated (finish_reason: " +
      (finishReason || "unknown") +
      ")",
  );
}

// AI-powered step generation from manual test steps (called by standalone recorder)
async function handleAIGenerateSteps(supabase: any, agent: any, body: any) {
  const { manualSteps, applicationName, engineMode } = body;

  if (!manualSteps) {
    return new Response(JSON.stringify({ error: "Missing manualSteps" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured (LOVABLE_API_KEY missing)" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isPad = engineMode === "pad";

  const padBlock = isPad ? `
IMPORTANT — Power Automate Desktop (PAD) Execution Engine:
All generated steps must be directly convertible to PAD Robin script with minimal changes.

PAD-specific requirements:
- Include a "padAction" field with the exact Robin action name:
  - click → "UIAutomation.PressButton"
  - type → "UIAutomation.PopulateTextField.PopulateTextField"
  - select → "UIAutomation.SelectDropDownListItem"
  - launch_app → "System.LaunchApplication"
  - wait → "WAIT"
  - keyboard_shortcut → "MouseAndKeyboard.SendKeys"
  - hover → "UIAutomation.Hover"
  - window_close → "UIAutomation.CloseWindow"
  - window_switch → "UIAutomation.FocusWindow"
  - wait_for_element → "UIAutomation.WaitForUiElement"
  - screenshot → "UIAutomation.TakeScreenshot"
  - drag_drop → "UIAutomation.DragAndDrop"
- Include target.padSelector in appmask format: "appmask['Window \\'WindowTitle\\'']['ElementName']"
- Include target.parentWindow with the exact window title
- Use PAD SendKeys format for keyboard shortcuts: "{Control}({S})" not "Ctrl+S"
- Add explicit WAIT 2 steps between navigation/click actions for PAD stability
- controlType values should be lowercase PAD types: button, edit, combobox, checkbox, radiobutton, listitem, menuitem, tabitem, treeitem, datagrid, text, hyperlink, window, pane, group
` : "";

  const prompt = "You are an expert desktop test automation engineer for Windows thick-client applications.\nConvert the following manual test steps into structured desktop automation steps.\n\nApplication: " + (applicationName || "Desktop App") + "\nEngine Mode: " + (engineMode || "uia") + (isPad ? " (Power Automate Desktop)" : " (uia = Windows UI Automation, jab = Java Access Bridge, hybrid = both)") + "\n" + padBlock + "\nManual Test Steps:\n" + manualSteps + "\n\nFor each step, generate a JSON object with:\n- action: click | double_click | right_click | type | clear | select | assert_text | assert_visible | assert_state | wait | wait_for_element | window_switch | window_close | keyboard_shortcut | scroll | hover | launch_app\n- target: { automationId, label, controlType, classHint, parentWindow" + (isPad ? ", padSelector" : "") + " }\n- value: input text, expected value, or shortcut combo" + (isPad ? "\n- padAction: exact PAD Robin action name" : "") + "\n- description: human-readable description\n\n" + (engineMode === "jab" || engineMode === "hybrid" ? "For Java apps, use classHint with Java Swing class names like javax.swing.JButton, javax.swing.JTextField, etc.\n" : "") + "Return ONLY a JSON array of step objects. No markdown, no explanation.";

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a desktop test automation expert. Return valid JSON arrays only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const finishReason = result.choices?.[0]?.finish_reason;

    // Robust JSON extraction with truncation repair
    const steps = extractJsonArray(content, finishReason);

    return new Response(JSON.stringify({ ok: true, steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AI step generation error:", e);
    return new Response(JSON.stringify({ error: "AI step generation failed: " + (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
