import { TestCase, TestCaseSeverity, TestCaseCategory } from '../mappingSpecificTestGenerator';
import { DatabaseSchema, findTableInSchema, findColumnInTable } from '../schemaFetcher';

/**
 * TC-001: Validation of Table Structure and Schema
 * Aligns with user example: "Verify the @Source Table and the @Target Table Structure"
 */
export function generateSchemaValidationTests(
    sourceTable: string,
    targetTable: string,
    sourceSchema?: DatabaseSchema | null,
    targetSchema?: DatabaseSchema | null
): TestCase[] {
    const tests: TestCase[] = [];

    // 1. Column Count Check
    tests.push({
        name: 'Source To Landing | Structure: Column Count Verification',
        description: `Verify Source [${sourceTable}] and Target [${targetTable}] have consistent column counts`,
        sourceSQL: `SELECT COUNT(*) as ColCount FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${sourceTable}'`,
        targetSQL: `SELECT COUNT(*) as ColCount FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${targetTable}'`,
        expectedResult: 'Column counts should match exactly',
        category: 'structure',
        severity: 'critical'
    });

    // 2. Data Type Validation (Sample Check)
    // Checks if specific critical columns have matching types in schema
    // (Implementation simplified for now to generic schema query)
    tests.push({
        name: 'Source To Landing | Structure: Data Type Consistency',
        description: `Verify data types match between Source [${sourceTable}] and Target [${targetTable}]`,
        sourceSQL: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${sourceTable}' ORDER BY COLUMN_NAME`,
        targetSQL: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${targetTable}' ORDER BY COLUMN_NAME`,
        expectedResult: 'Data types for mapped columns must match',
        category: 'structure',
        severity: 'major'
    });

    return tests;
}
