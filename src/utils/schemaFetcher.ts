// Database Schema Fetcher
// Fetches and caches database schemas for intelligent SQL generation
import { connectionsApi } from '@/lib/api';

export interface ColumnInfo {
    name: string;
    dataType: string;
    isNullable: boolean;
    maxLength?: number;
}

export interface TableInfo {
    schema: string;
    tableName: string;
    fullName: string; // schema.tableName
    columns: ColumnInfo[];
    primaryKey?: string[];
}

export interface DatabaseSchema {
    tables: TableInfo[];
    totalTables: number;
    totalColumns: number;
}

// Simple in-memory cache
const schemaCache = new Map<string, { schema: DatabaseSchema; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch database schema from backend API
 */
export async function fetchDatabaseSchema(connectionId: string, agentId?: string): Promise<DatabaseSchema> {
    // Check cache first
    const cached = schemaCache.get(connectionId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached schema for connection', connectionId);
        return cached.schema;
    }

    try {
        console.log('Fetching schema for connection', connectionId);
        const { data, error } = await connectionsApi.metadata(connectionId, agentId);
        if (error) {
            throw new Error(`Failed to fetch schema: ${error}`);
        }

        let metadata: any = data;
        if (data?.jobId) {
            const jobId = data.jobId as string;
            const timeoutMs = 60000;
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                await new Promise((r) => setTimeout(r, 1500));
                const { data: job, error: jobError } = await connectionsApi.getJob(jobId);
                if (jobError || !job) continue;
                if ((job as any).status === 'completed') {
                    metadata = (job as any).result || {};
                    break;
                }
                if ((job as any).status === 'failed') {
                    throw new Error((job as any).error_log || 'Metadata job failed');
                }
            }
        }

        if (!metadata?.databases || !Array.isArray(metadata.databases)) {
            throw new Error('Invalid schema response from metadata API');
        }

        const tables: TableInfo[] = [];
        let totalColumns = 0;

        for (const db of metadata.databases) {
            for (const schemaItem of (db.schemas || [])) {
                for (const table of (schemaItem.tables || [])) {
                    const columns: ColumnInfo[] = (table.columns || []).map((col: any) => ({
                        name: col.name,
                        dataType: col.type || col.dataType || 'unknown',
                        isNullable: Boolean(col.nullable ?? col.isNullable),
                        maxLength: col.maxLength,
                    }));
                    totalColumns += columns.length;
                    tables.push({
                        schema: schemaItem.name || 'dbo',
                        tableName: table.name,
                        fullName: `${schemaItem.name || 'dbo'}.${table.name}`,
                        columns,
                        primaryKey: (table.columns || [])
                            .filter((c: any) => c.isPrimaryKey)
                            .map((c: any) => c.name),
                    });
                }
            }
        }

        const schema: DatabaseSchema = {
            tables,
            totalTables: tables.length,
            totalColumns,
        };

        // Cache the result
        schemaCache.set(connectionId, {
            schema,
            timestamp: Date.now()
        });

        console.log(`Fetched schema: ${schema.totalTables} tables, ${schema.totalColumns} columns`);
        return schema;

    } catch (error) {
        console.error('Error fetching database schema:', error);
        throw error;
    }
}

/**
 * Find a table in schema by fuzzy matching
 */
export function findTableInSchema(schema: DatabaseSchema, tableName: string): TableInfo | null {
    const normalizedSearch = tableName.toLowerCase().replace(/[\[\]]/g, '');

    // Try exact match first
    for (const table of schema.tables) {
        if (table.fullName.toLowerCase() === normalizedSearch ||
            table.tableName.toLowerCase() === normalizedSearch) {
            return table;
        }
    }

    // Try partial match
    for (const table of schema.tables) {
        const tableNameLower = table.tableName.toLowerCase();
        if (tableNameLower.includes(normalizedSearch) ||
            normalizedSearch.includes(tableNameLower)) {
            return table;
        }
    }

    // Try parts match (e.g. schema.table)
    if (normalizedSearch.includes('.')) {
        const parts = normalizedSearch.split('.');
        const lastPart = parts[parts.length - 1];
        for (const table of schema.tables) {
            if (table.tableName.toLowerCase() === lastPart) {
                return table;
            }
        }
    }

    return null;
}

/**
 * Find a column in table by fuzzy matching
 */
export function findColumnInTable(table: TableInfo, columnName: string): ColumnInfo | null {
    const normalizedSearch = columnName.toLowerCase().replace(/[\[\]]/g, '');

    // Try exact match
    for (const col of table.columns) {
        if (col.name.toLowerCase() === normalizedSearch) {
            return col;
        }
    }

    // Try partial match
    for (const col of table.columns) {
        if (col.name.toLowerCase().includes(normalizedSearch) ||
            normalizedSearch.includes(col.name.toLowerCase())) {
            return col;
        }
    }

    return null;
}

/**
 * Clear schema cache for a connection
 */
export function clearSchemaCache(connectionId?: string) {
    if (connectionId) {
        schemaCache.delete(connectionId);
    } else {
        schemaCache.clear();
    }
}
