/**
 * DIAGNOSTIC VERSION - Shows exactly what's happening with column detection
 */

export function diagnosticParseMappingSheet(data: any[]): any {
    console.log('====== MAPPING SHEET DIAGNOSTIC ======');
    console.log('Total rows:', data.length);

    if (!data || data.length === 0) {
        console.error('❌ No data provided');
        return { error: 'No data' };
    }

    // Get headers (first row)
    const headers = Object.keys(data[0]);
    console.log('📋 Column Headers Found:', headers);
    console.log('📊 Number of columns:', headers.length);

    // Show first row data
    console.log('\n📝 FIRST ROW DATA:');
    headers.forEach((header, idx) => {
        const value = data[0][header];
        const type = typeof value;
        const length = value ? String(value).length : 0;
        console.log(`  Column ${idx}: "${header}" = "${value}" (${type}, length: ${length})`);
    });

    // Try to identify columns
    console.log('\n🔍 COLUMN IDENTIFICATION:');

    const sourceKeywords = ['source', 'src', 'from', 'input', 'origin'];
    const targetKeywords = ['target', 'tgt', 'dest', 'output', 'to'];
    const transformKeywords = ['transformation', 'transform', 'rule', 'logic', 'formula', 'mapping'];

    let sourceColIdx = -1;
    let targetColIdx = -1;
    let transformColIdx = -1;

    // Find source column
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase();
        if (sourceKeywords.some(kw => header.includes(kw))) {
            sourceColIdx = i;
            console.log(`✓ SOURCE column found at index ${i}: "${headers[i]}"`);
            break;
        }
    }

    // Find target column  
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase();
        if (targetKeywords.some(kw => header.includes(kw))) {
            targetColIdx = i;
            console.log(`✓ TARGET column found at index ${i}: "${headers[i]}"`);
            break;
        }
    }

    // Find transformation column
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase();
        if (transformKeywords.some(kw => header.includes(kw))) {
            transformColIdx = i;
            console.log(`✓ TRANSFORMATION column found at index ${i}: "${headers[i]}"`);
            break;
        }
    }

    if (sourceColIdx === -1) console.error('❌ SOURCE column NOT found');
    if (targetColIdx === -1) console.error('❌ TARGET column NOT found');
    if (transformColIdx === -1) console.warn('⚠️  TRANSFORMATION column NOT found');

    // Show sample data from identified columns
    console.log('\n📊 SAMPLE DATA FROM IDENTIFIED COLUMNS:');
    for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        console.log(`\nRow ${i + 1}:`);
        if (sourceColIdx >= 0) {
            console.log(`  Source: "${row[headers[sourceColIdx]]}"`);
        }
        if (targetColIdx >= 0) {
            console.log(`  Target: "${row[headers[targetColIdx]]}"`);
        }
        if (transformColIdx >= 0) {
            const transformValue = row[headers[transformColIdx]];
            const hasTransformation = transformValue && String(transformValue).trim() !== '' && String(transformValue).trim() !== '-';
            console.log(`  Transform: "${transformValue}" ${hasTransformation ? '✓ HAS VALUE' : '✗ EMPTY/DASH'}`);
        }
    }

    // Analyze transformation column content
    if (transformColIdx >= 0) {
        console.log('\n🔬 TRANSFORMATION COLUMN ANALYSIS:');
        let emptyCount = 0;
        let dashCount = 0;
        let hasValueCount = 0;
        let sqlKeywordCount = 0;

        data.forEach(row => {
            const value = row[headers[transformColIdx]];
            const str = String(value || '').trim().toUpperCase();

            if (!str || str === '') {
                emptyCount++;
            } else if (str === '-' || str === '–') {
                dashCount++;
            } else {
                hasValueCount++;
                if (/CASE|WHEN|IF|CAST|CONCAT|ISNULL|UPPER|LOWER|TRIM/.test(str)) {
                    sqlKeywordCount++;
                }
            }
        });

        console.log(`  Empty: ${emptyCount}`);
        console.log(`  Dash (-): ${dashCount}`);
        console.log(`  Has Value: ${hasValueCount}`);
        console.log(`  Contains SQL Keywords: ${sqlKeywordCount}`);
    }

    console.log('\n====== END DIAGNOSTIC ======\n');

    return {
        headers,
        sourceColIdx,
        targetColIdx,
        transformColIdx,
        totalRows: data.length
    };
}

// Add to window for easy access in console
if (typeof window !== 'undefined') {
    (window as any).diagnosticParseMappingSheet = diagnosticParseMappingSheet;
}
