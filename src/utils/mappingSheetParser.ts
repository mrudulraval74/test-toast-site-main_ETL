// Intelligent Mapping Sheet Parser
// Automatically detects format and extracts source/target mappings from any structure

export interface ColumnMapping {
    sourceColumn: string;
    targetColumn: string;
    sourceTable?: string;
    targetTable?: string;
    sourceDataType?: string;
    targetDataType?: string;
    notes?: string;
    comments?: string;
    transformationType: 'direct_move' | 'lookup' | 'date_format' | 'trim' | 'null_handling' |
    'concatenation' | 'aggregation' | 'case_conversion' | 'string_replace' |
    'type_casting' | 'business_rule' | 'unknown';
    transformationLogic?: string;
    tableName?: string;
    complexity: 'simple' | 'medium' | 'complex';
    isPrimaryKey?: boolean;
    isNullable?: boolean;
}

export interface ParsedMappingSheet {
    sourceTables: Set<string>;
    targetTables: Set<string>;
    columnMappings: ColumnMapping[];
    testCases?: any[];
    detectedFormat: string;
    transformationRules: string[];
    metadata: {
        totalRows: number;
        detectedColumns: string[];
        formatConfidence: number;
        skippedRows?: {
            missingSource: number;
            missingTarget: number;
            placeholder: number;
        };
    };
}

const PLACEHOLDER_TOKENS = new Set([
    '', '-', '--', 'na', 'n/a', 'none', 'null', 'nil', 'unknown', 'tbd', 'to be decided',
    'to be confirmed', 'to be determined', 'not applicable', 'none selected',
    'constant', 'expression', 'expression/constant', 'generated', 'auto', 'auto-generated',
    'auto increment', 'identity', 'computed', 'derived', 'calculated', 'static', 'hardcoded'
]);

function normalizeToken(value: any): string {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPlaceholderValue(value: any): boolean {
    const normalized = normalizeToken(value);
    if (!normalized) return true;
    if (PLACEHOLDER_TOKENS.has(normalized)) return true;
    // Don't treat generic names as placeholders if they might be actual column names in some DBs
    // but keep very generic ones like 'column_1'
    if (/^column[_\s-]?\d+$/i.test(normalized)) return true;
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

    // If the value is a placeholder token (e.g. 'N/A', 'Constant', 'Generated'), return empty.
    if (PLACEHOLDER_TOKENS.has(normalizeToken(cleaned))) return '';

    // If value contains a '/' it is a composite token like 'N/A' or 'Expression/Constant'.
    // Do NOT extract the trailing part — treat the whole thing as empty (no real column).
    if (cleaned.includes('/')) return '';

    // Handle comma-separated columns (multi-column mappings)
    if (cleaned.includes(',')) {
        return cleaned.split(',').map(s => cleanIdentifier(s)).filter(Boolean).join(', ');
    }

    // Extract trailing identifier from `db.schema.table.column` / `table.column`
    const direct = cleaned.match(/([a-zA-Z_][a-zA-Z0-9_]*)(\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*))?$/);
    if (direct) return cleanIdentifier(direct[3] || direct[1]);
    return cleaned;
}

export function normalizeEmbeddedHeaderRows(data: any[]): any[] {
    if (!data.length) return data;

    const firstRow = data[0];
    if (!firstRow || typeof firstRow !== 'object') return data;

    const originalKeys = Object.keys(firstRow);
    if (originalKeys.length === 0) return data;

    const headerHints = [
        'target column', 'source column', 'source table', 'source schema',
        'target table', 'target schema', 'transformation', 'business rule',
        'target data type', 'source data type', 'test case', 'test scenario',
        'target attribute', 'source attribute'
    ];

    let headerIndex = -1;
    let bestScore = 0;
    const limit = Math.min(data.length, 30);

    for (let i = 0; i < limit; i++) {
        const row = data[i];
        if (!row || typeof row !== 'object') continue;

        const values = originalKeys.map((k) => String((row as any)[k] ?? '').trim().toLowerCase());
        let score = 0;
        for (const value of values) {
            if (!value) continue;
            if (headerHints.some((hint) => value.includes(hint))) score++;
        }

        if (score > bestScore) {
            bestScore = score;
            headerIndex = i;
        }
    }

    if (bestScore < 1 || headerIndex < 0) return data;

    const headerRow = data[headerIndex];
    const headers = originalKeys.map((k, idx) => {
        const raw = String((headerRow as any)[k] ?? '').trim();
        const normalized = raw.replace(/\s+/g, ' ').replace(/^[:=]+|[:=]+$/g, '').trim();
        return normalized || `Column_${idx + 1}`;
    });

    const rebuilt: any[] = [];
    for (let i = headerIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || typeof row !== 'object') continue;

        const rebuiltRow: Record<string, any> = {};
        let hasValue = false;

        originalKeys.forEach((k, idx) => {
            const value = (row as any)[k];
            const normalizedValue = typeof value === 'string' ? value.trim() : value;
            if (normalizedValue !== '' && normalizedValue != null) hasValue = true;
            rebuiltRow[headers[idx]] = normalizedValue;
        });

        if (hasValue) rebuilt.push(rebuiltRow);
    }

    return rebuilt.length > 0 ? rebuilt : data;
}

export function parseMappingSheet(data: any[]): ParsedMappingSheet {
    if (!data || data.length === 0) return createEmptyResult();

    const normalizedData = normalizeEmbeddedHeaderRows(data);
    if (normalizedData.length === 0) return createEmptyResult();

    let headerRowIdx = 0;
    let maxKeywordCount = 0;
    const searchLimit = Math.min(normalizedData.length, 15);
    const etlKeywords = [
        'source', 'target', 'transformation', 'mapping', 'logic', 'rule', 'field', 'column',
        'src', 'tgt', 'business', 'rule', 'extraction', 'loading', 'metadata', 'comment'
    ];

    for (let i = 0; i < searchLimit; i++) {
        const row = normalizedData[i];
        if (!row) continue;
        const rowKeys = Object.keys(row);
        const rowValues = Object.values(row).map(v => String(v || '').toLowerCase());
        let keywordCount = 0;
        rowKeys.forEach(k => { if (etlKeywords.some(kw => k.toLowerCase().includes(kw))) keywordCount++; });
        rowValues.forEach(v => { if (etlKeywords.some(kw => v.includes(kw))) keywordCount += 2; });
        if (keywordCount > maxKeywordCount) { maxKeywordCount = keywordCount; headerRowIdx = i; }
    }

    const effectiveData = normalizedData.slice(headerRowIdx);
    if (effectiveData.length === 0) return createEmptyResult();
    const columnNames = Object.keys(effectiveData[0]);

    // Check for Vertical Metadata (Field | Value) at the very top
    const metadata: any = {};
    const fieldCol = findColumn(columnNames, ['field', 'key', 'attribute']);
    const valueCol = findColumn(columnNames, ['value', 'details', 'name']);
    
    if (fieldCol && valueCol) {
        effectiveData.slice(0, 10).forEach(row => {
            const f = normalizeToken(row[fieldCol]);
            const v = String(row[valueCol] || '').trim();
            if (f.includes('target table')) metadata.targetTable = v;
            if (f.includes('source table') || f === 'source') metadata.sourceTable = v;
            if (f.includes('notes')) metadata.notes = v;
        });
    }

    const strategies = [
        parseStandardFormat,
        parseMultiSourceFormat,
        parseTransformationRuleFormat,
        parseTestCaseFormat,
        parseVerticalFormat,
        parseGenericFormat
    ];

    let bestResult: ParsedMappingSheet | null = null;
    let highestConfidence = 0;

    for (const strategy of strategies) {
        const result = strategy(effectiveData, columnNames, metadata);
        if (result && result.metadata.formatConfidence > highestConfidence) {
            highestConfidence = result.metadata.formatConfidence;
            bestResult = result;
        }
    }

    return bestResult || createEmptyResult();
}

function parseStandardFormat(data: any[], columns: string[], verticalMetadata: any = {}): ParsedMappingSheet | null {
    const scoreColumn = (col: string, keywords: string[]): number => {
        const normalized = col.toLowerCase().replace(/[_\s-]/g, '');
        let score = 0;
        for (const kw of keywords) {
            const normalizedKw = kw.toLowerCase().replace(/[_\s-]/g, '');
            if (normalized === normalizedKw) score += 1.0;
            else if (normalized.startsWith(normalizedKw) || normalized.endsWith(normalizedKw)) score += 0.8;
            else if (normalized.includes(normalizedKw)) score += 0.6;
        }
        return score;
    };

    const findBestColumn = (keywords: string[]) => {
        let bestCol = null;
        let maxScore = 0;
        for (const col of columns) {
            const score = scoreColumn(col, keywords);
            if (score > maxScore) { maxScore = score; bestCol = col; }
        }
        return maxScore > 0.3 ? bestCol : null;
    };

    const sourceCol = findBestColumn(['source', 'src', 'from', 'source field', 'source column', 'source_column', 'source_field', 'source_col', 'src_field', 'source_name', 'source attribute', 'source_attribute', 'input field', 'legacy column', 'old column']);
    const targetCol = findBestColumn(['target', 'tgt', 'to', 'dest', 'destination', 'target field', 'target column', 'target_column', 'target_field', 'target_col', 'tgt_field', 'target_name', 'target attribute', 'target_attribute', 'output field', 'warehouse column', 'new column']);
    const transformCol = findBestColumn(['transformation', 'transform', 'rule', 'logic', 'formula', 'business rule', 'mapping logic', 'transformation_logic', 'syntax', 'description', 'rule description', 'logic description', 'transformation_rule', 'mapping_rule', 'business_logic']);
    const srcTableCol = findBestColumn(['source table', 'src table', 'src_table', 'source_table', 'source entity', 'source_entity', 'src entity', 'src_entity', 'source system', 'src system']);
    const tgtTableCol = findBestColumn(['target table', 'tgt table', 'tgt_table', 'target_table', 'target entity', 'target_entity', 'tgt entity', 'tgt_entity', 'target system', 'tgt system']);
    const srcSchemaCol = findBestColumn(['source schema', 'src_schema', 'source_schema', 'source_db_schema']);
    const tgtSchemaCol = findBestColumn(['target schema', 'tgt_schema', 'target_schema', 'target_db_schema']);
    const srcDbCol = findBestColumn(['source database', 'src_db', 'source_db', 'source_database_name']);
    const tgtDbCol = findBestColumn(['target database', 'tgt_db', 'target_db', 'target_database_name']);
    const srcDataTypeCol = findBestColumn(['source data type', 'source datatype', 'src datatype', 'source_type', 'source format', 'input type']);
    const tgtDataTypeCol = findBestColumn(['target data type', 'target datatype', 'tgt datatype', 'target_type', 'target format', 'output type']);
    const pkCol = findBestColumn(['primary key', 'pk', 'key', 'is key', 'is_key', 'unique key', 'identifier']);
    const nullCol = findBestColumn(['is nullable', 'nullable', 'null', 'allow null', 'is_nullable', 'optional']);
    const notesCol = findBestColumn(['notes', 'note', 'comment', 'comments', 'remarks', 'description', 'business_notes', 'mapping_notes']);

    if (!sourceCol && !targetCol) return null;
    
    // Log matched columns for debugging
    console.log(`📊 Column Matching Debug:
      Source: ${sourceCol}
      Target: ${targetCol}
      Transform: ${transformCol}
      SrcTable: ${srcTableCol}
      TgtTable: ${tgtTableCol}
      PK: ${pkCol}
      Null: ${nullCol}
    `);

    const confidence = (sourceCol ? 0.4 : 0) + (targetCol ? 0.4 : 0) + (transformCol ? 0.2 : 0) + (srcTableCol ? 0.1 : 0);
    if (confidence < 0.25) return null; // Lowered threshold to be more inclusive of sparse sheets

    const mappings: ColumnMapping[] = [];
    const sourceTables = new Set<string>();
    const targetTables = new Set<string>();
    const transformationRules: string[] = [];
    const skippedRows = { missingSource: 0, missingTarget: 0, placeholder: 0 };
    const dedupe = new Set<string>();

    let lastSDB: string | undefined, lastSS: string | undefined, lastST: string = verticalMetadata.sourceTable || '';
    let lastTDB: string | undefined, lastTS: string | undefined, lastTT: string = verticalMetadata.targetTable || '';

    data.forEach(row => {
        const cleanVal = (val: any) => {
            if (val == null) return null;
            const str = String(val).trim();
            if (str === '' || str === '-') return null;
            // Treat N/A-style and placeholder values as null (no data)
            if (PLACEHOLDER_TOKENS.has(str.toLowerCase().replace(/\s+/g, ' '))) return null;
            return str;
        };

        const sourceValue = sourceCol ? cleanVal(row[sourceCol]) : null;
        const targetValue = targetCol ? cleanVal(row[targetCol]) : null;
        const transformValue = transformCol ? cleanVal(row[transformCol]) : null;

        const hasAnyMappingSignal = Boolean(sourceValue || targetValue || transformValue);
        if (!hasAnyMappingSignal) return;

        const normalizedSource = resolveCandidateColumn(sourceValue);
        const normalizedTarget = resolveCandidateColumn(targetValue);

        if (isPlaceholderValue(normalizedSource) && isPlaceholderValue(normalizedTarget) && !transformValue) {
            skippedRows.placeholder++;
            return;
        }

        if (srcDbCol && cleanVal(row[srcDbCol])) lastSDB = cleanVal(row[srcDbCol])!;
        if (srcSchemaCol && cleanVal(row[srcSchemaCol])) lastSS = cleanVal(row[srcSchemaCol])!;
        if (srcTableCol && cleanVal(row[srcTableCol])) lastST = cleanVal(row[srcTableCol])!;
        if (tgtDbCol && cleanVal(row[tgtDbCol])) lastTDB = cleanVal(row[tgtDbCol])!;
        if (tgtSchemaCol && cleanVal(row[tgtSchemaCol])) lastTS = cleanVal(row[tgtSchemaCol])!;
        if (tgtTableCol && cleanVal(row[tgtTableCol])) lastTT = cleanVal(row[tgtTableCol])!;

        const rowSourceTable = [lastSDB, lastSS, lastST].filter(Boolean).join('.');
        const rowTargetTable = [lastTDB, lastTS, lastTT].filter(Boolean).join('.');

        if (rowSourceTable) sourceTables.add(rowSourceTable);
        if (rowTargetTable) targetTables.add(rowTargetTable);

        // Allow row if it has at least a target OR transformation logic
        if (!normalizedTarget && !transformValue) return;

        const dedupeKey = `${rowSourceTable}|${rowTargetTable}|${(normalizedSource || '').toLowerCase()}|${(normalizedTarget || '').toLowerCase()}|${(transformValue || '').toLowerCase()}`;
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);

        mappings.push({
            sourceColumn: normalizedSource || 'Expression/Constant',
            targetColumn: normalizedTarget,
            sourceTable: rowSourceTable,
            targetTable: rowTargetTable,
            transformationType: detectTransformationType(transformValue),
            transformationLogic: transformValue ? String(transformValue).trim() : undefined,
            sourceDataType: srcDataTypeCol ? cleanVal(row[srcDataTypeCol]) || undefined : undefined,
            targetDataType: tgtDataTypeCol ? cleanVal(row[tgtDataTypeCol]) || undefined : undefined,
            notes: notesCol ? cleanVal(row[notesCol]) || undefined : undefined,
            complexity: assessComplexity(transformValue),
            isPrimaryKey: pkCol ? /y|yes|true|1|pk/i.test(String(row[pkCol] || '')) : undefined,
            isNullable: nullCol ? /y|yes|true|1|null/i.test(String(row[nullCol] || '')) : undefined
        });

        if (transformValue) transformationRules.push(String(transformValue).trim());
    });

    return {
        sourceTables, targetTables, columnMappings: mappings,
        detectedFormat: 'Standard Mapping (Scored)',
        transformationRules,
        metadata: { totalRows: data.length, detectedColumns: columns, formatConfidence: confidence, skippedRows }
    };
}

function parseMultiSourceFormat(data: any[], columns: string[], verticalMetadata: any = {}): ParsedMappingSheet | null {
    const targetCol = findColumn(columns, ['target', 'edw', 'warehouse', 'target field']);
    if (!targetCol) return null;
    const potentialSourceCols = columns.filter(c => c !== targetCol && !/note|comment|desc|complex|logic/i.test(c));
    if (potentialSourceCols.length < 2) return null;

    const mappings: ColumnMapping[] = [];
    data.forEach(row => {
        const targetValue = resolveCandidateColumn(row[targetCol]);
        if (!targetValue || isPlaceholderValue(targetValue)) return;
        potentialSourceCols.forEach(sourceCol => {
            const sourceValue = resolveCandidateColumn(row[sourceCol]);
            if (sourceValue && !isPlaceholderValue(sourceValue)) {
                mappings.push({
                    sourceColumn: `${sourceCol}.${sourceValue}`,
                    targetColumn: targetValue,
                    sourceTable: sourceCol,
                    targetTable: 'Target Warehouse',
                    transformationType: 'direct_move',
                    complexity: 'simple'
                });
            }
        });
    });

    return {
        sourceTables: new Set(potentialSourceCols),
        targetTables: new Set(['Target Warehouse']),
        columnMappings: mappings,
        detectedFormat: 'Multi-Source',
        transformationRules: [],
        metadata: { totalRows: data.length, detectedColumns: columns, formatConfidence: 0.7 }
    };
}

function parseTransformationRuleFormat(data: any[], columns: string[], verticalMetadata: any = {}): ParsedMappingSheet | null {
    const ruleCol = findColumn(columns, ['rule', 'sr', 'no', '#', 'rule name']);
    const descCol = findColumn(columns, ['description', 'desc']);
    const syntaxCol = findColumn(columns, ['syntax', 'sql', 'formula', 'code']);
    if (!ruleCol && !descCol) return null;

    const transformationRules: string[] = [];
    const testCases: any[] = [];

    data.forEach(row => {
        const rule = ruleCol ? String(row[ruleCol] || '').trim() : '';
        const desc = descCol ? String(row[descCol] || '').trim() : '';
        const syntax = syntaxCol ? String(row[syntaxCol] || '').trim() : '';

        if (desc) {
            const ruleText = `${rule ? rule + ': ' : ''}${desc}`;
            transformationRules.push(ruleText);
            
            testCases.push({
                name: rule || desc.substring(0, 50),
                description: desc,
                sourceSQL: syntax || 'N/A',
                targetSQL: 'N/A',
                expectedResult: 'Transformation should match business rule logic.',
                category: 'business_rule'
            });
        }
    });

    return {
        sourceTables: new Set(['Source']),
        targetTables: new Set(['Target']),
        columnMappings: [],
        testCases,
        detectedFormat: 'Transformation Rules',
        transformationRules,
        metadata: { totalRows: data.length, detectedColumns: columns, formatConfidence: 0.6 }
    };
}

function parseTestCaseFormat(data: any[], columns: string[], verticalMetadata: any = {}): ParsedMappingSheet | null {
    const tsNameCol = findColumn(columns, ['test scenario name', 'scenario name', 'ts name']);
    const tcNameCol = findColumn(columns, ['test case name', 'tc name', 'test case']);
    const tsIdCol = findColumn(columns, ['test scenario id', 'ts id']);
    const tcIdCol = findColumn(columns, ['test case id', 'tc id']);

    if (!tsNameCol && !tcNameCol) return null;
    const testCases: any[] = [];
    let lastTsId = '', lastTsName = '';

    data.forEach(row => {
        const tsId = String(row[tsIdCol || ''] || '').trim();
        const tsName = String(row[tsNameCol || ''] || '').trim();
        const tcName = String(row[tcNameCol || ''] || '').trim();
        if (tsId) lastTsId = tsId;
        if (tsName) lastTsName = tsName;
        if (tcName) testCases.push({ id: row[tcIdCol || ''] || '', name: tcName, scenarioId: lastTsId, scenarioName: lastTsName });
    });

    return {
        sourceTables: new Set(['Source']), targetTables: new Set(['Target']), columnMappings: [], testCases,
        detectedFormat: 'Test Case Specification',
        transformationRules: testCases.map(tc => `${tc.scenarioName} > ${tc.name}`),
        metadata: { totalRows: data.length, detectedColumns: columns, formatConfidence: 0.8 }
    };
}

function parseVerticalFormat(data: any[], columns: string[], verticalMetadata: any = {}): ParsedMappingSheet | null {
    const hasMultipleMappingCols = columns.filter(c => /source|target/i.test(c)).length >= 2;
    if (!hasMultipleMappingCols) return null;
    return parseStandardFormat(data, columns, verticalMetadata);
}

function parseGenericFormat(data: any[], columns: string[], verticalMetadata: any = {}): ParsedMappingSheet | null {
    return {
        sourceTables: new Set(), targetTables: new Set(), columnMappings: [], detectedFormat: 'Generic', transformationRules: [],
        metadata: { totalRows: data.length, detectedColumns: columns, formatConfidence: 0.05 }
    };
}

function findColumn(columns: string[], keywords: string[]): string | null {
    for (const col of columns) {
        const normCol = col.toLowerCase().replace(/[_\s-]/g, '');
        for (const kw of keywords) {
            const normKw = kw.toLowerCase().replace(/[_\s-]/g, '');
            if (normCol === normKw || normCol.includes(normKw) || normKw.includes(normCol)) return col;
        }
    }
    return null;
}

function detectTransformationType(logic: any): ColumnMapping['transformationType'] {
    if (!logic) return 'direct_move';
    const l = String(logic).toUpperCase();
    if (l.includes('JOIN') || l.includes('LOOKUP')) return 'lookup';
    if (l.includes('FORMAT') || l.includes('DATE')) return 'date_format';
    if (l.includes('TRIM')) return 'trim';
    if (l.includes('REPLACE') || l.includes('STUFF')) return 'string_replace';
    if (l.includes('UPPER') || l.includes('LOWER')) return 'case_conversion';
    if (l.includes('CONCAT')) return 'concatenation';
    if (l.includes('ISNULL') || l.includes('COALESCE')) return 'null_handling';
    if (l.includes('SUM(') || l.includes('AVG(')) return 'aggregation';
    if (l.includes('CAST') || l.includes('CONVERT')) return 'type_casting';
    if (l.includes('CASE') || l.includes('WHEN')) return 'business_rule';
    return 'unknown';
}

function assessComplexity(logic: any): 'simple' | 'medium' | 'complex' {
    if (!logic) return 'simple';
    const l = String(logic);
    let score = 0;
    if (/CASE.*WHEN/i.test(l)) score += 2;
    if (/JOIN|SELECT/i.test(l)) score += 1;
    if ((l.match(/\(/g) || []).length > 2) score += 1;
    return score >= 3 ? 'complex' : score >= 1 ? 'medium' : 'simple';
}

function createEmptyResult(): ParsedMappingSheet {
    return {
        sourceTables: new Set(), targetTables: new Set(), columnMappings: [], detectedFormat: 'Unknown', transformationRules: [],
        metadata: { totalRows: 0, detectedColumns: [], formatConfidence: 0 }
    };
}
