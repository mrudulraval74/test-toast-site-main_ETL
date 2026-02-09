// Comprehensive ETL Test Case Generator
// Generates test cases for all 9 ETL testing categories

import { parseMappingSheet, type ParsedMappingSheet } from './mappingSheetParser';

export interface TestCase {
    name: string;
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    category?: 'direct_move' | 'business_rule' | 'transformation' | 'general';
    severity?: 'critical' | 'major' | 'minor';
}

export interface MappingAnalysis {
    sourceTables: string[];
    targetTables: string[];
    businessRules: string[];
    testCases: TestCase[];
}

export function generateComprehensiveTests(mappingData: any[]): MappingAnalysis {
    const testCases: TestCase[] = [];

    if (mappingData.length === 0) {
        return {
            sourceTables: ['[Configure Source Table]'],
            targetTables: ['[Configure Target Table]'],
            businessRules: ['No data provided'],
            testCases: []
        };
    }

    const firstRow = mappingData[0];
    const columns = Object.keys(firstRow);

    // Intelligent column detection
    const sourceColumns: string[] = [];
    const targetColumns: string[] = [];
    const transformationInfo: string[] = [];

    columns.forEach(col => {
        const lowerCol = col.toLowerCase();
        if (lowerCol.includes('source') || lowerCol.includes('src')) {
            sourceColumns.push(col);
        } else if (lowerCol.includes('target') || lowerCol.includes('tgt') || lowerCol.includes('dest')) {
            targetColumns.push(col);
        } else if (lowerCol.includes('transform') || lowerCol.includes('rule') || lowerCol.includes('logic') || lowerCol.includes('formula')) {
            transformationInfo.push(col);
        }
    });

    const sampleColumn = columns[0] || 'YourColumn';
    const sampleColumns = columns.slice(0, 5).join(', ');

    // ===  METADATA TESTING (3 tests) ===
    testCases.push(
        {
            name: 'MetaData - Data Type Check',
            description: 'Verify data types match between source and target columns',
            sourceSQL: `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '{{SRC_TABLE}}'
ORDER BY ORDINAL_POSITION`,
            targetSQL: `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '{{TGT_TABLE}}'
ORDER BY ORDINAL_POSITION`,
            expectedResult: 'Data types should match for mapped columns',
            category: 'general',
            severity: 'critical'
        },
        {
            name: 'MetaData - Data Length Check',
            description: 'Ensure column lengths are sufficient in target',
            sourceSQL: `SELECT MAX(LEN(${sampleColumn})) AS MaxLength FROM {{SRC_TABLE}}`,
            targetSQL: `SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = '{{TGT_TABLE}}' AND COLUMN_NAME = '${sampleColumn}'`,
            expectedResult: 'Target column length >= source max data length',
            category: 'general',
            severity: 'major'
        },
        {
            name: 'MetaData - Index and Constraint Check',
            description: 'Verify primary keys and indexes exist on target table',
            sourceSQL: `SELECT name, type_desc FROM sys.indexes 
WHERE object_id = OBJECT_ID('{{SRC_TABLE}}')`,
            targetSQL: `SELECT name, type_desc FROM sys.indexes 
WHERE object_id = OBJECT_ID('{{TGT_TABLE}}')`,
            expectedResult: 'Target should have appropriate indexes',
            category: 'general',
            severity: 'major'
        }
    );

    // === DATA COMPLETENESS TESTING (3 tests) ===
    testCases.push(
        {
            name: 'Completeness - Record Count Validation',
            description: 'Ensure source and target have same number of rows',
            sourceSQL: 'SELECT COUNT(*) AS Record_Count FROM {{SRC_TABLE}}',
            targetSQL: 'SELECT COUNT(*) AS Record_Count FROM {{TGT_TABLE}}',
            expectedResult: 'Row counts should be equal',
            category: 'general',
            severity: 'critical'
        },
        {
            name: 'Completeness - Column Data Profile',
            description: 'Validate all required columns are populated',
            sourceSQL: `SELECT 
    ${columns.slice(0, 5).map(c => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS [${c}_Nulls]`).join(',\n    ')}
FROM {{SRC_TABLE}}`,
            targetSQL: `SELECT 
    ${columns.slice(0, 5).map(c => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS [${c}_Nulls]`).join(',\n    ')}
FROM {{TGT_TABLE}}`,
            expectedResult: 'NULL counts should match for non-transformed columns',
            category: 'general',
            severity: 'major'
        },
        {
            name: 'Completeness - Compare Entire Source vs Target Data',
            description: 'Full dataset comparison using EXCEPT',
            sourceSQL: `SELECT ${sampleColumns}
FROM {{SRC_TABLE}}
EXCEPT
SELECT ${sampleColumns}
FROM {{TGT_TABLE}}`,
            targetSQL: `SELECT ${sampleColumns}
FROM {{TGT_TABLE}}
EXCEPT
SELECT ${sampleColumns}
FROM {{SRC_TABLE}}`,
            expectedResult: 'No rows returned from either query (perfect match)',
            category: 'direct_move',
            severity: 'critical'
        }
    );

    // === DATA QUALITY TESTING (3 tests) ===
    testCases.push(
        {
            name: 'Quality - Duplicate Data Checks',
            description: 'Identify duplicate records in target',
            sourceSQL: `SELECT ${sampleColumn}, COUNT(*) as DuplicateCount
FROM {{SRC_TABLE}}
GROUP BY ${sampleColumn}
HAVING COUNT(*) > 1`,
            targetSQL: `SELECT ${sampleColumn}, COUNT(*) as DuplicateCount
FROM {{TGT_TABLE}}
GROUP BY ${sampleColumn}
HAVING COUNT(*) > 1`,
            expectedResult: 'No duplicates in target (or matching source duplicates)',
            category: 'general',
            severity: 'critical'
        },
        {
            name: 'Quality - Data Validation Rules',
            description: 'Check for invalid data patterns',
            sourceSQL: `SELECT COUNT(*) as InvalidRecords
FROM {{SRC_TABLE}}
WHERE ${sampleColumn} IS NULL OR ${sampleColumn} = ''`,
            targetSQL: `SELECT COUNT(*) as InvalidRecords
FROM {{TGT_TABLE}}
WHERE ${sampleColumn} IS NULL OR ${sampleColumn} = ''`,
            expectedResult: 'Target should have 0 invalid records if business rules applied',
            category: 'business_rule',
            severity: 'major'
        },
        {
            name: 'Quality - Data Integrity Checks',
            description: 'Verify referential integrity constraints',
            sourceSQL: `SELECT DISTINCT ${sampleColumn}
FROM {{SRC_TABLE}}
WHERE ${sampleColumn} NOT IN (SELECT KeyColumn FROM ReferenceTable)`,
            targetSQL: `SELECT COUNT(*) as OrphanRecords
FROM {{TGT_TABLE}} T
WHERE NOT EXISTS (SELECT 1 FROM ReferenceTable R WHERE R.KeyColumn = T.${sampleColumn})`,
            expectedResult: 'No orphan records in target',
            category: 'general',
            severity: 'major'
        }
    );

    // === DATA TRANSFORMATION TESTING (5 tests) ===
    testCases.push(
        {
            name: 'Transformation - Direct Move Validation',
            description: 'Verify columns moved without modification',
            sourceSQL: `SELECT TOP 100 ${sampleColumns}
FROM {{SRC_TABLE}}
ORDER BY ${sampleColumn}`,
            targetSQL: `SELECT TOP 100 ${sampleColumns}
FROM {{TGT_TABLE}}
ORDER BY ${sampleColumn}`,
            expectedResult: 'Values should match exactly for direct move columns',
            category: 'direct_move',
            severity: 'critical'
        },
        {
            name: 'Transformation - Date Format Validation',
            description: 'Check if date formats are correctly transformed',
            sourceSQL: `SELECT ${sampleColumn}, 
    CONVERT(VARCHAR, DateColumn, 120) as OriginalFormat
FROM {{SRC_TABLE}}
WHERE DateColumn IS NOT NULL`,
            targetSQL: `SELECT ${sampleColumn},
    FORMAT(DateColumn, 'dd-MM-yyyy') as TransformedFormat
FROM {{TGT_TABLE}}
WHERE DateColumn IS NOT NULL`,
            expectedResult: 'Date formats match expected transformation pattern',
            category: 'transformation',
            severity: 'major'
        },
        {
            name: 'Transformation - NULL Handling Validation',
            description: 'Verify NULL values are properly handled (ISNULL/COALESCE)',
            sourceSQL: `SELECT COUNT(*) as NullCount
FROM {{SRC_TABLE}}
WHERE ${sampleColumn} IS NULL`,
            targetSQL: `SELECT COUNT(*) as DefaultValueCount
FROM {{TGT_TABLE}}
WHERE ${sampleColumn} = '0' OR ${sampleColumn} = 'N/A'`,
            expectedResult: 'NULL source values transformed to default values in target',
            category: 'transformation',
            severity: 'major'
        },
        {
            name: 'Transformation - String Trimming Validation',
            description: 'Ensure extra spaces are removed (LTRIM/RTRIM)',
            sourceSQL: `SELECT ${sampleColumn},
    DATALENGTH(${sampleColumn}) as OriginalLength
FROM {{SRC_TABLE}}
WHERE ${sampleColumn} LIKE ' %' OR ${sampleColumn} LIKE '% '`,
            targetSQL: `SELECT ${sampleColumn},
    DATALENGTH(${sampleColumn}) as TrimmedLength
FROM {{TGT_TABLE}}
WHERE LEN(${sampleColumn}) != LEN(LTRIM(RTRIM(${sampleColumn})))`,
            expectedResult: 'Target should have no leading/trailing spaces',
            category: 'transformation',
            severity: 'minor'
        },
        {
            name: 'Transformation - Aggregation Validation',
            description: 'Verify SUM/AVG/MIN/MAX calculations',
            sourceSQL: `SELECT 
    COUNT(*) as RecordCount,
    SUM(CASE WHEN ISNUMERIC(${sampleColumn}) = 1 THEN CAST(${sampleColumn} AS FLOAT) ELSE 0 END) as TotalSum
FROM {{SRC_TABLE}}`,
            targetSQL: `SELECT 
    COUNT(*) as RecordCount,
    SUM(CASE WHEN ISNUMERIC(${sampleColumn}) = 1 THEN CAST(${sampleColumn} AS FLOAT) ELSE 0 END) as TotalSum
FROM {{TGT_TABLE}}`,
            expectedResult: 'Aggregated values should match',
            category: 'transformation',
            severity: 'critical'
        }
    );

    // === ETL REGRESSION TESTING (1 test) ===
    testCases.push({
        name: 'Regression - Baseline Comparison',
        description: 'Compare current target with baseline snapshot',
        sourceSQL: `SELECT COUNT(*) as CurrentCount,
    SUM(CHECKSUM(*)) as CurrentChecksum
FROM {{TGT_TABLE}}`,
        targetSQL: `SELECT COUNT(*) as BaselineCount,
    SUM(CHECKSUM(*)) as BaselineChecksum
FROM {{TGT_TABLE}}_BASELINE`,
        expectedResult: 'Current data matches baseline (no unexpected changes)',
        category: 'general',
        severity: 'major'
    });

    // === REFERENCE DATA TESTING (1 test) ===
    testCases.push({
        name: 'Reference Data - Domain Value Validation',
        description: 'Ensure values conform to allowed reference values',
        sourceSQL: `SELECT DISTINCT StatusColumn
FROM {{SRC_TABLE}}
WHERE StatusColumn NOT IN ('Active', 'Inactive', 'Pending')`,
        targetSQL: `SELECT DISTINCT StatusColumn
FROM {{TGT_TABLE}}
WHERE StatusColumn NOT IN (SELECT AllowedValue FROM ReferenceTable WHERE Domain = 'Status')`,
        expectedResult: 'All target values should be in reference domain',
        category: 'business_rule',
        severity: 'major'
    });

    // === INCREMENTAL ETL TESTING (2 tests) ===
    testCases.push(
        {
            name: 'Incremental - Delta Record Detection',
            description: 'Identify only new/changed records since last load',
            sourceSQL: `SELECT COUNT(*) as NewRecords
FROM {{SRC_TABLE}}
WHERE ModifiedDate > (SELECT MAX(LastLoadDate) FROM ETL_Control)`,
            targetSQL: `SELECT COUNT(*) as LoadedRecords
FROM {{TGT_TABLE}}
WHERE LoadDate = (SELECT MAX(LoadDate) FROM {{TGT_TABLE}})`,
            expectedResult: 'Incremental load count matches delta records',
            category: 'general',
            severity: 'critical'
        },
        {
            name: 'Incremental - Slowly Changing Dimension (SCD Type 2)',
            description: 'Verify historical records are maintained correctly',
            sourceSQL: `SELECT ${sampleColumn}, COUNT(*) as VersionCount
FROM {{TGT_TABLE}}
GROUP BY ${sampleColumn}
HAVING COUNT(*) > 1`,
            targetSQL: `SELECT ${sampleColumn}, ValidFrom, ValidTo, IsCurrent
FROM {{TGT_TABLE}}
WHERE ${sampleColumn} IN (SELECT ${sampleColumn} FROM {{SRC_TABLE}} WHERE ModifiedFlag = 1)
ORDER BY ${sampleColumn}, ValidFrom`,
            expectedResult: 'Historical versions preserved with correct valid dates',
            category: 'business_rule',
            severity: 'critical'
        }
    );

    // === ETL INTEGRATION TESTING (1 test) ===
    testCases.push({
        name: 'Integration - End to End Data Flow',
        description: 'Validate complete ETL pipeline from source to final target',
        sourceSQL: `SELECT ${sampleColumn}, SourceTimestamp
FROM {{SRC_TABLE}}
WHERE LoadBatchID = (SELECT MAX(BatchID) FROM ETL_BatchControl)`,
        targetSQL: `SELECT ${sampleColumn}, TargetTimestamp, ProcessingStatus
FROM {{TGT_TABLE}}
WHERE LoadBatchID = (SELECT MAX(BatchID) FROM ETL_BatchControl)`,
        expectedResult: 'All source records processed and loaded to target',
        category: 'general',
        severity: 'critical'
    });

    // === ETL PERFORMANCE TESTING (1 test) ===
    testCases.push({
        name: 'Performance - Load Time Validation',
        description: 'Ensure ETL completes within acceptable timeframe',
        sourceSQL: `SELECT 
    COUNT(*) as RecordCount,
    MIN(LoadStartTime) as StartTime,
    MAX(LoadEndTime) as EndTime,
    DATEDIFF(SECOND, MIN(LoadStartTime), MAX(LoadEndTime)) as DurationSeconds
FROM ETL_LoadLog
WHERE BatchID = (SELECT MAX(BatchID) FROM ETL_BatchControl)`,
        targetSQL: `-- Expected SLA: Load should complete within 300 seconds
SELECT 
    CASE WHEN DATEDIFF(SECOND, MIN(LoadStartTime), MAX(LoadEndTime)) <= 300 
         THEN 'PASS' 
         ELSE 'FAIL' 
    END as PerformanceTest
FROM ETL_LoadLog
WHERE BatchID = (SELECT MAX(BatchID) FROM ETL_BatchControl)`,
        expectedResult: 'Performance test returns PASS (within SLA)',
        category: 'general',
        severity: 'major'
    });


    // Use intelligent parser for better insights
    const parsed = parseMappingSheet(mappingData);

    // Build smarter business rules based on parsed data
    const businessRules: string[] = [
        `📊 ${mappingData.length} rows in mapping sheet`,
        `🔍 Format detected: ${parsed.detectedFormat} (${Math.round(parsed.metadata.formatConfidence * 100)}% confidence)`,
        `✅ ${testCases.length} comprehensive test cases generated`,
        `📝$ ${parsed.columnMappings.length} column mappings identified`,
        `🔄 Transformation types: ${getTransformationSummary(parsed)}`,
        `Covering: MetaData, Completeness, Quality, Transformation, Regression, Reference Data, Incremental, Integration, Performance`
    ];

    if (transformationInfo.length > 0) {
        businessRules.push(`📌 Transformation rules in columns: ${transformationInfo.join(', ')}`);
    }

    if (parsed.transformationRules.length > 0) {
        businessRules.push(`📋 ${parsed.transformationRules.length} specific transformation rules detected`);
    }

    return {
        sourceTables: Array.from(parsed.sourceTables).length > 0
            ? Array.from(parsed.sourceTables)
            : (sourceColumns.length > 0 ? sourceColumns : ['[Configure Source Table Name]']),
        targetTables: Array.from(parsed.targetTables).length > 0
            ? Array.from(parsed.targetTables)
            : (targetColumns.length > 0 ? targetColumns : ['[Configure Target Table Name]']),
        businessRules,
        testCases
    };
}

// Helper function to summarize transformation types
function getTransformationSummary(parsed: ParsedMappingSheet): string {
    const types = parsed.columnMappings.map(m => m.transformationType);
    const counts: Record<string, number> = {};
    types.forEach(t => counts[t] = (counts[t] || 0) + 1);

    const summary = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => `${count}× ${type.replace('_', ' ')}`)
        .join(', ');

    return summary || 'direct moves';
}

