import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import mssql from "npm:mssql";
import { corsHeaders } from '../utils/cors.ts';
import { getSupabaseAdmin, getUserIdFromRequest } from '../utils/supabase.ts';
import { fetchPostgresMetadata, fetchMssqlMetadata, fetchMysqlMetadata, generateMockMetadata } from '../utils/metadata.ts';

function normalizeSqlServerConnectionPayload(payload: any) {
    if (!payload || (payload.type !== 'mssql' && payload.type !== 'azuresql')) {
        return payload;
    }

    const normalized = { ...payload };
    const normalizedInstance = normalized.instance && String(normalized.instance).trim()
        ? String(normalized.instance).trim()
        : undefined;
    const parsedPort = normalized.port ? parseInt(normalized.port, 10) : undefined;

    normalized.instance = normalizedInstance;
    normalized.port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : undefined;

    // For named MSSQL instances, default 1433 is often incorrect (e.g., SQLEXPRESS dynamic ports).
    // If instance is present and port is unchanged default, prefer instance resolution.
    if (normalized.type === 'mssql' && normalized.instance && normalized.port === 1433) {
        normalized.port = undefined;
    }

    if (normalized.type === 'azuresql') {
        normalized.trusted = false;
    }

    if (normalized.trusted === true) {
        normalized.username = undefined;
        normalized.password = undefined;
    }

    return normalized;
}

export async function handleGetMetadata(req: Request, connectionId: string): Promise<Response> {
    const supabase = getSupabaseAdmin();
    const { data: conn, error: connError } = await supabase.from('connections').select('*').eq('id', connectionId).single();
    if (connError || !conn) {
        console.error('Connection not found:', connError);
        throw new Error('Connection not found');
    }

    try {
        let metadata;
        if (conn.type === 'postgresql' || conn.type === 'redshift') {
            console.log(`[Metadata Fetch] Using Postgres fetcher for ${conn.type}`);
            metadata = await fetchPostgresMetadata(conn);
        } else if (conn.type === 'mssql' || conn.type === 'azuresql') {
            console.log(`[Metadata Fetch] Using MSSQL fetcher for ${conn.type}`);
            metadata = await fetchMssqlMetadata(conn);
        } else if (conn.type === 'mysql' || conn.type === 'mariadb') {
            console.log(`[Metadata Fetch] Using MySQL fetcher for ${conn.type}`);
            metadata = await fetchMysqlMetadata(conn);
        } else if (conn.type === 'mock' || conn.type === 'demo') {
            console.log(`[Metadata Fetch] Using mock data for demo connection`);
            metadata = generateMockMetadata(conn);
        } else {
            throw new Error(`Real-time metadata fetching is not yet implemented for ${conn.type}.`);
        }

        console.log(`[Metadata Fetch] SUCCESS - Retrieved ${metadata.databases?.[0]?.schemas?.length || 0} schemas`);
        return new Response(JSON.stringify(metadata), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Metadata Fetch] Direct fetch failed for ${conn.type}:`, errorMessage);
        return new Response(JSON.stringify({
            error: `Failed to fetch metadata: ${errorMessage}`,
            success: false
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

export async function handleTestConnection(req: Request): Promise<Response> {
    const rawBody = await req.json();
    const body = normalizeSqlServerConnectionPayload(rawBody);
    const { type, host, username, database, trusted, filePath, agentId } = body;

    console.log(`Connection test request for ${type}:`, body);

    if (!type) {
        return new Response(JSON.stringify({ error: 'Missing database type' }), { status: 400, headers: corsHeaders });
    }

    if (type === 'azuresql' && rawBody?.trusted) {
        return new Response(JSON.stringify({
            error: 'Windows Authentication is not supported for Azure SQL. Use SQL authentication.'
        }), { status: 400, headers: corsHeaders });
    }

    if (type === 'mssql' && rawBody?.trusted && (rawBody?.username || rawBody?.password)) {
        return new Response(JSON.stringify({
            error: 'Select either Windows Authentication or SQL Authentication, not both.'
        }), { status: 400, headers: corsHeaders });
    }

    if ((type === 'mssql' || type === 'azuresql') && !trusted && (!username || !body.password)) {
        return new Response(JSON.stringify({
            error: 'Username and password are required when Windows Authentication is off.'
        }), { status: 400, headers: corsHeaders });
    }

    // If agentId is provided, create a job for the agent
    if (agentId) {
        const createdBy = await getUserIdFromRequest(req);
        if (!createdBy) {
            console.error('Unauthorized: No user ID resolved from request for connection test');
            return new Response(JSON.stringify({ error: 'Unauthorized: Missing user context' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        console.log(`Initiating connection test job for user ${createdBy}`);

        console.log(`Creating test_connection job for agent ${agentId}`);
        const supabase = getSupabaseAdmin();
        const jobId = crypto.randomUUID();

        // Fetch the agent's project_id so the agent can pick it up.
        const { data: agent, error: agentError } = await supabase.from('self_hosted_agents').select('project_id').eq('id', agentId).single();
        if (agentError || !agent) {
            return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404, headers: corsHeaders });
        }

        const { error: insertError } = await supabase.from('agent_job_queue').insert({
            id: jobId,
            project_id: agent.project_id,
            created_by: createdBy,
            agent_id: agentId,
            job_type: 'test_connection',
            status: 'pending',
            base_url: body.base_url ?? body.baseUrl ?? 'N/A',
            steps: [],
            run_id: `CONNTEST-${jobId}`,
            payload: { connection: body }
        });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({ success: true, jobId, message: 'Test initiated via agent' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (type === 'sqlite') {
        if (!filePath && !database) {
            return new Response(JSON.stringify({ error: 'Missing SQLite file path or database name' }), { status: 400, headers: corsHeaders });
        }
    } else {
        // For most others, host and database are required
        if (!host || !database) {
            return new Response(JSON.stringify({ error: `Missing required fields (host, database) for ${type}` }), { status: 400, headers: corsHeaders });
        }
        // Username is required except for Trusted MSSQL
        if (!username && !(type === 'mssql' && trusted)) {
            console.log(`Validation failed: Missing username for ${type} (trusted: ${trusted})`);
            return new Response(JSON.stringify({ error: `Missing username for ${type}` }), { status: 400, headers: corsHeaders });
        }
    }

    if (body.type === 'postgresql' || body.type === 'redshift') {
        try {
            const client = new Client({
                user: body.username,
                database: body.database,
                hostname: body.host,
                port: body.port || 5432,
                password: body.password,
            });
            await client.connect();
            await client.queryArray(`SELECT 1`);
            await client.end();
            return new Response(JSON.stringify({ success: true, message: 'Connection successful!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (error) {
            return new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 500, headers: corsHeaders });
        }
    }

    if (body.type === 'mssql' || body.type === 'azuresql') {
        try {
            const config = {
                server: body.host,
                database: body.database,
                user: body.username,
                password: body.password,
                port: body.port ? parseInt(body.port) : 1433,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    connectTimeout: 5000
                }
            };
            const pool = await mssql.connect(config);
            await pool.request().query('SELECT 1');
            await pool.close();
            return new Response(JSON.stringify({ success: true, message: 'Connection successful!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (error) {
            return new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 500, headers: corsHeaders });
        }
    }

    return new Response(JSON.stringify({ error: `Connection testing not implemented for ${type}` }), { status: 501, headers: corsHeaders });
}

export async function handleConnectionsList(req: Request): Promise<Response> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('connections').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleConnectionSave(req: Request): Promise<Response> {
    const supabase = getSupabaseAdmin();
    const rawBody = await req.json();
    const body = normalizeSqlServerConnectionPayload(rawBody);
    delete body.encrypt;
    const { data, error } = await supabase.from('connections').insert(body).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleConnectionUpdate(req: Request, connectionId: string): Promise<Response> {
    const supabase = getSupabaseAdmin();
    const rawBody = await req.json();
    const body = normalizeSqlServerConnectionPayload(rawBody);
    delete body.encrypt;
    const { data, error } = await supabase.from('connections').update(body).eq('id', connectionId).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleConnectionDelete(req: Request, connectionId: string): Promise<Response> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('connections').delete().eq('id', connectionId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
export async function handleQueryPreview(req: Request): Promise<Response> {
    const body = await req.json();
    const { connectionId, sql, limit = 100 } = body;
    const supabase = getSupabaseAdmin();

    const { data: conn, error: connError } = await supabase.from('connections').select('*').eq('id', connectionId).single();
    if (connError || !conn) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), { status: 404, headers: corsHeaders });
    }

    try {
        let results;
        if (conn.type === 'postgresql' || conn.type === 'redshift') {
            const client = new Client({
                user: conn.username,
                database: conn.database,
                hostname: conn.host,
                port: conn.port || 5432,
                password: conn.password,
            });
            await client.connect();
            try {
                const querySql = limit ? `${sql} LIMIT ${limit}` : sql;
                const result = await client.queryObject(querySql);
                results = {
                    columns: result.columns,
                    rows: result.rows
                };
            } finally {
                await client.end();
            }
        } else if (conn.type === 'mssql' || conn.type === 'azuresql') {
            const config = {
                server: conn.host,
                database: conn.database,
                user: conn.username,
                password: conn.password,
                port: conn.port ? parseInt(conn.port) : 1433,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    connectTimeout: 5000
                }
            };
            const pool = await mssql.connect(config);
            try {
                const querySql = limit ? `SELECT TOP ${limit} * FROM (${sql}) AS sub` : sql;
                const result = await pool.request().query(querySql);
                results = {
                    columns: result.recordset.columns ? Object.keys(result.recordset.columns) : [],
                    rows: result.recordset
                };
            } finally {
                await pool.close();
            }
        } else if (conn.type === 'mock' || conn.type === 'demo') {
            results = {
                columns: ['id', 'name', 'status'],
                rows: [
                    { id: 1, name: 'Sample A', status: 'Active' },
                    { id: 2, name: 'Sample B', status: 'Inactive' }
                ]
            };
        } else {
            throw new Error(`Direct query preview not implemented for ${conn.type}`);
        }

        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
    }
}
