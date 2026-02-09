import { TestCase } from '../mappingSpecificTestGenerator';
import { DatabaseSchema, findTableInSchema, findColumnInTable } from '../schemaFetcher';

/**
 * Helper: Check if rule implies transformation
 */
const hasKeyword = (rule: string, keywords: string[]) => {
    if (!rule) return false;
    const r = rule.toUpperCase();
    return keywords.some(k => r.includes(k.toUpperCase()));
};

/**
 * TC-006, TC-008, TC-012: Data Quality Tests
 * STRICTLY RULE-BASED: Only generates tests if mapping logic explicitly requires it.
 */
export function generateDataQualityTests(
    mappings: any[],
    defaultSourceTable: string,
    defaultTargetTable: string
): TestCase[] {
    const tests: TestCase[] = [];

    // TC-008: Whitespace Trimming
    // Trigger: "Trim", "Clean", "Remove Spaces"
    const trimMappings = mappings.filter(m =>
        hasKeyword(m.transformationLogic, ['Trim', 'Clean', 'Remove Space', 'Whitespace'])
    );

    if (trimMappings.length > 0) {
        const columns = trimMappings.map(m => `[${m.targetColumn}]`).join(', ');
        const condition = trimMappings.map(m => `([${m.targetColumn}] LIKE ' %' OR [${m.targetColumn}] LIKE '% ')`).join(' OR ');

        tests.push({
            name: 'Source To Landing | DQ: Whitespace/Trimming Validation',
            description: `Verify validation rules (Trim) applied to: ${columns}`,
            sourceSQL: `SELECT 0 as UntrimmedCount`, // Logical placeholder
            targetSQL: `SELECT COUNT(*) as UntrimmedCount FROM ${defaultTargetTable} WHERE ${condition}`,
            expectedResult: 'Count of records with leading/trailing spaces should be 0',
            category: 'business_rule',
            severity: 'minor'
        });
    }

    // TC-006: Mandatory / Null Checks
    // Trigger: "Mandatory", "Not Null", "Required"
    const mandatoryMappings = mappings.filter(m =>
        hasKeyword(m.transformationLogic, ['Mandatory', 'Not Null', 'Required', 'PK']) ||
        hasKeyword(m.comments, ['Mandatory', 'Not Null'])
    );

    if (mandatoryMappings.length > 0) {
        const columns = mandatoryMappings.map(m => `[${m.targetColumn}]`).join(', ');
        const condition = mandatoryMappings.map(m => `[${m.targetColumn}] IS NULL`).join(' OR ');

        tests.push({
            name: 'Source To Landing | DQ: Mandatory Column Check',
            description: `Verify no NULLs in mandatory columns: ${columns}`,
            sourceSQL: `SELECT 0 as NullCount`,
            targetSQL: `SELECT COUNT(*) as NullCount FROM ${defaultTargetTable} WHERE ${condition}`,
            expectedResult: 'Null count must be 0 for mandatory fields',
            category: 'business_rule',
            severity: 'critical'
        });
    }

    // TC-015: Range / Boundary Validation
    // Trigger: "Numeric", "Price", "Amount", "Quantity", "Count"
    const numericMappings = mappings.filter(m =>
        hasKeyword(m.sourceColumn, ['Amount', 'Price', 'Qty', 'Quantity', 'Balance', 'Total', 'Sum']) ||
        hasKeyword(m.transformationLogic, ['Numeric', 'Decimal', 'Integer', 'Float'])
    );

    if (numericMappings.length > 0) {
        const sampleMapping = numericMappings[0];
        tests.push({
            name: 'Source To Landing | DQ: Numeric Range Validation',
            description: `Verify data stays within expected boundaries for [${sampleMapping.targetColumn}]`,
            sourceSQL: `SELECT MIN(${sampleMapping.sourceColumn}) as MinVal, MAX(${sampleMapping.sourceColumn}) as MaxVal FROM ${defaultSourceTable}`,
            targetSQL: `SELECT MIN(${sampleMapping.targetColumn}) as MinVal, MAX(${sampleMapping.targetColumn}) as MaxVal FROM ${defaultTargetTable}`,
            expectedResult: 'Target ranges should be consistent with source (or within defined business thresholds)',
            category: 'business_rule',
            severity: 'major'
        });
    }

    // TC-020: Distinct Value Count (Cardinality)
    const categoryMappings = mappings.filter(m =>
        hasKeyword(m.sourceColumn, ['Type', 'Code', 'Category', 'Status', 'ID'])
    );

    if (categoryMappings.length > 0) {
        const sample = categoryMappings[0];
        tests.push({
            name: 'Source To Landing | DQ: Cardinality Check (Distinct Counts)',
            description: `Verify unique value count for categorical column: [${sample.targetColumn}]`,
            sourceSQL: `SELECT COUNT(DISTINCT ${sample.sourceColumn}) as DistinctCount FROM ${defaultSourceTable}`,
            targetSQL: `SELECT COUNT(DISTINCT ${sample.targetColumn}) as DistinctCount FROM ${defaultTargetTable}`,
            expectedResult: 'Number of distinct values should match exactly',
            category: 'business_rule',
            severity: 'major'
        });
    }

    return tests;
}
