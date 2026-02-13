// Enhanced Mapping-Specific Test Generator with Better Classification
// Accurately distinguishes between direct moves and transformed columns

import { parseMappingSheet } from './mappingSheetParser';
import { DatabaseSchema, findTableInSchema, findColumnInTable } from './schemaFetcher';
import { generateDataQualityTests } from './test-generators/dataQualityTests';

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

    const logic = String(transformationLogic).trim().toUpperCase();

    // Check for common patterns (exact or highly similar)
    const directKeywords = [
        'DIRECT', 'SAME', 'AS IS', 'COPY', '1:1', '1 TO 1', 'STRAIGHT',
        'NO CHANGE', 'NONE', 'N/A', 'NA', '-', 'MATCH', 'AS-IS'
    ];

    if (directKeywords.some(kw => logic === kw || logic.startsWith(kw + ' ') || logic.includes(kw + ' MOVE') || logic.includes(kw + ' MAPPING'))) {
        return true;
    }

    // If it's just a simple source column reference like "Source.Column" or "[Column]"
    if (logic.match(/^\[?[a-zA-Z0-9_\s.]+\]?$/) && !logic.includes('CASE') && !logic.includes('WHEN')) {
        // If it looks like just a column name (no functions or operators), it's likely direct
        return true;
    }

    return false;
}

/**
 * Helper to resolve real column name from schema
 */
function resolveColumnName(schema: DatabaseSchema | null | undefined, tableName: string | undefined, columnName: string): string {
    if (!schema || !tableName) return columnName;

    const table = findTableInSchema(schema, tableName);
    if (!table) return columnName;

    const col = findColumnInTable(table, columnName);
    return col ? col.name : columnName;
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
        'none'
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

export function generateMappingSpecificTests(
    mappingData: any[],
    sourceSchema?: DatabaseSchema | null,
    targetSchema?: DatabaseSchema | null,
    pipelineName: string = 'Unknown_Pipeline',
    sourceDbType: string = 'mssql',
    targetDbType: string = 'mssql'
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
    const defaultSourceTable = Array.from(parsed.sourceTables)[0] || 'SourceTable';
    const defaultTargetTable = Array.from(parsed.targetTables)[0] || 'TargetTable';

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

        if (!hasUsableSource || !hasUsableTarget) {
            return;
        }

        const sourceValid = validateColumnExists(sourceSchema, sTab, mapping.sourceColumn);
        const targetValid = validateColumnExists(targetSchema, tTab, mapping.targetColumn);

        if (sourceValid && targetValid) {
            validatedMappings.push(mapping);
        }
    });

    console.log(`✅ Validated mappings count: ${validatedMappings.length}`);

    // Group mappings by exact source-target pair for better SQL accuracy.
    const tablePairs = new Map<string, {
        sourceTable: string;
        targetTable: string;
        mappings: any[];
    }>();

    validatedMappings.forEach(m => {
        const sTab = m.sourceTable || defaultSourceTable;
        const tTab = m.targetTable || defaultTargetTable;
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
    const quoteSourceColumn = (name: string) => quoteId(normalizeIdentifier(name), sourceDialect);
    const quoteTargetColumn = (name: string) => quoteId(normalizeIdentifier(name), targetDialect);

    const buildBusinessRuleExpression = (logicValue: any, sourceColExpr: string) => {
        const raw = String(logicValue || '').trim();
        if (!raw || isDirectMove(raw)) return sourceColExpr;
        const upper = raw.toUpperCase();

        // Simple but reliable rules only; unknown rules fallback to direct source expression.
        if (upper.includes('UPPER')) return `UPPER(${sourceColExpr})`;
        if (upper.includes('LOWER')) return `LOWER(${sourceColExpr})`;
        if (upper.includes('LTRIM') && upper.includes('RTRIM')) return `LTRIM(RTRIM(${sourceColExpr}))`;
        if (upper.includes('TRIM')) return `TRIM(${sourceColExpr})`;

        const coalesceMatch = raw.match(/(?:COALESCE|ISNULL|NVL)\s*\(\s*[^,]+,\s*([^)]+)\)/i);
        if (coalesceMatch?.[1]) return `COALESCE(${sourceColExpr}, ${coalesceMatch[1].trim()})`;

        const castMatch = raw.match(/CAST\s*\(\s*[^)]+\s+AS\s+([^)]+)\)/i);
        if (castMatch?.[1]) return `CAST(${sourceColExpr} AS ${castMatch[1].trim()})`;

        const roundMatch = raw.match(/ROUND\s*\(\s*[^,]+,\s*(\d+)\s*\)/i);
        if (roundMatch?.[1]) return `ROUND(${sourceColExpr}, ${roundMatch[1]})`;

        return sourceColExpr;
    };


    // --- PHASE 3: TEST GENERATION PER TABLE PAIR ---
    tablePairs.forEach((pair) => {
        const { sourceTable, targetTable, mappings } = pair;
        const qSrc = quoteSource(sourceTable);
        const qTgt = quoteTarget(targetTable);
        const phase = getPhasePrefix(sourceTable, targetTable);

        // 1. Structure Validation (Target vs Mapping Sheet) remained same...
        const generateMappingTruthSQL = (mapEntries: any[]) => {
            if (mapEntries.length === 0) return "SELECT 'No Mappings' as COLUMN_NAME";
            return mapEntries.map((m, i) => {
                const col = m.targetColumn || 'Unknown';
                const dtype = m.dataType || 'ANY';
                return `SELECT '${col}' as COLUMN_NAME, '${dtype}' as DATA_TYPE`;
            }).join(' UNION ALL ');
        };

        const getStructureSQL = (tableName: string, dialect: string) => {
            const shortName = tableName.split('.').pop();
            return `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${shortName}'`;
        };

        testCases.push({
            name: `${phase} | 1. Structure Validation (Target vs Mapping) | ${targetTable}`,
            description: `Verify that the columns and data types in ${targetTable} exactly match the definitions in the mapping sheet.`,
            sourceSQL: generateMappingTruthSQL(mappings),
            targetSQL: getStructureSQL(targetTable, targetDialect),
            expectedResult: 'Target table structure must match the column list and types defined in the mapping document.',
            category: 'structure',
            severity: 'major'
        });

        // 2. Count Validation (Sources vs Target)
        testCases.push({
            name: `${phase} | 2. Count Validation | ${targetTable}`,
            description: `Verify record count parity between ${sourceTable} and ${targetTable}`,
            sourceSQL: `SELECT COUNT(*) as TotalRecords FROM ${qSrc}`,
            targetSQL: `SELECT COUNT(*) as TotalRecords FROM ${qTgt}`,
            expectedResult: 'Row counts must be identical between sources and target.',
            category: 'general',
            severity: 'critical'
        });

        // 3. Null Data Validation (Sources vs Target)
        const firstMapped = mappings.find(m => isUsableColumnName(m.sourceColumn) && isUsableColumnName(m.targetColumn));
        if (firstMapped) {
            const sourceNullCol = quoteSourceColumn(resolveColumnName(sourceSchema, sourceTable, firstMapped.sourceColumn));
            const targetNullCol = quoteTargetColumn(resolveColumnName(targetSchema, targetTable, firstMapped.targetColumn));
            testCases.push({
                name: `${phase} | 3. Null Data Validation | ${targetTable}`,
                description: `Verify null-count parity for mapped column ${firstMapped.sourceColumn} -> ${firstMapped.targetColumn}.`,
                sourceSQL: `SELECT COUNT(*) as NullCount FROM ${qSrc} WHERE ${sourceNullCol} IS NULL`,
                targetSQL: `SELECT COUNT(*) as NullCount FROM ${qTgt} WHERE ${targetNullCol} IS NULL`,
                expectedResult: 'Null counts for mapped columns should be identical.',
                category: 'general',
                severity: 'major'
            });
        }

        // 4. Duplicate Data Validation
        let pkSrc: string[] = [];
        let pkTgt: string[] = [];

        // Try to find Primary Keys from schema, but ONLY if they are mapped
        // Note: For multi-source, we check the first source's schema as a heuristic
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

        // Fallback: If no schema PK is mapped, use the first column from the mapping as the "key"
        if (pkSrc.length === 0) {
            const firstValidMap = mappings.find(m => isUsableColumnName(m.sourceColumn) && isUsableColumnName(m.targetColumn));
            pkSrc = [firstValidMap?.sourceColumn || 'ID'];
            pkTgt = [firstValidMap?.targetColumn || 'ID'];
        }

        const sKeyList = pkSrc.map(c => quoteSourceColumn(c)).join(', ');
        const tKeyList = pkTgt.map(c => quoteTargetColumn(c)).join(', ');

        testCases.push({
            name: `${phase} | 4. Duplicate Data Validation | ${targetTable}`,
            description: `Verify uniqueness in ${targetTable} based on keys: ${tKeyList}`,
            sourceSQL: `SELECT ${sKeyList}, COUNT(*) as duplicate_Count FROM ${qSrc} GROUP BY ${sKeyList} HAVING COUNT(*) > 1`,
            targetSQL: `SELECT ${tKeyList}, COUNT(*) as duplicate_Count FROM ${qTgt} GROUP BY ${tKeyList} HAVING COUNT(*) > 1`,
            expectedResult: 'No duplicate records should exist for the defined keys.',
            category: 'general',
            severity: 'critical'
        });

        // 5. Table Constraint Validation
        const getConstraintSQL = (tableName: string) => {
            const shortName = tableName.split('.').pop();
            return `SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME = '${shortName}'`;
        };

        testCases.push({
            name: `${phase} | 5. Table Constraint Validation | ${targetTable}`,
            description: `Verify constraints (PK, SK, BK) in ${targetTable} against requirements.`,
            sourceSQL: getConstraintSQL(targetTable), // Comparing target constraints against itself/metadata
            targetSQL: getConstraintSQL(targetTable),
            expectedResult: 'All required table constraints should be correctly implemented.',
            category: 'structure',
            severity: 'major'
        });

        // 6. Data Accuracy Validation
        // 6a. Consolidated Direct Moves (One test case for all direct columns)
        const direct = mappings.filter(m =>
            (isDirectMove(m.transformationLogic) || m.transformationType === 'direct_move')
            && isUsableColumnName(m.sourceColumn)
            && isUsableColumnName(m.targetColumn)
        );

        if (direct.length > 0) {
            const usedAliases = new Set<string>();
            const keyAliases = pkSrc.map((_, idx) => `__key_${idx + 1}`);
            const sourceKeySelect = pkSrc.map((k, idx) => `s.${quoteSourceColumn(k)} AS ${quoteSourceColumn(keyAliases[idx])}`);
            const targetKeySelect = pkTgt.map((k, idx) => `t.${quoteTargetColumn(k)} AS ${quoteTargetColumn(keyAliases[idx])}`);

            const mappedSelects = direct.map((m, idx) => {
                const resolvedSrc = resolveColumnName(sourceSchema, sourceTable, m.sourceColumn);
                const resolvedTgt = resolveColumnName(targetSchema, targetTable, m.targetColumn);
                const alias = makeSafeAlias(m.targetColumn || `mapped_${idx + 1}`, usedAliases, `mapped_${idx + 1}`);
                return {
                    src: `s.${quoteSourceColumn(resolvedSrc)} AS ${quoteSourceColumn(alias)}`,
                    tgt: `t.${quoteTargetColumn(resolvedTgt)} AS ${quoteTargetColumn(alias)}`
                };
            });

            const orderSrc = keyAliases.map(k => quoteSourceColumn(k)).join(', ');
            const orderTgt = keyAliases.map(k => quoteTargetColumn(k)).join(', ');

            testCases.push({
                name: `${phase} | 6. Data Accuracy: Direct Moves (Consolidated) | ${targetTable}`,
                description: `Validate ${direct.length} direct mappings for ${targetTable} in one pass.`,
                sourceSQL: `SELECT ${[...sourceKeySelect, ...mappedSelects.map(m => m.src)].join(', ')} FROM ${qSrc} s ORDER BY ${orderSrc}`,
                targetSQL: `SELECT ${[...targetKeySelect, ...mappedSelects.map(m => m.tgt)].join(', ')} FROM ${qTgt} t ORDER BY ${orderTgt}`,
                expectedResult: 'All direct move values should match exactly.',
                category: 'direct_move',
                severity: 'critical'
            });
        }

        // 6b. Separate Business Rule Validation (one test per transformation)
        const rules = mappings.filter(m =>
            !isDirectMove(m.transformationLogic)
            && m.transformationType !== 'direct_move'
            && isUsableColumnName(m.sourceColumn)
            && isUsableColumnName(m.targetColumn)
        );

        rules.forEach(m => {
            const sCol = resolveColumnName(sourceSchema, sourceTable, m.sourceColumn);
            const tCol = resolveColumnName(targetSchema, targetTable, m.targetColumn);
            const usedAliases = new Set<string>();
            const keyAliases = pkSrc.map((_, idx) => `__key_${idx + 1}`);
            const sourceKeySelect = pkSrc.map((k, idx) => `s.${quoteSourceColumn(k)} AS ${quoteSourceColumn(keyAliases[idx])}`);
            const targetKeySelect = pkTgt.map((k, idx) => `t.${quoteTargetColumn(k)} AS ${quoteTargetColumn(keyAliases[idx])}`);
            const alias = makeSafeAlias(m.targetColumn || 'business_rule', usedAliases, 'business_rule');
            const srcExpr = buildBusinessRuleExpression(m.transformationLogic, `s.${quoteSourceColumn(sCol)}`);
            const orderSrc = keyAliases.map(k => quoteSourceColumn(k)).join(', ');
            const orderTgt = keyAliases.map(k => quoteTargetColumn(k)).join(', ');

            testCases.push({
                name: `${phase} | 6. Data Accuracy: Business Rule: ${m.targetColumn} | ${targetTable}`,
                description: `Validating: [${m.targetColumn}]. Logic: ${m.transformationLogic}`,
                sourceSQL: `SELECT ${[...sourceKeySelect, `${srcExpr} AS ${quoteSourceColumn(alias)}`].join(', ')} FROM ${qSrc} s ORDER BY ${orderSrc}`,
                targetSQL: `SELECT ${[...targetKeySelect, `t.${quoteTargetColumn(tCol)} AS ${quoteTargetColumn(alias)}`].join(', ')} FROM ${qTgt} t ORDER BY ${orderTgt}`,
                expectedResult: 'Transformed values should match exactly as per business rule.',
                category: 'business_rule',
                severity: 'critical'
            });
        });
    });

    // --- PHASE 4: SYSTEM INTEGRATION TESTS (Audit & Rejects) ---
    const allTgtTables = Array.from(parsed.targetTables);
    const hasLanding = allTgtTables.some(t => t.toUpperCase().includes('LANDING'));
    const hasEDW = allTgtTables.some(t => t.toUpperCase().includes('EDW'));
    const hasStage = allTgtTables.some(t => t.toUpperCase().includes('STAGE'));

    if (hasLanding || hasEDW || hasStage) {
        let phaseNum = 1;
        if (hasStage) phaseNum = 2;
        if (hasEDW) phaseNum = 3;

        const metadataTable = (phaseNum >= 3) ? '[Metadata].[EDWLanding]' : '[Metadata].[DLLanding]';

        testCases.push({
            name: `System: Pipeline Audit Trace | Validate execution for Phase ${phaseNum}`,
            description: `Verify entries in [Audit].[PipelineExecutionAudit] for Phase ${phaseNum}.`,
            sourceSQL: `SELECT pa.objectId, pea.ETLId, pa.status, pa.StartTimestamp, pa.EndTimestamp, pea.PipelineExecutionAuditId, pa.ChildPipelineRunId, pa.EffectedRowInserted, pa.EffectedRowUpdated, pa.Phase 
                       FROM [Audit].[PipelineExecutionAudit] pea
                       INNER JOIN [Audit].[PipelineAudit] pa ON pea.ParentPipelineRunId = pa.ParentPipelineRunId
                       INNER JOIN ${metadataTable} m ON pa.objectId = m.objectId
                       WHERE pa.Phase IN (${phaseNum}, ${phaseNum + 1})`,
            targetSQL: `SELECT count(*) as AuditCount FROM [Audit].[PipelineExecutionAudit] WHERE Phase = ${phaseNum} AND Status = 'Success'`,
            expectedResult: 'Record should exist with correct timestamps and row counts.',
            category: 'general',
            severity: 'critical'
        });

        testCases.push({
            name: `System: Reject Table Check | Validate rejected records | Phase ${phaseNum}`,
            description: `Verify if any records were rejected during Phase ${phaseNum}.`,
            sourceSQL: `SELECT count(*) as RejectCount, pa.objectId FROM [Audit].[PipelineExecutionAudit] pea 
                       INNER JOIN [Audit].[PipelineAudit] pa ON pea.ParentPipelineRunId = pa.ParentPipelineRunId
                       WHERE pa.Status = 'Rejected' AND pa.Phase = ${phaseNum}
                       GROUP BY pa.objectId`,
            targetSQL: `SELECT count(*) as RejectCount FROM [Audit].[PipelineExecutionAudit] WHERE Status = 'Rejected' AND Phase = ${phaseNum}`,
            expectedResult: 'Reject status should be tracked correctly in the audit system.',
            category: 'general',
            severity: 'major'
        });
    }

    const businessRules = [
        `📊 Analyzed ${mappingData.length} rows from mapping sheet`,
        `✅ Generated ${testCases.length} test cases for ${tablePairs.size} table pairs`,
    ];

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

    return {
        sourceTables: Array.from(parsed.sourceTables),
        targetTables: Array.from(parsed.targetTables),
        businessRules,
        testCases,
        mappings: validatedMappings
    };
}
