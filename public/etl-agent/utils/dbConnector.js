const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');
const sqlTedious = require('mssql');
const { spawn, spawnSync } = require('child_process');
let msnodesql = null;

function parseBooleanFlag(value) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return undefined;
}

function parseKeyValueConnectionString(connectionString) {
    return String(connectionString || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const idx = part.indexOf('=');
            if (idx === -1) return acc;
            const key = part.slice(0, idx).trim().toLowerCase();
            const value = part.slice(idx + 1).trim();
            if (key) acc[key] = value;
            return acc;
        }, {});
}

function parseSqlServerConnectionString(connectionString, type) {
    const kv = parseKeyValueConnectionString(connectionString);
    const serverValue = kv['server'] || kv['data source'] || kv['addr'] || kv['address'] || kv['network address'];
    const database = kv['database'] || kv['initial catalog'];
    const username = kv['user id'] || kv['uid'] || kv['user'];
    const password = kv['password'] || kv['pwd'];
    const trusted = parseBooleanFlag(kv['trusted_connection'] ?? kv['integrated security']);
    const ssl = parseBooleanFlag(kv['encrypt']);

    let host;
    let instance;
    let port;

    if (serverValue) {
        const trimmed = String(serverValue).trim();
        const hostAndInstance = trimmed.split('\\');
        host = hostAndInstance[0] ? hostAndInstance[0].trim() : undefined;
        instance = hostAndInstance[1] ? hostAndInstance[1].trim() : undefined;

        if (host && host.includes(',')) {
            const parts = host.split(',');
            host = parts[0] ? parts[0].trim() : undefined;
            const parsedPort = parseInt((parts[1] || '').trim(), 10);
            if (Number.isInteger(parsedPort) && parsedPort > 0) {
                port = parsedPort;
            }
        }
    }

    const normalized = {
        type,
        host: host || undefined,
        instance: instance || undefined,
        port,
        database: database || undefined,
        username: username || undefined,
        password: password || undefined,
        ssl: ssl ?? (type === 'azuresql'),
    };

    if (type === 'azuresql') {
        normalized.trusted = false;
    } else {
        normalized.trusted = trusted ?? false;
    }

    return normalized;
}

function parsePostgresConnectionString(connectionString, type) {
    try {
        const normalizedConnStr = String(connectionString).startsWith('postgres://')
            ? String(connectionString).replace(/^postgres:\/\//i, 'postgresql://')
            : String(connectionString);
        const parsed = new URL(normalizedConnStr);
        const parsedPort = parsed.port ? parseInt(parsed.port, 10) : undefined;

        return {
            type,
            host: parsed.hostname || undefined,
            port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5432,
            database: parsed.pathname ? parsed.pathname.replace(/^\//, '') || undefined : undefined,
            username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            schema: parsed.searchParams.get('schema') || 'public',
            ssl: parseBooleanFlag(parsed.searchParams.get('sslmode')) !== false,
        };
    } catch (_error) {
        return null;
    }
}

function normalizeConnectionConfig(config) {
    if (!config || !config.type) return config;

    const normalized = { ...config };
    const type = String(normalized.type).toLowerCase();
    const connectionString = normalized.connectionString || normalized.connection_string;

    if (connectionString) {
        if (type === 'mssql' || type === 'azuresql') {
            Object.assign(normalized, parseSqlServerConnectionString(connectionString, type));
        } else if (type === 'postgresql' || type === 'postgres' || type === 'redshift') {
            const parsed = parsePostgresConnectionString(connectionString, type === 'postgres' ? 'postgresql' : type);
            if (parsed) Object.assign(normalized, parsed);
        }
    }

    delete normalized.connectionString;
    delete normalized.connection_string;
    return normalized;
}

function getWindowsAuthMode() {
    const raw = String(process.env.MSSQL_WINDOWS_AUTH_MODE || 'auto').trim().toLowerCase();
    if (raw === 'native' || raw === 'sqlcmd' || raw === 'auto') return raw;
    return 'auto';
}

function getSqlcmdPath() {
    return process.env.MSSQL_SQLCMD_PATH || 'sqlcmd';
}

function getSqlcmdDelimiter() {
    // sqlcmd accepts only a single-character separator for -s.
    const configured = process.env.MSSQL_SQLCMD_DELIMITER;
    if (!configured) return '\t';
    return String(configured)[0] || '\t';
}

function isMsnodesqlv8Available() {
    try {
        require.resolve('msnodesqlv8');
        return true;
    } catch (_error) {
        return false;
    }
}

function isSqlcmdAvailable() {
    try {
        const result = spawnSync(getSqlcmdPath(), ['-?'], {
            encoding: 'utf8',
            windowsHide: true,
        });
        return Boolean(result.status === 0 || result.stdout || result.stderr);
    } catch (_error) {
        return false;
    }
}

function getWindowsAuthCapabilities() {
    return {
        mode: getWindowsAuthMode(),
        nativeAvailable: isMsnodesqlv8Available(),
        sqlcmdAvailable: isSqlcmdAvailable(),
        sqlcmdPath: getSqlcmdPath(),
    };
}

function getMsnodesqlv8Driver() {
    if (msnodesql) return msnodesql;
    msnodesql = require('msnodesqlv8');
    return msnodesql;
}

function buildMssqlTarget(server, instanceName, parsedPort) {
    if (parsedPort) return `${server},${parsedPort}`;
    if (instanceName) return `${server}\\${instanceName}`;
    return server;
}

function isSeparatorLine(line, delimiter) {
    const tokens = line.split(delimiter).map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every((token) => /^-+$/.test(token));
}

function parseSqlcmdRows(stdout, delimiter) {
    const lines = String(stdout || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== '')
        .filter((line) => !/^\(\d+\s+rows?\s+affected\)$/i.test(line.trim()))
        .filter((line) => !/^Changed database context to/i.test(line.trim()));

    if (lines.length === 0) {
        return { rows: [], rowCount: 0, fields: [] };
    }

    let headerIndex = lines.findIndex((line) => line.includes(delimiter));
    let fields = [];
    if (headerIndex === -1) {
        headerIndex = 0;
        fields = [lines[0].trim()];
    } else {
        fields = lines[headerIndex].split(delimiter).map((v) => v.trim());
    }

    const rows = [];

    for (let i = headerIndex + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (isSeparatorLine(line, delimiter)) continue;
        const values = line.includes(delimiter)
            ? line.split(delimiter).map((v) => v.trim())
            : [line.trim()];
        if (values.length !== fields.length) continue;
        // sqlcmd may repeat headers depending on -h behavior; skip those lines.
        if (values.every((value, idx) => value === fields[idx])) continue;
        const row = {};
        fields.forEach((field, idx) => {
            row[field] = values[idx] === 'NULL' ? null : values[idx];
        });
        rows.push(row);
    }

    return {
        rows,
        rowCount: rows.length,
        fields,
    };
}

function buildWindowsAuthRemediation(extraMessage) {
    const bits = [
        extraMessage,
        "Install Microsoft SQLCMD tools and ensure 'sqlcmd' is in PATH (or set MSSQL_SQLCMD_PATH).",
        "Install Microsoft ODBC Driver 17 or 18 for SQL Server.",
        "Optional fallback: switch to SQL Authentication (username/password).",
    ].filter(Boolean);
    return bits.join(' ');
}

async function executeWindowsAuthQueryNative({ server, instanceName, parsedPort, database, ssl }, query) {
    const nativeDriver = getMsnodesqlv8Driver();
    const serverTarget = buildMssqlTarget(server, instanceName, parsedPort);
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
        console.log(`[MSSQL] Windows Auth trying native ODBC driver: ${driver}`);
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

    throw new Error(`Windows Authentication failed: no supported SQL Server ODBC driver found. Tried: ${triedDrivers.join(', ')}.`);
}

async function executeWindowsAuthQuerySqlcmd({ server, instanceName, parsedPort, database, ssl }, query) {
    const sqlcmdPath = getSqlcmdPath();
    const target = buildMssqlTarget(server, instanceName, parsedPort);
    const delimiter = getSqlcmdDelimiter();
    const args = [
        '-S', target,
        '-d', database,
        '-E',
        '-b',
        '-W',
        // Print headers only once for reliable parsing.
        '-h', '65535',
        '-s', delimiter,
        '-w', '65535',
        '-r', '1',
    ];

    if (ssl) {
        args.push('-N');
        args.push('-C');
    }

    args.push('-Q');
    args.push(`SET NOCOUNT ON; ${query}`);

    console.log(`[MSSQL] Windows Auth trying sqlcmd fallback via ${sqlcmdPath}`);

    return await new Promise((resolve, reject) => {
        const child = spawn(sqlcmdPath, args, {
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            if (error.code === 'ENOENT') {
                return reject(new Error(buildWindowsAuthRemediation(`'${sqlcmdPath}' not found.`)));
            }
            reject(error);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                const shortErr = String(stderr || stdout || 'Unknown SQLCMD error').trim();
                return reject(new Error(buildWindowsAuthRemediation(`SQLCMD failed (exit ${code}): ${shortErr}`)));
            }
            try {
                resolve(parseSqlcmdRows(stdout, delimiter));
            } catch (parseError) {
                reject(new Error(buildWindowsAuthRemediation(`SQLCMD output parse failed: ${parseError.message}`)));
            }
        });
    });
}

async function executeWindowsAuthWithFallback(connection, query) {
    const { server, instanceName, parsedPort, database, ssl } = connection;
    const mode = getWindowsAuthMode();

    if (mode === 'sqlcmd') {
        return executeWindowsAuthQuerySqlcmd({ server, instanceName, parsedPort, database, ssl }, query);
    }

    if (mode === 'native') {
        return executeWindowsAuthQueryNative({ server, instanceName, parsedPort, database, ssl }, query);
    }

    try {
        return await executeWindowsAuthQueryNative({ server, instanceName, parsedPort, database, ssl }, query);
    } catch (nativeError) {
        console.warn(`[MSSQL] Native Windows Auth failed, attempting sqlcmd fallback: ${nativeError.message}`);
        try {
            return await executeWindowsAuthQuerySqlcmd({ server, instanceName, parsedPort, database, ssl }, query);
        } catch (sqlcmdError) {
            throw new Error(buildWindowsAuthRemediation(`Windows Authentication failed on both native and SQLCMD paths. Native error: ${nativeError.message}. SQLCMD error: ${sqlcmdError.message}`));
        }
    }
}

// Execute query based on database type
async function executeQuery(config, query) {
    config = normalizeConnectionConfig(config);
    if (config.type === 'postgresql' || config.type === 'postgres' || config.type === 'redshift') {
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
            fields: result.fields ? result.fields.map((f) => f.name) : [],
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
            fields: fields ? fields.map((f) => f.name) : [],
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
        server,
        database: config.database,
        options: {
            encrypt: config.ssl || false,
            trustServerCertificate: true,
            instanceName,
        },
    };

    if (isTrustedAuth) {
        if (hasSqlCredentials) {
            console.log('[MSSQL] Windows Auth selected; ignoring provided username/password.');
        }
        console.log(`[MSSQL] Auth mode: Windows (${getWindowsAuthMode()})`);
        console.log(`[MSSQL] Connecting to ${server}${instanceName ? '\\' + instanceName : ''}${hasExplicitPort ? ':' + parsedPort : ''}, DB: ${config.database}`);
        return await executeWindowsAuthWithFallback({
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
    console.log('[MSSQL] Auth mode: SQL');
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
            originalError: error,
        });
        if (pool) {
            try { await pool.close(); } catch (e) { /* ignore */ }
        }
        throw error;
    }
}

async function fetchPostgreSQLMetadata(config) {
    const metadataQuery = `
        SELECT
            c.table_schema AS schema_name,
            c.table_name AS table_name,
            CASE WHEN t.table_type = 'VIEW' THEN 'view' ELSE 'table' END AS table_type,
            c.column_name,
            c.data_type,
            c.is_nullable,
            COALESCE((
                SELECT 1
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                    AND tc.table_name = kcu.table_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = c.table_schema
                  AND tc.table_name = c.table_name
                  AND kcu.column_name = c.column_name
                LIMIT 1
            ), 0) AS is_primary
        FROM information_schema.columns c
        JOIN information_schema.tables t
            ON c.table_schema = t.table_schema
            AND c.table_name = t.table_name
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND t.table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `;

    const result = await executePostgreSQLQuery(config, metadataQuery);
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
                nullable: row.is_nullable === 'YES' || row.is_nullable === true,
                isPrimaryKey: row.is_primary === 1 || row.is_primary === true,
                tableType: row.table_type === 'view' ? 'view' : 'table',
            });
        }
    });

    return {
        success: true,
        databases: [{
            name: config.database || 'POSTGRES_DB',
            schemas: Array.from(schemasMap.values()).map((s) => ({
                name: s.name,
                tables: Array.from(s.tables.values()),
            })),
        }],
    };
}

// Test database connection
async function testConnection(config) {
    try {
        config = normalizeConnectionConfig(config);
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
    config = normalizeConnectionConfig(config);
    if (config.type === 'postgresql' || config.type === 'postgres' || config.type === 'redshift') {
        return await fetchPostgreSQLMetadata(config);
    }

    if (config.type !== 'mssql' && config.type !== 'azuresql') {
        throw new Error(`Metadata fetch is currently supported for SQL Server and PostgreSQL. Received: ${config.type}`);
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
                nullable: row.is_nullable === 'YES' || row.is_nullable === '1' || row.is_nullable === 1 || row.is_nullable === true,
                isPrimaryKey: row.is_primary === '1' || row.is_primary === 1 || row.is_primary === true,
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
    getWindowsAuthCapabilities,
};
