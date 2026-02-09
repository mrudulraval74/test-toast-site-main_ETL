import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Helper to create Supabase client with service role for admin operations
export function getSupabaseAdmin() {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
}

// Validate agent API key and return agent details
export async function validateAgent(apiKey: string | null): Promise<{ valid: boolean; agent?: any; error?: string }> {
    if (!apiKey) {
        return { valid: false, error: 'Missing agent API key' };
    }

    const supabase = getSupabaseAdmin();

    const { data: agent, error } = await supabase
        .from('self_hosted_agents')
        .select('*')
        .eq('api_token_hash', apiKey)
        .single();

    if (error || !agent) {
        const debugInfo = `Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'null'}, DB Error: ${error ? JSON.stringify(error) : 'None'}, Agent Found: ${!!agent}, URL: ${!!Deno.env.get('SUPABASE_URL')}, Key: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
        console.error('Agent validation failed:', debugInfo);
        return { valid: false, error: `Auth Failed: ${debugInfo}` };
    }

    return { valid: true, agent };
}
