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

// Simple in-memory cache. Key by connection + agent so metadata from one agent
// cannot be reused for another agent/tenant context.
const schemaCache = new Map<string, { schema: DatabaseSchema; timestamp: number }>();
const inFlightSchemaRequests = new Map<string, Promise<DatabaseSchema>>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

function getSchemaCacheKey(connectionId: string, agentId?: string) {
    return `${connectionId}::${agentId || 'default-agent'}`;
}

function parseNullableFlag(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return ['yes', 'y', 'true', '1', 'nullable'].includes(normalized);
}

/**
 * Fetch database schema from backend API
 */
export async function fetchDatabaseSchema(
    connectionId: string, 
    agentId?: string,
    options?: { signal?: AbortSignal; forceRefresh?: boolean }
): Promise<DatabaseSchema> {
    const cacheKey = getSchemaCacheKey(connectionId, agentId);

    // Check cache first
    const cached = schemaCache.get(cacheKey);
    if (!options?.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached schema for connection', connectionId);
        return cached.schema;
    }

    if (!options?.forceRefresh && !options?.signal) {
        const inFlight = inFlightSchemaRequests.get(cacheKey);
        if (inFlight) {
            console.log('Using in-flight schema request for connection', connectionId);
            return inFlight;
        }
    }

    const requestPromise = fetchDatabaseSchemaUncached(connectionId, agentId, options)
        .finally(() => {
            inFlightSchemaRequests.delete(cacheKey);
        });

    if (!options?.forceRefresh && !options?.signal) {
        inFlightSchemaRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
}

async function fetchDatabaseSchemaUncached(
    connectionId: string,
    agentId?: string,
    options?: { signal?: AbortSignal; forceRefresh?: boolean }
): Promise<DatabaseSchema> {
    const cacheKey = getSchemaCacheKey(connectionId, agentId);

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
                    const columns: ColumnInfo[] = (table.columns || [])
                        .map((col: any) => ({
                            name: col.name || col.columnName || col.column_name || col.COLUMN_NAME || '',
                            dataType: col.type || col.dataType || col.data_type || 'unknown',
                            isNullable: parseNullableFlag(col.nullable ?? col.isNullable ?? col.is_nullable ?? col.IS_NULLABLE),
                            maxLength: col.maxLength ?? col.max_length,
                        }))
                        .filter((col: ColumnInfo) => !!col.name);
                    totalColumns += columns.length;
                    tables.push({
                        schema: schemaItem.name || 'dbo',
                        tableName: table.name || table.tableName || table.table_name || '',
                        fullName: `${schemaItem.name || 'dbo'}.${table.name || table.tableName || table.table_name || ''}`,
                        columns,
                        primaryKey: (table.columns || [])
                            .filter((c: any) => c.isPrimaryKey)
                            .map((c: any) => c.name || c.columnName || c.column_name || c.COLUMN_NAME || ''),
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
        schemaCache.set(cacheKey, {
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
        for (const key of Array.from(schemaCache.keys())) {
            if (key.startsWith(`${connectionId}::`)) schemaCache.delete(key);
        }
        for (const key of Array.from(inFlightSchemaRequests.keys())) {
            if (key.startsWith(`${connectionId}::`)) inFlightSchemaRequests.delete(key);
        }
    } else {
        schemaCache.clear();
        inFlightSchemaRequests.clear();
    }
}
