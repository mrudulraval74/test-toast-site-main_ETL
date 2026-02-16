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
    const maxDetailedMismatches = Number(process.env.MAX_MISMATCH_ROWS || '50000');

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

        // Create hash buckets for comparison. Buckets preserve duplicates.
        const sourceBuckets = new Map();
        const targetBuckets = new Map();

        sourceResult.rows.forEach(row => {
            const hash = hashRow(row, compareColumns);
            if (!sourceBuckets.has(hash)) sourceBuckets.set(hash, []);
            sourceBuckets.get(hash).push(row);
        });

        targetResult.rows.forEach(row => {
            const hash = hashRow(row, compareColumns);
            if (!targetBuckets.has(hash)) targetBuckets.set(hash, []);
            targetBuckets.get(hash).push(row);
        });

        // Calculate differences
        let matchedRows = 0;
        let sourceOnlyRows = 0;
        let targetOnlyRows = 0;
        const mismatches = [];
        const comparisonRows = [];
        const sampleMismatches = [];
        const maxSamples = 10;
        const addMismatch = (entry) => {
            if (mismatches.length < maxDetailedMismatches) {
                mismatches.push(entry);
            }
            if (sampleMismatches.length < maxSamples) {
                sampleMismatches.push(entry);
            }
        };

        const allHashes = new Set([...sourceBuckets.keys(), ...targetBuckets.keys()]);
        const addComparisonRow = (entry) => {
            comparisonRows.push(entry);
        };

        for (const hash of allHashes) {
            const srcRows = sourceBuckets.get(hash) || [];
            const tgtRows = targetBuckets.get(hash) || [];
            const pairCount = Math.max(srcRows.length, tgtRows.length);

            for (let i = 0; i < pairCount; i++) {
                const sourceRow = srcRows[i];
                const targetRow = tgtRows[i];

                if (sourceRow && targetRow) {
                    matchedRows++;
                    addComparisonRow({
                        compareKeyHash: hash,
                        status: 'matched',
                        sourceRow,
                        targetRow,
                    });
                } else if (sourceRow) {
                    sourceOnlyRows++;
                    const mismatch = {
                        mismatchType: 'sourceOnly',
                        compareKeyHash: hash,
                        sourceRow,
                    };
                    addMismatch(mismatch);
                    addComparisonRow({
                        compareKeyHash: hash,
                        status: 'sourceOnly',
                        sourceRow,
                    });
                } else if (targetRow) {
                    targetOnlyRows++;
                    const mismatch = {
                        mismatchType: 'targetOnly',
                        compareKeyHash: hash,
                        targetRow,
                    };
                    addMismatch(mismatch);
                    addComparisonRow({
                        compareKeyHash: hash,
                        status: 'targetOnly',
                        targetRow,
                    });
                }
            }
        }

        const mismatchedRows = sourceOnlyRows + targetOnlyRows;

        const executionTime = Date.now() - startTime;

        const result = {
            summary: {
                sourceRowCount: sourceResult.rowCount,
                targetRowCount: targetResult.rowCount,
                matchedRows,
                mismatchedRows,
                sourceOnlyRows,
                targetOnlyRows,
                comparisonStatus: mismatchedRows === 0 ? 'passed' : 'failed',
            },
            compareColumns,
            source_data: sourceResult.rows,
            target_data: targetResult.rows,
            comparison_rows: comparisonRows,
            mismatches,
            sampleMismatches,
            mismatchTruncated: mismatches.length >= maxDetailedMismatches && mismatchedRows > maxDetailedMismatches,
            mismatchLimit: maxDetailedMismatches,
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
