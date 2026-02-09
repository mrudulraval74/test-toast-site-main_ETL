import React, { useState } from 'react';
import {
    Download, Code, Database, FileCode, Copy, Play, Plus, Edit, Trash2,
    CheckCircle, AlertTriangle, XCircle, ChevronRight, ChevronDown, Search,
    Settings, Save
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    category?: 'direct_move' | 'business_rule' | 'transformation' | 'general';
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

interface ComparisonTabProps {
    analysis: MappingAnalysis | null;
    uploadedFile: { name: string; data: any[] } | null;
    onExport: () => void;
    onExportResults?: (format: 'sql' | 'csv' | 'excel') => void; // New optional prop
    onCopy?: () => void;
    onQueryCreate: (testCase: TestCase) => void;
    onAddTestCase?: (testCase: TestCase) => void;
    onUpdateTestCase?: (index: number, testCase: TestCase) => void;
    onDeleteTestCase?: (index: number) => void;
    onRunTest?: (testCase: TestCase) => void;
    onRunAll?: () => void;
    onSaveResults?: () => void;
}

export function ComparisonTab({
    analysis,
    uploadedFile,
    onExport,
    onExportResults, // Destructure new prop
    onCopy,
    onQueryCreate,
    onAddTestCase,
    onUpdateTestCase,
    onDeleteTestCase,
    onRunTest,
    onRunAll,
    onSaveResults
}: ComparisonTabProps) {


    const [searchTerm, setSearchTerm] = useState('');
    const [isaddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<TestCase>({
        name: '',
        category: 'general',
        description: '',
        sourceSQL: '',
        targetSQL: '',
        expectedResult: '',
        severity: 'minor'
    });

    // Helper: Reset Form
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

    // Helper: Open Edit Dialog
    const handleEditClick = (index: number, testCase: TestCase) => {
        setEditingIndex(index);
        setEditForm({ ...testCase });
        setIsAddDialogOpen(true);
    };

    // Helper: Save (Add or Update)
    const handleSave = () => {
        if (editingIndex !== null && onUpdateTestCase) {
            onUpdateTestCase(editingIndex, editForm);
        } else if (onAddTestCase) {
            onAddTestCase(editForm);
        }
        setIsAddDialogOpen(false);
        resetForm();
    };

    const getCategoryBadge = (category?: string) => {
        const badges = {
            direct_move: <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200">Direct Move</Badge>,
            business_rule: <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-200">Business Rule</Badge>,
            transformation: <Badge className="bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 border-purple-200">Transformation</Badge>,
            general: <Badge variant="outline" className="text-muted-foreground">General</Badge>
        };
        return badges[category as keyof typeof badges] || badges.general;
    };

    const getSeverityIcon = (severity?: string) => {
        if (severity === 'critical') return <AlertTriangle className="h-3 w-3 text-red-500" />;
        if (severity === 'major') return <AlertTriangle className="h-3 w-3 text-amber-500" />;
        return <CheckCircle className="h-3 w-3 text-blue-500" />;
    };

    const testCases = analysis?.testCases || [];

    const stats = {
        total: testCases.length,
        passed: testCases.filter(tc => tc.lastRunResult?.status === 'pass').length,
        failed: testCases.filter(tc => tc.lastRunResult?.status === 'fail').length,
        running: testCases.filter(tc => tc.lastRunResult?.status === 'running').length,
        get pending() { return this.total - (this.passed + this.failed + this.running) }
    };

    const filteredTestCases = testCases.filter(tc =>
        (tc.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tc.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!analysis || !uploadedFile) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-muted/10 rounded-xl border border-dashed animate-in fade-in zoom-in duration-300">
                <div className="p-4 bg-muted/20 rounded-full mb-4">
                    <Database className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No Comparisons Available</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                    Please upload a mapping sheet to generate comparisons.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Execution Dashboard */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                    <Card className="bg-muted/20 border-border/50 shadow-sm">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-muted-foreground text-xs uppercase font-semibold flex items-center gap-1">
                                <Database className="h-3 w-3" /> Total Tests
                            </span>
                            <span className="text-2xl font-bold mt-1">{stats.total}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50/50 border-green-100 shadow-sm">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-green-700 text-xs uppercase font-semibold flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Passed
                            </span>
                            <span className="text-2xl font-bold text-green-700 mt-1">{stats.passed}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50/50 border-red-100 shadow-sm">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-red-700 text-xs uppercase font-semibold flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Failed
                            </span>
                            <span className="text-2xl font-bold text-red-700 mt-1">{stats.failed}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-blue-700 text-xs uppercase font-semibold flex items-center gap-1">
                                <Settings className="h-3 w-3 animate-pulse" /> Pending
                            </span>
                            <span className="text-2xl font-bold text-blue-700 mt-1">{stats.pending}</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Dashboard Action */}
                <Card className="flex flex-col justify-center items-center p-4 min-w-[120px] bg-primary/5 border-primary/20 shadow-sm">
                    <Button onClick={onSaveResults} variant="outline" className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/10">
                        <Save className="h-4 w-4" />
                        Save Results
                    </Button>
                    <span className="text-[10px] text-muted-foreground mt-2 text-center">
                        Persist current run to history
                    </span>
                </Card>
            </div>

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Code className="h-5 w-5 text-primary" />
                        Test Case Manager
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {testCases.length} generated test cases for {uploadedFile.name}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search test cases..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {onRunAll && (
                        <Button onClick={onRunAll} className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm">
                            <Play className="h-4 w-4" />
                            Run All
                        </Button>
                    )}
                    <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} variant="secondary" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Case
                    </Button>
                    <div className="h-8 w-px bg-border mx-2 hidden md:block" />
                    {onCopy && (
                        <Button variant="ghost" size="icon" onClick={onCopy} title="Copy All SQL">
                            <Copy className="h-4 w-4" />
                        </Button>
                    )}
                    {onExportResults ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" title="Export Options">
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
                    ) : (
                        <Button variant="ghost" size="icon" onClick={onExport} title="Export SQL">
                            <Download className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Test Case List (Cards) */}
            <div className="grid grid-cols-1 gap-4">
                {filteredTestCases?.map((tc, idx) => (
                    <Card key={idx} className="group hover:shadow-md transition-shadow border-l-4 border-l-transparent hover:border-l-primary/50">
                        <CardHeader className="py-3 px-4 flex flex-row items-start justify-between space-y-0">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lg">{tc.name}</span>
                                    {getCategoryBadge(tc.category)}
                                    <Badge variant="outline" className={`text-xs gap-1 border-dashed ${tc.severity === 'critical' ? 'text-red-600 border-red-200 bg-red-50' : 'text-muted-foreground'}`}>
                                        {getSeverityIcon(tc.severity)}
                                        {tc.severity || 'minor'}
                                    </Badge>
                                </div>
                                <CardDescription className="line-clamp-1 text-xs">
                                    {tc.description}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                {onRunTest && (
                                    <Button size="sm" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => onRunTest(tc)} title="Run Test">
                                        <Play className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => onQueryCreate(tc)} title="View SQL">
                                    <FileCode className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(idx, tc)} title="Edit">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                {onDeleteTestCase && (
                                    <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => onDeleteTestCase(idx)} title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4 pb-4">
                            {/* Execution Result Banner */}
                            {tc.lastRunResult && (
                                <div className={`mb-3 p-2 rounded-md border flex items-start gap-2 text-sm ${tc.lastRunResult.status === 'pass' ? 'bg-green-50/50 border-green-200 text-green-700' :
                                    tc.lastRunResult.status === 'fail' ? 'bg-red-50/50 border-red-200 text-red-700' :
                                        'bg-blue-50/50 border-blue-200 text-blue-700'
                                    }`}>
                                    {tc.lastRunResult.status === 'pass' && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                                    {tc.lastRunResult.status === 'fail' && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                                    {tc.lastRunResult.status === 'running' && <div className="h-4 w-4 mt-0.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />}
                                    <div>
                                        <p className="font-semibold">{tc.lastRunResult.status === 'running' ? 'Executing...' : tc.lastRunResult.status === 'pass' ? 'Test Passed' : 'Test Failed'}</p>
                                        <p className="text-xs opacity-90">{tc.lastRunResult.message}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 text-sm mt-2">
                                <div className="p-3 bg-muted/40 rounded-md border border-dashed">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                                        <Database className="h-3 w-3" /> Source Logic / Table
                                    </span>
                                    <div className="font-mono text-xs text-muted-foreground line-clamp-2">
                                        {tc.sourceSQL}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-3 bg-muted/40 rounded-md border border-dashed">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                                            <CheckCircle className="h-3 w-3" /> Expected Result
                                        </span>
                                        <p className="text-muted-foreground line-clamp-2 text-xs">
                                            {tc.expectedResult}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-md border border-dashed ${tc.lastRunResult ? (tc.lastRunResult.status === 'pass' ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200') : 'bg-muted/40 border-border'}`}>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                                            <FileCode className="h-3 w-3" /> Actual Result
                                        </span>
                                        <p className={`line-clamp-2 text-xs ${tc.lastRunResult ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
                                            {tc.lastRunResult ? tc.lastRunResult.message : 'Not executed yet'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Add/Edit Modal */}
            <Dialog open={isaddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
