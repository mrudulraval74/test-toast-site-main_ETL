import React, { useEffect, useMemo, useState } from 'react';
import {
    Download, Code, Database, FileCode, Copy, Play, Plus, Edit, Trash2,
    CheckCircle, XCircle, Search, Settings, Sparkles, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        details?: {
            sourceCount: number;
            targetCount: number;
            sourceData?: any[];
            targetData?: any[];
            comparisonData?: any[];
            compareColumns?: string[];
            comparisonType: string;
            executionTime?: number;
            mismatchData?: any[];
        };
    };
}

interface MappingAnalysis {
    sourceTables: string[];
    targetTables: string[];
    businessRules: string[];
    testCases: TestCase[];
    mappings?: any[];
}

interface TestComparisonStepProps {
    analysis: MappingAnalysis | null;
    uploadedFile: { name: string; data: any[] } | null;
    onExportResults?: (format: 'sql' | 'csv' | 'excel') => void;
    onCopy?: () => void;
    onQueryCreate: (testCase: TestCase) => void;
    onAddTestCase?: (testCase: TestCase) => void;
    onUpdateTestCase?: (index: number, testCase: TestCase) => void;
    onDeleteTestCase?: (index: number) => void;
    onDeleteSelected?: (indices: number[]) => void;
    onRunTest?: (testCase: TestCase) => void;
    onRunAll?: (orderedIndices?: number[]) => void;
    onQueueTestDuringRun?: (index: number) => void;
    onQueueTestsDuringRun?: (indices: number[]) => void;
    onUnqueueTestsDuringRun?: (indices: number[]) => void;
    isRunningAll?: boolean;
    currentExecutingTestName?: string | null;
    onStopExecution?: () => void;
    onSaveSelected?: (selectedIndices: number[]) => void; // New callback for saving selected tests
    onRegenerate?: () => void;
    onGenerateTests?: () => void; // New: Generate test cases from validated columns
}

export function TestComparisonStep({
    analysis,
    uploadedFile,
    onExportResults,
    onCopy,
    onQueryCreate,
    onAddTestCase,
    onUpdateTestCase,
    onDeleteTestCase,
    onDeleteSelected,
    onRunTest,
    onRunAll,
    onQueueTestDuringRun,
    onQueueTestsDuringRun,
    onUnqueueTestsDuringRun,
    isRunningAll = false,
    currentExecutingTestName = null,
    onStopExecution,
    onSaveSelected,
    onRegenerate,
    onGenerateTests
}: TestComparisonStepProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [selectedTests, setSelectedTests] = useState<number[]>([]); // For bulk delete
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [expandedTests, setExpandedTests] = useState<number[]>([]);
    const [editForm, setEditForm] = useState<TestCase>({
        name: '',
        category: 'general',
        description: '',
        sourceSQL: '',
        targetSQL: '',
        expectedResult: '',
        severity: 'minor'
    });

    const resetForm = () => {
        setEditForm({
            name: '',
            category: 'general',
            description: '',
            sourceSQL: '',
            targetSQL: '',
            expectedResult: '',
            severity: 'minor'
        });
        setEditingIndex(null);
    };

    const handleEditClick = (index: number, testCase: TestCase) => {
        setEditingIndex(index);
        setEditForm({ ...testCase });
        setIsAddDialogOpen(true);
    };

    const handleSave = () => {
        if (editingIndex !== null && onUpdateTestCase) {
            onUpdateTestCase(editingIndex, editForm);
        } else if (onAddTestCase) {
            onAddTestCase(editForm);
        }
        setIsAddDialogOpen(false);
        resetForm();
    };

    const getCategoryLabel = (category?: string) => {
        const labels = {
            direct_move: 'Direct Move',
            business_rule: 'Business Rule',
            transformation: 'Transformation',
            structure: 'Structure',
            general: 'General'
        };
        return labels[category as keyof typeof labels] || labels.general;
    };

    const getSeverityLabel = (severity?: string) => {
        if (severity === 'critical') return 'Critical';
        if (severity === 'major') return 'Major';
        if (severity === 'minor') return 'Minor';
        return 'Minor';
    };

    const testCases = analysis?.testCases || [];

    const stats = {
        total: testCases.length,
        passed: testCases.filter(tc => tc.lastRunResult?.status === 'pass').length,
        failed: testCases.filter(tc => tc.lastRunResult?.status === 'fail').length,
        running: testCases.filter(tc => tc.lastRunResult?.status === 'running').length,
        get pending() { return this.total - (this.passed + this.failed + this.running) }
    };

    const filteredTestCases = useMemo(
        () => testCases
            .map((tc, index) => ({ tc, index }))
            .filter(({ tc }) =>
                (tc.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tc.description || '').toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [testCases, searchTerm]
    );

    const totalPages = Math.max(1, Math.ceil(filteredTestCases.length / itemsPerPage));
    const filteredIndices = useMemo(
        () => filteredTestCases.map(({ index }) => index),
        [filteredTestCases]
    );
    const selectedFilteredCount = useMemo(
        () => filteredIndices.filter((idx) => selectedTests.includes(idx)).length,
        [filteredIndices, selectedTests]
    );
    const allFilteredSelected = filteredIndices.length > 0 && selectedFilteredCount === filteredIndices.length;

    const paginatedTestCases = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredTestCases.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTestCases, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, testCases.length]);

    useEffect(() => {
        setSelectedTests([]);
        setExpandedTests([]);
    }, [analysis]);

    useEffect(() => {
        if (!currentExecutingTestName) return;

        const filteredIndex = filteredTestCases.findIndex(({ tc }) => tc.name === currentExecutingTestName);
        if (filteredIndex === -1) return;

        const targetPage = Math.floor(filteredIndex / itemsPerPage) + 1;
        if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
        }

        const realIndex = filteredTestCases[filteredIndex]?.index;
        if (typeof realIndex === 'number') {
            setExpandedTests((prev) => (prev.includes(realIndex) ? prev : [...prev, realIndex]));
            window.setTimeout(() => {
                const el = document.getElementById(`test-case-card-${realIndex}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        }
    }, [currentExecutingTestName, filteredTestCases, itemsPerPage, currentPage]);

    const toggleExpanded = (index: number) => {
        setExpandedTests((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        );
    };

    const flattenRow = (input: any, prefix = '', out: Record<string, any> = {}): Record<string, any> => {
        if (input === null || input === undefined) return out;
        if (typeof input !== 'object' || Array.isArray(input)) {
            out[prefix || 'value'] = input;
            return out;
        }

        Object.entries(input).forEach(([key, val]) => {
            const nextKey = prefix ? `${prefix}.${key}` : key;
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                flattenRow(val, nextKey, out);
            } else {
                out[nextKey] = val;
            }
        });
        return out;
    };

    const toCsvCell = (val: any) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const downloadComparisonCsv = (tc: TestCase) => {
        const details = tc.lastRunResult?.details;
        if (!details) return;

        const sourceRows = Array.isArray(details.sourceData) ? details.sourceData : [];
        const targetRows = Array.isArray(details.targetData) ? details.targetData : [];
        const comparisonRows = Array.isArray(details.comparisonData) ? details.comparisonData : [];
        const mismatchRows = Array.isArray(details.mismatchData) ? details.mismatchData : [];

        const derivedRows = comparisonRows.length > 0
            ? comparisonRows.map((row: any, idx: number) => ({
                rowIndex: idx + 1,
                compareStatus: row?.status || 'unknown',
                compareKeyHash: row?.compareKeyHash || '',
                sourceRow: row?.sourceRow,
                targetRow: row?.targetRow
            }))
            : Array.from({ length: Math.max(sourceRows.length, targetRows.length) }, (_, idx) => ({
                rowIndex: idx + 1,
                compareStatus: sourceRows[idx] && targetRows[idx]
                    ? (JSON.stringify(sourceRows[idx]) === JSON.stringify(targetRows[idx]) ? 'matched' : 'different')
                    : (sourceRows[idx] ? 'sourceOnly' : 'targetOnly'),
                compareKeyHash: '',
                sourceRow: sourceRows[idx],
                targetRow: targetRows[idx]
            }));

        const mismatchByRowIndex = new Map<number, any>();
        mismatchRows.forEach((row: any) => {
            const idx = Number(row?.rowIndex || row?.row_index || 0);
            if (idx > 0) mismatchByRowIndex.set(idx, row);
        });

        const exportRows = derivedRows.map((r: any) => {
            const mismatch = mismatchByRowIndex.get(r.rowIndex);
            return {
                rowIndex: r.rowIndex,
                compareStatus: r.compareStatus,
                compareKeyHash: r.compareKeyHash,
                sourceQuery: tc.sourceSQL,
                targetQuery: tc.targetSQL,
                mismatchType: mismatch?.mismatchType || '',
                mismatchColumns: mismatch?.mismatchColumns || mismatch?.column || '',
                sourceRow: r.sourceRow,
                targetRow: r.targetRow
            };
        });

        const flattened = exportRows.map((row: any) => {
            const base: Record<string, any> = {
                rowIndex: row.rowIndex,
                compareStatus: row.compareStatus,
                compareKeyHash: row.compareKeyHash,
                sourceQuery: row.sourceQuery,
                targetQuery: row.targetQuery,
                mismatchType: row.mismatchType,
                mismatchColumns: toCsvCell(row.mismatchColumns)
            };
            const srcFlat = flattenRow(row.sourceRow, 'source');
            const tgtFlat = flattenRow(row.targetRow, 'target');
            return { ...base, ...srcFlat, ...tgtFlat };
        });

        const allKeys = new Set<string>();
        flattened.forEach((row) => Object.keys(row).forEach((key) => allKeys.add(key)));
        const headers = Array.from(allKeys);

        const csvRows = [
            headers.join(','),
            ...flattened.map((row) =>
                headers
                    .map((header) => `"${toCsvCell(row[header]).replace(/"/g, '""')}"`)
                    .join(',')
            )
        ].join('\n');

        const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${tc.name.replace(/[^a-z0-9]/gi, '_')}_Comparison_Full.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // If we have no test cases at all, show the empty state with generate button
    const hasData = (analysis || uploadedFile) && testCases.length > 0;
    const canGenerate = (analysis || uploadedFile) && onGenerateTests && testCases.length === 0;

    if (!hasData) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-muted/10 rounded-xl border border-dashed">
                <div className="p-4 bg-muted/20 rounded-full mb-4">
                    <Database className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No Test Cases Available</h3>
                <p className="text-muted-foreground max-w-sm mt-2 mb-4">
                    {canGenerate
                        ? "Generate test cases from your validated column mappings."
                        : "Please complete the previous steps to generate test cases."}
                </p>
                {canGenerate && (
                    <Button onClick={onGenerateTests} className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate Test Cases
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold sm:text-xl">Test Comparison</h2>
                <p className="text-sm text-muted-foreground">
                    Run and manage test cases for data comparison
                </p>
            </div>

            {/* Execution Dashboard */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="border-border/80 bg-card shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center p-3 text-center">
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                            <Database className="h-3 w-3" /> Total Tests
                        </span>
                        <span className="mt-1 text-xl font-semibold">{stats.total}</span>
                    </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center p-3 text-center">
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-green-700">
                            <CheckCircle className="h-3 w-3" /> Passed
                        </span>
                        <span className="mt-1 text-xl font-semibold text-green-700">{stats.passed}</span>
                    </CardContent>
                </Card>
                <Card className="border-rose-200 bg-rose-50/60 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center p-3 text-center">
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-red-700">
                            <XCircle className="h-3 w-3" /> Failed
                        </span>
                        <span className="mt-1 text-xl font-semibold text-red-700">{stats.failed}</span>
                    </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center p-3 text-center">
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-blue-700">
                            <Settings className="h-3 w-3" /> Pending
                        </span>
                        <span className="mt-1 text-xl font-semibold text-blue-700">{stats.pending}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Header Actions */}
            <div className="rounded-lg border bg-card p-3.5 shadow-sm">
                <div className="mb-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Code className="h-4 w-4 text-primary" />
                        Test Case Manager
                    </h3>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                        {testCases.length} generated test cases for {uploadedFile?.name || 'Unknown File'}
                        {selectedTests.length > 0 && <span className="text-primary font-semibold"> | {selectedTests.length} selected</span>}
                    </p>
                    {isRunningAll && (
                        <p className="mt-1 text-xs font-medium text-blue-700">
                            Currently executing: {currentExecutingTestName || 'Preparing...'}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search test cases..."
                            className="h-9 pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                    <Button
                        variant="outline"
                        className="h-9 gap-2"
                        disabled={filteredIndices.length === 0}
                        onClick={() => {
                            if (allFilteredSelected) {
                                const filteredSet = new Set(filteredIndices);
                                if (isRunningAll && onUnqueueTestsDuringRun) {
                                    const toUnqueue = selectedTests.filter((idx) => filteredSet.has(idx));
                                    if (toUnqueue.length > 0) onUnqueueTestsDuringRun(toUnqueue);
                                }
                                setSelectedTests((prev) => prev.filter((idx) => !filteredSet.has(idx)));
                                return;
                            }
                            if (isRunningAll && onQueueTestsDuringRun) {
                                const selectedSet = new Set(selectedTests);
                                const toQueue = filteredIndices.filter((idx) => !selectedSet.has(idx));
                                if (toQueue.length > 0) onQueueTestsDuringRun(toQueue);
                            }
                            setSelectedTests((prev) => Array.from(new Set([...prev, ...filteredIndices])));
                        }}
                    >
                        <CheckCircle className="h-4 w-4" />
                        {allFilteredSelected ? 'Unselect All' : 'Select All'}
                    </Button>
                    {!isRunningAll && selectedTests.length > 0 && (
                        <Button
                            variant="ghost"
                            className="h-9 px-2 text-xs"
                            onClick={() => {
                                if (isRunningAll && onUnqueueTestsDuringRun && selectedTests.length > 0) {
                                    onUnqueueTestsDuringRun(selectedTests);
                                }
                                setSelectedTests([]);
                            }}
                        >
                            Clear Selection
                        </Button>
                    )}
                    {!isRunningAll && selectedTests.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                                    <Settings className="h-4 w-4" />
                                    Bulk Actions ({selectedTests.length})
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {onRunAll && (
                                    <DropdownMenuItem onClick={() => {
                                        const selectedSet = new Set(selectedTests);
                                        const orderedSelectedIndices = filteredTestCases
                                            .map(({ index }) => index)
                                            .filter((idx) => selectedSet.has(idx));
                                        onRunAll(orderedSelectedIndices);
                                    }}>
                                        <Play className="mr-2 h-4 w-4" />
                                        Run Selected
                                    </DropdownMenuItem>
                                )}
                                {onSaveSelected && (
                                    <DropdownMenuItem onClick={() => onSaveSelected(selectedTests)}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Save Selected
                                    </DropdownMenuItem>
                                )}
                                {(onDeleteSelected || onDeleteTestCase) && (
                                    <DropdownMenuItem
                                        className="text-red-600 focus:text-red-700"
                                        onClick={() => {
                                            if (onDeleteSelected) {
                                                onDeleteSelected(selectedTests);
                                            } else if (onDeleteTestCase) {
                                                [...selectedTests].sort((a, b) => b - a).forEach(idx => {
                                                    onDeleteTestCase(idx);
                                                });
                                            }
                                            setSelectedTests([]);
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Selected
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {!isRunningAll && onRunAll && (
                        <Button
                            onClick={() => onRunAll(filteredTestCases.map(({ index }) => index))}
                            className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            disabled={isRunningAll}
                        >
                            <Play className="h-4 w-4" />
                            Run All
                        </Button>
                    )}
                    {isRunningAll && onStopExecution && (
                        <Button
                            onClick={onStopExecution}
                            variant="destructive"
                            className="h-9 gap-2"
                        >
                            <XCircle className="h-4 w-4" />
                            Stop Execution
                        </Button>
                    )}
                    <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} variant="secondary" className="h-9 gap-2">
                        <Plus className="h-4 w-4" />
                        Add Case
                    </Button>
                    {!isRunningAll && <div className="mx-1 hidden h-9 w-px bg-border md:block" />}
                    {!isRunningAll && onCopy && (
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onCopy} title="Copy All SQL">
                            <Copy className="h-4 w-4" />
                        </Button>
                    )}
                    {!isRunningAll && onRegenerate && (
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRegenerate} title="Regenerate Test Cases">
                            <div className="h-4 w-4 rotate-0 hover:rotate-180 transition-transform duration-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
                            </div>
                        </Button>
                    )}
                    {!isRunningAll && onExportResults && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9" title="Export Options">
                                    <Download className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Export As</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onExportResults('sql')}>
                                    <FileCode className="mr-2 h-4 w-4" /> SQL Script
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExportResults('csv')}>
                                    <Database className="mr-2 h-4 w-4" /> CSV File
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExportResults('excel')}>
                                    <Database className="mr-2 h-4 w-4" /> Excel File
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    </div>
                </div>
            </div>

            {/* Test Case List */}
            <div className="grid grid-cols-1 gap-3">
                {paginatedTestCases?.map(({ tc, index: realIndex }) => (
                    <Card id={`test-case-card-${realIndex}`} key={`${tc.name}-${realIndex}`} className="group border-border/80 transition-shadow hover:shadow-sm">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b bg-muted/5 px-3 py-2.5">
                            <div className="flex items-start gap-3 flex-1">
                                <Checkbox
                                    checked={selectedTests.includes(realIndex)}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedTests([...selectedTests, realIndex]);
                                            if (isRunningAll && onQueueTestDuringRun) {
                                                onQueueTestDuringRun(realIndex);
                                            }
                                        } else {
                                            setSelectedTests(selectedTests.filter(i => i !== realIndex));
                                            if (isRunningAll && onUnqueueTestsDuringRun) {
                                                onUnqueueTestsDuringRun([realIndex]);
                                            }
                                        }
                                    }}
                                    className={`mt-0.5 transition-opacity ${selectedTests.length > 0 || selectedTests.includes(realIndex) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                />
                                <div className="flex flex-1 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            className="h-auto p-0 text-left hover:bg-transparent"
                                            onClick={() => toggleExpanded(realIndex)}
                                        >
                                            {expandedTests.includes(realIndex) ? (
                                                <ChevronDown className="mr-1 h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="mr-1 h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className="text-sm font-semibold text-foreground">{tc.name}</span>
                                        </Button>
                                    </div>
                                    {((tc.category && tc.category !== 'general') || tc.severity === 'critical' || tc.severity === 'major') && (
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
                                            {tc.category && tc.category !== 'general' && (
                                                <span>{getCategoryLabel(tc.category)}</span>
                                            )}
                                            {tc.category && tc.category !== 'general' && (tc.severity === 'critical' || tc.severity === 'major') && (
                                                <span className="text-muted-foreground/40">|</span>
                                            )}
                                            {(tc.severity === 'critical' || tc.severity === 'major') && (
                                                <span className={tc.severity === 'critical' ? 'text-red-500/90' : 'text-amber-600/90'}>
                                                    {getSeverityLabel(tc.severity)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <CardDescription className="text-xs text-muted-foreground/85">
                                        {tc.description}
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 group-hover:opacity-100">
                                {onRunTest && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => onRunTest(tc)}
                                        title="Run Test"
                                        disabled={isRunningAll}
                                    >
                                        <Play className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => onQueryCreate(tc)} title="View SQL">
                                    <FileCode className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(realIndex, tc)} title="Edit">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                {onDeleteTestCase && (
                                    <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => onDeleteTestCase(realIndex)} title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        {expandedTests.includes(realIndex) && (
                            <CardContent className="px-3 pb-3 pt-2">
                            {/* Execution Result Banner */}
                            {tc.lastRunResult && (
                                <div className="space-y-2">
                                    <div className={`mb-3 flex items-start gap-2 rounded-md border p-2 text-sm ${tc.lastRunResult.status === 'pass' ? 'bg-green-50/50 border-green-200 text-green-700' :
                                        tc.lastRunResult.status === 'fail' ? 'bg-red-50/50 border-red-200 text-red-700' :
                                            'bg-blue-50/50 border-blue-200 text-blue-700'
                                        }`}>
                                        {tc.lastRunResult.status === 'pass' && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                                        {tc.lastRunResult.status === 'fail' && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                                        {tc.lastRunResult.status === 'running' && <div className="h-4 w-4 mt-0.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />}
                                        <div className="flex-1">
                                            <p className="font-semibold">{tc.lastRunResult.status === 'running' ? 'Executing...' : tc.lastRunResult.status === 'pass' ? 'Test Passed' : 'Test Failed'}</p>
                                            <p className="text-xs opacity-90">{tc.lastRunResult.message}</p>
                                        </div>
                                    </div>

                                    {/* Detailed Count Breakdown */}
                                    {tc.lastRunResult.details && (
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="p-2 bg-blue-50/50 border border-blue-200 rounded-md">
                                                <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Source Count</div>
                                                <div className="text-lg font-bold text-blue-900">{tc.lastRunResult.details.sourceCount.toLocaleString()}</div>
                                            </div>
                                            <div className="p-2 bg-purple-50/50 border border-purple-200 rounded-md">
                                                <div className="text-xs font-semibold text-purple-700 uppercase mb-1">Target Count</div>
                                                <div className="text-lg font-bold text-purple-900">{tc.lastRunResult.details.targetCount.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-2 grid grid-cols-1 gap-3 text-sm">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="rounded-md border border-dashed border-blue-200 bg-blue-50/40 p-2.5">
                                        <span className="text-xs font-semibold text-blue-700 uppercase flex items-center gap-1 mb-1">
                                            <Database className="h-3 w-3" /> Source Logic / Table
                                        </span>
                                        <div className="font-mono text-xs text-blue-900/80 line-clamp-3">
                                            {tc.sourceSQL}
                                        </div>
                                    </div>
                                    <div className="rounded-md border border-dashed border-purple-200 bg-purple-50/40 p-2.5">
                                        <span className="text-xs font-semibold text-purple-700 uppercase flex items-center gap-1 mb-1">
                                            <Database className="h-3 w-3" /> Target Logic / Table
                                        </span>
                                        <div className="font-mono text-xs text-purple-900/80 line-clamp-3">
                                            {tc.targetSQL}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="rounded-md border border-dashed bg-muted/40 p-2.5">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                                            <CheckCircle className="h-3 w-3" /> Expected Result
                                        </span>
                                        <p className="text-muted-foreground line-clamp-2 text-xs">
                                            {tc.expectedResult}
                                        </p>
                                    </div>
                                    <div className={`rounded-md border border-dashed p-2.5 ${tc.lastRunResult ? (tc.lastRunResult.status === 'pass' ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200') : 'bg-muted/40 border-border'}`}>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                                            <FileCode className="h-3 w-3" /> Actual Result
                                        </span>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 max-h-[150px] overflow-y-auto pr-2">
                                                <p className={`whitespace-pre-wrap text-xs ${tc.lastRunResult ? 'font-medium text-foreground' : 'italic text-muted-foreground'}`}>
                                                    {tc.lastRunResult ? tc.lastRunResult.message : 'Not executed yet'}
                                                </p>
                                            </div>
                                            {tc.lastRunResult?.details && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-[10px] gap-1 px-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 shrink-0"
                                                    onClick={() => downloadComparisonCsv(tc)}
                                                >
                                                    <Download className="h-3 w-3" />
                                                    Download Full Compare (CSV)
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>

            {filteredTestCases.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * itemsPerPage + 1}
                        {' - '}
                        {Math.min(currentPage * itemsPerPage, filteredTestCases.length)}
                        {' of '}
                        {filteredTestCases.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        >
                            Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {currentPage}/{totalPages}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingIndex !== null ? 'Edit Test Case' : 'Add New Test Case'}</DialogTitle>
                        <DialogDescription>
                            Configure the test case details, logic, and expectations.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Test Case Name</Label>
                                <Input
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    placeholder="e.g. Verify Customer ID Format"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select
                                    value={editForm.category}
                                    onValueChange={(val: any) => setEditForm({ ...editForm, category: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="direct_move">Direct Move</SelectItem>
                                        <SelectItem value="business_rule">Business Rule</SelectItem>
                                        <SelectItem value="transformation">Transformation</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="What does this test verify?"
                            />
                        </div>

                        <Tabs defaultValue="source" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="source">Source Query</TabsTrigger>
                                <TabsTrigger value="target">Target Query</TabsTrigger>
                            </TabsList>
                            <TabsContent value="source">
                                <Textarea
                                    className="font-mono text-xs min-h-[150px]"
                                    placeholder="SELECT ... FROM source ..."
                                    value={editForm.sourceSQL}
                                    onChange={(e) => setEditForm({ ...editForm, sourceSQL: e.target.value })}
                                />
                            </TabsContent>
                            <TabsContent value="target">
                                <Textarea
                                    className="font-mono text-xs min-h-[150px]"
                                    placeholder="SELECT ... FROM target ..."
                                    value={editForm.targetSQL}
                                    onChange={(e) => setEditForm({ ...editForm, targetSQL: e.target.value })}
                                />
                            </TabsContent>
                        </Tabs>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Expected Result</Label>
                                <Input
                                    value={editForm.expectedResult}
                                    onChange={(e) => setEditForm({ ...editForm, expectedResult: e.target.value })}
                                    placeholder="e.g. Counts match exactly"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Severity</Label>
                                <Select
                                    value={editForm.severity}
                                    onValueChange={(val: any) => setEditForm({ ...editForm, severity: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="minor">Minor</SelectItem>
                                        <SelectItem value="major">Major</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Test Case</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

