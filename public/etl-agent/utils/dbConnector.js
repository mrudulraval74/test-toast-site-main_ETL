const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');
const sql = require('mssql');

// Execute query based on database type
async function executeQuery(config, query) {
    if (config.type === 'postgresql') {
        return await executePostgreSQLQuery(config, query);
    } else if (config.type === 'mysql') {
        return await executeMySQLQuery(config, query);
    } else if (config.type === 'mssql') {
        return await executeMSSQLQuery(config, query);
    } else {
        throw new Error(`Unsupported database type: ${config.type}`);
    }
}

// PostgreSQL query execution
async function executePostgreSQLQuery(config, query) {
    const client = new PgClient({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        const result = await client.query(query);
        await client.end();

        return {
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields ? result.fields.map(f => f.name) : [],
        };
    } catch (error) {
        if (client) {
            try { await client.end(); } catch (e) { /* ignore */ }
        }
        throw error;
    }
}

// MySQL query execution
async function executeMySQLQuery(config, query) {
    const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? {} : undefined,
    });

    try {
        const [rows, fields] = await connection.execute(query);
        await connection.end();

        return {
            rows: Array.isArray(rows) ? rows : [],
            rowCount: Array.isArray(rows) ? rows.length : 0,
            fields: fields ? fields.map(f => f.name) : [],
        };
    } catch (error) {
        if (connection) {
            try { await connection.end(); } catch (e) { /* ignore */ }
        }
        throw error;
    }
}

// MSSQL query execution
async function executeMSSQLQuery(config, query) {
    let server = config.host;
    let instanceName = config.instance;

    // Handle "hostname\instance" format
    if (server && server.includes('\\')) {
        const parts = server.split('\\');
        server = parts[0];
        instanceName = parts[1];
    }

    const mssqlConfig = {
        server: server,
        database: config.database,
        options: {
            encrypt: config.ssl || false,
            trustServerCertificate: true,
            instanceName: instanceName,
        },
    };

    if (config.trusted) {
        try {
            require.resolve('msnodesqlv8');
            mssqlConfig.driver = 'msnodesqlv8';
            mssqlConfig.options.trustedConnection = true;
        } catch (e) {
            throw new Error("Trusted Connection (Windows Auth) requires the 'msnodesqlv8' driver. Please install it manually using 'npm install msnodesqlv8' (requires build tools) or use SQL Authentication (Username/Password).");
        }
    } else {
        mssqlConfig.user = config.username;
        mssqlConfig.password = config.password;
    }

    // Only add port if NO instance name is provided, or if it's explicitly non-default? 
    // Actually, usually if instance is present, we omit port to let SQL Browser find it.
    // However, if the user explicitly set a port, we might want to keep it?
    // Let's safe-guard: If instance is present, we generally rely on it.
    // But if 'port' is in config and it's NOT 1433 (default), we might trust it.
    // For now, let's keep it simple: if parsed instance, omit port.
    if (!instanceName && config.port) {
        mssqlConfig.port = parseInt(config.port);
    }

    const pool = new sql.ConnectionPool(mssqlConfig);

    try {
        console.log(`[MSSQL] Connecting to ${server}${instanceName ? '\\' + instanceName : ''}${mssqlConfig.port ? ':' + mssqlConfig.port : ''}, DB: ${config.database}`);
        // console.log('DEBUG Config:', JSON.stringify({ ...mssqlConfig, password: '***' })); 

        await pool.connect();
        const result = await pool.request().query(query);
        await pool.close();

        return {
            rows: result.recordset || [],
            rowCount: result.recordset ? result.recordset.length : 0,
            fields: result.recordset && result.recordset.columns ? Object.keys(result.recordset.columns) : [],
        };
    } catch (error) {
        console.error('[MSSQL] Connection/Query Error:', {
            message: error.message,
            code: error.code,
            originalError: error
        });
        if (pool) {
            try { await pool.close(); } catch (e) { /* ignore */ }
        }
        throw error;
    }

}

// Test database connection
async function testConnection(config) {
    try {
        await executeQuery(config, 'SELECT 1');
        return { success: true };
    } catch (error) {
        console.error('[dbConnector] Connection Test Failed:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

module.exports = {
    executeQuery,
    testConnection,
};
