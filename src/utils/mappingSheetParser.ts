// Intelligent Mapping Sheet Parser
// Automatically detects format and extracts source/target mappings from any structure

export interface ColumnMapping {
    sourceColumn: string;
    targetColumn: string;
    sourceTable?: string;
    targetTable?: string;
    transformationType: 'direct_move' | 'lookup' | 'date_format' | 'trim' | 'null_handling' |
    'concatenation' | 'aggregation' | 'case_conversion' | 'string_replace' |
    'type_casting' | 'business_rule' | 'unknown';
    transformationLogic?: string;
    tableName?: string;
    complexity: 'simple' | 'medium' | 'complex';
}

export interface ParsedMappingSheet {
    sourceTables: Set<string>;
    targetTables: Set<string>;
    columnMappings: ColumnMapping[];
    detectedFormat: string;
    transformationRules: string[];
    metadata: {
        totalRows: number;
        detectedColumns: string[];
        formatConfidence: number;
    };
}

const PLACEHOLDER_TOKENS = new Set([
    '', '-', '--', 'na', 'n/a', 'none', 'null', 'nil', 'unknown', 'tbd', 'to be decided',
    'to be confirmed', 'to be determined', 'not applicable', 'none selected'
]);

function normalizeToken(value: any): string {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPlaceholderValue(value: any): boolean {
    const normalized = normalizeToken(value);
    if (!normalized) return true;
    if (PLACEHOLDER_TOKENS.has(normalized)) return true;
    if (/^column[_\s-]?\d+$/i.test(normalized)) return true;
    if (/^(source|target|field|column)$/i.test(normalized)) return true;
    return false;
}

function cleanIdentifier(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw
        .replace(/^[:=]+|[:=]+$/g, '')
        .replace(/^\[|\]$/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();
}

function resolveCandidateColumn(value: any): string {
    const cleaned = cleanIdentifier(value);
    if (!cleaned) return '';

    // Extract trailing identifier from `db.schema.table.column` / `table.column`
    const direct = cleaned.match(/([a-zA-Z_][a-zA-Z0-9_]*)(\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*))?$/);
    if (direct) return cleanIdentifier(direct[3] || direct[1]);
    return cleaned;
}

/**
 * Intelligently parses any mapping sheet format with Extreme Intelligence
 */
export function parseMappingSheet(data: any[]): ParsedMappingSheet {
    if (!data || data.length === 0) {
        return createEmptyResult();
    }

    // --- PHASE 1: HEADER DISCOVERY ---
    // Scan top 15 rows to find the "true" header row (the one with the most ETL keywords)
    let headerRowIdx = 0;
    let maxKeywordCount = 0;
    const searchLimit = Math.min(data.length, 15);

    const etlKeywords = [
        'source', 'target', 'transformation', 'mapping', 'logic', 'rule', 'field', 'column',
        'src', 'tgt', 'business', 'rule', 'extraction', 'loading', 'metadata', 'comment'
    ];

    for (let i = 0; i < searchLimit; i++) {
        const row = data[i];
        if (!row) continue;

        const rowKeys = Object.keys(row);
        const rowValues = Object.values(row).map(v => String(v || '').toLowerCase());

        let keywordCount = 0;
        // Check keys (property names)
        rowKeys.forEach(k => {
            if (etlKeywords.some(kw => k.toLowerCase().includes(kw))) keywordCount++;
        });
        // Check values (if the first row of data actually contains labels)
        rowValues.forEach(v => {
            if (etlKeywords.some(kw => v.includes(kw))) keywordCount += 2; // Priority to value-based headers
        });

        if (keywordCount > maxKeywordCount) {
            maxKeywordCount = keywordCount;
            headerRowIdx = i;
        }
    }

    console.log(`🔍 Header Discovery: Found metadata row at index ${headerRowIdx} (score: ${maxKeywordCount})`);

    // Slice data to start from the discovered header
    const effectiveData = data.slice(headerRowIdx);
    if (effectiveData.length === 0) return createEmptyResult();

    const firstRow = effectiveData[0];
    const columnNames = Object.keys(firstRow);

    // Try different parsing strategies
    const strategies = [
        parseStandardFormat,
        parseMultiSourceFormat,
        parseTransformationRuleFormat,
        parseVerticalFormat,
        parseGenericFormat
    ];

    let bestResult: ParsedMappingSheet | null = null;
    let highestConfidence = 0;

    for (const strategy of strategies) {
        const result = strategy(effectiveData, columnNames);
        if (result && result.metadata.formatConfidence > highestConfidence) {
            highestConfidence = result.metadata.formatConfidence;
            bestResult = result;
        }
    }

    return bestResult || createEmptyResult();
}

/**
 * Strategy 1: Standard Format (Source Column | Target Column | Transformation)
 * NOW FEATURING: Probabilistic Column Scoring & Enhanced Fill-Down
 */
function parseStandardFormat(data: any[], columns: string[]): ParsedMappingSheet | null {
    // --- PHASE 2: PROBABILISTIC COLUMN SCORING ---
    const scoreColumn = (col: string, keywords: string[]): number => {
        const normalized = col.toLowerCase().replace(/[_\s-]/g, '');
        let score = 0;

        for (const kw of keywords) {
            const normalizedKw = kw.toLowerCase().replace(/[_\s-]/g, '');
            if (normalized === normalizedKw) score += 1.0;
            else if (normalized.startsWith(normalizedKw) || normalized.endsWith(normalizedKw)) score += 0.8;
            else if (normalized.includes(normalizedKw)) score += 0.6;
            else if (normalizedKw.includes(normalized)) score += 0.4;
        }
        return score;
    };

    const findBestColumn = (keywords: string[]) => {
        let bestCol = null;
        let maxScore = 0;
        for (const col of columns) {
            const score = scoreColumn(col, keywords);
            if (score > maxScore) {
                maxScore = score;
                bestCol = col;
            }
        }
        return maxScore > 0.3 ? bestCol : null;
    };

    const sourceCol = findBestColumn([
        'source', 'src', 'from', 'source field', 'source column', 'source_field', 'source_column',
        'input', 'origin', 'source_col', 'srcfield', 'src_col', 'source system', 'source_system',
        'nac', 'legacy', 'old', 'current', 'existing', 'src_field'
    ]);

    const targetCol = findBestColumn([
        'target', 'tgt', 'to', 'dest', 'destination', 'target field', 'target column',
        'target_field', 'target_column', 'output', 'target_col', 'tgtfield', 'tgt_col',
        'edw', 'warehouse', 'dw', 'data warehouse', 'new', 'target system', 'target_system', 'tgt_field'
    ]);

    const transformCol = findBestColumn([
        'transformation', 'transform', 'rule', 'logic', 'formula', 'business rule',
        'mapping logic', 'transformation_logic', 'transform_rule', 'business_rule',
        'mapping', 'conversion', 'calculation', 'expression', 'function', 'comments',
        'remarks', 'notes', 'spec', 'specification', 'instruction', 'transformation_rule'
    ]);

    const srcTableCol = findBestColumn(['source table', 'src_table', 'source_table', 'source_entity', 'src_entity']);
    const tgtTableCol = findBestColumn(['target table', 'tgt_table', 'target_table', 'target_entity', 'tgt_entity']);
    const srcSchemaCol = findBestColumn(['source schema', 'src_schema', 'source_schema']);
    const tgtSchemaCol = findBestColumn(['target schema', 'tgt_schema', 'target_schema']);
    const srcDbCol = findBestColumn(['source database', 'src_database', 'source_db', 'src_db']);
    const tgtDbCol = findBestColumn(['target database', 'tgt_database', 'target_db', 'tgt_db']);

    if (!sourceCol && !targetCol) {
        return null;
    }

    const confidence = (sourceCol ? 0.35 : 0) + (targetCol ? 0.35 : 0) + (transformCol ? 0.2 : 0) + (srcTableCol ? 0.1 : 0);

    if (confidence < 0.4) {
        return null;
    }

    const mappings: ColumnMapping[] = [];
    const dedupe = new Set<string>();
    const sourceTables = new Set<string>();
    const targetTables = new Set<string>();
    const transformationRules: string[] = [];

    // --- PHASE 3: EXTREME FILL-DOWN LOGIC ---
    let lastSourceDb: string | undefined;
    let lastSourceSchema: string | undefined;
    let lastSourceTable: string | undefined;
    let lastTargetDb: string | undefined;
    let lastTargetSchema: string | undefined;
    let lastTargetTable: string | undefined;

    // Detect if this is the specialized 19-column enterprise format
    const isEnterpriseFormat = columns.length === 19;

    data.forEach((row, idx) => {
        // ... (cleaning logic remains same)
        const cleanVal = (val: any) => {
            if (!val) return null;
            const str = String(val).trim();
            return (str === '' || str === '-') ? null : str;
        };

        let sourceValue = isEnterpriseFormat ? cleanVal(row[columns[3]]) : (sourceCol ? cleanVal(row[sourceCol]) : null);
        let targetValue = isEnterpriseFormat ? cleanVal(row[columns[13]]) : (targetCol ? cleanVal(row[targetCol]) : null);
        let transformValue = isEnterpriseFormat ? cleanVal(row[columns[17]]) : (transformCol ? cleanVal(row[transformCol]) : null);

        const normalizedSource = resolveCandidateColumn(sourceValue);
        const normalizedTarget = resolveCandidateColumn(targetValue);
        if (!normalizedSource || !normalizedTarget) return;
        if (isPlaceholderValue(normalizedSource) || isPlaceholderValue(normalizedTarget)) return;

        let rowSourceTable: string | undefined;
        let rowTargetTable: string | undefined;

        if (isEnterpriseFormat) {
            const sSchema = String(row[columns[1]] || '').trim();
            const sTable = String(row[columns[2]] || '').trim();
            const tSchema = String(row[columns[11]] || '').trim();
            const tTable = String(row[columns[12]] || '').trim();

            if (sSchema) lastSourceSchema = sSchema;
            if (sTable) lastSourceTable = sTable;
            if (tSchema) lastTargetSchema = tSchema;
            if (tTable) lastTargetTable = tTable;

            const partsS = [lastSourceSchema, lastSourceTable].filter(Boolean);
            rowSourceTable = partsS.join('.');
            const partsT = [lastTargetSchema, lastTargetTable].filter(Boolean);
            rowTargetTable = partsT.join('.');
        } else {
            const sDb = srcDbCol ? String(row[srcDbCol] || '').trim() : '';
            const sSchema = srcSchemaCol ? String(row[srcSchemaCol] || '').trim() : '';
            const sTable = srcTableCol ? String(row[srcTableCol] || '').trim() : '';
            const tDb = tgtDbCol ? String(row[tgtDbCol] || '').trim() : '';
            const tSchema = tgtSchemaCol ? String(row[tgtSchemaCol] || '').trim() : '';
            const tTable = tgtTableCol ? String(row[tgtTableCol] || '').trim() : '';

            if (sDb) lastSourceDb = sDb;
            if (sSchema) lastSourceSchema = sSchema;
            if (sTable) lastSourceTable = sTable;
            if (tDb) lastTargetDb = tDb;
            if (tSchema) lastTargetSchema = tSchema;
            if (tTable) lastTargetTable = tTable;

            const partsS = [lastSourceDb, lastSourceSchema, lastSourceTable].filter(Boolean);
            rowSourceTable = partsS.join('.');
            const partsT = [lastTargetDb, lastTargetSchema, lastTargetTable].filter(Boolean);
            rowTargetTable = partsT.join('.');
        }

        if (rowSourceTable) sourceTables.add(rowSourceTable);
        if (rowTargetTable) targetTables.add(rowTargetTable);

        const transformType = detectTransformationType(transformValue);
        const complexity = assessComplexity(transformValue);

        const dedupeKey = `${rowSourceTable || ''}|${rowTargetTable || ''}|${normalizedSource.toLowerCase()}|${normalizedTarget.toLowerCase()}`;
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);

        mappings.push({
            sourceColumn: normalizedSource,
            targetColumn: normalizedTarget,
            sourceTable: rowSourceTable,
            targetTable: rowTargetTable,
            transformationType: transformType,
            transformationLogic: transformValue ? String(transformValue).trim() : undefined,
            complexity
        });

        if (transformValue && String(transformValue).trim()) {
            transformationRules.push(String(transformValue).trim());
        }
    });

    return {
        sourceTables,
        targetTables,
        columnMappings: mappings,
        detectedFormat: isEnterpriseFormat ? 'Enterprise Mapping (19-col)' : 'Standard Mapping (Scored)',
        transformationRules,
        metadata: {
            totalRows: data.length,
            detectedColumns: columns,
            formatConfidence: confidence
        }
    };
}

/**
 * Strategy 2: Multi-Source Format (Target | Source1 | Source2 | Source3...)
 */
function parseMultiSourceFormat(data: any[], columns: string[]): ParsedMappingSheet | null {
    const targetCol = findColumn(columns, ['target', 'edw', 'warehouse', 'target field']);

    if (!targetCol) {
        return null;
    }

    // Other columns are likely source systems
    const potentialSourceCols = columns.filter(c =>
        c !== targetCol &&
        !c.toLowerCase().includes('note') &&
        !c.toLowerCase().includes('comment') &&
        !c.toLowerCase().includes('description') &&
        !c.toLowerCase().includes('complexity') &&
        !c.toLowerCase().includes('logic')
    );

    if (potentialSourceCols.length < 2) {
        return null;
    }

    const confidence = 0.7;
    const mappings: ColumnMapping[] = [];
    const sourceTables = new Set<string>();
    const targetTables = new Set<string>();
    const transformationRules: string[] = [];

    // Add source system names as tables
    potentialSourceCols.forEach(col => sourceTables.add(col));
    targetTables.add('Target Warehouse');

    data.forEach(row => {
        const targetValue = resolveCandidateColumn(row[targetCol]);
        if (!targetValue || isPlaceholderValue(targetValue)) return;

        potentialSourceCols.forEach(sourceCol => {
            const sourceValue = resolveCandidateColumn(row[sourceCol]);
            if (sourceValue && !isPlaceholderValue(sourceValue)) {
                const transformType = detectTransformationFromValue(sourceValue);

                mappings.push({
                    sourceColumn: `${sourceCol}.${sourceValue}`,
                    targetColumn: String(targetValue),
                    sourceTable: sourceCol,
                    targetTable: 'Target Warehouse',
                    transformationType: transformType,
                    tableName: sourceCol,
                    complexity: 'simple'
                });
            }
        });
    });

    return {
        sourceTables,
        targetTables,
        columnMappings: mappings,
        detectedFormat: 'Multi-Source (Multiple systems → Single target)',
        transformationRules,
        metadata: {
            totalRows: data.length,
            detectedColumns: columns,
            formatConfidence: confidence
        }
    };
}

/**
 * Strategy 3: Transformation Rule Format (Rule# | Description | Syntax)
 */
function parseTransformationRuleFormat(data: any[], columns: string[]): ParsedMappingSheet | null {
    const ruleCol = findColumn(columns, ['rule', 'sr', 'no', '#', 'rule name']);
    const descCol = findColumn(columns, ['description', 'desc']);
    const syntaxCol = findColumn(columns, ['syntax', 'sql', 'formula', 'code']);

    if (!ruleCol && !descCol) {
        return null;
    }

    const confidence = 0.6;
    const transformationRules: string[] = [];

    data.forEach(row => {
        const rule = ruleCol ? row[ruleCol] : null;
        const desc = descCol ? row[descCol] : null;
        const syntax = syntaxCol ? row[syntaxCol] : null;

        if (desc) {
            const ruleText = `${rule ? rule + ': ' : ''}${desc}${syntax ? ' - ' + syntax : ''}`;
            transformationRules.push(ruleText);
        }
    });

    return {
        sourceTables: new Set(['Source']),
        targetTables: new Set(['Target']),
        columnMappings: [],
        detectedFormat: 'Transformation Rules (Rule definitions)',
        transformationRules,
        metadata: {
            totalRows: data.length,
            detectedColumns: columns,
            formatConfidence: confidence
        }
    };
}

/**
 * Strategy 4: Vertical Format (rows represent mappings with metadata)
 */
function parseVerticalFormat(data: any[], columns: string[]): ParsedMappingSheet | null {
    // Look for patterns where each row has complete mapping info
    const hasMultipleMappingCols = columns.filter(c =>
        c.toLowerCase().includes('source') ||
        c.toLowerCase().includes('target')
    ).length >= 2;

    if (!hasMultipleMappingCols) {
        return null;
    }

    return parseStandardFormat(data, columns); // Delegate to standard parser
}

/**
 * Strategy 5: Generic Format (fallback - try to extract any useful info)
 */
function parseGenericFormat(data: any[], columns: string[]): ParsedMappingSheet | null {
    const sourceTables = new Set<string>();
    const targetTables = new Set<string>();

    return {
        sourceTables,
        targetTables,
        columnMappings: [],
        detectedFormat: 'Generic (Uncertain format)',
        transformationRules: [],
        metadata: {
            totalRows: data.length,
            detectedColumns: columns,
            formatConfidence: 0.05
        }
    };
}

/**
 * Helper: Find column by fuzzy matching with enhanced accuracy
 */
function findColumn(columns: string[], keywords: string[]): string | null {
    // First pass: exact matches (ignoring case, spaces, underscores, hyphens)
    for (const col of columns) {
        const normalizedCol = col.toLowerCase().replace(/[_\s-]/g, '');
        for (const keyword of keywords) {
            const normalizedKeyword = keyword.toLowerCase().replace(/[_\s-]/g, '');
            if (normalizedCol === normalizedKeyword) {
                return col;
            }
        }
    }

    // Second pass: starts with or ends with keyword
    for (const col of columns) {
        const lowerCol = col.toLowerCase();
        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();
            if (lowerCol.startsWith(lowerKeyword) || lowerCol.endsWith(lowerKeyword)) {
                return col;
            }
        }
    }

    // Third pass: contains keyword
    for (const col of columns) {
        const normalizedCol = col.toLowerCase().replace(/[_\s-]/g, '');
        for (const keyword of keywords) {
            const normalizedKeyword = keyword.toLowerCase().replace(/[_\s-]/g, '');
            if (normalizedCol.includes(normalizedKeyword)) {
                return col;
            }
        }
    }

    // Fourth pass: partial match (keyword contains col or vice versa)
    for (const col of columns) {
        const normalizedCol = col.toLowerCase().replace(/[_\s-]/g, '');
        for (const keyword of keywords) {
            const normalizedKeyword = keyword.toLowerCase().replace(/[_\s-]/g, '');
            if (normalizedKeyword.includes(normalizedCol) || normalizedCol.includes(normalizedKeyword)) {
                return col;
            }
        }
    }

    return null;
}

/**
 * Detect transformation type from logic string with enhanced pattern matching
 */
function detectTransformationType(transformLogic: any): ColumnMapping['transformationType'] {
    if (!transformLogic) return 'direct_move';

    const logic = String(transformLogic).toUpperCase();

    // Check for specific patterns in order of specificity
    if (logic.includes('JOIN') || logic.includes('LOOKUP') || logic.includes('MERGE') || logic.includes('FETCH')) return 'lookup';

    // Date/Time transformations
    if (logic.includes('FORMAT') || logic.includes('DATEFORMAT') ||
        (logic.includes('CONVERT') && (logic.includes('DATE') || logic.includes('TIME')))) return 'date_format';
    if (logic.includes('DATEADD') || logic.includes('DATEDIFF') || logic.includes('GETDATE') || logic.includes('SYSDATE')) return 'date_format';

    // String transformations
    if (logic.includes('LTRIM') || logic.includes('RTRIM') || logic.includes('TRIM')) return 'trim';
    if (logic.includes('SUBSTRING') || logic.includes('LEFT') || logic.includes('RIGHT') || logic.includes('MID')) return 'string_replace';
    if (logic.includes('REPLACE') || logic.includes('STUFF') || logic.includes('TRANSLATE')) return 'string_replace';
    if (logic.includes('UPPER') || logic.includes('LOWER')) return 'case_conversion';
    if (logic.includes('CONCAT') || logic.includes('||') || (logic.includes('+') && logic.includes("'"))) return 'concatenation';

    // NULL handling
    if (logic.includes('ISNULL') || logic.includes('COALESCE') || logic.includes('NULLIF') || logic.includes('NVL')) return 'null_handling';

    // Aggregations
    if (logic.includes('SUM(') || logic.includes('AVG(') || logic.includes('COUNT(') ||
        logic.includes('MIN(') || logic.includes('MAX(') || logic.includes('GROUP BY')) return 'aggregation';

    // Type conversions
    if (logic.includes('CAST') || logic.includes('CONVERT') || logic.includes('TRY_CAST') || logic.includes('TO_NUMBER') || logic.includes('TO_CHAR')) return 'type_casting';
    if (logic.includes('PARSE') || logic.includes('TRY_PARSE')) return 'type_casting';

    // Business rules (complex logic)
    if (logic.includes('CASE') || logic.includes('WHEN') || logic.includes('IF') || logic.includes('IIF') || logic.includes('DECODE')) return 'business_rule';
    if (logic.includes('WHERE') && (logic.includes('AND') || logic.includes('OR'))) return 'business_rule';
    if (logic.includes('MAP') && logic.includes('TO')) return 'business_rule';

    // Mathematical operations
    if (logic.match(/[+\-*/]/g) && logic.match(/\d/)) return 'business_rule';

    // Default to unknown if we can't identify but there is content
    const directKeywords = ['DIRECT', 'SAME', 'AS IS', 'AS-IS', '1:1', '1 TO 1', 'STRAIGHT', 'NONE', 'MATCH', 'COPY', 'NO CHANGE', 'NA', 'N/A', '-'];
    const isDirectPattern = directKeywords.some(kw => logic.includes(kw));

    if (logic.trim().length > 0 && !isDirectPattern) {
        return 'unknown';
    }

    return 'direct_move';
}

/**
 * Detect transformation from source value pattern
 */
function detectTransformationFromValue(value: any): ColumnMapping['transformationType'] {
    const str = String(value);

    if (str.includes('=') || str.includes('->')) return 'business_rule';
    if (str.match(/\d{4}-\d{2}-\d{2}/)) return 'date_format';

    return 'direct_move';
}

/**
 * Assess transformation complexity
 */
function assessComplexity(transformLogic: any): 'simple' | 'medium' | 'complex' {
    if (!transformLogic) return 'simple';

    const logic = String(transformLogic);
    const complexityIndicators = [
        /CASE.*WHEN/i,
        /JOIN/i,
        /SUBQUERY/i,
        /\(/g // Count parentheses
    ];

    let score = 0;
    complexityIndicators.forEach(pattern => {
        if (pattern.test(logic)) score++;
    });

    if (score === 0) return 'simple';
    if (score <= 2) return 'medium';
    return 'complex';
}

/**
 * Create empty result structure
 */
function createEmptyResult(): ParsedMappingSheet {
    return {
        sourceTables: new Set(),
        targetTables: new Set(),
        columnMappings: [],
        detectedFormat: 'Unknown',
        transformationRules: [],
        metadata: {
            totalRows: 0,
            detectedColumns: [],
            formatConfidence: 0
        }
    };
}
