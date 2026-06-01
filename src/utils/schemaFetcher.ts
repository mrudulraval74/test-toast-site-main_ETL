// Database Schema Fetcher
// Fetches and caches database schemas for intelligent SQL generation
import { connectionsApi, pollJobUntilComplete } from '@/lib/api';

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
export async function fetchDatabaseSchema(
    connectionId: string, 
    agentId?: string,
    options?: { signal?: AbortSignal }
): Promise<DatabaseSchema> {
    // Check cache first
    const cached = schemaCache.get(connectionId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached schema for connection', connectionId);
        return cached.schema;
    }

    try {
        console.log('Fetching schema for connection', connectionId);
        if (options?.signal?.aborted) {
            throw new Error('Metadata fetch aborted');
        }
        const { data, error } = await connectionsApi.metadata(connectionId, agentId);
        if (error) {
            throw new Error(`Failed to fetch schema: ${error}`);
        }

        let metadata: any = data;
        if (data?.jobId) {
            const jobId = data.jobId as string;
            const { cancel, promise } = pollJobUntilComplete(jobId, {
                intervalMs: 2500,
                maxIntervalMs: 5000,
                timeoutMs: 60000,
            });

            const onAbort = () => {
                cancel();
            };

            if (options?.signal) {
                options.signal.addEventListener('abort', onAbort);
            }

            try {
                const { data: job, timedOut, cancelled } = await promise;

                if (cancelled || options?.signal?.aborted) {
                    throw new Error('Metadata job cancelled');
                }

                if (timedOut) {
                    throw new Error('Metadata job timed out');
                }

                if (!job) {
                    throw new Error('Metadata job did not return a result');
                }

                if ((job as any).status === 'completed') {
                    metadata = (job as any).result || {};
                } else {
                    throw new Error((job as any).error_log || 'Metadata job failed');
                }
            } finally {
                if (options?.signal) {
                    options.signal.removeEventListener('abort', onAbort);
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
    const clean = (name: string) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedSearch = clean(tableName);

    if (!normalizedSearch) return null;

    // Try exact clean match first on table name
    for (const table of schema.tables) {
        if (clean(table.tableName) === normalizedSearch || clean(table.fullName) === normalizedSearch) {
            return table;
        }
    }

    // Try parts match (e.g. schema.table)
    const searchLower = tableName.toLowerCase().replace(/[\[\]]/g, '');
    if (searchLower.includes('.')) {
        const parts = searchLower.split('.');
        const lastPart = parts[parts.length - 1];
        const cleanedLastPart = clean(lastPart);
        for (const table of schema.tables) {
            if (clean(table.tableName) === cleanedLastPart) {
                return table;
            }
        }
    }

    // Try partial clean match
    for (const table of schema.tables) {
        const tableClean = clean(table.tableName);
        if (tableClean.includes(normalizedSearch) || normalizedSearch.includes(tableClean)) {
            return table;
        }
    }

    return null;
}

/**
 * Find a column in table by fuzzy matching
 */
export function findColumnInTable(table: TableInfo, columnName: string): ColumnInfo | null {
    const clean = (name: string) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedSearch = clean(columnName);

    if (!normalizedSearch) return null;

    // Try exact clean match
    for (const col of table.columns) {
        if (clean(col.name) === normalizedSearch) {
            return col;
        }
    }

    // Try partial clean match
    for (const col of table.columns) {
        const colClean = clean(col.name);
        if (colClean.includes(normalizedSearch) || normalizedSearch.includes(colClean)) {
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
