/**
 * React Hook for Database-Aware Query Generation
 * Automatically generates SQL queries based on the selected database connection
 */

import { useMemo, useCallback } from 'react';
import { DatabaseType } from '@/lib/sqlDialect';
import {
    generateRowCountQuery,
    generateSampleDataQuery,
    generateComparisonQuery,
    generateColumnComparisonQuery,
    generateNullCheckQuery,
    generateDuplicateCheckQuery,
    generateDataTypeCheckQuery,
    generateBusinessRuleQuery,
    generateSchemaQuery,
    QueryBuilderOptions
} from '@/lib/queryBuilder';

export interface Connection {
    id?: string;
    type: DatabaseType;
    name: string;
    database?: string;
    schema?: string;
    [key: string]: any;
}

export function useQueryGeneration(sourceConnection?: Connection, targetConnection?: Connection) {
    // Extract database types
    const sourceDbType = sourceConnection?.type as DatabaseType;
    const targetDbType = targetConnection?.type as DatabaseType;

    /**
     * Generate row count query for a table
     */
    const getRowCountQuery = useCallback((
        tableName: string,
        isSource: boolean = true
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateRowCountQuery(conn.type as DatabaseType, tableName, {
            database: conn.database,
            schema: conn.schema
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Generate sample data query
     */
    const getSampleDataQuery = useCallback((
        tableName: string,
        columns: string[] = ['*'],
        limit: number = 100,
        isSource: boolean = true
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateSampleDataQuery(conn.type as DatabaseType, tableName, columns, {
            database: conn.database,
            schema: conn.schema,
            limit
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Generate comparison query for both source and target
     */
    const getComparisonQueries = useCallback((
        sourceTable: string,
        targetTable: string,
        sourceColumns: string[],
        targetColumns: string[],
        joinColumns: string[],
        limit?: number
    ): { sourceQuery: string; targetQuery: string } => {
        if (!sourceConnection || !targetConnection) {
            throw new Error('Both source and target connections must be selected');
        }

        return generateComparisonQuery(
            sourceDbType,
            targetDbType,
            sourceTable,
            targetTable,
            sourceColumns,
            targetColumns,
            joinColumns,
            {
                database: sourceConnection.database,
                schema: sourceConnection.schema,
                limit
            },
            {
                database: targetConnection.database,
                schema: targetConnection.schema,
                limit
            }
        );
    }, [sourceConnection, targetConnection, sourceDbType, targetDbType]);

    /**
     * Generate null check query
     */
    const getNullCheckQuery = useCallback((
        tableName: string,
        columnName: string,
        checkForNulls: boolean = true,
        isSource: boolean = true,
        limit?: number
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateNullCheckQuery(conn.type as DatabaseType, tableName, columnName, checkForNulls, {
            database: conn.database,
            schema: conn.schema,
            limit
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Generate duplicate check query
     */
    const getDuplicateCheckQuery = useCallback((
        tableName: string,
        columns: string[],
        isSource: boolean = true,
        limit?: number
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateDuplicateCheckQuery(conn.type as DatabaseType, tableName, columns, {
            database: conn.database,
            schema: conn.schema,
            limit
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Generate data type validation query
     */
    const getDataTypeCheckQuery = useCallback((
        tableName: string,
        columnName: string,
        dataType: string,
        isSource: boolean = true,
        limit?: number
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateDataTypeCheckQuery(conn.type as DatabaseType, tableName, columnName, dataType, {
            database: conn.database,
            schema: conn.schema,
            limit
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Generate business rule validation query
     */
    const getBusinessRuleQuery = useCallback((
        tableName: string,
        ruleExpression: string,
        isSource: boolean = true,
        limit?: number
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateBusinessRuleQuery(conn.type as DatabaseType, tableName, ruleExpression, {
            database: conn.database,
            schema: conn.schema,
            limit
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Generate schema query for table structure
     */
    const getSchemaQuery = useCallback((
        tableName: string,
        isSource: boolean = true
    ): string => {
        const conn = isSource ? sourceConnection : targetConnection;
        if (!conn) throw new Error('Connection not selected');

        return generateSchemaQuery(conn.type as DatabaseType, tableName, {
            database: conn.database,
            schema: conn.schema
        });
    }, [sourceConnection, targetConnection]);

    /**
     * Get database type info
     */
    const databaseInfo = useMemo(() => ({
        source: {
            type: sourceDbType,
            name: sourceConnection?.name,
            database: sourceConnection?.database,
            schema: sourceConnection?.schema
        },
        target: {
            type: targetDbType,
            name: targetConnection?.name,
            database: targetConnection?.database,
            schema: targetConnection?.schema
        }
    }), [sourceConnection, targetConnection, sourceDbType, targetDbType]);

    return {
        // Query generators
        getRowCountQuery,
        getSampleDataQuery,
        getComparisonQueries,
        getNullCheckQuery,
        getDuplicateCheckQuery,
        getDataTypeCheckQuery,
        getBusinessRuleQuery,
        getSchemaQuery,

        // Database info
        databaseInfo,
        sourceDbType,
        targetDbType,

        // Connection checks
        hasSourceConnection: !!sourceConnection,
        hasTargetConnection: !!targetConnection,
        hasBothConnections: !!sourceConnection && !!targetConnection,
    };
}
