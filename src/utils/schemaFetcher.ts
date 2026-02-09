// Database Schema Fetcher
// Fetches and caches database schemas for intelligent SQL generation

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
export async function fetchDatabaseSchema(connectionId: string): Promise<DatabaseSchema> {
    // Check cache first
    const cached = schemaCache.get(connectionId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached schema for connection', connectionId);
        return cached.schema;
    }

    try {
        console.log('Fetching schema for connection', connectionId);
        const response = await fetch(`/api/schema/${connectionId}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch schema: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success || !result.data) {
            throw new Error('Invalid schema response from server');
        }

        const schema: DatabaseSchema = result.data;

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
