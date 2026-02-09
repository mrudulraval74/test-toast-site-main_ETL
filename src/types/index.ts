// Type definitions for Query Builder and related components

export interface Connection {
    id: string;
    name: string;
    type: 'postgres' | 'mysql' | 'mssql';
    host?: string;
    port?: number;
    database?: string;
    username?: string;
}

export interface SavedQuery {
    id: string;
    name: string;
    query: string;
    connection_id: string;
    folder?: string;
    created_at: string;
    updated_at: string;
}

export interface FolderNode {
    name: string;
    children: Record<string, FolderNode>;
    queries: SavedQuery[];
}

export interface QueryResult {
    columns: string[];
    rows: any[][];
    rowCount?: number;
}

export interface DatabaseMetadata {
    databases: DatabaseInfo[];
}

export interface DatabaseInfo {
    name: string;
    schemas?: SchemaInfo[];
    tables?: TableInfo[];
}

export interface SchemaInfo {
    name: string;
    tables: TableInfo[];
}

export interface TableInfo {
    name: string;
    schema?: string;
    columns: ColumnInfo[];
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable?: boolean;
    isPrimaryKey?: boolean;
}

export interface QueryHistoryItem {
    query: string;
    timestamp: number;
    connectionId: string;
    connectionName: string;
}

export interface QueryValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}

export interface Agent {
    id: string;
    agent_name: string;
    status: string;
    last_heartbeat: string;
    capacity?: number;
    running_jobs?: number;
}
