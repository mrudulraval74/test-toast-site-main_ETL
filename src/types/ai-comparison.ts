// Shared TypeScript interfaces for AI Comparison components

export interface TestCase {
    name: string;
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    category?: 'direct_move' | 'business_rule' | 'transformation' | 'general';
    severity?: 'critical' | 'major' | 'minor';
    metadata?: any;
    lastRunResult?: {
        status: 'pass' | 'fail' | 'running';
        message: string;
        timestamp: Date;
    };
}

export interface MappingAnalysis {
    sourceTables: string[];
    targetTables: string[];
    businessRules: string[];
    mappings?: any[];
    testCases: TestCase[];
}

export interface Connection {
    id: string;
    name: string;
    database: string;
    [key: string]: any;
}
