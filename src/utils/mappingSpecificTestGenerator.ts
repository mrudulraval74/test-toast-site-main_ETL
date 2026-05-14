// Enhanced Mapping-Specific Test Generator with Better Classification
// Accurately distinguishes between direct moves and transformed columns

import { parseMappingSheet } from './mappingSheetParser';
import { DatabaseSchema, findTableInSchema, findColumnInTable } from './schemaFetcher';
import { parsePromptDirectives, generatePromptEnhancedTests } from './promptTestEnhancer';
import { detectBusinessRules, BUSINESS_RULES } from './etlTestKnowledgeBase';

export type TestCaseCategory = 'direct_move' | 'business_rule' | 'transformation' | 'general' | 'structure';
export type TestCaseSeverity = 'critical' | 'major' | 'minor';

export interface TestCase {
    name: string;
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    category?: TestCaseCategory;
    severity?: TestCaseSeverity;
}

export interface MappingAnalysis {
    sourceTables: string[];
    targetTables: string[];
    businessRules: string[];
    testCases: TestCase[];
    mappings?: any[];
}

/**
 * Check if transformation is actually a direct move (no real transformation)
 */
function isDirectMove(transformationLogic: any): boolean {
    if (!transformationLogic) return true;

    const raw = String(transformationLogic).trim();
    const logic = raw.toUpperCase();

    // Check for common patterns (exact or highly similar)
    const directKeywords = [
        'DIRECT', 'SAME', 'AS IS', 'COPY', '1:1', '1 TO 1', 'STRAIGHT',
        'NO CHANGE', 'NONE', 'N/A', 'NA', '-', 'MATCH', 'AS-IS'
    ];

    if (directKeywords.some(kw => logic === kw || logic.startsWith(kw + ' ') || logic.includes(kw + ' MOVE') || logic.includes(kw + ' MAPPING'))) {
        return true;
    }

    // CRITICAL: Check knowledge base. If it's a known rule (like CONCAT, TRIM, etc.), it's NOT a direct move.
    const detected = detectBusinessRules(raw);
    if (detected.length > 0) return false;

    // If it's just a simple source column reference like "Source.Column" or "[Column]"
    // We restrict this to things that don't look like common ETL functions
    if (logic.match(/^\[?[a-zA-Z0-9_\s.]+\]?$/) && !logic.includes('CASE') && !logic.includes('WHEN')) {
        const forbiddenFunctions = ['CONCAT', 'TRIM', 'LTRIM', 'RTRIM', 'UPPER', 'LOWER', 'COALESCE', 'ISNULL', 'IFNULL', 'NVL', 'CAST', 'CONVERT', 'FORMAT', 'DATE', 'YEAR', 'MONTH', 'DAY'];
        if (forbiddenFunctions.some(f => logic === f || logic.startsWith(f + '('))) {
            return false;
        }
        return true;
    }

    return false;
}

/**
 * Helper to resolve real column name from schema
 */
function resolveColumnName(schema: DatabaseSchema | null | undefined, tableName: string | undefined, columnName: string): string {
    if (!columnName) return '';
    if (!schema || !tableName) return columnName;

    const resolveSingle = (name: string) => {
        const table = findTableInSchema(schema, tableName);
        if (!table) return name;
        const col = findColumnInTable(table, name);
        return col ? col.name : name;
    };

    if (columnName.includes(',')) {
        return columnName.split(',').map(s => resolveSingle(s.trim())).join(', ');
    }
    return resolveSingle(columnName);
}

function resolveTableName(schema: DatabaseSchema | null | undefined, tableName: string | undefined): string {
    if (!tableName) return '';
    if (!schema) return tableName;

    const table = findTableInSchema(schema, tableName);
    if (!table) return tableName;

    // Use schema-qualified names for generated SQL. In SQL Server, a table like
    // AdventureWorks2019.Person.Person cannot be queried as just "Person".
    return table.fullName || `${table.schema}.${table.tableName}`;
}

/**
 * Detect the ETL phase based on table names
 */
function getPhasePrefix(sourceTable: string, targetTable: string): string {
    const s = String(sourceTable || '').toUpperCase();
    const t = String(targetTable || '').toUpperCase();

    if (s.includes('EDWLANDING') || s.includes('EDW_LANDING') || (s.includes('EDW') && t.includes('EDW'))) return 'EDW Landing To EDW';
    if (s.includes('STAGE') || t.includes('EDWLANDING') || t.includes('EDW_LANDING')) return 'Stage To EDW Landing';
    if (s.includes('LANDING') || t.includes('STAGE')) return 'Landing To Stage';
    if (s.includes('SOURCE') || t.includes('LANDING') || t.includes('ODS')) return 'Source To Landing';

    return 'Source To Landing'; // Default
}

function isUsableColumnName(columnName: string | undefined | null): boolean {
    if (!columnName) return false;
    const value = String(columnName).trim();
    if (!value) return false;

    const normalized = value.toLowerCase();
    const blocked = [
        'unknown',
        'source',
        'target',
        'n/a',
        'na',
        '-',
        '--',
        'column',
        'field',
        'null',
        'none',
        'expression',
        'expression/constant'
    ];

    if (blocked.includes(normalized)) return false;
    if (/^column[_\s-]?\d+$/i.test(value)) return false;
    if (value.includes('[Auto-detected') || value.includes('[Configure')) return false;
    return true;
}

function normalizeIdentifier(value: string | undefined | null): string {
    if (!value) return '';
    const cleaned = String(value).trim().replace(/^[\[\]`"]+|[\[\]`"]+$/g, '');
    if (!cleaned) return '';
    const parts = cleaned.split('.').map(p => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : cleaned;
}

function makeSafeAlias(base: string, used: Set<string>, fallback: string): string {
    const normalized = normalizeIdentifier(base).replace(/[^a-zA-Z0-9_]/g, '_');
    const seed = normalized || fallback;
    let alias = seed;
    let i = 2;
    while (used.has(alias.toLowerCase())) {
        alias = `${seed}_${i}`;
        i += 1;
    }
    used.add(alias.toLowerCase());
    return alias;
}

function hasKeyword(value: any, keywords: string[]): boolean {
    const text = String(value || '').toUpperCase();
    return keywords.some((kw) => text.includes(kw.toUpperCase()));
}

function inferBestTableFromSchema(
    schema: DatabaseSchema | null | undefined,
    mappings: any[],
    side: 'source' | 'target'
): string | null {
    if (!schema || !Array.isArray(schema.tables) || schema.tables.length === 0 || !Array.isArray(mappings)) {
        return null;
    }

    const columnKey = side === 'source' ? 'sourceColumn' : 'targetColumn';
    const scores = new Map<string, number>();

    for (const table of schema.tables) {
        let score = 0;
        for (const mapping of mappings) {
            const colName = normalizeIdentifier(mapping?.[columnKey]);
            if (!colName) continue;
            if (findColumnInTable(table, colName)) score += 1;
        }
        if (score > 0) {
            scores.set(table.fullName, score);
        }
    }

    if (scores.size === 0) return null;

    let bestTable: string | null = null;
    let bestScore = -1;
    for (const [tableName, score] of scores.entries()) {
        if (score > bestScore) {
            bestTable = tableName;
            bestScore = score;
        }
    }

    return bestTable;
}

export function generateMappingSpecificTests(
    mappingData: any[],
    sourceSchema?: DatabaseSchema | null,
    targetSchema?: DatabaseSchema | null,
    pipelineName: string = 'Unknown_Pipeline',
    sourceDbType: string = 'mssql',
    targetDbType: string = 'mssql',
    promptInstructions: string = ''
): MappingAnalysis {
    if (!mappingData || mappingData.length === 0) {
        return {
            sourceTables: [],
            targetTables: [],
            businessRules: ['No mapping data provided'],
            testCases: []
        };
    }

    const parsed = parseMappingSheet(mappingData);
    const testCases: TestCase[] = [];

    // Default tables if not specified in mapping
    const inferredSourceTable = inferBestTableFromSchema(sourceSchema, parsed.columnMappings, 'source');
    const inferredTargetTable = inferBestTableFromSchema(targetSchema, parsed.columnMappings, 'target');
    const defaultSourceTable = Array.from(parsed.sourceTables)[0] || inferredSourceTable || 'SourceTable';
    const defaultTargetTable = Array.from(parsed.targetTables)[0] || inferredTargetTable || 'TargetTable';

    /**
     * Validate that a column exists in the schema
     */
    function validateColumnExists(
        schema: DatabaseSchema | null | undefined,
        tableName: string | undefined,
        columnName: string
    ): boolean {
        if (!schema || !tableName || !columnName) return true; // Fail-open
        const table = findTableInSchema(schema, tableName);
        if (!table) return true; // Fail-open
        const column = findColumnInTable(table, columnName);
        return !!column;
    }

    // --- PHASE 1: VALIDATION & GROUPING ---
    const validatedMappings: any[] = [];

    parsed.columnMappings.forEach(mapping => {
        const sTab = mapping.sourceTable || defaultSourceTable;
        const tTab = mapping.targetTable || defaultTargetTable;
        const hasUsableSource = isUsableColumnName(mapping.sourceColumn);
        const hasUsableTarget = isUsableColumnName(mapping.targetColumn);

        // Allow if it's a constant/expression (source column is 'Expression/Constant')
        if (!hasUsableTarget) {
            return;
        }

        const sourceValid = hasUsableSource ? validateColumnExists(sourceSchema, sTab, mapping.sourceColumn) : true;
        const targetValid = validateColumnExists(targetSchema, tTab, mapping.targetColumn);

        // Fail-Open: Process mapping even if not found in schema
        validatedMappings.push(mapping);
    });

    console.log(`✅ Validated mappings count: ${validatedMappings.length}`);

    // Group mappings by exact source-target pair for better SQL accuracy.
    const tablePairs = new Map<string, {
        sourceTable: string;
        targetTable: string;
        mappings: any[];
    }>();

    validatedMappings.forEach(m => {
        const sTab = resolveTableName(sourceSchema, m.sourceTable || defaultSourceTable);
        const tTab = resolveTableName(targetSchema, m.targetTable || defaultTargetTable);
        const key = `${sTab}=>${tTab}`;
        if (!tablePairs.has(key)) {
            tablePairs.set(key, { sourceTable: sTab, targetTable: tTab, mappings: [] });
        }
        const pair = tablePairs.get(key)!;
        pair.mappings.push(m);
    });

    // --- PHASE 2: DIALECT & QUOTING HELPERS ---
    const getDialect = (dbType: string) => {
        const type = dbType?.toLowerCase() || 'mssql';
        if (type === 'mysql' || type === 'mariadb') return 'mysql';
        if (type === 'postgresql' || type === 'redshift' || type === 'snowflake' || type === 'databricks' || type === 'sqlite' || type === 'spark') return 'postgres'; // Backtick or Double Quote depending on engine, but postgres double quotes are safe for most Spark SQL
        if (type === 'spark_sql' || type === 'databricks') return 'mysql'; // Spark SQL often uses backticks
        if (type === 'oracle') return 'oracle';
        return 'mssql';
    };

    const sourceDialect = getDialect(sourceDbType);
    const targetDialect = getDialect(targetDbType);

    const quoteId = (name: string, dialect: string) => {
        if (!name) return '';
        if (dialect === 'mysql') return `\`${name}\``;
        if (dialect === 'postgres' || dialect === 'oracle') return `"${name}"`;
        return `[${name}]`;
    };

    const quoteSource = (name: string) => {
        if (!name) return '';
        // Handle multi-part names: DB.Schema.Table or Schema.Table
        return name.split('.').map(p => quoteId(p.trim(), sourceDialect)).filter(Boolean).join('.');
    };
    const quoteTarget = (name: string) => {
        if (!name) return '';
        return name.split('.').map(p => quoteId(p.trim(), targetDialect)).filter(Boolean).join('.');
    };
    const quoteIdMulti = (name: string, dialect: string) => {
        if (!name) return "''";
        if (name.includes(',')) {
            return name.split(',').map(s => quoteId(normalizeIdentifier(s.trim()), dialect)).join(', ');
        }
        return quoteId(normalizeIdentifier(name), dialect);
    };

    const quoteSourceColumn = (name: string) => quoteIdMulti(name, sourceDialect);
    const quoteTargetColumn = (name: string) => quoteIdMulti(name, targetDialect);
    const buildDistinctKeyExpr = (keys: string, dialect: string) => {
        const parts = keys.split(',').map(k => k.trim()).filter(Boolean);
        if (parts.length <= 1) return parts[0] || '1';
        if (dialect === 'mysql') return `CONCAT_WS('|', ${parts.join(', ')})`;
        if (dialect === 'postgres' || dialect === 'oracle') return parts.join(` || '|' || `);
        return parts.join(` + '|' + `);
    };

    const buildBusinessRuleExpression = (logicValue: any, sourceColExpr: string) => {
        const raw = String(logicValue || '').trim();
        if (!raw || isDirectMove(raw)) return sourceColExpr;
        
        // If the rule ALREADY looks like a SQL expression (contains parens and looks like a function)
        // AND it doesn't seem to be a simple keyword like "CONCAT" or "TRIM"
        const isAlreadySql = /^[a-zA-Z0-9_]+\(.*\)$/.test(raw) || /[\+\-\*\/\|]/.test(raw);
        
        const detected = detectBusinessRules(raw);
        
        // If no known rule but looks like SQL, use it as is (risky but often what users want)
        if (detected.length === 0 && isAlreadySql) {
            return raw;
        }

        if (detected.length === 0) return sourceColExpr;

        // Use the first detected rule's pattern
        const rule = detected[0];
        let pattern = rule.sqlPatterns[0];

        if (!pattern) return sourceColExpr;

        // DIALECT-SPECIFIC TRANSLATION
        if (sourceDialect === 'mysql') {
            pattern = pattern.replace(/ISNULL\(/gi, 'IFNULL(').replace(/GETDATE\(\)/gi, 'NOW()').replace(/LEN\(/gi, 'LENGTH(');
        } else if (sourceDialect === 'postgres' || sourceDialect === 'oracle') {
            pattern = pattern.replace(/ISNULL\(/gi, 'COALESCE(').replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP').replace(/LEN\(/gi, 'LENGTH(');
            if (pattern.includes('CONCAT(')) pattern = '{col1} || {col2}';
        }

        // Split source expression by comma for multi-column rules
        const colParts = sourceColExpr.split(',').map(s => s.trim());

        // SMART REPLACEMENT:
        // If the rule text itself contains the source column name, it's a high-fidelity mapping
        let expr = pattern;
        
        // If we have multiple columns, replace {col1}, {col2}...
        if (colParts.length > 1) {
            colParts.forEach((part, idx) => {
                const placeholder = `{col${idx + 1}}`;
                expr = expr.split(placeholder).join(part);
            });
            // Fallback for {col} in multi-column context
            expr = expr.replace(/{col}/g, colParts.join(', '));
        } else {
            // Single column context
            expr = expr.replace(/{col}/g, sourceColExpr).replace(/{col1}/g, sourceColExpr);
        }

        // Handle other placeholders
        expr = expr
            .replace(/{col2}/g, colParts[1] || "'TBD'")
            .replace(/{n}/g, '10')
            .replace(/{decimals}/g, '2')
            .replace(/{type}/g, sourceDialect === 'mysql' ? 'CHAR' : (sourceDialect === 'postgres' ? 'TEXT' : 'VARCHAR(MAX)'))
            .replace(/{interval}/g, 'DAY')
            .replace(/{number}/g, '2')
            .replace(/{old}/g, 'old_value')
            .replace(/{new}/g, 'new_value')
            .replace(/{start}/g, '1')
            .replace(/{length}/g, '5')
            .replace(/{year}/g, sourceDialect === 'mysql' ? 'YEAR(NOW())' : 'YEAR(GETDATE())')
            .replace(/{month}/g, sourceDialect === 'mysql' ? 'MONTH(NOW())' : 'MONTH(GETDATE())')
            .replace(/{day}/g, sourceDialect === 'mysql' ? 'DAY(NOW())' : 'DAY(GETDATE())');

        return expr;
    };


    // --- PHASE 3: TEST GENERATION PER TABLE PAIR ---
    tablePairs.forEach((pair) => {
        const { sourceTable, targetTable, mappings } = pair;
        const qSrc = quoteSource(sourceTable);
        const qTgt = quoteTarget(targetTable);
        const phase = getPhasePrefix(sourceTable, targetTable);
        const withPhase = (title: string) => phase === 'Source To Landing' ? title : `${phase} | ${title}`;

        // 3. Null Data Validation (Sources vs Target)
        const firstMapped = mappings.find(m => isUsableColumnName(m.sourceColumn) && isUsableColumnName(m.targetColumn));
        if (firstMapped) {
            const sourceNullCol = quoteSourceColumn(resolveColumnName(sourceSchema, sourceTable, firstMapped.sourceColumn));
            const targetNullCol = quoteTargetColumn(resolveColumnName(targetSchema, targetTable, firstMapped.targetColumn));
            testCases.push({
                name: `${withPhase('3. Null Data Validation')} | ${targetTable}`,
                description: `Verify null-count parity for mapped column ${firstMapped.sourceColumn} -> ${firstMapped.targetColumn}.`,
                sourceSQL: `SELECT COUNT(*) as NullCount FROM ${qSrc} WHERE ${sourceNullCol} IS NULL`,
                targetSQL: `SELECT COUNT(*) as NullCount FROM ${qTgt} WHERE ${targetNullCol} IS NULL`,
                expectedResult: 'Null counts for mapped columns should be identical.',
                category: 'general',
                severity: 'major'
            });
        }

        // 3b. Mapping-Defined Null Validation
        const nonNullableMappings = mappings.filter(m => m.isNullable === false && isUsableColumnName(m.targetColumn));
        nonNullableMappings.forEach(m => {
            const tCol = quoteTargetColumn(resolveColumnName(targetSchema, targetTable, m.targetColumn));
            testCases.push({
                name: `${withPhase('Validate Mandatory Column')} | ${targetTable}.${m.targetColumn}`,
                description: `Verify that mandatory column ${m.targetColumn} contains no null values in target.`,
                sourceSQL: `SELECT 0 as NullCount`, // Placeholder as we check target only
                targetSQL: `SELECT COUNT(*) as NullCount FROM ${qTgt} WHERE ${tCol} IS NULL`,
                expectedResult: 'Mandatory columns should not have NULL values.',
                category: 'general',
                severity: 'critical'
            });
        });

        // 4. Duplicate Data Validation
        let pkSrc: string[] = [];
        let pkTgt: string[] = [];

        // Try to find Primary Keys from mapping sheet FIRST
        const mappingPks = mappings.filter(m => m.isPrimaryKey);
        if (mappingPks.length > 0) {
            pkSrc = mappingPks.map(m => isUsableColumnName(m.sourceColumn) ? m.sourceColumn! : '');
            pkTgt = mappingPks.map(m => isUsableColumnName(m.targetColumn) ? m.targetColumn! : '');
            
            // If we have a target PK but no source PK, try to find a matching source column
            pkSrc = pkSrc.map((s, i) => {
                if (s) return s;
                const targetName = pkTgt[i];
                const matchingSource = mappings.find(m => m.targetColumn === targetName && isUsableColumnName(m.sourceColumn));
                return matchingSource ? matchingSource.sourceColumn : '';
            });
        } else {
            // Fallback: Try to find Primary Keys from schema
            const tableInfo = findTableInSchema(sourceSchema, sourceTable);
            if (tableInfo?.primaryKey && tableInfo.primaryKey.length > 0) {
                const mappedPks = tableInfo.primaryKey.filter(pk =>
                    mappings.some(m => normalizeIdentifier(m.sourceColumn).toLowerCase() === normalizeIdentifier(pk).toLowerCase())
                );

                if (mappedPks.length > 0) {
                    pkSrc = mappedPks;
                    pkTgt = pkSrc.map(s => {
                        const map = mappings.find(m => normalizeIdentifier(m.sourceColumn).toLowerCase() === normalizeIdentifier(s).toLowerCase());
                        return map ? (map.targetColumn || s) : s;
                    });
                }
            }
        }

        // Fallback: If no schema PK is mapped, use the first column from the mapping as the "key"
        if (pkSrc.filter(Boolean).length === 0) {
            const firstValidMap = mappings.find(m => isUsableColumnName(m.sourceColumn) && isUsableColumnName(m.targetColumn));
            pkSrc = [firstValidMap?.sourceColumn || ''];
            pkTgt = [firstValidMap?.targetColumn || ''];
        }

        const usablePkSrc = pkSrc.filter(isUsableColumnName);
        const usablePkTgt = pkTgt.filter(isUsableColumnName);

        const sKeyList = usablePkSrc.map(c => quoteSourceColumn(c)).join(', ');
        const tKeyList = usablePkTgt.map(c => quoteTargetColumn(c)).join(', ');

        testCases.push({
            name: `${withPhase('4. Duplicate Data Validation')} | ${targetTable}`,
            description: `Verify uniqueness in ${targetTable} based on keys: ${tKeyList}`,
            sourceSQL: `SELECT ${sKeyList}, COUNT(*) as duplicate_Count FROM ${qSrc} GROUP BY ${sKeyList} HAVING COUNT(*) > 1`,
            targetSQL: `SELECT ${tKeyList}, COUNT(*) as duplicate_Count FROM ${qTgt} GROUP BY ${tKeyList} HAVING COUNT(*) > 1`,
            expectedResult: 'No duplicate records should exist for the defined keys.',
            category: 'general',
            severity: 'critical'
        });

        // Validate values between source and target
        const firstMappedForValue = mappings.find((m) => isUsableColumnName(m.sourceColumn) && isUsableColumnName(m.targetColumn));
        if (firstMappedForValue) {
            const srcValCol = quoteSourceColumn(resolveColumnName(sourceSchema, sourceTable, firstMappedForValue.sourceColumn));
            const tgtValCol = quoteTargetColumn(resolveColumnName(targetSchema, targetTable, firstMappedForValue.targetColumn));
            testCases.push({
                name: `${withPhase('Validate Data Values')} | ${targetTable}`,
                description: `Validate source and target values for mapped column ${firstMappedForValue.sourceColumn} -> ${firstMappedForValue.targetColumn}.`,
                sourceSQL: `SELECT ${sKeyList}, ${srcValCol} AS ValueData FROM ${qSrc} ORDER BY ${sKeyList}`,
                targetSQL: `SELECT ${tKeyList}, ${tgtValCol} AS ValueData FROM ${qTgt} ORDER BY ${tKeyList}`,
                expectedResult: 'Data values should match source and target as per ETL mapping.',
                category: 'direct_move',
                severity: 'critical'
            });
        }

        // 5. Data Completeness: Row Count Reconciliation
        testCases.push({
            name: `${withPhase('Row Count Reconciliation')} | ${targetTable}`,
            description: `Verify that target table ${targetTable} row count matches source ${sourceTable}.`,
            sourceSQL: `SELECT COUNT(*) as RecordCount FROM ${qSrc}`,
            targetSQL: `SELECT COUNT(*) as RecordCount FROM ${qTgt}`,
            expectedResult: 'Record counts should be identical.',
            category: 'general',
            severity: 'critical'
        });

        // 6. Data Accuracy: Individual Column Validation
        // This generates a test for EVERY mapping to ensure maximum visibility
        mappings.forEach((m, idx) => {
            if (!isUsableColumnName(m.targetColumn)) return;

            const sCol = resolveColumnName(sourceSchema, sourceTable, m.sourceColumn);
            const tCol = resolveColumnName(targetSchema, targetTable, m.targetColumn);
            const isRule = !isDirectMove(m.transformationLogic);
            const ruleName = isRule ? (detectBusinessRules(m.transformationLogic)[0]?.name || 'Transformation') : 'Direct Move';
            
            const usedAliases = new Set<string>();
            const keyAliases = pkSrc.map((_, i) => `__key_${i + 1}`);
            
            // Only include key columns that actually exist/are usable
            const sourceKeySelect = pkSrc
                .map((k, i) => isUsableColumnName(k) ? `s.${quoteSourceColumn(k)} AS ${quoteSourceColumn(keyAliases[i])}` : null)
                .filter(Boolean);
                
            const targetKeySelect = pkTgt
                .map((k, i) => isUsableColumnName(k) ? `t.${quoteTargetColumn(k)} AS ${quoteTargetColumn(keyAliases[i])}` : null)
                .filter(Boolean);

            const orderSrc = usablePkSrc.map(k => `s.${quoteSourceColumn(k)}`).join(', ');
            const orderTgt = usablePkTgt.map(k => `t.${quoteTargetColumn(k)}`).join(', ');

            const alias = makeSafeAlias(`${m.targetColumn}_val`, usedAliases, 'val');
            const hasSrc = isUsableColumnName(m.sourceColumn);
            // FIX: Remove 's.' prefix for literals
            const baseSrc = hasSrc ? `s.${quoteSourceColumn(sCol)}` : "NULL";
            const srcExpr = isRule 
                ? buildBusinessRuleExpression(m.transformationLogic, baseSrc)
                : baseSrc;

            // Only use ORDER BY if we have a usable key
            const orderBySrc = orderSrc ? `ORDER BY ${orderSrc}` : '';
            const orderByTgt = orderTgt ? `ORDER BY ${orderTgt}` : '';

            testCases.push({
                name: `${withPhase(`Validate ${ruleName}`)} | ${targetTable}.${m.targetColumn}`,
                description: isRule 
                    ? `Validating business rule [${ruleName}] for column ${m.targetColumn}. Logic: ${m.transformationLogic}`
                    : `Validating direct mapping from ${m.sourceColumn} to ${m.targetColumn}.`,
                sourceSQL: `SELECT ${[...sourceKeySelect, `${srcExpr} AS ${quoteSourceColumn(alias)}`].join(', ')} FROM ${qSrc} s ${orderBySrc}`,
                targetSQL: `SELECT ${[...targetKeySelect, `t.${quoteTargetColumn(tCol)} AS ${quoteTargetColumn(alias)}`].join(', ')} FROM ${qTgt} t ${orderByTgt}`,
                expectedResult: 'Source and target values should match exactly.',
                category: isRule ? 'business_rule' : 'direct_move',
                severity: isRule ? 'critical' : 'major'
            });
        });


    });

    // --- PHASE 4: PROMPT-ENHANCED TESTS ---
    if (promptInstructions && promptInstructions.trim()) {
        const directives = parsePromptDirectives(promptInstructions);
        if (directives.length > 0) {
            tablePairs.forEach((pair) => {
                const { sourceTable, targetTable, mappings: pairMappings } = pair;
                const phase = getPhasePrefix(sourceTable, targetTable);
                const promptTests = generatePromptEnhancedTests(
                    directives,
                    pairMappings.map(m => ({
                        sourceColumn: m.sourceColumn,
                        targetColumn: m.targetColumn,
                        sourceTable: m.sourceTable,
                        targetTable: m.targetTable,
                        sourceDataType: m.sourceDataType,
                        targetDataType: m.targetDataType,
                        transformationLogic: m.transformationLogic,
                    })),
                    sourceTable,
                    targetTable,
                    quoteSource,
                    quoteTarget,
                    quoteSourceColumn,
                    quoteTargetColumn,
                    phase
                );
                testCases.push(...promptTests);
            });
            console.log(`🧠 Prompt enhanced: +${testCases.length} tests from ${directives.length} directive(s)`);
        }
    }

    const businessRules = [
        `📊 Analyzed ${mappingData.length} rows from mapping sheet`,
        `✅ Generated ${testCases.length} test cases for ${tablePairs.size} table pairs`,
    ];

    if (promptInstructions && promptInstructions.trim()) {
        businessRules.push(`🧠 Prompt instructions applied`);
    }
    if (sourceSchema) businessRules.push('✅ Source schema validated');
    if (targetSchema) businessRules.push('✅ Target schema validated');

    // Build comprehensive business rules summary
    const transformations = validatedMappings.filter(m => !isDirectMove(m.transformationLogic) && m.transformationType !== 'direct_move');
    if (transformations.length > 0) {
        const types: Record<string, number> = {};
        transformations.forEach(t => {
            types[t.transformationType] = (types[t.transformationType] || 0) + 1;
        });
        const typeSummary = Object.entries(types)
            .map(([type, count]) => `${count}× ${type.replace('_', ' ')}`)
            .join(', ');
        businessRules.push(`🎯 Transformation breakdown: ${typeSummary}`);
    }

    // Combine generated tests with any manual test cases from the sheet
    const finalTestCases = [
        ...testCases,
        ...(parsed.testCases || []).map((tc: any) => ({
            name: tc.name || 'Manual Test Case',
            description: tc.description || 'Manual test case from specification',
            sourceSQL: tc.sourceSQL || 'N/A',
            targetSQL: tc.targetSQL || 'N/A',
            expectedResult: tc.expectedResult || 'N/A',
            category: 'general' as TestCaseCategory,
            severity: 'major' as TestCaseSeverity
        }))
    ];

    // Final fallback: If still no tests but we have mappings/rules, add a structural check
    if (finalTestCases.length === 0 && (parsed.columnMappings.length > 0 || businessRules.length > 0)) {
        finalTestCases.push({
            name: 'ETL Metadata Validation',
            description: 'Basic validation of mapping metadata presence',
            sourceSQL: 'SELECT COUNT(*) FROM Information_Schema.Tables',
            targetSQL: 'SELECT COUNT(*) FROM Information_Schema.Tables',
            expectedResult: 'Metadata should be present and valid.',
            category: 'structure',
            severity: 'minor'
        });
    }

    return {
        sourceTables: Array.from(new Set(Array.from(parsed.sourceTables).map((table) => resolveTableName(sourceSchema, table)))),
        targetTables: Array.from(new Set(Array.from(parsed.targetTables).map((table) => resolveTableName(targetSchema, table)))),
        businessRules,
        testCases: finalTestCases,
        mappings: validatedMappings
    };
}
