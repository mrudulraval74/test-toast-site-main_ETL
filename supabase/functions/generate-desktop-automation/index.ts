import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, projectId, testDescription, applicationName, existingSteps, failureInfo, engineMode } = await req.json();

    if (!projectId || !mode) {
      return new Response(JSON.stringify({ error: "projectId and mode are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Azure OpenAI config from integrations
    const { data: configData } = await supabase
      .from("integration_configs")
      .select("config")
      .eq("project_id", projectId)
      .eq("integration_id", "openai")
      .eq("enabled", true)
      .single();

    let aiResponse: string;

    if (configData?.config) {
      // Use project-specific Azure OpenAI
      const config = configData.config as any;
      const azureEndpoint = config.endpoint?.replace(/\/$/, "");
      const azureApiKey = config.apiKey;
      const deploymentId = config.deploymentId || "gpt-4o";
      const apiVersion = config.apiVersion || "2024-08-01-preview";

      if (!azureApiKey || !azureEndpoint) throw new Error("Azure OpenAI not configured");

      const apiUrl = `${azureEndpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;

      let systemPrompt = "";
      let userPrompt = "";

      if (mode === "generate_steps") {
        systemPrompt = buildGenerateStepsSystemPrompt(engineMode);
        userPrompt = buildGenerateStepsUserPrompt(testDescription, applicationName, engineMode);
      } else if (mode === "extract_selectors") {
        systemPrompt = buildExtractSelectorsSystemPrompt();
        userPrompt = buildExtractSelectorsUserPrompt(existingSteps, applicationName);
      } else if (mode === "fix_failed_steps") {
        systemPrompt = buildFixFailedStepsSystemPrompt();
        userPrompt = buildFixFailedStepsUserPrompt(existingSteps, applicationName, failureInfo);
      } else {
        return new Response(JSON.stringify({ error: "Invalid mode" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": azureApiKey },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Azure OpenAI error: ${response.status} ${err}`);
      }

      const data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content || "";
    } else {
      // Fallback to Lovable AI
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("No AI provider configured");

      let systemPrompt = "";
      let userPrompt = "";

      if (mode === "generate_steps") {
        systemPrompt = buildGenerateStepsSystemPrompt(engineMode);
        userPrompt = buildGenerateStepsUserPrompt(testDescription, applicationName, engineMode);
      } else if (mode === "fix_failed_steps") {
        systemPrompt = buildFixFailedStepsSystemPrompt();
        userPrompt = buildFixFailedStepsUserPrompt(existingSteps, applicationName, failureInfo);
      } else {
        systemPrompt = buildExtractSelectorsSystemPrompt();
        userPrompt = buildExtractSelectorsUserPrompt(existingSteps, applicationName);
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
        if (response.status === 402) throw new Error("AI credits exhausted. Please top up your workspace.");
        throw new Error(`AI error: ${response.status} ${err}`);
      }

      const data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content || "";
    }

    // Parse JSON from response
    const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/) || aiResponse.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiResponse;

    let result: any;
    try {
      result = JSON.parse(jsonStr.trim());
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-desktop-automation:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildGenerateStepsSystemPrompt(engineMode?: string): string {
  const isPad = engineMode === "pad";
  
  const padInstructions = isPad ? `

IMPORTANT: You are generating steps for Power Automate Desktop (PAD) execution engine.
All actions and selectors MUST be directly compatible with PAD Robin script syntax.

PAD-specific rules:
- Use PAD-native action names that map directly to Robin actions:
  - "click" → UIAutomation.Click / UIAutomation.PressButton
  - "type" → UIAutomation.PopulateTextField.PopulateTextField
  - "select" → UIAutomation.SelectDropDownListItem
  - "launch_app" → System.LaunchApplication
  - "wait" → WAIT (with numeric seconds in value)
  - "keyboard_shortcut" → MouseAndKeyboard.SendKeys
  - "hover" → UIAutomation.Hover
  - "window_close" → UIAutomation.CloseWindow
  - "window_switch" → UIAutomation.FocusWindow
  - "screenshot" → UIAutomation.TakeScreenshot
  - "drag_drop" → UIAutomation.DragAndDrop
  - "wait_for_element" → UIAutomation.WaitForUiElement (set timeoutSeconds)
- For "type" actions, include the PopulateTextMode (Replace) and ClickType (SingleClick) in metadata
- For selectors, use the PAD appmask format: target.padSelector should be like "appmask['Window \\'WindowTitle\\'']['ElementName']"
- Include target.parentWindow as the exact window title for building appmask references
- Use controlType values that map to PAD selector types: button, edit, combobox, checkbox, radiobutton, listitem, menuitem, tabitem, treeitem, datagrid, text, hyperlink, window, pane, group
- Add a "padAction" field to each step with the exact PAD Robin action name (e.g., "UIAutomation.PressButton", "UIAutomation.PopulateTextField.PopulateTextField")
- For assertions, add a comment step since PAD doesn't natively support assertions: use action "assert_text" but include padAction as "# WISPR Assertion"
- Always include explicit WAIT steps (2-3 seconds) between navigation actions for PAD stability
- For keyboard shortcuts, format value as PAD SendKeys syntax: e.g., "{Control}({S})" instead of "Ctrl+S"
` : "";

  return "You are an expert desktop test automation engineer specializing in thick-client applications like LoanIQ, Temenos, Murex, and other Java/Win32 apps.\n\nYou convert natural language test descriptions into structured automation steps for a UIA (Windows UI Automation) , (JAB) Java Access Bridge and Vision-based desktop agent.\n" + padInstructions + "\nReturn a JSON array of steps with this exact structure:\n[\n  {\n    \"stepId\": \"step-1\",\n    \"action\": \"launch_app|click|double_click|right_click|type|clear|select|assert_text|assert_state|assert_visible|wait|wait_for_element|window_switch|window_close|screenshot|scroll|hover|keyboard_shortcut|drag_drop\",\n    \"target\": {\n      \"automationId\": \"unique UI automation ID like btnLogin, txtUsername\",\n      \"label\": \"visible text label of the element\",\n      \"controlType\": \"Button|Edit|ComboBox|ListItem|MenuItem|TreeItem|TabItem|CheckBox|RadioButton|DataGrid|Window|Pane|Text\",\n      \"classHint\": \"optional Java/WPF class name\",\n      \"parentWindow\": \"parent window title if needed\"" + (isPad ? ",\n      \"padSelector\": \"appmask reference for PAD e.g. appmask['Window \\\\'Title\\\\'']['Element']\"" : "") + "\n    },\n    \"value\": \"text to type or expected assertion value\"," + (isPad ? "\n    \"padAction\": \"exact PAD Robin action name like UIAutomation.PressButton\"," : "") + "\n    \"waitCondition\": \"element_exists|element_visible|element_enabled|text_matches\",\n    \"timeoutSeconds\": 30,\n    \"retryCount\": 2,\n    \"failureCategoryHint\": \"element_not_found|wrong_value|timeout|application_error\"\n  }\n]\n\nRules:\n- First step is usually launch_app with the application path in value\n- Use realistic automationIds based on common desktop app patterns (e.g., btnOK, txtAmount, cmbCurrency)\n- For keyboard shortcuts use the keyboard_shortcut action with value like " + (isPad ? "\"{Control}({S})\", \"{Alt}({F4})\"" : "\"Ctrl+S\", \"Alt+F4\"") + "\n- Keep timeoutSeconds between 10-60 based on expected load time\n- Return ONLY the JSON array, no other text";
}

function buildGenerateStepsUserPrompt(testDescription: string, applicationName: string, engineMode?: string): string {
  const isPad = engineMode === "pad";
  return "Application: " + (applicationName || "Desktop Application") + "\n" + (isPad ? "Execution Engine: Power Automate Desktop (PAD)\n" : "") + "\nTest Description / Steps to automate:\n" + testDescription + "\n\nGenerate detailed desktop automation steps for this test case. Make the selectors realistic for the " + (applicationName || "application") + " and include proper wait conditions." + (isPad ? "\n\nEnsure all steps produce PAD-compatible Robin script output with appmask selectors and PAD action names. Add explicit WAIT steps between UI interactions for stability." : "");
}

function buildExtractSelectorsSystemPrompt(): string {
  return `You are an expert desktop UI automation engineer. Your job is to analyze automation steps and extract/enhance UI element selectors for a selector repository.

For each unique UI element in the provided steps, generate an enriched selector entry with multiple fallback strategies.

Return a JSON array of selector entries:
[
  {
    "element_name": "descriptive unique name like LoginButton or UsernameField",
    "selector": {
      "automationId": "primary automation ID",
      "label": "visible text label",
      "controlType": "Button|Edit|ComboBox|etc",
      "classHint": "Java/WPF class if known",
      "parentWindow": "parent window title"
    },
    "fallback_selectors": [
      {
        "strategy": "label_match",
        "automationId": "",
        "label": "alternative label text",
        "controlType": "Button"
      },
      {
        "strategy": "partial_automation_id",
        "automationId": "partial_*",
        "label": "",
        "controlType": "Button"
      }
    ],
    "suggested_description": "what this element does",
    "confidence": 0.9
  }
]

Rules:
- Generate 2-3 fallback selectors per element using different strategies
- Use descriptive element_name in PascalCase (e.g., LoginButton, AccountNumberField)
- Skip generic elements like Window containers unless critical
- confidence: 0.9 = very clear from context, 0.7 = inferred, 0.5 = uncertain
- Return ONLY the JSON array`;
}

function buildExtractSelectorsUserPrompt(steps: any[], applicationName: string): string {
  return `Application: ${applicationName || "Desktop Application"}

Existing automation steps:
${JSON.stringify(steps, null, 2)}

Extract and enrich all unique UI element selectors from these steps. Generate fallback strategies for each element to improve test resilience.`;
}

function buildFixFailedStepsSystemPrompt(): string {
  return `You are an expert desktop test automation engineer specializing in thick-client applications like LoanIQ, Temenos, Murex, and other Java/Win32 apps.

An automation script was dispatched to a desktop agent but some steps failed. Your job is to analyze the failed steps and produce a corrected version of the full script.

Rules:
- Preserve steps that passed; only fix the steps that failed
- Common fixes: correct automationId, adjust controlType, add explicit wait steps before the failed step, correct the parentWindow title
- For "element_not_found" failures: try alternative automationId patterns or switch to label-based matching
- For "timeout" failures: increase timeoutSeconds and add a wait_for_element step before the action
- For "application_error" failures: add an error recovery step or screenshot step
- Return the COMPLETE corrected step array (not just the fixed steps)
- Return ONLY valid JSON array, no explanation text`;
}

function buildFixFailedStepsUserPrompt(steps: any[], applicationName: string, failureInfo: any): string {
  return `Application: ${applicationName || "Desktop Application"}

Original automation steps that were run:
${JSON.stringify(steps, null, 2)}

Agent execution result (failure info):
${JSON.stringify(failureInfo || {}, null, 2)}

Please fix the steps that caused failures and return the complete corrected automation step array.`;
}
