import React from 'react';
import { Save, Download, FileSpreadsheet, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TestCase {
    name: string;
    category?: 'direct_move' | 'business_rule' | 'transformation' | 'general' | 'structure';
    description: string;
    sourceSQL: string;
    targetSQL: string;
    expectedResult: string;
    severity?: 'critical' | 'major' | 'minor';
    metadata?: any;
    lastRunResult?: {
        status: 'pass' | 'fail' | 'running';
        message: string;
        timestamp: Date;
    };
}

interface MappingAnalysis {
    sourceTables: string[];
    targetTables: string[];
    businessRules: string[];
    testCases: TestCase[];
    mappings?: any[];
}

interface SaveResultsStepProps {
    analysis: MappingAnalysis | null;
    uploadedFile: { name: string; data: any[] } | null;
    selectedTestIndices?: number[]; // Indices of selected test cases to save
    onSaveResults?: () => void;
    onExportResults?: (format: 'sql' | 'csv' | 'excel') => void;
}

export function SaveResultsStep({
    analysis,
    uploadedFile,
    selectedTestIndices = [],
    onSaveResults,
    onExportResults
}: SaveResultsStepProps) {
    // Filter to only selected test cases if indices provided
    const allTestCases = analysis?.testCases || [];
    const testCases = selectedTestIndices.length > 0
        ? allTestCases.filter((_: any, index: number) => selectedTestIndices.includes(index))
        : allTestCases;

    const stats = {
        total: testCases.length,
        passed: testCases.filter(tc => tc.lastRunResult?.status === 'pass').length,
        failed: testCases.filter(tc => tc.lastRunResult?.status === 'fail').length,
        running: testCases.filter(tc => tc.lastRunResult?.status === 'running').length,
        get pending() { return this.total - (this.passed + this.failed + this.running) },
        get executed() { return this.passed + this.failed },
        get passRate() { return this.executed > 0 ? Math.round((this.passed / this.executed) * 100) : 0 }
    };

    const hasExecutedTests = stats.executed > 0;

    if (!analysis || !uploadedFile) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-muted/10 rounded-xl border border-dashed">
                <div className="p-4 bg-muted/20 rounded-full mb-4">
                    <Save className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No Results to Save</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                    Please complete the previous steps to generate test results.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold sm:text-2xl">Save Results</h2>
                <p className="text-sm text-muted-foreground">
                    Review your test results and save to history
                </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Test Suite</span>
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div className="truncate text-2xl font-bold" title={uploadedFile.name}>{uploadedFile.name}</div>
                        <p className="text-xs text-muted-foreground mt-1">{testCases.length} test cases</p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-emerald-50/70">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700">Success Rate</span>
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="text-2xl font-bold text-green-700">{stats.passRate}%</div>
                        <Progress value={stats.passRate} className="h-2 mt-2" />
                    </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/70">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">Execution Status</span>
                            <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-2xl font-bold text-blue-700">
                            {stats.executed} / {stats.total}
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                            {stats.pending} pending
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Results Breakdown */}
            <Card className="border-border/80 shadow-sm">
                <CardHeader>
                    <CardTitle>Results Breakdown</CardTitle>
                    <CardDescription>
                        Detailed overview of test execution results
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="rounded-lg bg-muted/30 p-4 text-center">
                            <div className="text-3xl font-bold">{stats.total}</div>
                            <div className="text-xs text-muted-foreground mt-1 uppercase">Total Tests</div>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <div className="text-3xl font-bold text-green-700">{stats.passed}</div>
                            </div>
                            <div className="text-xs text-green-700 uppercase font-medium">Passed</div>
                        </div>
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <div className="text-3xl font-bold text-red-700">{stats.failed}</div>
                            </div>
                            <div className="text-xs text-red-700 uppercase font-medium">Failed</div>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <Clock className="h-4 w-4 text-blue-600" />
                                <div className="text-3xl font-bold text-blue-700">{stats.pending}</div>
                            </div>
                            <div className="text-xs text-blue-700 uppercase font-medium">Pending</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Warnings and Tips */}
            {!hasExecutedTests && (
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-amber-800">
                        <strong>Tip:</strong> You haven't executed any tests yet. Go back to the Test Comparison step to run tests before saving.
                    </AlertDescription>
                </Alert>
            )}

            {stats.failed > 0 && (
                <Alert variant="destructive">
                    <AlertDescription>
                        <strong>Warning:</strong> {stats.failed} test(s) failed. Review the failures in the Test Comparison step before saving.
                    </AlertDescription>
                </Alert>
            )}

            {stats.passed === stats.total && stats.total > 0 && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                        <strong>Excellent!</strong> All tests passed successfully. Your data migration looks good!
                    </AlertDescription>
                </Alert>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Save className="h-5 w-5 text-primary" />
                            Save to History
                        </CardTitle>
                        <CardDescription>
                            Persist test results for future reference and tracking
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={onSaveResults} className="h-10 w-full gap-2 shadow-sm">
                            <Save className="h-4 w-4" />
                            Save Test Run
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Results will be saved in the Test History sidebar
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border bg-muted/10">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Export Results
                        </CardTitle>
                        <CardDescription>
                            Download test results in various formats
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {onExportResults && (
                            <>
                                <Button variant="outline" className="h-9 w-full gap-2" onClick={() => onExportResults('sql')}>
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Export as SQL Script
                                </Button>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onExportResults('csv')}
                                    >
                                        CSV
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onExportResults('excel')}
                                    >
                                        Excel
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Test Categories Breakdown */}
            {hasExecutedTests && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Test Categories</CardTitle>
                        <CardDescription>Results organized by category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {['structure', 'direct_move', 'business_rule', 'transformation', 'general'].map(category => {
                                const categoryTests = testCases.filter(tc => (tc.category || 'general') === category);
                                const categoryPassed = categoryTests.filter(tc => tc.lastRunResult?.status === 'pass').length;
                                const categoryFailed = categoryTests.filter(tc => tc.lastRunResult?.status === 'fail').length;
                                const categoryExecuted = categoryPassed + categoryFailed;

                                if (categoryTests.length === 0) return null;

                                const categoryNames: any = {
                                    structure: 'Structure & Schema',
                                    direct_move: 'Direct Move',
                                    business_rule: 'Business Rule',
                                    transformation: 'Transformation',
                                    general: 'General'
                                };

                                const passRate = categoryExecuted > 0 ? Math.round((categoryPassed / categoryExecuted) * 100) : 0;

                                return (
                                    <div key={category} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className="min-w-[120px]">
                                                {categoryNames[category]}
                                            </Badge>
                                            <div className="flex-1">
                                                <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden flex">
                                                    {categoryPassed > 0 && (
                                                        <div
                                                            className="h-full bg-green-500"
                                                            style={{ width: `${(categoryPassed / categoryTests.length) * 100}%` }}
                                                        />
                                                    )}
                                                    {categoryFailed > 0 && (
                                                        <div
                                                            className="h-full bg-red-500"
                                                            style={{ width: `${(categoryFailed / categoryTests.length) * 100}%` }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-green-600 font-medium">{categoryPassed} passed</span>
                                            <span className="text-red-600 font-medium">{categoryFailed} failed</span>
                                            <span className="text-muted-foreground">{categoryTests.length} total</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
