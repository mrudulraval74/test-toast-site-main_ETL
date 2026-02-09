import { MappingAnalysis } from '@/types/ai-comparison';

/**
 * Generate SQL script containing all test cases
 */
export function getTestCasesSQL(analysis: MappingAnalysis | null): string {
    if (!analysis || !analysis.testCases) return '';

    return analysis.testCases.map(tc =>
        `-- Test Case: ${tc.name}\n-- ${tc.description}\n\n-- SOURCE SQL:\n${tc.sourceSQL};\n\n-- TARGET SQL:\n${tc.targetSQL};\n\n`
    ).join('-- --------------------------------------------------\n\n');
}

/**
 * Generate SQL report for structure validation results
 */
export function getStructureValidationSQL(validationResults: any): string {
    if (!validationResults) return '';
    const { sourceErrors, targetErrors, matches } = validationResults;

    let report = `-- Structure Validation Report\n`;
    report += `-- Generated: ${new Date().toLocaleString()}\n\n`;

    report += `-- ISSUES (${sourceErrors.length + targetErrors.length})\n`;
    sourceErrors.forEach((e: string) => report += `-- [SOURCE ISSUE] ${e}\n`);
    targetErrors.forEach((e: string) => report += `-- [TARGET ISSUE] ${e}\n`);

    report += `\n-- VERIFIED MATCHES (${matches.length})\n`;
    matches.forEach((m: string) => report += `-- [MATCH] ${m}\n`);

    report += `\n-- Note: This is a text report of the validation findings.\n-- To verify manually, check the existence of these objects in your database.\n`;
    return report;
}
