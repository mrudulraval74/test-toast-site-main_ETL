import * as XLSX from 'xlsx';
import { MappingAnalysis } from '@/types/ai-comparison';

/**
 * Download a string as a file
 */
export function downloadString(content: string, filename: string) {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

/**
 * Export test cases to CSV format
 */
export function exportToCSV(analysis: MappingAnalysis, filename: string = 'test_results.csv') {
    const exportData = analysis.testCases.map((tc, index) => ({
        ID: index + 1,
        Name: tc.name,
        Description: tc.description || '',
        Status: tc.lastRunResult?.status || 'Not executed',
        'Execution Message': tc.lastRunResult?.message || '',
        'Source SQL': tc.sourceSQL,
        'Target SQL': tc.targetSQL,
        'Executed At': tc.lastRunResult?.timestamp ? new Date(tc.lastRunResult.timestamp).toLocaleString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Test Results");
    XLSX.writeFile(wb, filename);
}

/**
 * Export test cases to Excel format
 */
export function exportToExcel(analysis: MappingAnalysis, filename: string = 'test_results.xlsx') {
    const exportData = analysis.testCases.map((tc, index) => ({
        ID: index + 1,
        Name: tc.name,
        Description: tc.description || '',
        Status: tc.lastRunResult?.status || 'Not executed',
        'Execution Message': tc.lastRunResult?.message || '',
        'Source SQL': tc.sourceSQL,
        'Target SQL': tc.targetSQL,
        'Executed At': tc.lastRunResult?.timestamp ? new Date(tc.lastRunResult.timestamp).toLocaleString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Test Results");
    XLSX.writeFile(wb, filename);
}
