import { TestCase } from '../mappingSpecificTestGenerator';

/**
 * Audit Table Validation Generator
 * Implementations based on user examples EDW-T446 (Pipeline Audit) and EDW-T1189 (Reject Table)
 */

import { TestCase } from '../mappingSpecificTestGenerator';
import { DatabaseSchema, findTableInSchema } from '../schemaFetcher';

/**
 * Audit Table Validation Generator
 * Implementations based on user examples EDW-T446 (Pipeline Audit) and EDW-T1189 (Reject Table)
 */

export function generateAuditTests(
    sourceTable: string,
    targetTable: string,
    pipelineName: string = 'Unknown_Pipeline',
    targetSchema?: DatabaseSchema | null
): TestCase[] {
    const tests: TestCase[] = [];

    // 0. Prerequisite: Check if Audit Table exists (Mandatory)
    // If we have schema info, we can fail fast or warn
    if (targetSchema) {
        // Check for Audit schema/table
        // Note: The schema fetcher might flatten schemas, so we check loosely or strictly depending on implementation
        // Assuming standard [Audit].[PipelineExecutionAudit]
        const auditTableExists = findTableInSchema(targetSchema, 'PipelineExecutionAudit') ||
            findTableInSchema(targetSchema, '[Audit].[PipelineExecutionAudit]');

        if (!auditTableExists) {
            tests.push({
                name: 'Source To Landing | Structure: Audit Table Missing',
                description: 'Critical: The required audit table [Audit].[PipelineExecutionAudit] was not found in the target database.',
                sourceSQL: 'SELECT 0 as AuditExists',
                targetSQL: `SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Audit' AND TABLE_NAME = 'PipelineExecutionAudit'`,
                expectedResult: 'Audit table must exist for ETL validation',
                category: 'structure',
                severity: 'critical'
            });
            // We can still return other tests, but this one will block/fail
        }
    }

    // 1. Pipeline Execution Audit Check (Matches EDW-T446)
    // Verifies headers, timestamps, and row counts in the [Audit].[PipelineExecutionAudit] table
    tests.push({
        name: `Source To Landing | Audit: Pipeline Execution Verification (${sourceTable} -> ${targetTable})`,
        description: `Verify audit table entries for pipeline phases (Start/End time, Status, Row Counts) for pipeline '${pipelineName}'`,
        sourceSQL: `-- Reference: Expected Source Counts
SELECT COUNT(*) as ExpectedCount FROM ${sourceTable}`,
        targetSQL: `SELECT 
    ea.PipelineExecutionAuditId,
    ea.Status,
    ea.StartTimestamp,
    ea.EndTimestamp,
    ea.EffectedRowInserted,
    ea.EffectedRowUpdated
FROM [Audit].[PipelineExecutionAudit] ea
JOIN [Audit].[PipelineAudit] pa ON ea.ParentPipelineRunId = pa.ParentPipelineRunId
WHERE pa.PipelineName = '${pipelineName}'
ORDER BY ea.StartTimestamp DESC`,
        expectedResult: 'Audit table should contain success entry with correct timestamps and row counts matching source',
        category: 'general',
        severity: 'major'
    });

    // 2. Reject Table Count Validation (Matches EDW-T1189)
    // "Validate the count in Reject table and audit table."
    tests.push({
        name: `Source To Landing | Audit: Reject Table Count Verification`,
        description: `Verify that Rejected Record count matches the Audit table rejected count`,
        sourceSQL: `SELECT COUNT(*) as RejectCount FROM [Audit].[PipelineExecutionAudit] WHERE Status = 'Rejected'`,
        targetSQL: `SELECT COUNT(*) as RejectCount FROM [Reject].[${targetTable}_Reject]`, // Assumes standard naming convention
        expectedResult: 'Reject table count must match Audit log reject count',
        category: 'general',
        severity: 'minor'
    });

    return tests;
}
