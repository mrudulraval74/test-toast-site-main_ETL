import { MappingAnalysis, Connection } from '@/types/ai-comparison';

/**
 * Replace table placeholders in SQL with actual database-qualified table names
 * {{SRC_TABLE}} and {{TGT_TABLE}} are replaced with connection-specific values
 */
export function replaceTablePlaceholders(
    analysis: MappingAnalysis,
    sourceConn?: Connection,
    targetConn?: Connection
): MappingAnalysis {
    let sourceTable = analysis.sourceTables[0] || 'SourceTable';
    let targetTable = analysis.targetTables[0] || 'TargetTable';

    // Add database prefix to source table if connection has database
    if (sourceConn?.database) {
        if (!sourceTable.startsWith(sourceConn.database) && !sourceTable.includes('.')) {
            sourceTable = `[${sourceConn.database}].${sourceTable}`;
        }
    }

    // Add database prefix to target table if connection has database
    if (targetConn?.database) {
        if (!targetTable.startsWith(targetConn.database) && !targetTable.includes('.')) {
            targetTable = `[${targetConn.database}].${targetTable}`;
        }
    }

    // Extract raw table names for metadata queries (remove brackets and schema)
    const getRawTableName = (fullPath: string) => {
        const parts = fullPath.replace(/[\[\]]/g, '').split('.');
        return parts[parts.length - 1]; // Return just the table name
    };

    const sourceTableName = getRawTableName(analysis.sourceTables[0] || 'SourceTable');
    const targetTableName = getRawTableName(analysis.targetTables[0] || 'TargetTable');

    return {
        ...analysis,
        testCases: analysis.testCases.map(tc => ({
            ...tc,
            sourceSQL: tc.sourceSQL
                .replace(/\{\{SRC_TABLE\}\}/g, sourceTable)
                .replace(/\{\{TGT_TABLE\}\}/g, targetTable)
                .replace(/\{\{SRC_TABLE_NAME\}\}/g, sourceTableName)
                .replace(/\{\{TGT_TABLE_NAME\}\}/g, targetTableName),
            targetSQL: tc.targetSQL
                .replace(/\{\{SRC_TABLE\}\}/g, sourceTable)
                .replace(/\{\{TGT_TABLE\}\}/g, targetTable)
                .replace(/\{\{SRC_TABLE_NAME\}\}/g, sourceTableName)
                .replace(/\{\{TGT_TABLE_NAME\}\}/g, targetTableName),
            metadata: {
                ...(tc as any).metadata,
                sourceConnection: sourceConn?.name,
                targetConnection: targetConn?.name
            }
        }))
    };
}
