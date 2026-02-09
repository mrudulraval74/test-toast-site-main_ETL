// Table-Specific Comprehensive ETL Test Generator
// Generates all 9 ETL testing categories for a specific source-target table pair

import { DatabaseSchema, findTableInSchema, findColumnInTable } from './schemaFetcher';

export interface TestCase {
    name: string;
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    category?: 'metadata' | 'completeness' | 'quality' | 'transformation' | 'regression' | 'reference' | 'incremental' | 'integration' | 'performance' | 'general';
    severity?: 'critical' | 'major' | 'minor';
}

interface TablePair {
    sourceTable: string;
    targetTable: string;
}

/**
 * Generate comprehensive ETL test cases for a specific source-target table pair
 */
export function generateTableSpecificETLTests(
    sourceTable: string,
    targetTable: string,
    sourceSchema?: DatabaseSchema | null,
    targetSchema?: DatabaseSchema | null,
    sourceDbType: string = 'mssql',
    targetDbType: string = 'mssql',
    columnMappings?: any[] // Column mappings from the mapping sheet
): TestCase[] {
    const testCases: TestCase[] = [];

    // Get dialect helpers
    const srcDialect = getDialect(sourceDbType);
    const tgtDialect = getDialect(targetDbType);

    // Get sample columns from schema if available
    const sourceTableInfo = sourceSchema ? findTableInSchema(sourceSchema, sourceTable) : null;
    const targetTableInfo = targetSchema ? findTableInSchema(targetSchema, targetTable) : null;

    // Keep raw column names for aliases (without quotes)
    const sampleSourceColumnsRaw = sourceTableInfo?.columns.slice(0, 5).map(c => c.name) || ['Column1', 'Column2', 'Column3'];
    const sampleTargetColumnsRaw = targetTableInfo?.columns.slice(0, 5).map(c => c.name) || ['Column1', 'Column2', 'Column3'];

    // Quoted column names for use in SQL queries
    const sampleSourceColumns = sampleSourceColumnsRaw.map(c => quoteName(c, srcDialect));
    const sampleTargetColumns = sampleTargetColumnsRaw.map(c => quoteName(c, tgtDialect));
    const sampleColumn = sourceTableInfo?.columns[0]?.name || 'ID';

    // Filter mappings for this specific table pair
    // Filter mappings for this specific table pair (Normalized check - Case Insensitive)
    const relevantMappings = columnMappings?.filter(m => {
        const mSrc = String(m.sourceTable || m.source_table || m.SourceTable || '').trim().toLowerCase();
        const mTgt = String(m.targetTable || m.target_table || m.TargetTable || '').trim().toLowerCase();
        return mSrc === sourceTable.toLowerCase().trim() && mTgt === targetTable.toLowerCase().trim();
    }) || [];

    // Extract schema from table name if present (e.g., "Person.Person" -> schema="Person", table="Person")
    // Do this once at the top level so all tests can use it
    const sourceTableParts = sourceTable.includes('.') ? sourceTable.split('.') : [null, sourceTable];
    const targetTableParts = targetTable.includes('.') ? targetTable.split('.') : [null, targetTable];

    const sourceSchemaName = sourceTableParts[0] || sourceTableInfo?.schema || 'dbo';
    const sourceTableName = sourceTableParts[1] || sourceTable;
    const targetSchemaName = targetTableParts[0] || targetTableInfo?.schema || 'dbo';
    const targetTableName = targetTableParts[1] || targetTable;

    // Create fully qualified table names for SQL queries (schema.table format)
    const quotedSrcTable = `${quoteName(sourceSchemaName, srcDialect)}.${quoteName(sourceTableName, srcDialect)}`;
    const quotedTgtTable = `${quoteName(targetSchemaName, tgtDialect)}.${quoteName(targetTableName, tgtDialect)}`;

    // Helper to generate safe columns for CHECKSUM (handling XML/Image types in MSSQL)
    const getSafeChecksumCols = (dialect: string, info: any) => {
        if (dialect === 'mssql' && info?.columns) {
            // Identify columns that have transformations (not direct moves)
            const transformedColumnNames = new Set(
                (relevantMappings || [])
                    .filter(m => {
                        const logic = (m.transformationLogic || '').trim().toLowerCase();
                        return logic !== '' && logic !== 'direct move' && logic !== 'straight move';
                    })
                    .map(m => (m.sourceColumn || m.source_column || '').trim().toLowerCase())
            );

            return info.columns
                .filter((c: any) => !transformedColumnNames.has(c.name.toLowerCase())) // Exclude transformed columns
                .map((c: any) => {
                    const rawType = c.dataType || c.data_type || c.type || '';
                    const type = String(rawType).toLowerCase().trim();
                    const qName = quoteName(c.name, dialect);

                    // Debug log to see what types we are actually getting
                    if (type.includes('xml') || type.includes('text') || type.includes('image')) {
                        console.log(`Applying safe cast for ${c.name} (${rawType})`);
                    }

                    if (type.includes('xml')) return `CAST(${qName} AS NVARCHAR(MAX))`;
                    if (type.includes('image')) return `CAST(${qName} AS VARBINARY(MAX))`;
                    if (type === 'text') return `CAST(${qName} AS VARCHAR(MAX))`;
                    if (type === 'ntext') return `CAST(${qName} AS NVARCHAR(MAX))`;
                    if (type === 'geography') return `CAST(${qName} AS VARBINARY(MAX))`;
                    if (type === 'geometry') return `CAST(${qName} AS VARBINARY(MAX))`;

                    // Fallback for explicitly named XML column if type is missing common naming convention
                    if (c.name.includes('Demographics') || c.name.includes('AdditionalContactInfo')) {
                        console.log(`Force-casting known XML column by name: ${c.name}`);
                        return `CAST(${qName} AS NVARCHAR(MAX))`;
                    }

                    return qName;
                }).join(', ');
        }
        return '*';
    };

    const safeSourceChecksumCols = getSafeChecksumCols(srcDialect, sourceTableInfo);
    const safeTargetChecksumCols = getSafeChecksumCols(tgtDialect, targetTableInfo);

    // === METADATA TESTING (5 tests) ===

    // Enhanced Data Type Check using actual column mappings
    if (relevantMappings.length > 0) {
        // Build specific column list from mappings
        const mappedColumns = relevantMappings
            .filter(m => m.sourceColumn && m.targetColumn)
            .map(m => ({
                source: m.sourceColumn || m.source_column,
                target: m.targetColumn || m.target_column
            }))
            .slice(0, 10); // Limit to first 10 mappings

        if (mappedColumns.length > 0) {
            const sourceColumnList = mappedColumns.map(c => `'${c.source}'`).join(', ');
            const targetColumnList = mappedColumns.map(c => `'${c.target}'`).join(', ');

            testCases.push({
                name: `MetaData | Mapped Columns Data Type Check - ${sourceTable} → ${targetTable}`,
                description: `Verify data types match for ${mappedColumns.length} mapped columns from mapping sheet`,
                sourceSQL: `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${sourceTableName}'
AND TABLE_SCHEMA = '${sourceSchemaName}'
AND COLUMN_NAME IN (${sourceColumnList})
ORDER BY COLUMN_NAME`,
                targetSQL: `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTableName}'
AND TABLE_SCHEMA = '${targetSchemaName}'
AND COLUMN_NAME IN (${targetColumnList})
ORDER BY COLUMN_NAME`,
                expectedResult: `Data types should match for all ${mappedColumns.length} mapped columns`,
                category: 'metadata',
                severity: 'critical'
            });
        }
    } else {
        // Fallback to generic data type check
        testCases.push({
            name: `MetaData | Data Type Check - ${sourceTable} → ${targetTable}`,
            description: 'Verify data types match between source and target columns',
            sourceSQL: `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${sourceTableName}'
AND TABLE_SCHEMA = '${sourceSchemaName}'
ORDER BY ORDINAL_POSITION`,
            targetSQL: `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTableName}'
AND TABLE_SCHEMA = '${targetSchemaName}'
ORDER BY ORDINAL_POSITION`,
            expectedResult: 'Data types should match for mapped columns',
            category: 'metadata',
            severity: 'critical'
        });
    }

    testCases.push(
        {
            name: `MetaData | Data Length Check - ${sourceTable} → ${targetTable}`,
            description: 'Ensure column lengths are sufficient in target',
            sourceSQL: `SELECT MAX(${getLenFn(srcDialect)}(${quoteName(sampleColumn, srcDialect)})) AS MaxLength FROM ${quotedSrcTable}`,
            targetSQL: `SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = '${targetTableParts[1] || targetTable}' 
AND TABLE_SCHEMA = '${targetTableParts[0] || targetTableInfo?.schema || 'dbo'}'
AND COLUMN_NAME = '${sampleColumn}'`,
            expectedResult: 'Target column length >= source max data length',
            category: 'metadata',
            severity: 'major'
        },
        {
            name: `MetaData | Index and Constraint Check - ${sourceTable} → ${targetTable}`,
            description: 'Verify primary keys and indexes exist on target table',
            sourceSQL: srcDialect === 'mssql'
                ? `SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('${sourceSchemaName}.${sourceTableName}')`
                : `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = '${sourceSchemaName}' AND tablename = '${sourceTableName}'`,
            targetSQL: tgtDialect === 'mssql'
                ? `SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('${targetSchemaName}.${targetTableName}')`
                : `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = '${targetSchemaName}' AND tablename = '${targetTableName}'`,
            expectedResult: 'Target should have appropriate indexes',
            category: 'metadata',
            severity: 'major'
        },
        {
            name: `MetaData | Naming Standards Check - ${targetTable}`,
            description: 'Verify table and column names follow naming conventions',
            sourceSQL: `SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${sourceTableParts[1] || sourceTable}'
AND TABLE_SCHEMA = '${sourceTableParts[0] || sourceTableInfo?.schema || 'dbo'}'
AND (COLUMN_NAME NOT LIKE '[A-Z]%' OR COLUMN_NAME LIKE '%  %')`,
            targetSQL: `SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTableParts[1] || targetTable}'
AND TABLE_SCHEMA = '${targetTableParts[0] || targetTableInfo?.schema || 'dbo'}'
AND (COLUMN_NAME NOT LIKE '[A-Z]%' OR COLUMN_NAME LIKE '%  %')`,
            expectedResult: 'All names should follow naming standards (no violations)',
            category: 'metadata',
            severity: 'minor'
        },
        {
            name: `MetaData | Cross-Environment Check - ${targetTable}`,
            description: 'Verify metadata consistency across environments (DEV/QA/PROD)',
            sourceSQL: `SELECT COUNT(*) as ColumnCount, 
    SUM(CHARACTER_MAXIMUM_LENGTH) as TotalLength
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTableParts[1] || targetTable}'
AND TABLE_SCHEMA = '${targetTableParts[0] || targetTableInfo?.schema || 'dbo'}'`,
            targetSQL: `-- Compare with other environment
SELECT COUNT(*) as ColumnCount,
    SUM(CHARACTER_MAXIMUM_LENGTH) as TotalLength
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTableParts[1] || targetTable}'
AND TABLE_SCHEMA = '${targetTableParts[0] || targetTableInfo?.schema || 'dbo'}'`,
            expectedResult: 'Metadata should be consistent across environments',
            category: 'metadata',
            severity: 'major'
        }
    );

    // === DATA COMPLETENESS TESTING (3 tests) ===
    testCases.push(
        {
            name: `Completeness | Record Count Validation - ${sourceTable} → ${targetTable}`,
            description: 'Ensure source and target have same number of rows',
            sourceSQL: `SELECT COUNT(*) AS Record_Count FROM ${quotedSrcTable}`,
            targetSQL: `SELECT COUNT(*) AS Record_Count FROM ${quotedTgtTable}`,
            expectedResult: 'Row counts should be equal',
            category: 'completeness',
            severity: 'critical'
        },
        {
            name: `Completeness | Column Data Profile - ${sourceTable} → ${targetTable}`,
            description: 'Validate all required columns are populated',
            sourceSQL: `SELECT 
    ${sampleSourceColumns.map((c, i) => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS ${quoteName(sampleSourceColumnsRaw[i] + '_Nulls', srcDialect)}`).join(',\n    ')}
FROM ${quotedSrcTable}`,
            targetSQL: `SELECT 
    ${sampleTargetColumns.map((c, i) => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS ${quoteName(sampleTargetColumnsRaw[i] + '_Nulls', tgtDialect)}`).join(',\n    ')}
FROM ${quotedTgtTable}`,
            expectedResult: 'NULL counts should match for non-transformed columns',
            category: 'completeness',
            severity: 'major'
        },
        {
            name: `Completeness | Full Dataset Comparison (Direct Moves Only) - ${sourceTable} → ${targetTable}`,
            description: 'Compare row counts and checksums for non-transformed columns (Direct Moves)',
            sourceSQL: `SELECT 
    COUNT(*) as TotalRows,
    CHECKSUM_AGG(CHECKSUM(${safeSourceChecksumCols})) as DataChecksum
FROM ${quotedSrcTable}`,
            targetSQL: `SELECT 
    COUNT(*) as TotalRows,
    CHECKSUM_AGG(CHECKSUM(${safeTargetChecksumCols})) as DataChecksum
FROM ${quotedTgtTable}`,
            expectedResult: 'Row counts and checksums should match (indicating identical data)',
            category: 'completeness',
            severity: 'critical'
        }
    );

    // === DATA QUALITY TESTING (3 tests) ===
    testCases.push(
        {
            name: `Quality | Duplicate Data Checks - ${sourceTable} → ${targetTable}`,
            description: 'Identify duplicate records in target',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, COUNT(*) as DuplicateCount
FROM ${quotedSrcTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}
HAVING COUNT(*) > 1`,
            targetSQL: `SELECT ${quoteName(sampleColumn, tgtDialect)}, COUNT(*) as DuplicateCount
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}
HAVING COUNT(*) > 1`,
            expectedResult: 'No duplicates in target (or matching source duplicates)',
            category: 'quality',
            severity: 'critical'
        },
        {
            name: `Quality | Data Validation Rules - ${sourceTable} → ${targetTable}`,
            description: 'Check for invalid data patterns',
            sourceSQL: `SELECT COUNT(*) as InvalidRecords
FROM ${quotedSrcTable}
WHERE ${quoteName(sampleColumn, srcDialect)} IS NULL OR ${quoteName(sampleColumn, srcDialect)} = ''`,
            targetSQL: `SELECT COUNT(*) as InvalidRecords
FROM ${quotedTgtTable}
WHERE ${quoteName(sampleColumn, tgtDialect)} IS NULL OR ${quoteName(sampleColumn, tgtDialect)} = ''`,
            expectedResult: 'Target should have 0 invalid records if business rules applied',
            category: 'quality',
            severity: 'major'
        },
        {
            name: `Quality | Data Integrity Checks - ${sourceTable} → ${targetTable}`,
            description: 'Verify referential integrity constraints',
            sourceSQL: `SELECT COUNT(*) as OrphanRecords
FROM ${quotedSrcTable}
WHERE ${quoteName(sampleColumn, srcDialect)} IS NOT NULL`,
            targetSQL: `SELECT COUNT(*) as ValidRecords
FROM ${quotedTgtTable}
WHERE ${quoteName(sampleColumn, tgtDialect)} IS NOT NULL`,
            expectedResult: 'All non-null records should be present',
            category: 'quality',
            severity: 'major'
        }
    );

    // === DATA TRANSFORMATION TESTING (7 tests) ===
    testCases.push(
        {
            name: `Transformation | White Box - Direct Move Validation - ${sourceTable} → ${targetTable}`,
            description: 'White Box: Verify columns moved without modification (with knowledge of ETL logic)',
            sourceSQL: `SELECT ${getLimitClause(srcDialect, 100)} ${sampleSourceColumns.join(', ')}
FROM ${quotedSrcTable}
ORDER BY ${quoteName(sampleColumn, srcDialect)}`,
            targetSQL: `SELECT ${getLimitClause(tgtDialect, 100)} ${sampleTargetColumns.join(', ')}
FROM ${quotedTgtTable}
ORDER BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'Values should match exactly for direct move columns',
            category: 'transformation',
            severity: 'critical'
        },
        {
            name: `Transformation | Black Box - Output Validation - ${sourceTable} → ${targetTable}`,
            description: 'Black Box: Verify transformation output without knowing internal logic',
            sourceSQL: `SELECT COUNT(*) as SourceCount,
    COUNT(DISTINCT ${quoteName(sampleColumn, srcDialect)}) as UniqueValues
FROM ${quotedSrcTable}`,
            targetSQL: `SELECT COUNT(*) as TargetCount,
    COUNT(DISTINCT ${quoteName(sampleColumn, tgtDialect)}) as UniqueValues
FROM ${quotedTgtTable}`,
            expectedResult: 'Output metrics should match expected transformation results',
            category: 'transformation',
            severity: 'critical'
        },
        {
            name: `Transformation | NULL Handling Validation - ${sourceTable} → ${targetTable}`,
            description: 'Verify NULL values are properly handled',
            sourceSQL: `SELECT COUNT(*) as NullCount
FROM ${quotedSrcTable}
WHERE ${quoteName(sampleColumn, srcDialect)} IS NULL`,
            targetSQL: `SELECT COUNT(*) as NullOrDefaultCount
FROM ${quotedTgtTable}
WHERE ${quoteName(sampleColumn, tgtDialect)} IS NULL OR ${quoteName(sampleColumn, tgtDialect)} IN ('0', 'N/A', 'Unknown')`,
            expectedResult: 'NULL source values transformed to default values in target',
            category: 'transformation',
            severity: 'major'
        },
        {
            name: `Transformation | String Trimming Validation - ${sourceTable} → ${targetTable}`,
            description: 'Ensure extra spaces are removed',
            sourceSQL: `SELECT COUNT(*) as UntrimmedCount
FROM ${quotedSrcTable}
WHERE ${quoteName(sampleColumn, srcDialect)} LIKE ' %' OR ${quoteName(sampleColumn, srcDialect)} LIKE '% '`,
            targetSQL: `SELECT COUNT(*) as TrimmedCount
FROM ${quotedTgtTable}
WHERE ${quoteName(sampleColumn, tgtDialect)} LIKE ' %' OR ${quoteName(sampleColumn, tgtDialect)} LIKE '% '`,
            expectedResult: 'Target should have no leading/trailing spaces',
            category: 'transformation',
            severity: 'minor'
        },
        {
            name: `Transformation | Aggregation Validation - ${sourceTable} → ${targetTable}`,
            description: 'Verify SUM/AVG/MIN/MAX calculations',
            sourceSQL: `SELECT 
    COUNT(*) as RecordCount,
    SUM(CASE WHEN ISNUMERIC(CAST(${quoteName(sampleColumn, srcDialect)} AS NVARCHAR(4000))) = 1 THEN CAST(${quoteName(sampleColumn, srcDialect)} AS FLOAT) ELSE 0 END) as TotalSum
FROM ${quotedSrcTable}`,
            targetSQL: `SELECT 
    COUNT(*) as RecordCount,
    SUM(CASE WHEN ISNUMERIC(CAST(${quoteName(sampleColumn, tgtDialect)} AS NVARCHAR(4000))) = 1 THEN CAST(${quoteName(sampleColumn, tgtDialect)} AS FLOAT) ELSE 0 END) as TotalSum
FROM ${quotedTgtTable}`,
            expectedResult: 'Aggregated values should match',
            category: 'transformation',
            severity: 'critical'
        },
        {
            name: `Transformation | Data Type Conversion - ${sourceTable} → ${targetTable}`,
            description: 'Verify data type conversions are accurate',
            sourceSQL: `SELECT TOP 10 ${quoteName(sampleColumn, srcDialect)}, CAST(${quoteName(sampleColumn, srcDialect)} AS VARCHAR(MAX)) as ConvertedValue
FROM ${quotedSrcTable}
WHERE ${quoteName(sampleColumn, srcDialect)} IS NOT NULL`,
            targetSQL: `SELECT TOP 10 ${quoteName(sampleColumn, tgtDialect)}, CAST(${quoteName(sampleColumn, tgtDialect)} AS VARCHAR(MAX)) as ConvertedValue
FROM ${quotedTgtTable}
WHERE ${quoteName(sampleColumn, tgtDialect)} IS NOT NULL`,
            expectedResult: 'Converted values should match expected format',
            category: 'transformation',
            severity: 'major'
        },
        {
            name: `Transformation | Data Denormalization Check - ${sourceTable} → ${targetTable}`,
            description: 'Verify denormalization logic (if applicable)',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, COUNT(*) as OccurrenceCount
FROM ${quotedSrcTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}`,
            targetSQL: `SELECT ${quoteName(sampleColumn, tgtDialect)}, COUNT(*) as OccurrenceCount
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'Denormalized data should maintain correct relationships',
            category: 'transformation',
            severity: 'major'
        }
    );

    // === ETL REGRESSION TESTING (3 tests) ===
    testCases.push(
        {
            name: `Regression | Metadata Changes Detection - ${targetTable}`,
            description: 'Detect any changes to table metadata since last run',
            sourceSQL: `SELECT COUNT(*) as ColumnCount,
    STRING_AGG(COLUMN_NAME + ':' + DATA_TYPE, ',') as ColumnSignature
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTable}'`,
            targetSQL: `-- Compare with baseline metadata
SELECT COUNT(*) as BaselineColumnCount
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${targetTable}'`,
            expectedResult: 'No unexpected metadata changes',
            category: 'regression',
            severity: 'critical'
        },
        {
            name: `Regression | Baseline Data Comparison - ${targetTable}`,
            description: 'Compare current target data against source (as baseline)',
            sourceSQL: `SELECT COUNT(*) as BaselineCount,
    CHECKSUM_AGG(CHECKSUM(${safeSourceChecksumCols})) as BaselineChecksum
FROM ${quotedSrcTable}`,
            targetSQL: `-- Compare with baseline or previous run
SELECT COUNT(*) as CurrentCount,
    CHECKSUM_AGG(CHECKSUM(${safeTargetChecksumCols})) as CurrentChecksum
FROM ${quotedTgtTable}`,
            expectedResult: 'Current data matches expected baseline',
            category: 'regression',
            severity: 'major'
        },
        {
            name: `Regression | Automated ETL Testing - ${sourceTable} → ${targetTable}`,
            description: 'Verify ETL process can be automated and repeated consistently',
            sourceSQL: `SELECT COUNT(*) as SourceRecords,
    CHECKSUM_AGG(CHECKSUM(${safeSourceChecksumCols})) as SourceChecksum
FROM ${quotedSrcTable}`,
            targetSQL: `SELECT COUNT(*) as TargetRecords,
    CHECKSUM_AGG(CHECKSUM(${safeTargetChecksumCols})) as TargetChecksum
FROM ${quotedTgtTable}`,
            expectedResult: 'Automated runs produce consistent results',
            category: 'regression',
            severity: 'major'
        }
    );

    // === REFERENCE DATA TESTING (3 tests) ===
    testCases.push(
        {
            name: `Reference Data | Domain Value Validation - ${targetTable}`,
            description: 'Ensure values conform to allowed reference values',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}
FROM ${quotedSrcTable}
WHERE ${quoteName(sampleColumn, srcDialect)} IS NOT NULL
GROUP BY ${quoteName(sampleColumn, srcDialect)}`,
            targetSQL: `SELECT ${quoteName(sampleColumn, tgtDialect)}
FROM ${quotedTgtTable}
WHERE ${quoteName(sampleColumn, tgtDialect)} IS NOT NULL
GROUP BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'All target values should be valid',
            category: 'reference',
            severity: 'major'
        },
        {
            name: `Reference Data | Cross-Environment Domain Check - ${targetTable}`,
            description: 'Compare domain values across environments (DEV/QA/PROD)',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, COUNT(*) as Frequency
FROM ${quotedSrcTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}
ORDER BY ${quoteName(sampleColumn, srcDialect)}`,
            targetSQL: `-- Compare with other environment
SELECT ${quoteName(sampleColumn, tgtDialect)}, COUNT(*) as Frequency
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}
ORDER BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'Domain values should be consistent across environments',
            category: 'reference',
            severity: 'major'
        },
        {
            name: `Reference Data | Change Tracking - ${targetTable}`,
            description: 'Track reference data changes over time',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, 
    COUNT(*) as CurrentCount
FROM ${quotedSrcTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}`,
            targetSQL: `-- Compare with historical reference data
SELECT ${quoteName(sampleColumn, tgtDialect)},
    COUNT(*) as HistoricalCount
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'Reference data changes should be tracked and documented',
            category: 'reference',
            severity: 'minor'
        }
    );

    // === INCREMENTAL ETL TESTING (4 tests) ===
    testCases.push(
        {
            name: `Incremental | Duplicate Data Checks - ${sourceTable} → ${targetTable}`,
            description: 'Ensure no duplicates introduced during incremental load',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, COUNT(*) as DuplicateCount
FROM ${quotedSrcTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}
HAVING COUNT(*) > 1`,
            targetSQL: `SELECT ${quoteName(sampleColumn, tgtDialect)}, COUNT(*) as DuplicateCount
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}
HAVING COUNT(*) > 1`,
            expectedResult: 'No duplicate records in incremental load',
            category: 'incremental',
            severity: 'critical'
        },
        {
            name: `Incremental | Compare Data Values - ${sourceTable} → ${targetTable}`,
            description: 'Verify incremental data values match source',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, COUNT(*) as RecordCount
FROM ${quotedSrcTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}`,
            targetSQL: `SELECT ${quoteName(sampleColumn, tgtDialect)}, COUNT(*) as RecordCount
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'Incremental data values should match source',
            category: 'incremental',
            severity: 'critical'
        },
        {
            name: `Incremental | Data Denormalization Check - ${sourceTable} → ${targetTable}`,
            description: 'Verify denormalization during incremental load',
            sourceSQL: `SELECT COUNT(DISTINCT ${quoteName(sampleColumn, srcDialect)}) as UniqueCount
FROM ${quotedSrcTable}`,
            targetSQL: `SELECT COUNT(DISTINCT ${quoteName(sampleColumn, tgtDialect)}) as UniqueCount
FROM ${quotedTgtTable}`,
            expectedResult: 'Denormalization should be consistent in incremental loads',
            category: 'incremental',
            severity: 'major'
        },
        {
            name: `Incremental | Slowly Changing Dimension (SCD Type 2) - ${targetTable}`,
            description: 'Verify SCD Type 2 logic for historical tracking',
            sourceSQL: `SELECT ${quoteName(sampleColumn, srcDialect)}, COUNT(*) as VersionCount
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, srcDialect)}
HAVING COUNT(*) > 1`,
            targetSQL: `-- Verify SCD columns exist and are properly maintained
SELECT ${quoteName(sampleColumn, tgtDialect)},
    COUNT(*) as Versions
FROM ${quotedTgtTable}
GROUP BY ${quoteName(sampleColumn, tgtDialect)}`,
            expectedResult: 'Historical versions preserved with correct SCD flags',
            category: 'incremental',
            severity: 'critical'
        }
    );

    // === ETL INTEGRATION TESTING (1 test) ===
    testCases.push({
        name: `Integration | End-to-End Data Flow - ${sourceTable} → ${targetTable}`,
        description: 'Validate complete ETL pipeline from source to target',
        sourceSQL: `SELECT COUNT(*) as SourceRecords,
    MIN(${quoteName(sampleColumn, srcDialect)}) as MinValue,
    MAX(${quoteName(sampleColumn, srcDialect)}) as MaxValue
FROM ${quotedSrcTable}`,
        targetSQL: `SELECT COUNT(*) as TargetRecords,
    MIN(${quoteName(sampleColumn, tgtDialect)}) as MinValue,
    MAX(${quoteName(sampleColumn, tgtDialect)}) as MaxValue
FROM ${quotedTgtTable}`,
        expectedResult: 'All source records processed and loaded to target',
        category: 'integration',
        severity: 'critical'
    });

    // === ETL PERFORMANCE TESTING (1 test) ===
    testCases.push({
        name: `Performance | Load Time Validation - ${targetTable}`,
        description: 'Ensure ETL completes within acceptable timeframe',
        sourceSQL: `SELECT COUNT(*) as RecordCount
FROM ${quotedSrcTable}`,
        targetSQL: `-- Monitor ETL execution time
SELECT COUNT(*) as ProcessedCount
FROM ${quotedTgtTable}`,
        expectedResult: 'ETL completes within SLA (adjust based on volume)',
        category: 'performance',
        severity: 'major'
    });

    return testCases;
}

/**
 * Extract unique source-target table pairs from parsed mapping data
 */
export function extractTablePairs(
    mappings: any[],
    sourceSchema?: DatabaseSchema | null,
    targetSchema?: DatabaseSchema | null
): TablePair[] {
    const pairs = new Map<string, TablePair>();

    for (const mapping of mappings) {
        const srcTableRaw = mapping.sourceTable || mapping.source_table || mapping.SourceTable || '';
        const tgtTableRaw = mapping.targetTable || mapping.target_table || mapping.TargetTable || '';

        const srcTable = String(srcTableRaw).trim();
        const tgtTable = String(tgtTableRaw).trim();

        if (srcTable && tgtTable) {
            // key is normalized to lowercase to prevent duplicates from case variations
            const key = `${srcTable.toLowerCase()}::${tgtTable.toLowerCase()}`;
            if (!pairs.has(key)) {
                pairs.set(key, { sourceTable: srcTable, targetTable: tgtTable });
            }
        }
    }

    return Array.from(pairs.values());
}

// === DIALECT HELPERS ===
function getDialect(dbType: string): string {
    const normalized = dbType.toLowerCase();
    if (normalized.includes('postgres') || normalized.includes('pg')) return 'postgres';
    if (normalized.includes('mysql')) return 'mysql';
    if (normalized.includes('oracle')) return 'oracle';
    if (normalized.includes('snowflake')) return 'snowflake';
    if (normalized.includes('databricks')) return 'databricks';
    return 'mssql'; // default
}

function quoteName(name: string, dialect: string): string {
    if (dialect === 'postgres' || dialect === 'snowflake' || dialect === 'databricks') {
        return `"${name}"`;
    } else if (dialect === 'mysql') {
        return `\`${name}\``;
    } else {
        return `[${name}]`;
    }
}

function getLenFn(dialect: string): string {
    if (dialect === 'postgres') return 'LENGTH';
    if (dialect === 'oracle') return 'LENGTH';
    return 'LEN';
}

function getLimitClause(dialect: string, n: number): string {
    if (dialect === 'mssql') return `TOP ${n}`;
    if (dialect === 'oracle') return `ROWNUM <= ${n}`;
    return `LIMIT ${n}`;
}

function getTypeCast(dialect: string): string {
    if (dialect === 'postgres') return 'CAST(column AS NUMERIC)';
    if (dialect === 'mysql') return 'CAST(column AS DECIMAL)';
    return 'CAST(column AS FLOAT)';
}
