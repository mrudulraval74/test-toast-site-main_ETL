import { corsHeaders } from './utils/cors.ts';
import { getSupabaseAdmin } from './utils/supabase.ts';
import { handleJobPoll, handleJobStart, handleJobResult, handleArtifactUpload, handleGetJob } from './handlers/jobs.ts';
import {
    handleGetMetadata,
    handleTestConnection,
    handleConnectionsList,
    handleConnectionSave,
    handleConnectionUpdate,
    handleConnectionDelete,
    handleQueryPreview
} from './handlers/connections.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(req.url);
    const path = url.pathname.replace(/^(?:\/functions\/v1)?\/etl-api/, '') || '/';

    try {
        const supabase = getSupabaseAdmin();

        // ETL Comparison - Create job for agent
        if (path === '/compare/run' && req.method === 'POST') {
            const body = await req.json();
            const compareId = crypto.randomUUID();
            const jobId = crypto.randomUUID();

            console.log('Creating ETL comparison job:', jobId);

            try {
                // Create job in queue for agent to pick up
                const { error: jobError } = await supabase.from('agent_job_queue').insert({
                    id: jobId,
                    project_id: body.projectId,
                    job_type: 'etl_comparison',
                    status: 'pending',
                    payload: {
                        compareId,
                        sourceConnection: body.sourceConnection,
                        targetConnection: body.targetConnection,
                        sourceQuery: body.sourceQuery,
                        targetQuery: body.targetQuery,
                        keyColumns: body.keyColumns,
                        sourceConnectionId: body.sourceConnectionId,
                        targetConnectionId: body.targetConnectionId,
                    },
                });

                if (jobError) throw jobError;

                // Create initial report entry
                await supabase.from('reports').insert({
                    compare_id: compareId,
                    job_id: jobId,
                    status: 'pending',
                    progress: 0,
                    source_connection_id: body.sourceConnectionId,
                    target_connection_id: body.targetConnectionId,
                    source_query: body.sourceQuery,
                    target_query: body.targetQuery,
                });

                console.log('Job created successfully:', jobId);

                return new Response(
                    JSON.stringify({
                        success: true,
                        compareId,
                        jobId,
                        message: 'Comparison job created. Agent will process it shortly.',
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            } catch (error) {
                console.error('Failed to create job:', error);

                return new Response(
                    JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : 'Failed to create comparison job',
                    }),
                    {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }
                );
            }
        }

        // Agent Heartbeat
        if (path === '/heartbeat' && req.method === 'POST') {
            const apiKey = req.headers.get('x-agent-key');
            const body = await req.json();

            console.log('[Heartbeat] Received from agent');

            // Update agent heartbeat in database
            const { error } = await supabase
                .from('self_hosted_agents')
                .update({
                    last_heartbeat: new Date().toISOString(),
                    running_jobs: body.active_jobs || 0,
                    status: (body.active_jobs || 0) > 0 ? 'busy' : 'online',
                    config: body.system_info || {},
                })
                .eq('api_token_hash', apiKey);

            if (error) {
                console.error('[Heartbeat] Failed to update:', error);
            }

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Agent Polling/Management
        if (path === '/jobs/poll') return await handleJobPoll(req);
        const jobActionMatch = path.match(/^\/jobs\/([^/]+)\/(start|result|artifacts)$/);
        if (jobActionMatch) {
            const [, jobId, action] = jobActionMatch;
            if (action === 'start') return await handleJobStart(req, jobId);
            if (action === 'result') return await handleJobResult(req, jobId);
            if (action === 'artifacts') return await handleArtifactUpload(req, jobId);
        }

        // Connections
        if (path === '/connections' && req.method === 'GET') return await handleConnectionsList(req);
        if (path === '/connections/save' && req.method === 'POST') return await handleConnectionSave(req);
        if (path === '/connections/test' && req.method === 'POST') return await handleTestConnection(req);

        const connectionUpdateMatch = path.match(/^\/connections\/([^/]+)$/);
        if (connectionUpdateMatch && req.method === 'PUT') return await handleConnectionUpdate(req, connectionUpdateMatch[1]);
        if (connectionUpdateMatch && req.method === 'DELETE') return await handleConnectionDelete(req, connectionUpdateMatch[1]);

        const metadataMatch = path.match(/^\/connections\/([^/]+)\/metadata$/);
        if (metadataMatch && req.method === 'POST') return await handleGetMetadata(req, metadataMatch[1]);

        // Queries
        if (path === '/queries/saved' && req.method === 'GET') {
            const connectionId = url.searchParams.get('connectionId');
            let query = supabase.from('saved_queries').select('*').order('name', { ascending: true });
            if (connectionId) query = query.eq('connection_id', connectionId);
            const { data, error } = await query;
            if (error) throw error;
            return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (path === '/queries/saved' && req.method === 'POST') {
            const body = await req.json();
            const { data, error } = await supabase.from('saved_queries').insert(body).select().single();
            if (error) throw error;
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (path.match(/^\/queries\/saved\/[\w-]+$/) && req.method === 'DELETE') {
            const id = path.split('/').pop();
            const { error } = await supabase.from('saved_queries').delete().eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (path === '/queries/preview' && req.method === 'POST') return await handleQueryPreview(req);

        // Reports
        if (path === '/reports' && req.method === 'GET') {
            const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return new Response(JSON.stringify({ reports: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (path.match(/^\/reports\/[\w-]+$/) && req.method === 'DELETE') {
            const id = path.split('/').pop();
            const { error } = await supabase.from('reports').delete().eq('compare_id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Agents (legacy support)
        if (path === '/agents' && req.method === 'GET') {
            const { data, error } = await supabase
                .from('self_hosted_agents')
                .select('id, agent_name, status, last_heartbeat, capacity, running_jobs')
                .eq('status', 'online')
                .order('agent_name', { ascending: true });
            if (error) throw error;
            return new Response(JSON.stringify({ agents: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Job Details
        if (path === '/jobs/poll' && req.method === 'GET') {
            return handleJobPoll(req);
        }

        const jobMatch = path.match(/^\/jobs\/([a-zA-Z0-9-]+)$/);
        if (jobMatch && req.method === 'GET') {
            return handleGetJob(req, jobMatch[1]);
        }

        // AI Chat (dummy endpoint)
        if (path === '/ai/chat' && req.method === 'POST') {
            const body = await req.json();
            return new Response(JSON.stringify({
                success: true,
                response: `Analysis for ${body.context}: Initializing deeper inspection of your data structure.`,
                suggestions: ["Explain results", "Suggest optimizations", "Show sample data"]
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // AI Suggestions
        if (path === '/ai/suggestions' && (req.method === 'POST' || req.method === 'GET')) {
            const suggestions = ["Compare schema structures", "Analyze data quality", "Generate sample queries"];
            if (path.includes('context=connections')) {
                suggestions.push("Check source reachability", "Verify credential permissions");
            }
            return new Response(JSON.stringify({
                success: true,
                suggestions
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers: corsHeaders });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
    }
});
