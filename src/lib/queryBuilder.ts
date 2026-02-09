/**
 * Database-Aware Query Builder
 * Generates optimized SQL queries for ETL testing based on database type
 */

import { DatabaseType, getDialect, buildSelectQuery, buildCountQuery, buildFullTableName, quoteIdentifier } from './sqlDialect';

export interface QueryBuilderOptions {
  database?: string;
  schema?: string;
  limit?: number;
  offset?: number;
  orderBy?: string[];
  groupBy?: string[];
}

/**
 * Generate a row count query
 */
export function generateRowCountQuery(
  dbType: DatabaseType,
  tableName: string,
  options: QueryBuilderOptions = {}
): string {
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);
  return buildCountQuery(dbType, fullTableName);
}

/**
 * Generate a sample data query
 */
export function generateSampleDataQuery(
  dbType: DatabaseType,
  tableName: string,
  columns: string[] = ['*'],
  options: QueryBuilderOptions = {}
): string {
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);
  const limit = options.limit || 100;

  return buildSelectQuery(dbType, fullTableName, columns, undefined, limit, options.offset);
}

/**
 * Generate a data comparison query (row-by-row)
 */
export function generateComparisonQuery(
  sourceDbType: DatabaseType,
  targetDbType: DatabaseType,
  sourceTable: string,
  targetTable: string,
  sourceColumns: string[],
  targetColumns: string[],
  joinColumns: string[],
  sourceOptions: QueryBuilderOptions = {},
  targetOptions: QueryBuilderOptions = {}
): { sourceQuery: string; targetQuery: string } {
  const sourceDialect = getDialect(sourceDbType);
  const targetDialect = getDialect(targetDbType);

  const sourceFullTable = buildFullTableName(sourceDbType, sourceTable, sourceOptions.schema, sourceOptions.database);
  const targetFullTable = buildFullTableName(targetDbType, targetTable, targetOptions.schema, targetOptions.database);

  // Build join condition
  const joinCondition = joinColumns.map(col => {
    const sourceCol = sourceDialect.quoteIdentifier(col);
    const targetCol = targetDialect.quoteIdentifier(col);
    return `s.${sourceCol} = t.${targetCol}`;
  }).join(' AND ');

  const sourceQuery = buildSelectQuery(sourceDbType, sourceFullTable, sourceColumns, undefined, sourceOptions.limit);
  const targetQuery = buildSelectQuery(targetDbType, targetFullTable, targetColumns, undefined, targetOptions.limit);

  return { sourceQuery, targetQuery };
}

/**
 * Generate a column comparison query
 */
export function generateColumnComparisonQuery(
  dbType: DatabaseType,
  tableName: string,
  columnName: string,
  expectedValue: any,
  options: QueryBuilderOptions = {}
): string {
  const dialect = getDialect(dbType);
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);
  const quotedColumn = dialect.quoteIdentifier(columnName);

  let whereClause: string;
  if (expectedValue === null) {
    whereClause = `${quotedColumn} IS NOT NULL`;
  } else if (typeof expectedValue === 'string') {
    whereClause = `${quotedColumn} = ${dialect.quoteString(expectedValue)}`;
  } else {
    whereClause = `${quotedColumn} = ${expectedValue}`;
  }

  return buildSelectQuery(dbType, fullTableName, ['*'], whereClause, options.limit || 100);
}

/**
 * Generate a null check query
 */
export function generateNullCheckQuery(
  dbType: DatabaseType,
  tableName: string,
  columnName: string,
  checkForNulls: boolean = true,
  options: QueryBuilderOptions = {}
): string {
  const dialect = getDialect(dbType);
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);
  const quotedColumn = dialect.quoteIdentifier(columnName);

  const whereClause = checkForNulls
    ? `${quotedColumn} IS NULL`
    : `${quotedColumn} IS NOT NULL`;

  return buildSelectQuery(dbType, fullTableName, [columnName], whereClause, options.limit || 100);
}

/**
 * Generate a duplicate check query
 */
export function generateDuplicateCheckQuery(
  dbType: DatabaseType,
  tableName: string,
  columns: string[],
  options: QueryBuilderOptions = {}
): string {
  const dialect = getDialect(dbType);
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);
  const quotedColumns = columns.map(c => dialect.quoteIdentifier(c));

  // Different syntax for different databases
  if (dbType === 'mssql' || dbType === 'azuresql') {
    return `
      SELECT ${quotedColumns.join(', ')}, COUNT(*) as duplicate_count
      FROM ${fullTableName}
      GROUP BY ${quotedColumns.join(', ')}
      HAVING COUNT(*) > 1
    `.trim();
  } else {
    return `
      SELECT ${quotedColumns.join(', ')}, COUNT(*) as duplicate_count
      FROM ${fullTableName}
      GROUP BY ${quotedColumns.join(', ')}
      HAVING COUNT(*) > 1
      ${dialect.limitClause(options.limit || 100)}
    `.trim();
  }
}

/**
 * Generate a data type validation query
 */
export function generateDataTypeCheckQuery(
  dbType: DatabaseType,
  tableName: string,
  columnName: string,
  dataType: string,
  options: QueryBuilderOptions = {}
): string {
  const dialect = getDialect(dbType);
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);
  const quotedColumn = dialect.quoteIdentifier(columnName);

  // Try to cast and find failures
  let query: string;
  if (dbType === 'mssql' || dbType === 'azuresql') {
    query = `
      SELECT ${quotedColumn}
      FROM ${fullTableName}
      WHERE TRY_CAST(${quotedColumn} AS ${dataType}) IS NULL
        AND ${quotedColumn} IS NOT NULL
    `.trim();
  } else if (dbType === 'postgresql' || dbType === 'redshift') {
    query = `
      SELECT ${quotedColumn}
      FROM ${fullTableName}
      WHERE ${quotedColumn}::text !~ '^[0-9]+$'
        AND ${quotedColumn} IS NOT NULL
      ${dialect.limitClause(options.limit || 100)}
    `.trim();
  } else {
    // Generic approach - select all and validate in application
    query = buildSelectQuery(dbType, fullTableName, [columnName], `${quotedColumn} IS NOT NULL`, options.limit || 100);
  }

  return query;
}

/**
 * Generate a business rule validation query
 */
export function generateBusinessRuleQuery(
  dbType: DatabaseType,
  tableName: string,
  ruleExpression: string,
  options: QueryBuilderOptions = {}
): string {
  const fullTableName = buildFullTableName(dbType, tableName, options.schema, options.database);

  // The rule expression should already be in the correct SQL syntax
  return `
    SELECT *
    FROM ${fullTableName}
    WHERE NOT (${ruleExpression})
    ${getDialect(dbType).limitClause(options.limit || 100)}
  `.trim();
}

/**
 * Generate a transformation validation query
 */
export function generateTransformationQuery(
  sourceDbType: DatabaseType,
  targetDbType: DatabaseType,
  sourceTable: string,
  targetTable: string,
  sourceColumn: string,
  targetColumn: string,
  transformExpression: string,
  joinColumns: string[],
  sourceOptions: QueryBuilderOptions = {},
  targetOptions: QueryBuilderOptions = {}
): string {
  const sourceDialect = getDialect(sourceDbType);
  const targetDialect = getDialect(targetDbType);

  const sourceFullTable = buildFullTableName(sourceDbType, sourceTable, sourceOptions.schema, sourceOptions.database);
  const targetFullTable = buildFullTableName(targetDbType, targetTable, targetOptions.schema, targetOptions.database);

  const joinCondition = joinColumns.map(col => {
    const sourceCol = sourceDialect.quoteIdentifier(col);
    const targetCol = targetDialect.quoteIdentifier(col);
    return `s.${sourceCol} = t.${targetCol}`;
  }).join(' AND ');

  // Note: This query would need to be executed on one database that can access both
  // In practice, you'd fetch data from both and compare in the application
  return `
    -- This is a conceptual query - actual implementation fetches from both databases separately
    SELECT 
      s.${sourceDialect.quoteIdentifier(sourceColumn)} as source_value,
      t.${targetDialect.quoteIdentifier(targetColumn)} as target_value,
      ${transformExpression} as expected_value
    FROM ${sourceFullTable} s
    INNER JOIN ${targetFullTable} t ON ${joinCondition}
    WHERE t.${targetDialect.quoteIdentifier(targetColumn)} != ${transformExpression}
  `.trim();
}

/**
 * Generate a schema validation query (get table structure)
 */
export function generateSchemaQuery(dbType: DatabaseType, tableName: string, options: QueryBuilderOptions = {}): string {
  const dialect = getDialect(dbType);

  if (dbType === 'mssql' || dbType === 'azuresql') {
    const schema = options.schema || 'dbo';
    const database = options.database || 'master';
    return `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        CHARACTER_MAXIMUM_LENGTH as max_length
      FROM [${database}].INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `.trim();
  } else if (dbType === 'mysql' || dbType === 'mariadb') {
    const schema = options.database || 'information_schema';
    return `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        CHARACTER_MAXIMUM_LENGTH as max_length
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `.trim();
  } else if (dbType === 'postgresql' || dbType === 'redshift') {
    const schema = options.schema || 'public';
    return `
      SELECT 
        column_name as name,
        data_type as type,
        is_nullable as nullable,
        character_maximum_length as max_length
      FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `.trim();
  } else if (dbType === 'sqlite') {
    return `PRAGMA table_info(${dialect.quoteIdentifier(tableName)})`;
  } else {
    // Generic ANSI SQL
    return `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `.trim();
  }
}
