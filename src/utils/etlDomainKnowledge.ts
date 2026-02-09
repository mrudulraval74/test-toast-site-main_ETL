// ETL Domain Knowledge - Understanding ETL terminology and patterns
// Maps ETL concepts to appropriate SQL test strategies

export interface ETLPattern {
    keywords: string[];
    category: 'direct_move' | 'business_rule' | 'transformation' | 'lookup' | 'validation';
    sqlStrategy: string;
    description: string;
}

/**
 * Comprehensive ETL terminology and patterns
 */
export const ETL_PATTERNS: ETLPattern[] = [
    // DIRECT MOVE PATTERNS
    {
        keywords: ['direct', 'no change', 'as is', 'same', 'copy', 'pass through', 'straight', 'unchanged'],
        category: 'direct_move',
        sqlStrategy: 'exact_match',
        description: 'Column copied without modification'
    },

    // BUSINESS RULE PATTERNS
    {
        keywords: ['business rule', 'business logic', 'mapping rule', 'transformation rule', 'data rule'],
        category: 'business_rule',
        sqlStrategy: 'rule_validation',
        description: 'Business logic applied to transform data'
    },
    {
        keywords: ['conditional', 'case when', 'if then', 'condition', 'when', 'decode'],
        category: 'business_rule',
        sqlStrategy: 'conditional_logic',
        description: 'Conditional transformation based on logic'
    },
    {
        keywords: ['derive', 'derived', 'calculate', 'computed', 'formula'],
        category: 'business_rule',
        sqlStrategy: 'calculation',
        description: 'Calculated or derived value'
    },
    {
        keywords: ['default', 'default value', 'hardcode', 'constant', 'static'],
        category: 'business_rule',
        sqlStrategy: 'default_value',
        description: 'Default or hardcoded value assignment'
    },

    // LOOKUP/REFERENCE PATTERNS
    {
        keywords: ['lookup', 'reference', 'join', 'map', 'mapping table', 'dimension', 'master data'],
        category: 'lookup',
        sqlStrategy: 'join_validation',
        description: 'Lookup from reference/dimension table'
    },
    {
        keywords: ['surrogate key', 'sk', 'sequence', 'identity', 'auto increment'],
        category: 'lookup',
        sqlStrategy: 'surrogate_key',
        description: 'Surrogate key assignment'
    },

    // DATA QUALITY/VALIDATION PATTERNS
    {
        keywords: ['validate', 'validation', 'check', 'verify', 'ensure'],
        category: 'validation',
        sqlStrategy: 'validation_check',
        description: 'Data quality validation'
    },
    {
        keywords: ['cleanse', 'clean', 'scrub', 'standardize', 'normalize'],
        category: 'transformation',
        sqlStrategy: 'data_cleansing',
        description: 'Data cleansing and standardization'
    },
    {
        keywords: ['deduplicate', 'dedupe', 'remove duplicates', 'distinct', 'unique'],
        category: 'validation',
        sqlStrategy: 'deduplication',
        description: 'Duplicate removal'
    },

    // TRANSFORMATION PATTERNS
    {
        keywords: ['transform', 'conversion', 'convert', 'change format'],
        category: 'transformation',
        sqlStrategy: 'format_conversion',
        description: 'Format or type transformation'
    },
    {
        keywords: ['aggregate', 'sum', 'count', 'avg', 'average', 'min', 'max', 'total', 'rollup'],
        category: 'transformation',
        sqlStrategy: 'aggregation',
        description: 'Aggregation calculation'
    },
    {
        keywords: ['split', 'parse', 'extract', 'substring', 'delimiter'],
        category: 'transformation',
        sqlStrategy: 'string_parsing',
        description: 'String parsing and extraction'
    },
    {
        keywords: ['concatenate', 'concat', 'combine', 'merge', 'join strings'],
        category: 'transformation',
        sqlStrategy: 'concatenation',
        description: 'String concatenation'
    },
    {
        keywords: ['trim', 'strip', 'remove spaces', 'ltrim', 'rtrim'],
        category: 'transformation',
        sqlStrategy: 'trimming',
        description: 'Whitespace removal'
    },
    {
        keywords: ['upper', 'lowercase', 'lower', 'uppercase', 'title case', 'proper case'],
        category: 'transformation',
        sqlStrategy: 'case_conversion',
        description: 'Case conversion'
    },
    {
        keywords: ['null', 'null handling', 'isnull', 'coalesce', 'nvl', 'ifnull'],
        category: 'transformation',
        sqlStrategy: 'null_handling',
        description: 'NULL value handling'
    },
    {
        keywords: ['date', 'datetime', 'timestamp', 'date format', 'date conversion'],
        category: 'transformation',
        sqlStrategy: 'date_handling',
        description: 'Date/time transformation'
    },

    // SLOWLY CHANGING DIMENSION PATTERNS
    {
        keywords: ['scd', 'slowly changing', 'scd type 1', 'scd type 2', 'scd type 3', 'historical', 'versioning'],
        category: 'business_rule',
        sqlStrategy: 'scd_logic',
        description: 'Slowly Changing Dimension logic'
    },
    {
        keywords: ['effective date', 'valid from', 'valid to', 'start date', 'end date', 'current flag'],
        category: 'business_rule',
        sqlStrategy: 'temporal_validity',
        description: 'Temporal validity management'
    },

    // ETL METADATA PATTERNS
    {
        keywords: ['audit', 'audit column', 'created date', 'modified date', 'created by', 'modified by'],
        category: 'business_rule',
        sqlStrategy: 'audit_columns',
        description: 'Audit metadata population'
    },
    {
        keywords: ['batch', 'batch id', 'load id', 'run id', 'etl timestamp'],
        category: 'business_rule',
        sqlStrategy: 'batch_tracking',
        description: 'Batch/load tracking'
    }
];

/**
 * Analyze transformation logic text for ETL patterns
 */
export function analyzeETLLogic(transformationLogic: string): {
    matchedPatterns: ETLPattern[];
    primaryPattern: ETLPattern | null;
    category: string;
    confidence: number;
} {
    if (!transformationLogic || transformationLogic.trim() === '') {
        return {
            matchedPatterns: [],
            primaryPattern: null,
            category: 'direct_move',
            confidence: 1.0
        };
    }

    const logic = transformationLogic.toLowerCase();
    const matchedPatterns: ETLPattern[] = [];

    // Check each pattern
    for (const pattern of ETL_PATTERNS) {
        const matchCount = pattern.keywords.filter(keyword =>
            logic.includes(keyword.toLowerCase())
        ).length;

        if (matchCount > 0) {
            matchedPatterns.push(pattern);
        }
    }

    // Determine primary pattern (first match or most specific)
    const primaryPattern = matchedPatterns.length > 0 ? matchedPatterns[0] : null;
    const category = primaryPattern?.category || 'transformation';
    const confidence = matchedPatterns.length > 0 ? 0.8 : 0.3;

    return {
        matchedPatterns,
        primaryPattern,
        category,
        confidence
    };
}

/**
 * Generate SQL strategy based on ETL pattern understanding
 */
export function generateETLTestSQL(
    sourceColumn: string,
    targetColumn: string,
    transformationLogic: string
): {
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    testDescription: string;
} {
    const analysis = analyzeETLLogic(transformationLogic);
    const strategy = analysis.primaryPattern?.sqlStrategy || 'exact_match';

    let sourceSQL = '';
    let targetSQL = '';
    let expectedResult = '';
    let testDescription = '';

    switch (strategy) {
        case 'exact_match':
            testDescription = `Verify exact copy: ${sourceColumn} → ${targetColumn}`;
            sourceSQL = `-- Exact match validation
SELECT [${sourceColumn}], COUNT(*) as RecordCount
FROM {{SRC_TABLE}}
GROUP BY [${sourceColumn}]
ORDER BY [${sourceColumn}]`;
            targetSQL = `-- Should match source exactly
SELECT [${targetColumn}], COUNT(*) as RecordCount
FROM {{TGT_TABLE}}
GROUP BY [${targetColumn}]
ORDER BY [${targetColumn}]`;
            expectedResult = 'Values and counts must match exactly';
            break;

        case 'rule_validation':
        case 'conditional_logic':
            testDescription = `Validate business rule: ${transformationLogic}`;
            sourceSQL = `-- Source values before rule
SELECT 
    [${sourceColumn}],
    COUNT(*) as SourceCount,
    COUNT(DISTINCT [${sourceColumn}]) as UniqueValues
FROM {{SRC_TABLE}}
GROUP BY [${sourceColumn}]`;
            targetSQL = `-- Transformed values after rule: ${transformationLogic}
SELECT 
    [${targetColumn}],
    COUNT(*) as TargetCount,  
    COUNT(DISTINCT [${targetColumn}]) as UniqueValues
FROM {{TGT_TABLE}}
GROUP BY [${targetColumn}]`;
            expectedResult = `Business rule correctly applied: ${transformationLogic}`;
            break;

        case 'join_validation':
            testDescription = `Verify lookup/join: ${transformationLogic}`;
            sourceSQL = `-- Source keys for lookup
SELECT 
    [${sourceColumn}],
    COUNT(*) as RecordCount
FROM {{SRC_TABLE}}
GROUP BY [${sourceColumn}]`;
            targetSQL = `-- Verify lookup result
SELECT 
    [${targetColumn}],
    COUNT(*) as RecordCount
FROM {{TGT_TABLE}}
GROUP BY [${targetColumn}]`;
            expectedResult = `All lookups successful, no orphan records`;
            break;

        case 'validation_check':
            testDescription = `Data quality validation: ${transformationLogic}`;
            sourceSQL = `-- Check data quality in source
SELECT 
    COUNT(*) as TotalRecords,
    SUM(CASE WHEN [${sourceColumn}] IS NULL THEN 1 ELSE 0 END) as NullCount,
    SUM(CASE WHEN [${sourceColumn}] = '' THEN 1 ELSE 0 END) as EmptyCount,
    COUNT(DISTINCT [${sourceColumn}]) as UniqueCount
FROM {{SRC_TABLE}}`;
            targetSQL = `-- Verify quality after validation
SELECT 
    COUNT(*) as TotalRecords,
    SUM(CASE WHEN [${targetColumn}] IS NULL THEN 1 ELSE 0 END) as NullCount,
    SUM(CASE WHEN [${targetColumn}] = '' THEN 1 ELSE 0 END) as EmptyCount,
    COUNT(DISTINCT [${targetColumn}]) as UniqueCount
FROM {{TGT_TABLE}}`;
            expectedResult = `Data quality improved: ${transformationLogic}`;
            break;

        case 'null_handling':
            testDescription = `NULL handling: ${transformationLogic}`;
            sourceSQL = `-- NULL analysis in source
SELECT 
    COUNT(*) as TotalRows,
    SUM(CASE WHEN [${sourceColumn}] IS NULL THEN 1 ELSE 0 END) as NullCount,
    SUM(CASE WHEN [${sourceColumn}] IS NOT NULL THEN 1 ELSE 0 END) as NotNullCount
FROM {{SRC_TABLE}}`;
            targetSQL = `-- Verify NULL handling in target
SELECT 
    COUNT(*) as TotalRows,
    SUM(CASE WHEN [${targetColumn}] IS NULL THEN 1 ELSE 0 END) as StillNullCount,
    SUM(CASE WHEN [${targetColumn}] IS NOT NULL THEN 1 ELSE 0 END) as ReplacedCount  
FROM {{TGT_TABLE}}`;
            expectedResult = `NULLs handled as per: ${transformationLogic}`;
            break;

        case 'aggregation':
            testDescription = `Aggregation: ${transformationLogic}`;
            sourceSQL = `-- Source detail for aggregation
SELECT 
    COUNT(*) as DetailCount,
    SUM(CASE WHEN ISNUMERIC([${sourceColumn}]) = 1 THEN CAST([${sourceColumn}] AS FLOAT) ELSE 0 END) as DetailSum
FROM {{SRC_TABLE}}`;
            targetSQL = `-- Aggregated result
SELECT 
    COUNT(*) as AggregateCount,
    SUM([${targetColumn}]) as AggregateSum
FROM {{TGT_TABLE}}`;
            expectedResult = `Aggregation matches formula: ${transformationLogic}`;
            break;

        case 'scd_logic':
            testDescription = `SCD validation: ${transformationLogic}`;
            sourceSQL = `-- Source current records
SELECT 
    [${sourceColumn}],
    COUNT(*) as CurrentCount
FROM {{SRC_TABLE}}
WHERE IsActive = 1 OR CurrentFlag = 'Y'
GROUP BY [${sourceColumn}]`;
            targetSQL = `-- SCD dimension with history
SELECT 
    [${targetColumn}],
    COUNT(*) as VersionCount,
    SUM(CASE WHEN IsCurrent = 1 THEN 1 ELSE 0 END) as CurrentVersions
FROM {{TGT_TABLE}}
GROUP BY [${targetColumn}]`;
            expectedResult = `SCD logic maintains history correctly`;
            break;

        case 'audit_columns':
            testDescription = `Audit metadata: ${transformationLogic}`;
            sourceSQL = `-- Source record timestamps
SELECT COUNT(*) as RecordCount
FROM {{SRC_TABLE}}`;
            targetSQL = `-- Verify audit columns populated
SELECT 
    COUNT(*) as RecordCount,
    COUNT([${targetColumn}]) as PopulatedCount,
    MIN([${targetColumn}]) as EarliestTimestamp,
    MAX([${targetColumn}]) as LatestTimestamp
FROM {{TGT_TABLE}}`;
            expectedResult = `Audit metadata correctly populated`;
            break;

        default:
            testDescription = `Transform: ${transformationLogic}`;
            sourceSQL = `SELECT [${sourceColumn}], COUNT(*) as RecordCount
FROM {{SRC_TABLE}}
GROUP BY [${sourceColumn}]`;
            targetSQL = `SELECT [${targetColumn}], COUNT(*) as RecordCount
FROM {{TGT_TABLE}}
GROUP BY [${targetColumn}]`;
            expectedResult = `Transformation applied: ${transformationLogic}`;
    }

    return {
        sourceSQL,
        targetSQL,
        expectedResult,
        testDescription
    };
}
