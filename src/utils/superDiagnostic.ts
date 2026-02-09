// SUPER DIAGNOSTIC - Dumps everything from the mapping sheet
export function superDiagnostic(data: any[]): void {
    console.log('\n🔬 ===== SUPER DIAGNOSTIC MODE =====');
    console.log(`📊 Total Rows: ${data.length}`);

    if (data.length === 0) {
        console.log('❌ No data found');
        return;
    }

    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    console.log(`\n📋 Total Columns: ${columns.length}`);
    console.log('All Column Names:', columns);

    // Analyze each column
    console.log('\n🔍 ===== ANALYZING EACH COLUMN =====');
    columns.forEach((col, index) => {
        console.log(`\n--- Column ${index + 1}: "${col}" ---`);

        // Get sample values (first 10 non-empty values)
        const samples: string[] = [];
        let emptyCount = 0;
        let dashCount = 0;
        let longTextCount = 0;
        let sqlKeywordCount = 0;

        const sqlKeywords = ['CASE', 'WHEN', 'CAST', 'CONVERT', 'CONCAT', 'SUBSTRING',
            'ISNULL', 'COALESCE', 'TRIM', 'UPPER', 'LOWER'];

        for (let i = 0; i < Math.min(50, data.length); i++) {
            const value = data[i][col];
            if (!value || String(value).trim() === '') {
                emptyCount++;
                continue;
            }

            const strValue = String(value).trim();
            if (strValue === '-' || strValue === 'N/A') {
                dashCount++;
                continue;
            }

            // Collect sample
            if (samples.length < 10) {
                // Truncate very long values for display
                samples.push(strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue);
            }

            // Check for SQL keywords
            const upper = strValue.toUpperCase();
            if (sqlKeywords.some(kw => upper.includes(kw))) {
                sqlKeywordCount++;
            }

            // Check for long text
            if (strValue.length > 30) {
                longTextCount++;
            }
        }

        // Calculate score
        const score = (sqlKeywordCount * 10) + (longTextCount * 5) + samples.length;

        console.log(`  Empty values: ${emptyCount}`);
        console.log(`  Dash/N/A values: ${dashCount}`);
        console.log(`  SQL patterns found: ${sqlKeywordCount}`);
        console.log(`  Long text entries: ${longTextCount}`);
        console.log(`  SCORE: ${score}`);
        console.log(`  Sample values (first 10):`);
        samples.forEach((s, i) => {
            console.log(`    ${i + 1}. "${s}"`);
        });
    });

    // Now show first 5 complete rows
    console.log('\n\n📝 ===== FIRST 5 COMPLETE ROWS =====');
    for (let i = 0; i < Math.min(5, data.length); i++) {
        console.log(`\n--- ROW ${i + 1} ---`);
        columns.forEach(col => {
            const value = data[i][col];
            if (value && String(value).trim() !== '') {
                console.log(`  ${col}: "${value}"`);
            }
        });
    }

    console.log('\n🔬 ===== END SUPER DIAGNOSTIC =====\n');
}
