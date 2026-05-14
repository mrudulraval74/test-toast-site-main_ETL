/**
 * ETL Test Knowledge Base
 * 
 * Comprehensive reference for business rules, test scenarios, and SQL patterns.
 * Read by the test generator before creating test cases to ensure accuracy.
 */

// ── Business Rule Definitions ──────────────────────────────────────────────

export interface BusinessRule {
    id: number;
    name: string;
    keywords: string[];
    description: string;
    sqlPatterns: string[];
}

export const BUSINESS_RULES: BusinessRule[] = [
    { id: 1, name: 'Direct Move', keywords: ['direct', 'same', 'as is', 'copy', '1:1', 'move', 'straight'], description: 'Data moves from source to target without change', sqlPatterns: ['{col}'] },
    { id: 2, name: 'Lookup Table', keywords: ['lookup', 'join', 'inner join', 'left join', 'right join', 'reference', 'common data'], description: 'Fetch common data between two tables using joins', sqlPatterns: ['SELECT * FROM {t1} T1 JOIN {t2} T2 ON (T1.{col} = T2.{col})', 'SELECT * FROM {t1} T1 LEFT JOIN {t2} T2 ON (T1.{col} = T2.{col})', 'SELECT * FROM {t1} T1 RIGHT JOIN {t2} T2 ON (T1.{col} = T2.{col})'] },
    { id: 3, name: 'Date Format Change', keywords: ['date format', 'format date', 'date conversion', 'dd-MM-yyyy', 'format('], description: 'Change the format of the date', sqlPatterns: ["FORMAT({col},'dd-MM-yyyy')"] },
    { id: 4, name: 'Remove Timestamp', keywords: ['remove timestamp', 'strip time', 'date only', 'convert(date', 'convert date'], description: 'Remove timestamp from the date', sqlPatterns: ['CONVERT(DATE,{col})'] },
    { id: 5, name: 'Trimming Data', keywords: ['trim', 'ltrim', 'rtrim', 'whitespace', 'space', 'extra space'], description: 'Remove extra spaces from left, right or both sides', sqlPatterns: ['LTRIM({col})', 'RTRIM({col})', 'LTRIM(RTRIM({col}))'] },
    { id: 6, name: 'Replace Null Value', keywords: ['isnull', 'null replace', 'coalesce', 'default value', 'null to', 'blank', 'replace null'], description: 'Replace NULL with 0, blank or default value', sqlPatterns: ["ISNULL({col},'0')", "ISNULL({col},' ')"] },
    { id: 7, name: 'Concatenation', keywords: ['concat', 'combine', 'merge columns', 'concatenat', 'merge more than one'], description: 'Combine more than one column', sqlPatterns: ['CONCAT({col1},{col2})'] },
    { id: 8, name: 'Current Date Time', keywords: ['getdate', 'current date', 'sysdate', 'now', 'runtime date'], description: 'Fetching runtime date and time', sqlPatterns: ['GETDATE()'] },
    { id: 9, name: 'Modified Date', keywords: ['dateadd', 'add date', 'add interval', 'modified date', 'time interval'], description: 'Add time/date interval to a date', sqlPatterns: ['DATEADD(DAY,2,{col})'] },
    { id: 10, name: 'Date Difference', keywords: ['datediff', 'date difference', 'duration', 'date diff', 'start date', 'end date'], description: 'Find difference between two dates', sqlPatterns: ['DATEDIFF(DAY,{col1},{col2})'] },
    { id: 11, name: 'Size of Data', keywords: ['datalength', 'data length', 'size of data', 'byte length', 'leading and trailing spaces'], description: 'Counts both leading and trailing spaces in calculation', sqlPatterns: ['DATALENGTH({col})'] },
    { id: 12, name: 'Left Extract', keywords: ['left', 'extract first', 'first characters', 'left extract', 'number_of_chars'], description: 'Extracts a number of characters from a string starting from left', sqlPatterns: ['LEFT({col},{n})'] },
    { id: 13, name: 'Case Sensitivity', keywords: ['lower', 'upper', 'case sensitive', 'lowercase', 'uppercase', 'convert upper', 'convert lower'], description: 'Convert to upper case or lower case', sqlPatterns: ['LOWER({col})', 'UPPER({col})'] },
    { id: 14, name: 'String Replace', keywords: ['replace', 'replace string', 'substitute', 'substring within'], description: 'Replaces all occurrences of a substring within a string', sqlPatterns: ["REPLACE({col},'{old}','{new}')"] },
    { id: 15, name: 'Stuffing', keywords: ['stuff', 'stuffing', 'insert string', 'delete part'], description: 'Deletes a part of a string and inserts another part', sqlPatterns: ['STUFF({col},{start},{length},\'{new}\')'] },
    { id: 16, name: 'Substring', keywords: ['substring', 'substr', 'extract value', 'mid string', 'some characters'], description: 'Extracts some characters from a string', sqlPatterns: ['SUBSTRING({col},{start},{length})'] },
    { id: 17, name: 'Average', keywords: ['avg', 'average', 'average value'], description: 'Find average value from the table', sqlPatterns: ['AVG({col})'] },
    { id: 18, name: 'Minimum', keywords: ['min', 'minimum', 'min value'], description: 'Find minimum value from the table', sqlPatterns: ['MIN({col})'] },
    { id: 19, name: 'Maximum', keywords: ['max', 'maximum', 'max value'], description: 'Find maximum value from the table', sqlPatterns: ['MAX({col})'] },
    { id: 20, name: 'Rounding', keywords: ['round', 'rounding', 'decimal places', 'decimal value'], description: 'Rounds a number to specified decimal places', sqlPatterns: ['ROUND({col},{decimals})'] },
    { id: 21, name: 'Casting', keywords: ['cast', 'convert type', 'data type cast', 'type conversion', 'casting'], description: 'Converts a value into a specified datatype', sqlPatterns: ['CAST({col} AS {type})'] },
    { id: 22, name: 'Coalesce', keywords: ['coalesce', 'first non null', 'not null value', 'list of values'], description: 'Returns the first non-null value in a list', sqlPatterns: ['COALESCE({col1},{col2})'] },
    { id: 23, name: 'Date Name', keywords: ['datename', 'month name', 'day name', 'name of the month'], description: 'Return name of month or day', sqlPatterns: ['DATENAME(MM,{col})'] },
    { id: 24, name: 'Date Part', keywords: ['month', 'year', 'day', 'datepart', 'find month'], description: 'Extract month, year, or day from date', sqlPatterns: ['MONTH({col})', 'YEAR({col})', 'DAY({col})'] },
    { id: 25, name: 'Date From Parts', keywords: ['datefromparts', 'combine date', 'build date', 'combine date from different parts'], description: 'Combine year, month, day into a date format', sqlPatterns: ['DATEFROMPARTS({year},{month},{day})'] },
];

// ── Test Scenarios ─────────────────────────────────────────────────────────

export interface TestScenario {
    id: string;
    name: string;
    keywords: string[];
    testCases: TestCaseTemplate[];
}

export interface TestCaseTemplate {
    id: string;
    name: string;
    description: string;
    category: 'structure' | 'general' | 'direct_move' | 'business_rule' | 'transformation';
    severity: 'critical' | 'major' | 'minor';
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
}

export const TEST_SCENARIOS: TestScenario[] = [
    {
        id: 'TS_001', name: 'Validate Database Structure',
        keywords: ['structure', 'schema', 'column', 'data type', 'length', 'mapping doc', 'database structure'],
        testCases: [
            { id: 'TC_001', name: 'Validate Structure of Source and Target Table', description: 'Validate the structure of source and target table', category: 'structure', severity: 'critical', sourceSQL: "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{sourceTable}' ORDER BY ORDINAL_POSITION", targetSQL: "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{targetTable}' ORDER BY ORDINAL_POSITION", expectedResult: 'Table structure should be identical or as specified.' },
            { id: 'TC_002', name: 'Validate Data Types', description: 'Validate the data type of source and target table', category: 'structure', severity: 'critical', sourceSQL: "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{sourceTable}'", targetSQL: "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{targetTable}'", expectedResult: 'Data types should match mapping document.' },
            { id: 'TC_003', name: 'Validate Data Type Lengths', description: 'Validate the length of data types. Target should not be greater than source.', category: 'structure', severity: 'major', sourceSQL: "SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{sourceTable}'", targetSQL: "SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{targetTable}'", expectedResult: 'Target data length should not be greater than source unless specified.' },
            { id: 'TC_004', name: 'Verify Field Formats', description: 'Verify the data field type and formats are specified', category: 'structure', severity: 'major', sourceSQL: "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{sourceTable}'", targetSQL: "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{targetTable}'", expectedResult: 'Field types and formats should match requirement.' },
            { id: 'TC_005', name: 'Validate Column Names', description: 'Validate the name of columns in the table against mapping doc.', category: 'structure', severity: 'critical', sourceSQL: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{sourceTable}'", targetSQL: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{targetTable}'", expectedResult: 'Column names should exist as per mapping.' },
        ]
    },
    {
        id: 'TS_003', name: 'Validate Constraints',
        keywords: ['constraint', 'not null', 'check constraint', 'informational', 'primary key', 'foreign key'],
        testCases: [
            { id: 'TC_008', name: 'Validate Not Null Constraint', description: 'Validate Not null constraint', category: 'structure', severity: 'critical', sourceSQL: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{sourceTable}' AND IS_NULLABLE = 'NO'", targetSQL: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{targetTable}' AND IS_NULLABLE = 'NO'", expectedResult: 'NOT NULL constraints should be correctly applied.' },
            { id: 'TC_009', name: 'Validate Check Constraint', description: 'Validate Check constraint', category: 'structure', severity: 'major', sourceSQL: "SELECT * FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS", targetSQL: "SELECT * FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS", expectedResult: 'Check constraints should match requirement.' },
            { id: 'TC_011', name: 'Validate Primary Key Constraint', description: 'Validate Primary key constraint', category: 'structure', severity: 'critical', sourceSQL: "SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '{sourceTable}'", targetSQL: "SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '{targetTable}'", expectedResult: 'Primary keys should be identical.' },
            { id: 'TC_012', name: 'Validate Foreign Key Constraint', description: 'Validate Foreign key constraint', category: 'structure', severity: 'critical', sourceSQL: "SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS", targetSQL: "SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS", expectedResult: 'Foreign keys should match source.' },
        ]
    },
    {
        id: 'TS_004', name: 'Validate Data Consistency',
        keywords: ['consistency', 'domain integrity', 'entity integrity', 'referential integrity', 'key constraints'],
        testCases: [
            { id: 'TC_013', name: 'Validate Domain Data Integrity', description: 'Validate Domain data integrity', category: 'general', severity: 'major', sourceSQL: "SELECT DISTINCT {col} FROM {sourceTable}", targetSQL: "SELECT DISTINCT {col} FROM {targetTable}", expectedResult: 'Domain values should be consistent.' },
            { id: 'TC_015', name: 'Validate Referential Integrity', description: 'Validate Referential Integrity Constraints', category: 'general', severity: 'critical', sourceSQL: "SELECT DISTINCT {col} FROM {sourceTable}", targetSQL: "SELECT {col} FROM {targetTable} WHERE {col} NOT IN (SELECT {col} FROM {sourceTable})", expectedResult: 'Referential integrity should be maintained.' },
        ]
    },
    {
        id: 'TS_005', name: 'Validate Data Completeness',
        keywords: ['completeness', 'count', 'unique values', 'max', 'min', 'avg', 'null values', 'distribution'],
        testCases: [
            { id: 'TC_017', name: 'Validate Row Count', description: 'Validate Count between source table to target table', category: 'general', severity: 'critical', sourceSQL: "SELECT COUNT(*) AS RowCount FROM {sourceTable}", targetSQL: "SELECT COUNT(*) AS RowCount FROM {targetTable}", expectedResult: 'Counts must match.' },
            { id: 'TC_018', name: 'Validate Unique Values', description: 'Validate unique values in a column between source and target.', category: 'general', severity: 'major', sourceSQL: "SELECT COUNT(DISTINCT {col}) FROM {sourceTable}", targetSQL: "SELECT COUNT(DISTINCT {col}) FROM {targetTable}", expectedResult: 'Unique counts should match.' },
            { id: 'TC_019', name: 'Validate Stats', description: 'Validate max, min, avg values for columns.', category: 'general', severity: 'major', sourceSQL: "SELECT MAX({col}), MIN({col}), AVG(CAST({col} AS FLOAT)) FROM {sourceTable}", targetSQL: "SELECT MAX({col}), MIN({col}), AVG(CAST({col} AS FLOAT)) FROM {targetTable}", expectedResult: 'Stats should match.' },
            { id: 'TC_020', name: 'Validate Null Values', description: 'Validate null values in a column between source and target.', category: 'general', severity: 'major', sourceSQL: "SELECT COUNT(*) FROM {sourceTable} WHERE {col} IS NULL", targetSQL: "SELECT COUNT(*) FROM {targetTable} WHERE {col} IS NULL", expectedResult: 'Null counts should match.' },
        ]
    },
    {
        id: 'TS_006', name: 'Validate Data Correctness',
        keywords: ['correctness', 'target value', 'misspelled', 'inaccurate', 'integrity disabled'],
        testCases: [
            { id: 'TC_022', name: 'Validate Target Values', description: 'Validating the value of the data in the target system', category: 'direct_move', severity: 'critical', sourceSQL: "SELECT {key}, {col} FROM {sourceTable}", targetSQL: "SELECT {key}, {col} FROM {targetTable}", expectedResult: 'Values should match.' },
        ]
    },
    {
        id: 'TS_007', name: 'Validate Data Transformation',
        keywords: ['transformation', 'business rules', 'parent-child', 'range', 'warehouse', 'data model'],
        testCases: [
            { id: 'TC_025', name: 'Validate Business Rules', description: 'Validating Business rules and transformation of the columns', category: 'business_rule', severity: 'critical', sourceSQL: "SELECT {key}, {transformExpr} FROM {sourceTable}", targetSQL: "SELECT {key}, {col} FROM {targetTable}", expectedResult: 'Transformation logic should be correct.' },
        ]
    },
    {
        id: 'TS_010', name: 'Date Validation',
        keywords: ['date validation', 'from date', 'to date', 'date format', 'junk values'],
        testCases: [
            { id: 'TC_034', name: 'Validate From and To Date', description: 'Validate From_Date and TO_Date(From_Date should not greater than To_Date)', category: 'general', severity: 'critical', sourceSQL: "SELECT COUNT(*) FROM {sourceTable} WHERE FromDate > ToDate", targetSQL: "SELECT COUNT(*) FROM {targetTable} WHERE FromDate > ToDate", expectedResult: 'From date <= To date.' },
            { id: 'TC_035', name: 'Validate Format of Date', description: 'Validate Format of date', category: 'general', severity: 'major', sourceSQL: "SELECT {col} FROM {sourceTable}", targetSQL: "SELECT {col} FROM {targetTable}", expectedResult: 'Date format should be consistent.' },
        ]
    },
    {
        id: 'TS_011', name: 'Full Dataset Validation',
        keywords: ['full dataset', 'minus query', 'source to target', 'target to source'],
        testCases: [
            { id: 'TC_037', name: 'Source to Target Minus', description: 'Validating source to target by minus query', category: 'general', severity: 'critical', sourceSQL: "SELECT {cols} FROM {sourceTable} EXCEPT SELECT {cols} FROM {targetTable}", targetSQL: "SELECT 0", expectedResult: 'No orphans in source.' },
            { id: 'TC_038', name: 'Target to Source Minus', description: 'Validating target to source by minus query', category: 'general', severity: 'critical', sourceSQL: "SELECT 0", targetSQL: "SELECT {cols} FROM {targetTable} EXCEPT SELECT {cols} FROM {sourceTable}", expectedResult: 'No orphans in target.' },
        ]
    },
];

// ── Layer Validation Rules ─────────────────────────────────────────────────

export interface LayerRule {
    layer: 'extraction' | 'transformation' | 'load';
    keywords: string[];
    checks: string[];
}

export const LAYER_RULES: LayerRule[] = [
    {
        layer: 'extraction',
        keywords: ['extraction', 'extract', 'reconcile', 'spam', 'unwanted', 'data type check', 'keys in place'],
        checks: [
            'Reconcile records with the source data',
            'Make sure that no spam/unwanted data loaded',
            'Data type check',
            'Remove all types of duplicate/fragmented data',
            'Check whether all the keys are in place or not'
        ]
    },
    {
        layer: 'transformation',
        keywords: ['transformation', 'transform', 'filtering', 'lookup table', 'data standardization', 'character set', 'encoding', 'unit conversion', 'date time conversion', 'currency conversion', 'threshold', 'staging', 'intermediate', 'required fields', 'blank', 'cleaning', 'split', 'merge', 'transpose', 'complex validation'],
        checks: [
            'Filtering – Select only certain columns to load',
            'Using rules and lookup tables for Data standardization',
            'Character Set Conversion and encoding handling',
            'Conversion of Units of Measurements (Date Time, currency, numerical)',
            'Data threshold validation check (e.g. age < 100)',
            'Data flow validation from staging to intermediate tables',
            'Required fields should not be left blank',
            'Cleaning (NULL to 0, Gender Male to M, etc.)',
            'Split a column into multiples and merging multiple columns',
            'Transposing rows and columns',
            'Use lookups to merge data',
            'Using complex data validation'
        ]
    },
    {
        layer: 'load',
        keywords: ['load', 'key field', 'modeling views', 'combined values', 'calculated measures', 'dimension table', 'history table', 'bi reports', 'fact table'],
        checks: [
            'Ensure that the key field data is neither missing nor null',
            'Test modeling views based on the target tables',
            'Check combined values and calculated measures',
            'Data checks in dimension table as well as history table',
            'Check the BI reports on the loaded fact and dimension table'
        ]
    }
];

// ── Testing Type Definitions ───────────────────────────────────────────────

export interface TestingType {
    name: string;
    keywords: string[];
    subTypes: string[];
}

export const TESTING_TYPES: TestingType[] = [
    { name: 'Data Quality Testing', keywords: ['quality', 'duplicate', 'validation rules', 'integrity'], subTypes: ['Duplicate Data Checks', 'Data Validation Rules', 'Data Integrity Checks'] },
    { name: 'Data Transformation Testing', keywords: ['transformation', 'white box', 'black box', 'transform'], subTypes: ['White Box approach', 'Black Box approach'] },
    { name: 'ETL Regression Testing', keywords: ['regression', 'metadata change', 'automated', 'baseline'], subTypes: ['Changes to metadata', 'Automated ETL Testing', 'Regression testing by baselining target data'] },
    { name: 'Reference Data Testing', keywords: ['reference', 'domain values', 'reference data', 'standards'], subTypes: ['Verify data conforms to reference standards', 'Compare domain values across environments', 'Track reference data changes'] },
    { name: 'Incremental ETL Testing', keywords: ['incremental', 'delta', 'scd', 'slowly changing', 'denormalization'], subTypes: ['Duplicate Data Checks', 'Compare Data Values', 'Data Denormalization Check', 'Slowly Changing Dimension Checks'] },
    { name: 'ETL Integration Testing', keywords: ['integration', 'end to end', 'e2e'], subTypes: ['End to End Data Testing'] },
    { name: 'ETL Performance Testing', keywords: ['performance', 'speed', 'load time', 'throughput'], subTypes: ['End to End Data Testing'] },
];

// ── Matching Functions ─────────────────────────────────────────────────────

/**
 * Match a prompt + mapping data against the knowledge base to find applicable test scenarios.
 */
export function matchTestScenarios(prompt: string, mappingData?: any[]): TestScenario[] {
    if (!prompt || !prompt.trim()) return [];
    const lower = prompt.toLowerCase();
    return TEST_SCENARIOS.filter(ts =>
        ts.keywords.some(kw => lower.includes(kw.toLowerCase()))
    );
}

/**
 * Detect which business rules are present in a transformation logic string.
 */
export function detectBusinessRules(transformationLogic: string): BusinessRule[] {
    if (!transformationLogic) return [];
    const lower = transformationLogic.toLowerCase();
    return BUSINESS_RULES.filter(rule =>
        rule.keywords.some(kw => lower.includes(kw.toLowerCase()))
    );
}

/**
 * Detect applicable ETL layers from prompt.
 */
export function detectLayers(prompt: string): LayerRule[] {
    if (!prompt) return [];
    const lower = prompt.toLowerCase();
    return LAYER_RULES.filter(lr =>
        lr.keywords.some(kw => lower.includes(kw.toLowerCase()))
    );
}

/**
 * Detect applicable testing types from prompt.
 */
export function detectTestingTypes(prompt: string): TestingType[] {
    if (!prompt) return [];
    const lower = prompt.toLowerCase();
    return TESTING_TYPES.filter(tt =>
        tt.keywords.some(kw => lower.includes(kw.toLowerCase()))
    );
}
