
import 'dotenv/config';
import axios from 'axios';
import { Client } from 'pg';
import mysql from 'mysql2/promise';
import mssql from 'mssql';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://qfjeicrvelgmyyecvlxo.supabase.co/functions/v1/etl-api';
const AGENT_KEY = process.env.AGENT_KEY;
const AGENT_ID = process.env.AGENT_ID || 'local-agent-1';

if (!AGENT_KEY) {
    console.error('Error: AGENT_KEY environment variable is required');
    process.exit(1);
}

console.log(`Starting ETL Agent ${AGENT_ID}...`);
console.log(`API URL: ${API_BASE_URL}`);

// Polling Interval (ms)
const POLL_INTERVAL = 5000;

async function pollJobs() {
    try {
        const response = await axios.get(`${API_BASE_URL}/jobs/poll`, {
            headers: {
                'x-agent-key': AGENT_KEY,
                'Content-Type': 'application/json'
            }
        });

        const { success, jobs } = response.data;

        if (success && jobs && jobs.length > 0) {
            console.log(`Found ${jobs.length} jobs`);
            for (const job of jobs) {
                await processJob(job);
            }
        }
    } catch (error: any) {
        if (error.response) {
            console.error(`Poll error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`Poll error: ${error.message}`);
        }
    } finally {
        setTimeout(pollJobs, POLL_INTERVAL);
    }
}

async function processJob(job: any) {
    console.log(`Processing job ${job.id} (${job.job_type})`);

    try {
        // Mark job as started
        await axios.post(`${API_BASE_URL}/jobs/${job.id}/start`, {}, {
            headers: { 'x-agent-key': AGENT_KEY }
        });

        let result = null;

        if (job.job_type === 'test_connection') {
            result = await handleTestConnection(job.payload.connection);
        } else if (job.job_type === 'etl_comparison') {
            // Basic implementation for comparison - strictly for connectivity check first
            // Full implementation would require significant logic for data diffing
            result = { success: true, message: "ETL Comparison Agent Logic Pending Implementation" };
        } else {
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // Report success
        await axios.post(`${API_BASE_URL}/jobs/${job.id}/result`, {
            status: 'completed',
            result_data: result
        }, {
            headers: { 'x-agent-key': AGENT_KEY }
        });
        console.log(`Job ${job.id} completed successfully`);

    } catch (error: any) {
        console.error(`Job ${job.id} failed:`, error.message);

        // Report failure
        await axios.post(`${API_BASE_URL}/jobs/${job.id}/result`, {
            status: 'failed',
            error_message: error.message
        }, {
            headers: { 'x-agent-key': AGENT_KEY }
        });
    }
}

async function handleTestConnection(config: any) {
    console.log(`Testing connection for ${config.type} at ${config.host}`);

    if (config.type === 'postgresql') {
        const client = new Client({
            user: config.username,
            host: config.host,
            database: config.database,
            password: config.password,
            port: parseInt(config.port) || 5432,
        });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return { success: true, message: 'Connection successful' };
    }
    else if (config.type === 'mysql' || config.type === 'mariadb') {
        const connection = await mysql.createConnection({
            host: config.host,
            user: config.username,
            password: config.password,
            database: config.database,
            port: parseInt(config.port) || 3306
        });
        await connection.execute('SELECT 1');
        await connection.end();
        return { success: true, message: 'Connection successful' };
    }
    else if (config.type === 'mssql') {
        try {
            console.log(`[MSSQL] Attempting connection to ${config.host} (Port: ${parseInt(config.port) || 1433}) User: ${config.username}`);
            await mssql.connect({
                user: config.username,
                password: config.password,
                server: config.host,
                database: config.database,
                port: parseInt(config.port) || 1433,
                options: {
                    encrypt: true,
                    trustServerCertificate: true // For local dev usually
                }
            });
            await mssql.query('SELECT 1');
            await mssql.close();
            return { success: true, message: 'Connection successful' };
        } catch (err: any) {
            console.error('[MSSQL] Connection Error Detailed:', err);
            // Re-throw to be caught by processJob
            throw new Error(`MSSQL Connection Failed: ${err.message} (Code: ${err.code})`);
        }
    }

    throw new Error(`Unsupported database type: ${config.type}`);
}

// Start polling
pollJobs();
