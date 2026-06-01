// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Map keywords -> data domains the AI report should include
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  testCases: ["test case", "test cases", "tc-", "manual test", "test coverage"],
  testRuns: ["test run", "run result", "execution result", "test execution"],
  automation: ["automation", "no code", "nocode", "no-code", "playwright", "selenium", "suite"],
  api: ["api", "endpoint", "rest", "swagger", "postman", "api test"],
  performance: ["performance", "load test", "jmeter", "throughput", "latency", "response time"],
  security: ["security", "vulnerability", "burp", "zap", "owasp", "scan", "penetration"],
  defects: ["defect", "bug", "issue", "ticket", "jira", "azure devops"],
};

function detectDomains(description: string): string[] {
  const lower = description.toLowerCase();
  const matched: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) matched.push(domain);
  }
  // If nothing matched, include everything so the AI can pick what's relevant
  return matched.length > 0 ? matched : Object.keys(DOMAIN_KEYWORDS);
}

async function safeSelect(table: string, builder: (q: any) => any) {
  try {
    const { data, error } = await builder(supabase.from(table));
    if (error) {
      console.warn(`Query failed for ${table}:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn(`Query exception for ${table}:`, e);
    return [];
  }
}

async function gatherContextData(projectId: string, domains: string[]) {
  const ctx: Record<string, any> = {};

  if (domains.includes("testCases")) {
    ctx.testCases = await safeSelect("test_cases", (q) =>
      q.select("id,readable_id,title,status,priority,automated,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200)
    );
  }

  if (domains.includes("testRuns")) {
    ctx.testRuns = await safeSelect("test_runs", (q) =>
      q.select("id,name,run_type,status,created_at,updated_at,test_run_cases(id,status,executed_at)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  if (domains.includes("automation")) {
    ctx.nocodeTests = await safeSelect("nocode_tests", (q) =>
      q.select("id,name,base_url,created_at").eq("project_id", projectId).limit(100)
    );
    ctx.nocodeExecutions = await safeSelect("nocode_test_executions", (q) =>
      q.select("id,test_id,status,started_at,completed_at,duration_ms,error_message")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(100)
    );
    ctx.agentExecutions = await safeSelect("agent_execution_results", (q) =>
      q.select("id,job_id,status,total_steps,passed_steps,failed_steps,duration_ms,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100)
    );
  }

  if (domains.includes("api")) {
    ctx.apiTestRuns = await safeSelect("api_test_runs", (q) =>
      q.select("id,name,status,test_cases,created_at,completed_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  if (domains.includes("performance")) {
    ctx.performanceExecutions = await safeSelect("performance_test_executions", (q) =>
      q.select("id,test_name,status,started_at,completed_at,results_summary")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(50)
    );
  }

  if (domains.includes("security")) {
    ctx.burpScans = await safeSelect("burp_scans", (q) =>
      q.select("id,name,status,critical_count,high_count,medium_count,low_count,info_count,started_at,completed_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30)
    );
    ctx.zapScans = await safeSelect("zap_scans", (q) =>
      q.select("id,name,status,high_count,medium_count,low_count,info_count,started_at,completed_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30)
    );
  }

  if (domains.includes("defects")) {
    ctx.defects = await safeSelect("defects", (q) =>
      q.select("id,title,status,severity,priority,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200)
    );
  }

  return ctx;
}

function summarizeContext(ctx: Record<string, any>) {
  const summary: Record<string, any> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (Array.isArray(v)) {
      summary[k] = { count: v.length, sample: v.slice(0, 50) };
    }
  }
  return summary;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId, projectName, description } = await req.json();
    if (!projectId || !description || typeof description !== "string") {
      return new Response(JSON.stringify({ error: "projectId and description are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (description.length > 4000) {
      return new Response(JSON.stringify({ error: "Description must be under 4000 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Azure OpenAI configuration from integration_configs
    const { data: configData, error: configError } = await supabase
      .from("integration_configs")
      .select("config")
      .eq("project_id", projectId)
      .eq("integration_id", "openai")
      .eq("enabled", true)
      .single();

    if (configError || !configData) {
      return new Response(JSON.stringify({
        error: "Azure OpenAI not configured",
        details: "Please configure Azure OpenAI in the Integrations tab",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dbConfig = configData.config as any;
    const apiKey = dbConfig.apiKey;
    const azureEndpoint = dbConfig.endpoint;
    const deploymentId = dbConfig.deploymentId || "gpt-4o";
    const apiVersion = dbConfig.apiVersion || "2024-08-01-preview";

    if (!apiKey || !azureEndpoint) {
      return new Response(JSON.stringify({
        error: "Azure OpenAI not properly configured",
        details: "Missing API key or endpoint in Integrations tab",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Detect domains from description and gather data
    const domains = detectDomains(description);
    console.log("Detected domains:", domains);
    const ctx = await gatherContextData(projectId, domains);
    const summary = summarizeContext(ctx);

    const systemPrompt = `You are a senior QA reporting expert. You generate detailed, well-structured Markdown test reports based on the user's description and live project data. Be clear, data-driven, and include actionable insights. Always include relevant statistics, tables, and recommendations. Only reference data that is present in the provided context. If a domain has no data, mention that clearly.`;

    const userPrompt = `Project: ${projectName || "Unknown"}

User-requested report description:
"""
${description}
"""

Detected relevant domains: ${domains.join(", ")}

Live Project Data (JSON, truncated samples):
${JSON.stringify(summary, null, 2)}

Generate a comprehensive Markdown report tailored exactly to the user's description above.
Structure the report with:
1. Executive Summary
2. Scope (which areas this report covers based on the description)
3. Key Metrics & Statistics (use tables where helpful)
4. Detailed Findings per relevant domain
5. Risks & Issues
6. Recommendations & Next Steps
7. Appendix (notable items)

Keep it professional, concise where possible, and detailed where it adds value.`;

    const cleanEndpoint = azureEndpoint.replace(/\/$/, "");
    const apiEndpoint = `${cleanEndpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Azure OpenAI error:", response.status, data);
      const msg = data?.error?.message || `Azure OpenAI error ${response.status}`;
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reportContent = data.choices?.[0]?.message?.content ?? "";

    // Log usage
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: user.id,
        project_id: projectId,
        feature_type: "custom_ai_report",
        tokens_used: data.usage?.total_tokens || 0,
        openai_model: `azure-${deploymentId}`,
        openai_tokens_prompt: data.usage?.prompt_tokens || 0,
        openai_tokens_completion: data.usage?.completion_tokens || 0,
        execution_time_ms: Date.now() - startTime,
        success: true,
      });
    } catch (e) {
      console.warn("Failed to log AI usage:", e);
    }

    return new Response(JSON.stringify({
      report: reportContent,
      detectedDomains: domains,
      dataCounts: Object.fromEntries(Object.entries(summary).map(([k, v]: any) => [k, v.count])),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("generate-custom-ai-report error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});