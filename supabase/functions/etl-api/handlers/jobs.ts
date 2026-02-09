import { corsHeaders } from '../utils/cors.ts';
import { getSupabaseAdmin, validateAgent } from '../utils/supabase.ts';

export async function handleJobPoll(req: Request): Promise<Response> {
    const apiKey = req.headers.get('x-agent-key');
    const validation = await validateAgent(apiKey);

    if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), { status: 401, headers: corsHeaders });
    }

    const agent = validation.agent!;
    const supabase = getSupabaseAdmin();

    const { data: jobs, error } = await supabase
        .from('agent_job_queue')
        .select('*')
        .eq('project_id', agent.project_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

    return new Response(JSON.stringify({ success: true, jobs: jobs || [], agent_id: agent.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleGetJob(req: Request, jobId: string): Promise<Response> {
    const supabase = getSupabaseAdmin();
    // Validate user auth if needed, but for now we assume RLS or open access for job status
    // ideally check req.headers.get('Authorization')

    const { data: job, error } = await supabase
        .from('agent_job_queue')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify(job), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleJobStart(req: Request, jobId: string): Promise<Response> {
    const apiKey = req.headers.get('x-agent-key');
    const validation = await validateAgent(apiKey);

    if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), { status: 401, headers: corsHeaders });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('agent_job_queue')
        .update({ status: 'running', started_at: new Date().toISOString(), agent_id: validation.agent.id })
        .eq('id', jobId);

    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleJobResult(req: Request, jobId: string): Promise<Response> {
    const apiKey = req.headers.get('x-agent-key');
    const validation = await validateAgent(apiKey);

    if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const supabase = getSupabaseAdmin();

    console.log(`[Job Result] Receiving result for job ${jobId}, status: ${body.status}`);

    // Update job record
    const { error: jobError } = await supabase
        .from('agent_job_queue')
        .update({
            status: body.status,
            completed_at: new Date().toISOString(),
            result: body.result_data,
            error_log: body.error_message
        })
        .eq('id', jobId);

    if (jobError) throw jobError;

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleArtifactUpload(req: Request, jobId: string): Promise<Response> {
    const apiKey = req.headers.get('x-agent-key');
    const validation = await validateAgent(apiKey);
    if (!validation.valid) return new Response(JSON.stringify({ error: validation.error }), { status: 401, headers: corsHeaders });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file) return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: corsHeaders });

    const supabase = getSupabaseAdmin();
    const storagePath = `etl-results/${jobId}/${path}`;

    const { error: uploadError } = await supabase.storage
        .from('artifacts')
        .upload(storagePath, file, { contentType: file.type, upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('artifacts').getPublicUrl(storagePath);

    return new Response(JSON.stringify({ success: true, path: publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
