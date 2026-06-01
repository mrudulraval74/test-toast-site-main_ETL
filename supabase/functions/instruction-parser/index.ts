import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDENTIAL_ENCRYPTION_KEY = Deno.env.get('CREDENTIAL_ENCRYPTION_KEY') || '';

type EncryptedField = { __encrypted: true; value: string };

function isEncryptedField(v: unknown): v is EncryptedField {
  return !!v && typeof v === 'object' && (v as any).__encrypted === true && typeof (v as any).value === 'string';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveAesGcmKey(keyMaterial: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(keyMaterial.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptAesGcmBase64(combinedBase64: string, keyMaterial: string): Promise<string> {
  const combined = new Uint8Array(base64ToArrayBuffer(combinedBase64));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await deriveAesGcmKey(keyMaterial);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

async function readConfigStringField(v: unknown): Promise<string | undefined> {
  if (typeof v === 'string') return v;
  if (isEncryptedField(v)) {
    if (!CREDENTIAL_ENCRYPTION_KEY) {
      console.warn('Encrypted integration config found but CREDENTIAL_ENCRYPTION_KEY is not configured');
      return undefined;
    }
    try {
      return await decryptAesGcmBase64(v.value, CREDENTIAL_ENCRYPTION_KEY);
    } catch (e) {
      console.warn('Failed to decrypt integration config field:', e);
      return undefined;
    }
  }
  return undefined;
}

function isValidAzureEndpoint(endpoint?: string): boolean {
  return !!endpoint && (endpoint.includes('.openai.azure.com') || endpoint.includes('.cognitiveservices.azure.com'));
}

async function getAzureConfig(supabase: any, projectId: string) {
  const [{ data: openaiIntegration }, { data: azureIntegration }] = await Promise.all([
    supabase
      .from('integration_configs')
      .select('config')
      .eq('project_id', projectId)
      .eq('integration_id', 'openai')
      .eq('enabled', true)
      .maybeSingle(),
    supabase
      .from('integration_configs')
      .select('config')
      .eq('project_id', projectId)
      .eq('integration_id', 'azure_openai')
      .eq('enabled', true)
      .maybeSingle(),
  ]);

  const preferredConfig = openaiIntegration?.config || azureIntegration?.config;
  if (preferredConfig) {
    const endpoint = await readConfigStringField((preferredConfig as any).endpoint);
    const apiKey = await readConfigStringField((preferredConfig as any).apiKey);
    const deploymentName = (preferredConfig as any).deploymentId || (preferredConfig as any).deploymentName || 'gpt-4o';
    const apiVersion = (preferredConfig as any).apiVersion || '2024-02-01';

    if (apiKey && isValidAzureEndpoint(endpoint)) {
      return { apiKey, endpoint, deploymentName, apiVersion };
    }
  }

  // Fallback to env vars
  const envKey = Deno.env.get('AZURE_OPENAI_API_KEY');
  const envEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  if (envKey && isValidAzureEndpoint(envEndpoint)) {
    return { apiKey: envKey, endpoint: envEndpoint!, deploymentName: 'gpt-4o', apiVersion: '2024-02-01' };
  }

  throw new Error('Azure OpenAI not configured. Please configure it in the Integrations module.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { instruction_text, project_id } = await req.json();

    if (!instruction_text) {
      return new Response(JSON.stringify({ error: 'instruction_text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client to read integration config
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const azureConfig = await getAzureConfig(supabase, project_id);
    console.log('Using Azure OpenAI from Integrations module:', {
      endpoint: azureConfig.endpoint,
      deployment: azureConfig.deploymentName,
    });

    const systemPrompt = `You are an AI QA instruction parser for a test management platform called WISPR.
Your job is to analyze a natural language instruction from a QA lead and extract structured intent.
IMPORTANT: You must process the ENTIRE instruction text completely. Do NOT truncate or skip any part.

Available agent types: analyst, automation, healer, performance, security, reporting

Available intent types:
- TEST_GENERATION: Generate test cases (analyst)
- AUTOMATE_ONLY: Create automation scripts (automation)
- FIX_FAILURES: Heal or fix failed tests (healer)
- RUN_NFR: Run performance/load tests (performance)
- SECURITY_AUDIT: Run security scans (security)
- RELEASE_SUMMARY: Generate reports (reporting)
- DATA_VALIDATION: Validate data quality (analyst)
- COMPOUND: When instruction contains MULTIPLE actions (e.g., create test cases AND automate AND execute). Use this when the instruction asks for more than one sequential action.
- CUSTOM: Anything else

COMPOUND instructions are common. Examples:
- "Create test case for X, then automate and execute it" -> COMPOUND with workflow_steps
- "Generate tests for login and run them using Playwright" -> COMPOUND with workflow_steps

For COMPOUND intents, you MUST populate the workflow_steps array with each discrete step in order.

Risk levels:
- low: read-only operations (reporting, viewing)
- medium: generation of artifacts (test cases, scripts)
- high: execution on production-like systems, security scans, performance stress tests

Return a JSON object with tool calling.`;

    const azureUrl = `${azureConfig.endpoint}/openai/deployments/${azureConfig.deploymentName}/chat/completions?api-version=${azureConfig.apiVersion}`;

    const response = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "api-key": azureConfig.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this QA instruction completely. Read the FULL text carefully:\n\n"${instruction_text}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_instruction",
              description: "Parse a QA instruction into structured intent. For compound/multi-step instructions, extract ALL steps.",
              parameters: {
                type: "object",
                properties: {
                  intent: {
                    type: "string",
                    enum: ["TEST_GENERATION", "AUTOMATE_ONLY", "FIX_FAILURES", "RUN_NFR", "SECURITY_AUDIT", "RELEASE_SUMMARY", "DATA_VALIDATION", "COMPOUND", "CUSTOM"],
                    description: "The classified intent type. Use COMPOUND when the instruction contains multiple sequential actions (e.g. create test cases AND automate AND execute)."
                  },
                  target_agents: {
                    type: "array",
                    items: { type: "string", enum: ["analyst", "automation", "healer", "performance", "security", "reporting"] },
                    description: "Which agents should handle this. For COMPOUND, include all agents needed across all steps."
                  },
                  scope: {
                    type: "object",
                    properties: {
                      artifact_type: { type: "string", description: "Type of artifact (api, ui, user_story, test_case, etc.)" },
                      tags: { type: "array", items: { type: "string" }, description: "Relevant tags or keywords" },
                    },
                    additionalProperties: true,
                  },
                  constraints: {
                    type: "object",
                    properties: {
                      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      test_types: { type: "array", items: { type: "string" }, description: "Types of tests (negative, boundary, regression, etc.)" },
                      exclude: { type: "array", items: { type: "string" }, description: "What to exclude" },
                      user_story_title: { type: "string", description: "The exact title of the user story mentioned in the instruction, if any" },
                      story_title: { type: "string", description: "Alias for user_story_title - the name/title of the story to act on" },
                      test_case_title: { type: "string", description: "Title or description for the test case to create, if mentioned" },
                      base_url: { type: "string", description: "The target URL/website mentioned in the instruction for testing, e.g. https://www.saucedemo.com/" },
                    },
                    additionalProperties: true,
                  },
                  workflow_steps: {
                    type: "array",
                    description: "For COMPOUND intents only. Ordered list of discrete workflow steps to execute sequentially.",
                    items: {
                      type: "object",
                      properties: {
                        step_type: {
                          type: "string",
                          enum: ["create_test_case", "create_automation", "execute_automation", "auto_heal"],
                          description: "Type of step: create_test_case (generate manual test cases), create_automation (create no-code automation script), execute_automation (run the automation via agent), auto_heal (fix failures and re-run)"
                        },
                        description: { type: "string", description: "What this step does" },
                        config: {
                          type: "object",
                          description: "Step-specific configuration",
                          properties: {
                            test_case_title: { type: "string", description: "Title for the test case" },
                            base_url: { type: "string", description: "Base URL for automation" },
                            automation_steps: {
                              type: "array",
                              description: "Playwright automation steps extracted from the instruction. Each step has a type (navigate, fill, click, etc.), a selector (CSS selector or description), a value (text to type), and a description.",
                              items: {
                                type: "object",
                                properties: {
                                  type: { type: "string", description: "Action type: navigate, fill, click, type, assert_visible, assert_text, select, hover, wait, screenshot, etc." },
                                  selector: { type: "string", description: "CSS selector or element description for the target element" },
                                  value: { type: "string", description: "Value to type/fill or URL to navigate to" },
                                  description: { type: "string", description: "Human-readable description of this step" }
                                },
                                required: ["type", "description"]
                              }
                            }
                          },
                          additionalProperties: true
                        }
                      },
                      required: ["step_type", "description"]
                    }
                  },
                  confidence: { type: "number", minimum: 0, maximum: 1, description: "How confident the parse is (0-1)" },
                  approval_required: { type: "boolean", description: "Whether this should require human approval" },
                  risk_level: { type: "string", enum: ["low", "medium", "high"], description: "Risk level of this instruction" },
                  summary: { type: "string", description: "A short summary of what was parsed" },
                },
                required: ["intent", "target_agents", "confidence", "risk_level", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_instruction" } },
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Azure OpenAI error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Azure OpenAI error: ${response.status} - ${errText}`);
    }

    const aiResult = await response.json();
    console.log("Azure OpenAI response:", JSON.stringify(aiResult));

    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log("Parsed instruction:", JSON.stringify(parsed));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("instruction-parser error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});