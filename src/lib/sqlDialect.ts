/**
 * SQL Dialect Abstraction Layer
 * Handles database-specific SQL syntax, identifier quoting, and function translation
 */

export type DatabaseType = 'mssql' | 'azuresql' | 'mysql' | 'postgresql' | 'oracle' | 'databricks' | 'snowflake' | 'redshift' | 'mariadb' | 'sqlite';

interface SQLDialect {
    name: string;
    quoteIdentifier: (identifier: string) => string;
    quoteString: (value: string) => string;
    limitClause: (limit: number, offset?: number) => string;
    concatFunction: (...args: string[]) => string;
    currentTimestamp: () => string;
    substringFunction: (str: string, start: number, length?: number) => string;
    ifNullFunction: (expr: string, replacement: string) => string;
    castFunction: (expr: string, type: string) => string;
    topClause?: (limit: number) => string;
    supportsWindowFunctions: boolean;
    supportsCTE: boolean;
    caseSensitive: boolean;
}

class MSSQLDialect implements SQLDialect {
    name = 'Microsoft SQL Server';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = false;

    quoteIdentifier(identifier: string): string {
        return `[${identifier.replace(/\]/g, ']]')}]`;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        if (offset) {
            return `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        }
        return ''; // Use TOP clause instead
    }

    topClause(limit: number): string {
        return `TOP ${limit}`;
    }

    concatFunction(...args: string[]): string {
        return `CONCAT(${args.join(', ')})`;
    }

    currentTimestamp(): string {
        return 'GETDATE()';
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTRING(${str}, ${start}, ${length})`
            : `SUBSTRING(${str}, ${start}, LEN(${str}))`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `ISNULL(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

class MySQLDialect implements SQLDialect {
    name = 'MySQL';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = false;

    quoteIdentifier(identifier: string): string {
        return `\`${identifier.replace(/`/g, '``')}\``;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        return offset ? `LIMIT ${offset}, ${limit}` : `LIMIT ${limit}`;
    }

    concatFunction(...args: string[]): string {
        return `CONCAT(${args.join(', ')})`;
    }

    currentTimestamp(): string {
        return 'NOW()';
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTRING(${str}, ${start}, ${length})`
            : `SUBSTRING(${str}, ${start})`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `IFNULL(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

class PostgreSQLDialect implements SQLDialect {
    name = 'PostgreSQL';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = true;

    quoteIdentifier(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        return offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`;
    }

    concatFunction(...args: string[]): string {
        return args.join(' || ');
    }

    currentTimestamp(): string {
        return 'CURRENT_TIMESTAMP';
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTRING(${str} FROM ${start} FOR ${length})`
            : `SUBSTRING(${str} FROM ${start})`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `COALESCE(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

class OracleDialect implements SQLDialect {
    name = 'Oracle';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = false;

    quoteIdentifier(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        return offset
            ? `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
            : `FETCH FIRST ${limit} ROWS ONLY`;
    }

    concatFunction(...args: string[]): string {
        return args.join(' || ');
    }

    currentTimestamp(): string {
        return 'SYSDATE';
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTR(${str}, ${start}, ${length})`
            : `SUBSTR(${str}, ${start})`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `NVL(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

class SnowflakeDialect implements SQLDialect {
    name = 'Snowflake';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = false;

    quoteIdentifier(identifier: string): string {
        // Snowflake typically doesn't require quotes unless using reserved words or special chars
        if (/^[A-Z][A-Z0-9_]*$/.test(identifier)) {
            return identifier;
        }
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        return offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`;
    }

    concatFunction(...args: string[]): string {
        return `CONCAT(${args.join(', ')})`;
    }

    currentTimestamp(): string {
        return 'CURRENT_TIMESTAMP()';
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTRING(${str}, ${start}, ${length})`
            : `SUBSTRING(${str}, ${start})`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `IFNULL(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

class DatabricksDialect implements SQLDialect {
    name = 'Databricks';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = false;

    quoteIdentifier(identifier: string): string {
        return `\`${identifier.replace(/`/g, '``')}\``;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        return offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`;
    }

    concatFunction(...args: string[]): string {
        return `CONCAT(${args.join(', ')})`;
    }

    currentTimestamp(): string {
        return 'CURRENT_TIMESTAMP()';
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTRING(${str}, ${start}, ${length})`
            : `SUBSTRING(${str}, ${start})`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `COALESCE(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

class SQLiteDialect implements SQLDialect {
    name = 'SQLite';
    supportsWindowFunctions = true;
    supportsCTE = true;
    caseSensitive = false;

    quoteIdentifier(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    quoteString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    limitClause(limit: number, offset?: number): string {
        return offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`;
    }

    concatFunction(...args: string[]): string {
        return args.join(' || ');
    }

    currentTimestamp(): string {
        return "DATETIME('now')";
    }

    substringFunction(str: string, start: number, length?: number): string {
        return length
            ? `SUBSTR(${str}, ${start}, ${length})`
            : `SUBSTR(${str}, ${start})`;
    }

    ifNullFunction(expr: string, replacement: string): string {
        return `IFNULL(${expr}, ${replacement})`;
    }

    castFunction(expr: string, type: string): string {
        return `CAST(${expr} AS ${type})`;
    }
}

// Dialect registry
const dialects: Record<DatabaseType, SQLDialect> = {
    mssql: new MSSQLDialect(),
    azuresql: new MSSQLDialect(),
    mysql: new MySQLDialect(),
    mariadb: new MySQLDialect(), // MariaDB uses MySQL syntax
    postgresql: new PostgreSQLDialect(),
    redshift: new PostgreSQLDialect(), // Redshift uses PostgreSQL syntax
    oracle: new OracleDialect(),
    snowflake: new SnowflakeDialect(),
    databricks: new DatabricksDialect(),
    sqlite: new SQLiteDialect(),
};

/**
 * Get SQL dialect for a database type
 */
export function getDialect(dbType: DatabaseType): SQLDialect {
    const dialect = dialects[dbType];
    if (!dialect) {
        throw new Error(`Unsupported database type: ${dbType}`);
    }
    return dialect;
}

/**
 * Build a SELECT query with database-specific syntax
 */
export function buildSelectQuery(
    dbType: DatabaseType,
    tableName: string,
    columns: string[] = ['*'],
    whereClause?: string,
    limit?: number,
    offset?: number
): string {
    const dialect = getDialect(dbType);
    const quotedTable = dialect.quoteIdentifier(tableName);
    const quotedColumns = columns.map(c => c === '*' ? '*' : dialect.quoteIdentifier(c));

    let query = 'SELECT ';

    // Handle TOP clause for SQL Server
    if ((dbType === 'mssql' || dbType === 'azuresql') && limit && !offset && dialect.topClause) {
        query += `${dialect.topClause(limit)} `;
    }

    query += quotedColumns.join(', ');
    query += ` FROM ${quotedTable}`;

    if (whereClause) {
        query += ` WHERE ${whereClause}`;
    }

    // Handle LIMIT/OFFSET for other databases
    if (limit && ((dbType !== 'mssql' && dbType !== 'azuresql') || offset)) {
        query += ` ${dialect.limitClause(limit, offset)}`;
    }

    return query;
}

/**
 * Build a COUNT query with database-specific syntax
 */
export function buildCountQuery(
    dbType: DatabaseType,
    tableName: string,
    whereClause?: string
): string {
    const dialect = getDialect(dbType);
    const quotedTable = dialect.quoteIdentifier(tableName);

    let query = `SELECT COUNT(*) as count FROM ${quotedTable}`;

    if (whereClause) {
        query += ` WHERE ${whereClause}`;
    }

    return query;
}

/**
 * Quote an identifier (table/column name) for a specific database
 */
export function quoteIdentifier(dbType: DatabaseType, identifier: string): string {
    return getDialect(dbType).quoteIdentifier(identifier);
}

/**
 * Quote a string value for a specific database
 */
export function quoteString(dbType: DatabaseType, value: string): string {
    return getDialect(dbType).quoteString(value);
}

/**
 * Build a fully qualified table name (database.schema.table or schema.table)
 */
export function buildFullTableName(
    dbType: DatabaseType,
    tableName: string,
    schema?: string,
    database?: string
): string {
    const dialect = getDialect(dbType);
    const parts: string[] = [];

    if (database && (dbType === 'mssql' || dbType === 'azuresql' || dbType === 'mysql' || dbType === 'mariadb')) {
        parts.push(dialect.quoteIdentifier(database));
    }

    if (schema) {
        parts.push(dialect.quoteIdentifier(schema));
    }

    parts.push(dialect.quoteIdentifier(tableName));

    return parts.join('.');
}
