/**
 * Prompt-Enhanced ETL Test Case Generator
 * 
 * Parses user-provided natural language instructions and generates
 * additional targeted ETL test cases based on recognized keywords,
 * consulting the ETL Test Knowledge Base for patterns and rules.
 */

import { 
    BUSINESS_RULES, 
    TEST_SCENARIOS, 
    LAYER_RULES, 
    TESTING_TYPES,
    matchTestScenarios,
    detectLayers,
    detectTestingTypes
} from './etlTestKnowledgeBase';

export interface EnhancementDirective {
    type: string;
    columns?: string[];
    params?: Record<string, any>;
}

export interface PromptTestCase {
    name: string;
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    category: 'direct_move' | 'business_rule' | 'transformation' | 'general' | 'structure';
    severity: 'critical' | 'major' | 'minor';
}

interface ColumnMapping {
    sourceColumn: string;
    targetColumn: string;
    sourceTable?: string;
    targetTable?: string;
    sourceDataType?: string;
    targetDataType?: string;
    transformationLogic?: string;
}

// ---------------------------------------------------------------------------
// 1. Keyword Pattern Definitions
// ---------------------------------------------------------------------------

const KEYWORD_PATTERNS: { pattern: RegExp; type: string }[] = [
    { pattern: /\b(row\s*count|record\s*count|total\s*count|count\s*match)\b/i, type: 'row_count' },
    { pattern: /\b(null\s*check|null\s*value|null\s*validation|check\s*null|not\s*null|nulls?\b)/i, type: 'null_check_all' },
    { pattern: /\b(duplicate|duplicates|unique|uniqueness)\b/i, type: 'duplicate_all' },
    { pattern: /\b(sum|aggregate|min|max|avg|average|total)\b/i, type: 'aggregate' },
    { pattern: /\b(data\s*type|datatype|type\s*mismatch|type\s*check|type\s*validation)\b/i, type: 'datatype_check' },
    { pattern: /\b(trim|whitespace|leading\s*space|trailing\s*space|spaces)\b/i, type: 'trim_check' },
    { pattern: /\b(date|date\s*format|timestamp|datetime)\b/i, type: 'date_check' },
    { pattern: /\b(referential|foreign\s*key|fk|ref\s*integrity)\b/i, type: 'referential_integrity' },
    { pattern: /\b(distinct|distinct\s*count|unique\s*value|cardinality)\b/i, type: 'distinct_count' },
    { pattern: /\b(negative|boundary|edge\s*case|zero|min\s*value|max\s*value|overflow)\b/i, type: 'boundary' },
    { pattern: /\b(completeness|mandatory|required\s*field|required\s*column)\b/i, type: 'completeness' },
    { pattern: /\b(length|max\s*length|char\s*length|string\s*length|truncat)/i, type: 'length_check' },
    { pattern: /\b(round|rounding|decimal|precision)\b/i, type: 'rounding' },
];

// ---------------------------------------------------------------------------
// 2. Parse Prompt → Directives
// ---------------------------------------------------------------------------

export function parsePromptDirectives(prompt: string): EnhancementDirective[] {
    if (!prompt || !prompt.trim()) return [];

    const directives: EnhancementDirective[] = [];
    const seenTypes = new Set<string>();

    // 1. Check internal patterns
    for (const { pattern, type } of KEYWORD_PATTERNS) {
        if (pattern.test(prompt) && !seenTypes.has(type)) {
            seenTypes.add(type);
            const columns = extractMentionedColumns(prompt);
            directives.push({ type, columns: columns.length > 0 ? columns : undefined });
        }
    }

    // 2. Check Knowledge Base Scenarios
    const scenarios = matchTestScenarios(prompt);
    scenarios.forEach(s => {
        if (!seenTypes.has(s.id)) {
            seenTypes.add(s.id);
            directives.push({ type: `kb_scenario:${s.id}`, params: { scenarioId: s.id } });
        }
    });

    // 3. Check Testing Types
    const testingTypes = detectTestingTypes(prompt);
    testingTypes.forEach(tt => {
        if (!seenTypes.has(tt.name)) {
            seenTypes.add(tt.name);
            directives.push({ type: `kb_testing_type:${tt.name}` });
        }
    });

    // 4. Check Layers
    const layers = detectLayers(prompt);
    layers.forEach(l => {
        if (!seenTypes.has(l.layer)) {
            seenTypes.add(l.layer);
            directives.push({ type: `kb_layer:${l.layer}` });
        }
    });

    return directives;
}

/**
 * Extract potential column names from the prompt (words in quotes, backticks, or after "column"/"field")
 */
function extractMentionedColumns(prompt: string): string[] {
    const cols: string[] = [];

    // Match quoted names: "ColumnName", 'ColumnName', `ColumnName`
    const quotedMatches = prompt.match(/["'`]([A-Za-z_][A-Za-z0-9_]*?)["'`]/g);
    if (quotedMatches) {
        quotedMatches.forEach(m => {
            cols.push(m.replace(/["'`]/g, ''));
        });
    }

    // Match "column X" or "field X" patterns
    const fieldMatches = prompt.match(/(?:column|field|attr(?:ibute)?)\s+([A-Za-z_][A-Za-z0-9_]*)/gi);
    if (fieldMatches) {
        fieldMatches.forEach(m => {
            const parts = m.split(/\s+/);
            if (parts.length >= 2) cols.push(parts[parts.length - 1]);
        });
    }

    return [...new Set(cols)];
}

/**
 * Return human-readable labels for recognized keywords (for UI badges)
 */
export function getRecognizedKeywords(prompt: string): string[] {
    if (!prompt || !prompt.trim()) return [];
    const labels: string[] = [];
    const seen = new Set<string>();

    const LABEL_MAP: Record<string, string> = {
        row_count: 'Row Count',
        null_check_all: 'Null Checks',
        duplicate_all: 'Duplicate Checks',
        aggregate: 'Aggregates',
        datatype_check: 'Data Types',
        trim_check: 'Whitespace/Trim',
        date_check: 'Date Validation',
        referential_integrity: 'Referential Integrity',
        distinct_count: 'Distinct Count',
        boundary: 'Boundary/Edge Cases',
        completeness: 'Completeness',
        length_check: 'Length Validation',
        rounding: 'Rounding/Precision',
    };

    // Internal patterns
    for (const { pattern, type } of KEYWORD_PATTERNS) {
        if (pattern.test(prompt) && !seen.has(type)) {
            seen.add(type);
            labels.push(LABEL_MAP[type] || type);
        }
    }

    // Knowledge Base
    matchTestScenarios(prompt).forEach(s => {
        if (!seen.has(s.name)) {
            seen.add(s.name);
            labels.push(s.name);
        }
    });

    detectTestingTypes(prompt).forEach(tt => {
        if (!seen.has(tt.name)) {
            seen.add(tt.name);
            labels.push(tt.name);
        }
    });

    detectLayers(prompt).forEach(l => {
        const layerLabel = l.layer.charAt(0).toUpperCase() + l.layer.slice(1) + ' Validation';
        if (!seen.has(layerLabel)) {
            seen.add(layerLabel);
            labels.push(layerLabel);
        }
    });

    return labels;
}

// ---------------------------------------------------------------------------
// 3. Generate Additional Tests from Directives
// ---------------------------------------------------------------------------

export function generatePromptEnhancedTests(
    directives: EnhancementDirective[],
    mappings: ColumnMapping[],
    sourceTable: string,
    targetTable: string,
    quoteSource: (n: string) => string,
    quoteTarget: (n: string) => string,
    quoteSourceCol: (n: string) => string,
    quoteTargetCol: (n: string) => string,
    phasePrefix: string
): PromptTestCase[] {
    if (!directives || directives.length === 0) return [];
    if (!mappings || mappings.length === 0) return [];

    const tests: PromptTestCase[] = [];
    const qSrc = quoteSource(sourceTable);
    const qTgt = quoteTarget(targetTable);
    const withPhase = (t: string) => phasePrefix === 'Source To Landing' ? t : `${phasePrefix} | ${t}`;

    const usable = mappings.filter(m => m.sourceColumn && m.targetColumn);
    const filterByColumns = (directive: EnhancementDirective, list: ColumnMapping[]) => {
        if (!directive.columns || directive.columns.length === 0) return list;
        return list.filter(m =>
            directive.columns!.some(c =>
                m.sourceColumn.toLowerCase().includes(c.toLowerCase()) ||
                m.targetColumn.toLowerCase().includes(c.toLowerCase())
            )
        );
    };

    for (const directive of directives) {
        // Knowledge Base Scenario Handling
        if (directive.type.startsWith('kb_scenario:')) {
            const scenarioId = directive.params?.scenarioId;
            const scenario = TEST_SCENARIOS.find(s => s.id === scenarioId);
            if (scenario) {
                scenario.testCases.forEach(tc => {
                    // Simple placeholder replacement
                    let sSQL = tc.sourceSQL
                        .replace(/{sourceTable}/g, qSrc)
                        .replace(/{targetTable}/g, qTgt);
                    let tSQL = tc.targetSQL
                        .replace(/{sourceTable}/g, qSrc)
                        .replace(/{targetTable}/g, qTgt);

                    // If it needs a column, pick the first usable one or use a placeholder
                    const firstCol = usable[0];
                    if (firstCol) {
                        const sc = quoteSourceCol(firstCol.sourceColumn);
                        const tc_col = quoteTargetCol(firstCol.targetColumn);
                        sSQL = sSQL.replace(/{col}/g, sc).replace(/{key}/g, sc).replace(/{cols}/g, sc);
                        tSQL = tSQL.replace(/{col}/g, tc_col).replace(/{key}/g, tc_col).replace(/{cols}/g, tc_col);
                    }

                    tests.push({
                        name: `${withPhase(tc.name)} | ${targetTable}`,
                        description: tc.description,
                        sourceSQL: sSQL,
                        targetSQL: tSQL,
                        expectedResult: tc.expectedResult,
                        category: tc.category,
                        severity: tc.severity
                    });
                });
            }
            continue;
        }

        const targeted = filterByColumns(directive, usable);
        const cols = targeted.length > 0 ? targeted : usable;

        switch (directive.type) {
            case 'row_count':
                tests.push({
                    name: `${withPhase('Row Count Validation')} | ${targetTable}`,
                    description: 'Compare total record count between source and target tables.',
                    sourceSQL: `SELECT COUNT(*) AS RowCount FROM ${qSrc}`,
                    targetSQL: `SELECT COUNT(*) AS RowCount FROM ${qTgt}`,
                    expectedResult: 'Row counts must match exactly between source and target.',
                    category: 'general',
                    severity: 'critical'
                });
                break;

            case 'null_check_all':
                cols.slice(0, 20).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Null Check: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Verify null count parity for ${m.sourceColumn} → ${m.targetColumn}.`,
                        sourceSQL: `SELECT COUNT(*) AS NullCount FROM ${qSrc} WHERE ${sc} IS NULL`,
                        targetSQL: `SELECT COUNT(*) AS NullCount FROM ${qTgt} WHERE ${tc} IS NULL`,
                        expectedResult: 'Null counts should match between source and target.',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'duplicate_all':
                cols.slice(0, 10).forEach(m => {
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Duplicate Check: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Check for duplicates in target column ${m.targetColumn}.`,
                        sourceSQL: `SELECT 0 AS ExpectedDuplicates`,
                        targetSQL: `SELECT ${tc}, COUNT(*) AS cnt FROM ${qTgt} GROUP BY ${tc} HAVING COUNT(*) > 1`,
                        expectedResult: 'No duplicate values should exist in the target column.',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'aggregate':
                cols.filter(m => isLikelyNumeric(m)).slice(0, 10).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Aggregate Validation: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Compare SUM, MIN, MAX, AVG for ${m.sourceColumn} → ${m.targetColumn}.`,
                        sourceSQL: `SELECT SUM(${sc}) AS total_sum, MIN(${sc}) AS min_val, MAX(${sc}) AS max_val, AVG(${sc}) AS avg_val FROM ${qSrc}`,
                        targetSQL: `SELECT SUM(${tc}) AS total_sum, MIN(${tc}) AS min_val, MAX(${tc}) AS max_val, AVG(${tc}) AS avg_val FROM ${qTgt}`,
                        expectedResult: 'Aggregate values (SUM, MIN, MAX, AVG) must match.',
                        category: 'general',
                        severity: 'critical'
                    });
                });
                break;

            case 'datatype_check':
                cols.filter(m => m.sourceDataType && m.targetDataType).slice(0, 15).forEach(m => {
                    tests.push({
                        name: `${withPhase(`Data Type Check: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Source type: ${m.sourceDataType} → Target type: ${m.targetDataType}. Verify compatibility.`,
                        sourceSQL: `SELECT TOP 10 ${quoteSourceCol(m.sourceColumn)} FROM ${qSrc} WHERE ${quoteSourceCol(m.sourceColumn)} IS NOT NULL`,
                        targetSQL: `SELECT TOP 10 ${quoteTargetCol(m.targetColumn)} FROM ${qTgt} WHERE ${quoteTargetCol(m.targetColumn)} IS NOT NULL`,
                        expectedResult: `Data should be correctly converted from ${m.sourceDataType || 'source type'} to ${m.targetDataType || 'target type'}.`,
                        category: 'structure',
                        severity: 'major'
                    });
                });
                break;

            case 'trim_check':
                cols.filter(m => isLikelyString(m)).slice(0, 10).forEach(m => {
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Whitespace Check: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Detect leading/trailing whitespace in target column ${m.targetColumn}.`,
                        sourceSQL: `SELECT 0 AS ExpectedWhitespace`,
                        targetSQL: `SELECT COUNT(*) AS WhitespaceCount FROM ${qTgt} WHERE ${tc} <> LTRIM(RTRIM(${tc}))`,
                        expectedResult: 'No records should have leading or trailing whitespace.',
                        category: 'general',
                        severity: 'minor'
                    });
                });
                break;

            case 'date_check':
                cols.filter(m => isLikelyDate(m)).slice(0, 10).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Date Range Validation: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Compare date ranges for ${m.sourceColumn} → ${m.targetColumn}.`,
                        sourceSQL: `SELECT MIN(${sc}) AS MinDate, MAX(${sc}) AS MaxDate, COUNT(*) AS TotalDates FROM ${qSrc} WHERE ${sc} IS NOT NULL`,
                        targetSQL: `SELECT MIN(${tc}) AS MinDate, MAX(${tc}) AS MaxDate, COUNT(*) AS TotalDates FROM ${qTgt} WHERE ${tc} IS NOT NULL`,
                        expectedResult: 'Date ranges and counts should match between source and target.',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'distinct_count':
                cols.slice(0, 15).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Distinct Count: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Compare distinct value counts for ${m.sourceColumn} → ${m.targetColumn}.`,
                        sourceSQL: `SELECT COUNT(DISTINCT ${sc}) AS DistinctCount FROM ${qSrc}`,
                        targetSQL: `SELECT COUNT(DISTINCT ${tc}) AS DistinctCount FROM ${qTgt}`,
                        expectedResult: 'Distinct value counts should match.',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'boundary':
                cols.filter(m => isLikelyNumeric(m)).slice(0, 10).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Boundary Check: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Check for negative values, zeros, and extremes in ${m.targetColumn}.`,
                        sourceSQL: `SELECT COUNT(CASE WHEN ${sc} < 0 THEN 1 END) AS NegativeCount, COUNT(CASE WHEN ${sc} = 0 THEN 1 END) AS ZeroCount, MIN(${sc}) AS MinVal, MAX(${sc}) AS MaxVal FROM ${qSrc}`,
                        targetSQL: `SELECT COUNT(CASE WHEN ${tc} < 0 THEN 1 END) AS NegativeCount, COUNT(CASE WHEN ${tc} = 0 THEN 1 END) AS ZeroCount, MIN(${tc}) AS MinVal, MAX(${tc}) AS MaxVal FROM ${qTgt}`,
                        expectedResult: 'Boundary values (negatives, zeros, extremes) should match.',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'completeness':
                cols.slice(0, 20).forEach(m => {
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Completeness: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Check that ${m.targetColumn} has no unexpected NULL values.`,
                        sourceSQL: `SELECT COUNT(*) AS TotalRows FROM ${qSrc}`,
                        targetSQL: `SELECT COUNT(*) AS TotalRows, COUNT(${tc}) AS NonNullCount, COUNT(*) - COUNT(${tc}) AS NullCount FROM ${qTgt}`,
                        expectedResult: 'All required fields should be populated (zero or minimal NULLs).',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'length_check':
                cols.filter(m => isLikelyString(m)).slice(0, 10).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Length Validation: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Compare max string length for ${m.sourceColumn} → ${m.targetColumn} to detect truncation.`,
                        sourceSQL: `SELECT MAX(LEN(${sc})) AS MaxLength FROM ${qSrc}`,
                        targetSQL: `SELECT MAX(LEN(${tc})) AS MaxLength FROM ${qTgt}`,
                        expectedResult: 'Max length should not decrease (no data truncation).',
                        category: 'general',
                        severity: 'major'
                    });
                });
                break;

            case 'rounding':
                cols.filter(m => isLikelyNumeric(m)).slice(0, 10).forEach(m => {
                    const sc = quoteSourceCol(m.sourceColumn);
                    const tc = quoteTargetCol(m.targetColumn);
                    tests.push({
                        name: `${withPhase(`Rounding Check: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Verify precision/rounding for ${m.sourceColumn} → ${m.targetColumn}.`,
                        sourceSQL: `SELECT SUM(ROUND(${sc}, 2)) AS RoundedSum FROM ${qSrc}`,
                        targetSQL: `SELECT SUM(ROUND(${tc}, 2)) AS RoundedSum FROM ${qTgt}`,
                        expectedResult: 'Rounded sums should match (no precision loss).',
                        category: 'transformation',
                        severity: 'major'
                    });
                });
                break;

            case 'referential_integrity':
                // Only generate if we can identify FK-like columns
                cols.filter(m =>
                    /id$/i.test(m.targetColumn) || /key$/i.test(m.targetColumn) || /fk/i.test(m.targetColumn)
                ).slice(0, 5).forEach(m => {
                    const tc = quoteTargetCol(m.targetColumn);
                    const sc = quoteSourceCol(m.sourceColumn);
                    tests.push({
                        name: `${withPhase(`Referential Integrity: ${m.targetColumn}`)} | ${targetTable}`,
                        description: `Check that all ${m.targetColumn} values exist in the source ${m.sourceColumn}.`,
                        sourceSQL: `SELECT DISTINCT ${sc} FROM ${qSrc} ORDER BY ${sc}`,
                        targetSQL: `SELECT DISTINCT ${tc} FROM ${qTgt} WHERE ${tc} NOT IN (SELECT DISTINCT ${sc} FROM ${qSrc}) ORDER BY ${tc}`,
                        expectedResult: 'No orphan records — all target FK values should exist in source.',
                        category: 'general',
                        severity: 'critical'
                    });
                });
                break;
        }
    }

    return tests;
}

// ---------------------------------------------------------------------------
// 4. Type Inference Helpers
// ---------------------------------------------------------------------------

function isLikelyNumeric(m: ColumnMapping): boolean {
    const dt = (m.sourceDataType || m.targetDataType || '').toLowerCase();
    if (/int|decimal|numeric|float|double|money|real|number|bigint|smallint|tinyint/i.test(dt)) return true;
    const name = (m.sourceColumn || m.targetColumn || '').toLowerCase();
    return /amount|price|cost|qty|quantity|total|sum|count|rate|percent|salary|balance|weight|height|score/i.test(name);
}

function isLikelyString(m: ColumnMapping): boolean {
    const dt = (m.sourceDataType || m.targetDataType || '').toLowerCase();
    if (/char|varchar|nvarchar|text|string|clob|nchar|ntext/i.test(dt)) return true;
    const name = (m.sourceColumn || m.targetColumn || '').toLowerCase();
    return /name|desc|address|city|state|country|email|phone|comment|note|title|label|code|status|type/i.test(name);
}

function isLikelyDate(m: ColumnMapping): boolean {
    const dt = (m.sourceDataType || m.targetDataType || '').toLowerCase();
    if (/date|time|datetime|timestamp|datetime2|smalldatetime/i.test(dt)) return true;
    const name = (m.sourceColumn || m.targetColumn || '').toLowerCase();
    return /date|time|created|updated|modified|start|end|expir|birth|dob|effective/i.test(name);
}
