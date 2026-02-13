const axios = require('axios');
const { executeComparison } = require('./utils/compareEngine');
const { testConnection, fetchMetadata, getWindowsAuthCapabilities } = require('./utils/dbConnector');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:54321/functions/v1/etl-api';
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000');
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '60000'); // 60 seconds

if (!AGENT_API_KEY) {
    console.error('ERROR: AGENT_API_KEY is required in .env file');
    process.exit(1);
}

console.log(`ETL Agent starting...`);
console.log(`---------------------------------------------------`);
console.log(`---      PATCHED AGENT LOADED (v2)              ---`);
console.log(`---------------------------------------------------`);
console.log(`Node Runtime: ${process.version}`);
console.log(`API Base URL: ${API_BASE_URL}`);
console.log(`Poll Interval: ${POLL_INTERVAL}ms`);
console.log(`Heartbeat Interval: ${HEARTBEAT_INTERVAL}ms`);
const windowsAuthCapabilities = getWindowsAuthCapabilities();
console.log(`[MSSQL] Windows auth mode: ${windowsAuthCapabilities.mode}`);
console.log(`[MSSQL] Native driver available: ${windowsAuthCapabilities.nativeAvailable ? 'yes' : 'no'}`);
console.log(`[MSSQL] SQLCMD available: ${windowsAuthCapabilities.sqlcmdAvailable ? 'yes' : 'no'} (${windowsAuthCapabilities.sqlcmdPath})`);
if (!windowsAuthCapabilities.nativeAvailable && !windowsAuthCapabilities.sqlcmdAvailable) {
    console.warn('[MSSQL] Warning: Windows Authentication is not currently available. Install msnodesqlv8 or SQLCMD + ODBC Driver 17/18.');
}

// Agent state
let isProcessing = false;

// Send heartbeat to server
async function sendHeartbeat() {
    try {
        const systemInfo = {
            platform: process.platform,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            agentType: 'etl',
        };

        await axios.post(`${API_BASE_URL}/heartbeat`, {
            current_capacity: isProcessing ? 0 : 1,
            max_capacity: 1,
            active_jobs: isProcessing ? 1 : 0,
            system_info: systemInfo,
        }, {
            headers: { 'x-agent-key': AGENT_API_KEY },
        });

        console.log('[Heartbeat] Sent successfully');
    } catch (error) {
        console.error('[Heartbeat] Failed:', error.message);
    }
}

// Poll for jobs
async function pollForJobs() {
    if (isProcessing) {
        console.log('[Poll] Already processing a job, skipping poll');
        return;
    }

    try {
        const response = await axios.get(`${API_BASE_URL}/jobs/poll`, {
            headers: {
                'x-agent-key': AGENT_API_KEY,
            },
        });

        const { jobs, agent_id } = response.data;

        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            console.log(`[Job] Received job: ${job.id} (${job.job_type})`);
            await processJob(job, agent_id);
        }
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('[Poll] Authentication failed.');
            console.error('Initial Error:', error.response?.data?.error);
        } else {
            console.error('[Poll] Error:', error.message);
        }
    }
}

// Process a job
async function processJob(job, agentId) {
    isProcessing = true;
    const jobId = job.id;

    try {
        // Mark job as started
        await axios.post(`${API_BASE_URL}/jobs/${jobId}/start`, {}, {
            headers: { 'x-agent-key': AGENT_API_KEY },
        });

        console.log(`[Job ${jobId}] Started processing`);

        // Parse job payload
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

        let result;
        if (job.job_type === 'etl_comparison') {
            result = await executeETLComparison(payload);
        } else if (job.job_type === 'test_connection') {
            result = await executeTestConnection(payload);
        } else if (job.job_type === 'fetch_metadata') {
            result = await executeFetchMetadata(payload);
        } else {
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // Submit successful result
        await axios.post(`${API_BASE_URL}/jobs/${jobId}/result`, {
            status: 'completed',
            result_data: result,
        }, {
            headers: { 'x-agent-key': AGENT_API_KEY },
        });

        console.log(`[Job ${jobId}] Completed successfully`);
    } catch (error) {
        console.error(`[Job ${jobId}] Error:`, error.message);

        // Submit error result
        try {
            await axios.post(`${API_BASE_URL}/jobs/${jobId}/result`, {
                status: 'failed',
                error_message: error.message,
            }, {
                headers: { 'x-agent-key': AGENT_API_KEY },
            });
        } catch (submitError) {
            console.error(`[Job ${jobId}] Failed to submit error result:`, submitError.message);
        }
    } finally {
        isProcessing = false;
    }
}

// Execute ETL comparison
async function executeETLComparison(payload) {
    const { sourceConnection, targetConnection, sourceQuery, targetQuery, keyColumns } = payload;

    console.log('[Comparison] Executing ETL comparison...');
    console.log(`[Comparison] Source: ${sourceConnection.type}://${sourceConnection.host}:${sourceConnection.port}/${sourceConnection.database}`);
    console.log(`[Comparison] Target: ${targetConnection.type}://${targetConnection.host}:${targetConnection.port}/${targetConnection.database}`);

    const result = await executeComparison({
        sourceConnection,
        targetConnection,
        sourceQuery,
        targetQuery,
        keyColumns,
    });

    console.log(`[Comparison] Complete - Status: ${result.summary.comparisonStatus}`);
    console.log(`[Comparison] Source rows: ${result.summary.sourceRowCount}, Target rows: ${result.summary.targetRowCount}`);
    console.log(`[Comparison] Matched: ${result.summary.matchedRows}, Mismatched: ${result.summary.mismatchedRows}`);

    return result;
}

// Execute connection test
async function executeTestConnection(payload) {
    const { connection } = payload;

    console.log(`[Test] Testing connection to ${connection.type}://${connection.host}:${connection.port}/${connection.database}`);
    if (connection.type === 'mssql' || connection.type === 'azuresql') {
        console.log('[Test] SQL Server auth payload:', {
            type: connection.type,
            trusted: !!connection.trusted,
            host: connection.host,
            port: connection.port,
            instance: connection.instance,
            database: connection.database,
            usernamePresent: !!connection.username,
            passwordPresent: !!connection.password,
        });
    }

    const result = await testConnection(connection);

    console.log(`[Test] Connection test ${result.success ? 'passed' : 'failed'}`);
    if (!result.success) {
        console.error('---------------------------------------------------');
        console.error('[Test] CONNECTION FAILURE REASON:', result.error);
        console.error('---------------------------------------------------');
    }

    return result;
}

// Execute metadata fetch
async function executeFetchMetadata(payload) {
    const { connection } = payload;

    console.log(`[Metadata] Fetching metadata for ${connection.type}://${connection.host}:${connection.port || ''}/${connection.database}`);
    const result = await fetchMetadata(connection);
    console.log(`[Metadata] Fetched ${result.databases?.length || 0} database(s)`);
    return result;
}

// Start polling
console.log('[Agent] Starting job polling...');
setInterval(pollForJobs, POLL_INTERVAL);

// Start heartbeat
console.log('[Agent] Starting heartbeat...');
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

// Initial poll and heartbeat
pollForJobs();
sendHeartbeat();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Agent] Shutting down gracefully...');
    process.exit(0);
});
