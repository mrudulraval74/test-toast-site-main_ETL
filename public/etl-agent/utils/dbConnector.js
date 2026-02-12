const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');
const sqlTedious = require('mssql');
let msnodesql = null;

function getMsnodesqlv8Driver() {
    if (msnodesql) return msnodesql;
    msnodesql = require('msnodesqlv8');
    return msnodesql;
}

async function executeWindowsAuthQuery({ server, instanceName, parsedPort, database, ssl }, query) {
    const nativeDriver = getMsnodesqlv8Driver();
    const serverTarget = parsedPort
        ? `${server},${parsedPort}`
        : (instanceName ? `${server}\\${instanceName}` : server);
    const driverCandidates = Array.from(new Set([
        process.env.MSSQL_ODBC_DRIVER,
        'ODBC Driver 18 for SQL Server',
        'ODBC Driver 17 for SQL Server',
        'SQL Server Native Client 11.0',
        'SQL Server',
    ].filter(Boolean)));
    const triedDrivers = [];

    for (const driver of driverCandidates) {
        const connectionString = `Driver={${driver}};Server=${serverTarget};Database=${database};Trusted_Connection=Yes;Encrypt=${ssl ? 'Yes' : 'No'};TrustServerCertificate=Yes;`;
        triedDrivers.push(driver);
        console.log(`[MSSQL] Windows Auth trying ODBC driver: ${driver}`);
        try {
            const rows = await new Promise((resolve, reject) => {
                nativeDriver.query(connectionString, query, (err, data) => {
                    if (err) return reject(err);
                    resolve(Array.isArray(data) ? data : []);
                });
            });
            return {
                rows,
                rowCount: rows.length,
                fields: rows.length > 0 ? Object.keys(rows[0]) : [],
            };
        } catch (error) {
            const msg = String(error?.message || '');
            const isDriverLookupError =
                msg.includes('Data source name not found') ||
                msg.includes('no default driver specified') ||
                msg.includes('IM002');
            if (!isDriverLookupError) {
                throw error;
            }
        }
    }

    throw new Error(`Windows Authentication failed: no supported SQL Server ODBC driver found. Tried: ${triedDrivers.join(', ')}. Install Microsoft ODBC Driver 17 or 18 for SQL Server, then restart agent.`);
}

// Execute query based on database type
async function executeQuery(config, query) {
    if (config.type === 'postgresql') {
        return await executePostgreSQLQuery(config, query);
    } else if (config.type === 'mysql') {
        return await executeMySQLQuery(config, query);
    } else if (config.type === 'mssql' || config.type === 'azuresql') {
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
    const isAzureSql = config.type === 'azuresql';
    const trustedFlag = typeof config.trusted === 'string'
        ? config.trusted.toLowerCase() === 'true'
        : config.trusted === true;
    const isTrustedAuth = isAzureSql ? false : trustedFlag;
    const hasSqlCredentials = Boolean(config.username || config.password);
    const parsedPort = config.port ? parseInt(config.port, 10) : undefined;
    let hasExplicitPort = Number.isInteger(parsedPort) && parsedPort > 0;

    // Handle "hostname\instance" format only when no explicit port is provided.
    // If port is explicitly provided, prefer host:port to avoid routing to the wrong SQL instance.
    if (server && server.includes('\\')) {
        const parts = server.split('\\');
        server = parts[0];
        if (!hasExplicitPort) {
            instanceName = parts[1];
        }
    }

    // Named MSSQL instances often do not listen on fixed 1433.
    // If instance is present and port is default 1433, prefer instance resolution.
    if (!isAzureSql && instanceName && parsedPort === 1433) {
        hasExplicitPort = false;
    }

    if (hasExplicitPort) {
        instanceName = undefined;
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

    if (isTrustedAuth) {
        if (hasSqlCredentials) {
            console.log('[MSSQL] Windows Auth selected; ignoring provided username/password.');
        }
        try {
            require.resolve('msnodesqlv8');
        } catch (e) {
            throw new Error("Windows Auth selected: Trusted Connection requires the 'msnodesqlv8' driver. Please install it manually using 'npm install msnodesqlv8' (requires build tools) or use SQL Authentication (Username/Password).");
        }
        console.log(`[MSSQL] Auth mode: Windows`);
        console.log(`[MSSQL] Connecting to ${server}${instanceName ? '\\' + instanceName : ''}${hasExplicitPort ? ':' + parsedPort : ''}, DB: ${config.database}`);
        return await executeWindowsAuthQuery({
            server,
            instanceName,
            parsedPort: hasExplicitPort ? parsedPort : undefined,
            database: config.database,
            ssl: config.ssl || false,
        }, query);
    }

    if (!config.username || !config.password) {
        throw new Error('SQL Authentication requires both username and password. Enable Trusted Connection for Windows Authentication.');
    }
    mssqlConfig.user = config.username;
    mssqlConfig.password = config.password;
    if (!instanceName && hasExplicitPort) {
        mssqlConfig.port = parsedPort;
    }
    console.log(`[MSSQL] Auth mode: SQL`);
    console.log(`[MSSQL] Connecting to ${server}${instanceName ? '\\' + instanceName : ''}${mssqlConfig.port ? ':' + mssqlConfig.port : ''}, DB: ${config.database}`);

    let pool;
    try {
        // Force SQL-auth path to use the default tedious driver.
        pool = new sqlTedious.ConnectionPool(mssqlConfig);
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

// Fetch metadata for supported databases
async function fetchMetadata(config) {
    if (config.type !== 'mssql' && config.type !== 'azuresql') {
        throw new Error(`Metadata fetch is currently supported only for SQL Server. Received: ${config.type}`);
    }

    const query = `
        SELECT
            s.name AS schema_name,
            o.name AS table_name,
            o.type_desc AS table_type,
            c.name AS column_name,
            ty.name AS data_type,
            c.is_nullable,
            COALESCE((
                SELECT 1
                FROM sys.index_columns ic
                JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                WHERE ic.object_id = o.object_id
                  AND ic.column_id = c.column_id
                  AND i.is_primary_key = 1
            ), 0) AS is_primary
        FROM sys.objects o
        JOIN sys.schemas s ON o.schema_id = s.schema_id
        LEFT JOIN sys.columns c ON o.object_id = c.object_id
        LEFT JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
        ORDER BY s.name, o.name, c.column_id
    `;

    const result = await executeMSSQLQuery(config, query);

    const schemasMap = new Map();
    (result.rows || []).forEach((row) => {
        if (!schemasMap.has(row.schema_name)) {
            schemasMap.set(row.schema_name, { name: row.schema_name, tables: new Map() });
        }
        const schema = schemasMap.get(row.schema_name);
        if (!schema.tables.has(row.table_name)) {
            schema.tables.set(row.table_name, {
                name: row.table_name,
                columns: [],
            });
        }
        if (row.column_name) {
            schema.tables.get(row.table_name).columns.push({
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES' || row.is_nullable === 1 || row.is_nullable === true,
                isPrimaryKey: row.is_primary === 1 || row.is_primary === true,
                tableType: row.table_type === 'VIEW' ? 'view' : 'table',
            });
        }
    });

    return {
        success: true,
        databases: [{
            name: config.database || 'MSSQL_DB',
            schemas: Array.from(schemasMap.values()).map((s) => ({
                name: s.name,
                tables: Array.from(s.tables.values()),
            })),
        }],
    };
}

module.exports = {
    executeQuery,
    testConnection,
    fetchMetadata,
};
