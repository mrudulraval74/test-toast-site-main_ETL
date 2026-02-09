import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import mssql from "npm:mssql";
import mysql from "npm:mysql2/promise";

export async function fetchPostgresMetadata(conn: any) {
    const client = new Client({
        user: conn.username,
        database: conn.database,
        hostname: conn.host,
        port: conn.port || 5432,
        password: conn.password,
    });

    await client.connect();
    try {
        // Use a single query for all metadata to improve performance (O(1) query instead of O(N*M))
        const query = `
            SELECT 
                t.table_schema as schema_name,
                t.table_name,
                t.table_type,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                EXISTS (
                    SELECT 1 FROM information_schema.key_column_usage kcu
                    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
                    WHERE kcu.table_schema = c.table_schema AND kcu.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY'
                ) as is_primary
            FROM information_schema.tables t
            LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
            WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY t.table_schema, t.table_name, c.ordinal_position
        `;

        const result = await client.queryObject<{
            schema_name: string,
            table_name: string,
            table_type: string,
            column_name: string,
            data_type: string,
            is_nullable: string,
            column_default: string,
            is_primary: boolean
        }>(query);

        const schemasMap = new Map();
        for (const row of result.rows) {
            if (!schemasMap.has(row.schema_name)) {
                schemasMap.set(row.schema_name, { name: row.schema_name, tables: new Map() });
            }
            const schema = schemasMap.get(row.schema_name);
            if (!schema.tables.has(row.table_name)) {
                schema.tables.set(row.table_name, {
                    name: row.table_name,
                    schema: row.schema_name,
                    type: row.table_type === 'VIEW' ? 'view' : 'table',
                    columns: []
                });
            }
            if (row.column_name) {
                schema.tables.get(row.table_name).columns.push({
                    name: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES',
                    isPrimaryKey: row.is_primary,
                    defaultValue: row.column_default
                });
            }
        }

        const schemas = Array.from(schemasMap.values()).map(s => ({
            name: s.name,
            tables: Array.from(s.tables.values())
        }));

        return { databases: [{ name: conn.config.database, schemas }] };
    } finally {
        await client.end();
    }
}

export async function fetchMssqlMetadata(conn: any) {
    // For MSSQL, the server should be formatted precisely (host\instance)
    const server = conn.instance && conn.instance.trim()
        ? `${conn.host}\\${conn.instance.trim()}`
        : conn.host;

    const config = {
        server: server,
        database: conn.database || conn.initialDatabase,
        user: conn.username,
        password: conn.password,
        port: conn.port ? parseInt(conn.port) : 1433,
        options: {
            encrypt: true,
            trustServerCertificate: true,
            connectTimeout: 5000,
        }
    };

    const pool = await mssql.connect(config);
    try {
        const query = `
            SELECT 
                s.name AS schema_name,
                o.name AS table_name,
                o.type_desc AS table_type,
                c.name AS column_name,
                ty.name AS data_type,
                c.is_nullable,
                COALESCE((SELECT 1 FROM sys.index_columns ic 
                 JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                 WHERE ic.object_id = o.object_id AND ic.column_id = c.column_id AND i.is_primary_key = 1), 0) as is_primary
            FROM sys.objects o
            JOIN sys.schemas s ON o.schema_id = s.schema_id
            LEFT JOIN sys.columns c ON o.object_id = c.object_id
            LEFT JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
            ORDER BY s.name, o.name, c.column_id
        `;
        const result = await pool.request().query(query);

        const schemasMap = new Map();
        result.recordset.forEach((row: any) => {
            if (!schemasMap.has(row.schema_name)) {
                schemasMap.set(row.schema_name, { name: row.schema_name, tables: new Map() });
            }
            const schema = schemasMap.get(row.schema_name);
            if (!schema.tables.has(row.table_name)) {
                schema.tables.set(row.table_name, { name: row.table_name, columns: [] });
            }
            if (row.column_name) {
                schema.tables.get(row.table_name).columns.push({
                    name: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES' || row.is_nullable === 1,
                    isPrimaryKey: row.is_primary === 1,
                    tableType: row.table_type === 'VIEW' ? 'view' : 'table'
                });
            }
        });

        const schemas = Array.from(schemasMap.values()).map(s => ({
            name: s.name,
            tables: Array.from(s.tables.values())
        }));

        return {
            success: true,
            databases: [{ name: (conn.database || conn.initialDatabase || 'MSSQL_DB'), schemas }]
        };
    } finally {
        await pool.close();
    }
}

export async function fetchMysqlMetadata(conn: any) {
    const connection = await mysql.createConnection({
        host: conn.host,
        user: conn.username,
        password: conn.password,
        database: conn.database,
        port: conn.port || 3306,
        connectTimeout: 5000
    });

    try {
        const [rows]: [any[], any] = await connection.execute(`
            SELECT 
                t.TABLE_SCHEMA as schema_name,
                t.TABLE_NAME as table_name,
                t.TABLE_TYPE as table_type,
                c.COLUMN_NAME as column_name,
                c.DATA_TYPE as data_type,
                c.IS_NULLABLE as is_nullable,
                c.COLUMN_KEY as column_key,
                c.COLUMN_DEFAULT as column_default
            FROM information_schema.tables t
            LEFT JOIN information_schema.columns c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
            WHERE t.TABLE_SCHEMA = ?
            ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
        `, [conn.config.database]);

        const schemasMap = new Map();
        rows.forEach((row: any) => {
            if (!schemasMap.has(row.schema_name)) {
                schemasMap.set(row.schema_name, { name: row.schema_name, tables: new Map() });
            }
            const schema = schemasMap.get(row.schema_name);
            if (!schema.tables.has(row.table_name)) {
                schema.tables.set(row.table_name, {
                    name: row.table_name,
                    schema: row.schema_name,
                    type: row.table_type === 'VIEW' ? 'view' : 'table',
                    columns: []
                });
            }
            if (row.column_name) {
                schema.tables.get(row.table_name).columns.push({
                    name: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES',
                    isPrimaryKey: row.column_key === 'PRI',
                    defaultValue: row.column_default
                });
            }
        });

        const schemas = Array.from(schemasMap.values()).map(s => ({
            name: s.name,
            tables: Array.from(s.tables.values())
        }));

        return { databases: [{ name: conn.config.database, schemas }] };
    } finally {
        await connection.end();
    }
}

export function generateMockMetadata(conn: any) {
    const dbName = conn.database || conn.name || 'default_db';
    const schemaName = conn.schema || (conn.type === 'mssql' ? 'dbo' : 'public');

    return {
        success: true,
        isMock: true,
        databases: [
            {
                name: dbName,
                schemas: [
                    {
                        name: schemaName,
                        tables: [
                            {
                                name: 'Demo_Customers',
                                schema: schemaName,
                                columns: [
                                    { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
                                    { name: 'full_name', type: 'varchar(100)', nullable: false },
                                    { name: 'email_address', type: 'varchar(255)', nullable: false },
                                    { name: 'signup_date', type: 'timestamp', nullable: false }
                                ]
                            },
                            {
                                name: 'Demo_Orders',
                                schema: schemaName,
                                columns: [
                                    { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
                                    { name: 'customer_id', type: 'integer', nullable: false },
                                    { name: 'order_timestamp', type: 'datetime', nullable: false },
                                    { name: 'amount', type: 'decimal(10,2)', nullable: false }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        message: `Note: Showing Demo/Sample schema. Real-time metadata fetching for ${conn.type} requires a direct connection or the background agent.`
    };
}
