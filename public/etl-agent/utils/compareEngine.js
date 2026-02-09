const { executeQuery } = require('./dbConnector');

// Simple hash function for row comparison
function hashRow(row, columns) {
    const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return 'NULL';
        return String(val);
    });
    return values.join('|');
}

// Execute comparison
async function executeComparison(config) {
    const startTime = Date.now();

    try {
        // Execute both queries
        console.log('[Comparison] Executing source query...');
        const sourceResult = await executeQuery(config.sourceConnection, config.sourceQuery);

        console.log('[Comparison] Executing target query...');
        const targetResult = await executeQuery(config.targetConnection, config.targetQuery);

        console.log(`[Comparison] Source rows: ${sourceResult.rowCount}, Target rows: ${targetResult.rowCount}`);

        // Determine columns to compare
        const sourceColumns = sourceResult.fields || [];
        const targetColumns = targetResult.fields || [];
        const commonColumns = sourceColumns.filter(col => targetColumns.includes(col));

        if (commonColumns.length === 0) {
            throw new Error('No common columns found between source and target');
        }

        // Use key columns if provided, otherwise use all common columns
        const compareColumns = config.keyColumns && config.keyColumns.length > 0
            ? config.keyColumns.filter(col => commonColumns.includes(col))
            : commonColumns;

        console.log(`[Comparison] Comparing using columns: ${compareColumns.join(', ')}`);

        // Create hash maps for comparison
        const sourceMap = new Map();
        const targetMap = new Map();

        sourceResult.rows.forEach(row => {
            const hash = hashRow(row, compareColumns);
            sourceMap.set(hash, row);
        });

        targetResult.rows.forEach(row => {
            const hash = hashRow(row, compareColumns);
            targetMap.set(hash, row);
        });

        // Calculate differences
        let matchedRows = 0;
        let mismatchedRows = 0;
        const sampleMismatches = [];
        const maxSamples = 10;

        // Check source rows
        for (const [hash, sourceRow] of sourceMap.entries()) {
            if (targetMap.has(hash)) {
                matchedRows++;
            } else {
                mismatchedRows++;
                if (sampleMismatches.length < maxSamples) {
                    sampleMismatches.push({
                        type: 'source_only',
                        row: sourceRow,
                    });
                }
            }
        }

        // Check target-only rows
        let targetOnlyCount = 0;
        for (const [hash, targetRow] of targetMap.entries()) {
            if (!sourceMap.has(hash)) {
                targetOnlyCount++;
                if (sampleMismatches.length < maxSamples) {
                    sampleMismatches.push({
                        type: 'target_only',
                        row: targetRow,
                    });
                }
            }
        }

        const executionTime = Date.now() - startTime;

        const result = {
            summary: {
                sourceRowCount: sourceResult.rowCount,
                targetRowCount: targetResult.rowCount,
                matchedRows,
                mismatchedRows,
                sourceOnlyRows: mismatchedRows,
                targetOnlyRows: targetOnlyCount,
                comparisonStatus: (mismatchedRows === 0 && targetOnlyCount === 0) ? 'passed' : 'failed',
            },
            sampleMismatches,
            executionTime,
        };

        console.log(`[Comparison] Complete: ${result.summary.comparisonStatus}`);
        return result;

    } catch (error) {
        console.error('[Comparison] Error:', error);
        throw error;
    }
}

module.exports = {
    executeComparison,
};
