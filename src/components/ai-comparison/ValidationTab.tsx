
import React from 'react';
import { Upload, FileSpreadsheet, Database, ShieldCheck, Loader2, CheckCircle, AlertTriangle, XCircle, Table as TableIcon, Copy, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface ValidationTabProps {
    uploadedFile: { name: string; data: any[] } | null;
    isDragging: boolean;
    isAnalyzing: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;

    savedConnections: any[];
    sourceConnection: any;
    targetConnection: any;
    onSourceConnectionChange: (id: string) => void;
    onTargetConnectionChange: (id: string) => void;

    onValidate: () => void;
    onExportValidationSQL: () => void;
    onCopyValidationSQL?: () => void;
    isValidating: boolean;
    // Removed showValidationDialog props as we are going inline
    showValidationDialog: boolean;
    setShowValidationDialog: (show: boolean) => void;
    validationResults: any;

    analysis: any;
}

export function ValidationTab({
    uploadedFile,
    isDragging,
    isAnalyzing,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileSelect,
    savedConnections,
    sourceConnection,
    targetConnection,
    onSourceConnectionChange,
    onTargetConnectionChange,
    onValidate,
    onExportValidationSQL,
    onCopyValidationSQL,
    isValidating,
    // showValidationDialog, // Unused now
    // setShowValidationDialog, // Unused now
    validationResults,
    analysis
}: ValidationTabProps) {

    // Helper to extract table name for grouping
    const groupMatches = (matches: string[]) => {
        const groups: Record<string, string[]> = {};
        if (!matches) return groups;
        matches.forEach(m => {
            const match = m.match(/'([^']+)'/);
            const tableName = match ? match[1] : 'Unknown';
            if (!groups[tableName]) groups[tableName] = [];
            groups[tableName].push(m);
        });
        return groups;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Configuration */}
                <div className="space-y-6">
                    {/* Connection Selection Pipeline */}
                    <Card className="shadow-sm border-border/50 overflow-hidden">
                        <CardHeader className="bg-muted/10 border-b pb-4">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <Database className="h-4 w-4 text-primary" />
                                1. Connection Pipeline
                            </CardTitle>
                            <CardDescription>Configure the data flow for validation</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row items-center gap-4">
                                {/* Source Card */}
                                <div className="flex-1 w-full">
                                    <Label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source Database</Label>
                                    <Select
                                        value={sourceConnection?.id || "none"}
                                        onValueChange={onSourceConnectionChange}
                                    >
                                        <SelectTrigger className="h-auto p-3 flex items-center justify-between gap-2 border border-border hover:border-primary/50 transition-colors bg-card hover:bg-accent/5 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3 text-left flex-1 overflow-hidden">
                                                <div className={`p-2 rounded-md shrink-0 ${sourceConnection ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                                                    <Database className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col items-start truncate min-w-0">
                                                    <span className={`font-semibold truncate text-sm ${sourceConnection ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {sourceConnection ? sourceConnection.name : "Select Source"}
                                                    </span>
                                                    {sourceConnection ? (
                                                        <span className="text-xs text-muted-foreground truncate">{sourceConnection.host}</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Click to configure</span>
                                                    )}
                                                </div>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-muted-foreground">None (Use mapping sheet names)</SelectItem>
                                            {savedConnections.map((conn: any) => (
                                                <SelectItem key={conn.id} value={conn.id}>
                                                    <div className="flex flex-col text-left py-1">
                                                        <span className="font-medium">{conn.name}</span>
                                                        <span className="text-xs text-muted-foreground">{conn.host} • {conn.database}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Flow Icon */}
                                <div className="flex items-center justify-center text-muted-foreground/30 md:pt-6">
                                    <div className="hidden md:flex flex-col items-center">
                                        <div className="h-px w-8 bg-current" />
                                        <ChevronRight className="h-4 w-4 -ml-2" />
                                    </div>
                                    <div className="md:hidden">
                                        <ChevronDown className="h-4 w-4" />
                                    </div>
                                </div>

                                {/* Target Card */}
                                <div className="flex-1 w-full">
                                    <Label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Database</Label>
                                    <Select
                                        value={targetConnection?.id || "none"}
                                        onValueChange={onTargetConnectionChange}
                                    >
                                        <SelectTrigger className="h-auto p-3 flex items-center justify-between gap-2 border border-border hover:border-primary/50 transition-colors bg-card hover:bg-accent/5 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3 text-left flex-1 overflow-hidden">
                                                <div className={`p-2 rounded-md shrink-0 ${targetConnection ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'}`}>
                                                    <Database className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col items-start truncate min-w-0">
                                                    <span className={`font-semibold truncate text-sm ${targetConnection ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {targetConnection ? targetConnection.name : "Select Target"}
                                                    </span>
                                                    {targetConnection ? (
                                                        <span className="text-xs text-muted-foreground truncate">{targetConnection.host}</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Click to configure</span>
                                                    )}
                                                </div>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-muted-foreground">None (Use mapping sheet names)</SelectItem>
                                            {savedConnections.map((conn: any) => (
                                                <SelectItem key={conn.id} value={conn.id}>
                                                    <div className="flex flex-col text-left py-1">
                                                        <span className="font-medium">{conn.name}</span>
                                                        <span className="text-xs text-muted-foreground">{conn.host} • {conn.database}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Upload Zone */}
                    <Card className="shadow-sm border-border/50">
                        <CardHeader className="pb-3 border-b bg-muted/5">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-primary" />
                                2. Upload Mapping
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {!uploadedFile ? (
                                <div
                                    className={`
                                        border-2 border-dashed rounded-lg p-8 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center
                                        ${isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'}
                                    `}
                                    onDragOver={onDragOver}
                                    onDragLeave={onDragLeave}
                                    onDrop={onDrop}
                                    onClick={() => {
                                        const el = document.getElementById('file-input') as HTMLInputElement;
                                        if (el) { el.value = ''; el.click(); }
                                    }}
                                >
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                        <Upload className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium">Drop mapping sheet here</p>
                                    <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv</p>
                                    <input id="file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileSelect} />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-500/10 rounded-md">
                                                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{uploadedFile.name}</p>
                                                <p className="text-xs text-muted-foreground">{uploadedFile.data.length} rows</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => {
                                            const el = document.getElementById('file-input') as HTMLInputElement;
                                            if (el) { el.value = ''; el.click(); }
                                        }}>Change</Button>
                                    </div>
                                    {analysis && (
                                        <Button
                                            onClick={onValidate}
                                            className="w-full gap-2 shadow-sm"
                                            disabled={isValidating || !sourceConnection || !targetConnection}
                                        >
                                            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                            Validate Structure
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Validation Dashboard */}
                <div className="space-y-6 h-full">
                    {!validationResults ? (
                        <div className="h-full min-h-[400px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/5">
                            <ShieldCheck className="h-16 w-16 mb-4 opacity-10" />
                            <h3 className="text-lg font-medium opacity-50">Validation Results</h3>
                            <p className="text-sm opacity-50 text-center max-w-xs mt-2">
                                Select connections and upload a file to see validation insights here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Summary Card */}
                            <Card className={`border-l-4 ${validationResults.success ? 'border-l-green-500 bg-green-50/30' : 'border-l-red-500 bg-red-50/30'} shadow-sm`}>
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            {validationResults.success ? <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" /> : <XCircle className="h-6 w-6 text-red-600 mt-0.5" />}
                                            <div>
                                                <h3 className={`text-lg font-bold ${validationResults.success ? 'text-green-800' : 'text-red-800'}`}>
                                                    {validationResults.success ? "Structure Validated" : "Validation Issues Found"}
                                                </h3>
                                                <p className="text-sm text-foreground/70 mt-1 max-w-md">
                                                    {validationResults.success
                                                        ? "All mapped tables and columns were verified in the connected databases."
                                                        : "Some objects in your mapping sheet could not be found."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        {onCopyValidationSQL && (
                                            <Button variant="outline" size="sm" onClick={onCopyValidationSQL} className="gap-2 h-8" title="Copy Report">
                                                <Copy className="h-3.5 w-3.5" /> Copy Report
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={onExportValidationSQL} className="gap-2 h-8">
                                            <Download className="h-3.5 w-3.5" /> Export Report
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="bg-card/50">
                                    <CardContent className="p-4 pt-5">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase">Tables Found</span>
                                            <span className="text-xl font-bold">{validationResults.stats.tablesFound} <span className="text-muted-foreground text-sm font-normal">/ {validationResults.stats.totalTables}</span></span>
                                        </div>
                                        <Progress value={(validationResults.stats.tablesFound / (validationResults.stats.totalTables || 1)) * 100} className="h-1.5" />
                                    </CardContent>
                                </Card>
                                <Card className="bg-card/50">
                                    <CardContent className="p-4 pt-5">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase">Columns Verified</span>
                                            <span className="text-xl font-bold">{validationResults.stats.columnsFound} <span className="text-muted-foreground text-sm font-normal">/ {validationResults.stats.totalColumns}</span></span>
                                        </div>
                                        <Progress value={(validationResults.stats.columnsFound / (validationResults.stats.totalColumns || 1)) * 100} className="h-1.5" />
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detailed Tabs */}
                            <Card className="overflow-hidden border-t-0 shadow-sm">
                                <Tabs defaultValue={validationResults.success ? "verified" : "issues"} className="w-full">
                                    <div className="border-b px-4 bg-muted/30">
                                        <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                                            {!validationResults.success && (
                                                <TabsTrigger value="issues" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none px-0 h-full">
                                                    <span className="flex items-center gap-2 text-red-600 font-medium">
                                                        <AlertTriangle className="h-4 w-4" /> Unresolved Issues
                                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px] ml-1">{validationResults.sourceErrors.length + validationResults.targetErrors.length}</Badge>
                                                    </span>
                                                </TabsTrigger>
                                            )}
                                            <TabsTrigger value="verified" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none px-0 h-full">
                                                <span className="flex items-center gap-2 font-medium">
                                                    <CheckCircle className="h-4 w-4 text-green-600" /> Verified Objects
                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-1">{validationResults.matches.length}</Badge>
                                                </span>
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="p-0 bg-card">
                                        <TabsContent value="issues" className="m-0">
                                            <ScrollArea className="h-[280px] w-full">
                                                <div className="p-4 space-y-4">
                                                    {validationResults.sourceErrors.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="text-xs font-bold text-red-700 uppercase flex items-center gap-2 bg-red-50 p-2 rounded">
                                                                Source Issues ({validationResults.sourceErrors.length})
                                                            </h4>
                                                            <ul className="space-y-1">
                                                                {validationResults.sourceErrors.map((err: string, i: number) => (
                                                                    <li key={i} className="text-sm text-red-600 flex items-start gap-2 pl-2">
                                                                        <span className="text-red-400 mt-1.5 text-[10px]">●</span> {err}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {validationResults.targetErrors.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="text-xs font-bold text-red-700 uppercase flex items-center gap-2 bg-red-50 p-2 rounded">
                                                                Target Issues ({validationResults.targetErrors.length})
                                                            </h4>
                                                            <ul className="space-y-1">
                                                                {validationResults.targetErrors.map((err: string, i: number) => (
                                                                    <li key={i} className="text-sm text-red-600 flex items-start gap-2 pl-2">
                                                                        <span className="text-red-400 mt-1.5 text-[10px]">●</span> {err}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </TabsContent>

                                        <TabsContent value="verified" className="m-0">
                                            <ScrollArea className="h-[280px] w-full">
                                                <div className="p-4">
                                                    {validationResults.matches.length > 0 ? (
                                                        <div className="grid grid-cols-1 gap-1">
                                                            {validationResults.matches.map((msg: string, i: number) => {
                                                                const isSource = msg.startsWith('source:');
                                                                const text = msg.replace('source:', '').replace('target:', '');
                                                                return (
                                                                    <div key={i} className="flex items-center justify-between text-sm py-2 px-3 rounded hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40 group">
                                                                        <div className="flex items-center gap-3">
                                                                            <Badge variant="outline" className={`${isSource ? 'border-blue-200 text-blue-700 bg-blue-50/50' : 'border-purple-200 text-purple-700 bg-purple-50/50'} w-14 justify-center text-[10px] uppercase font-bold`}>
                                                                                {isSource ? 'SRC' : 'TGT'}
                                                                            </Badge>
                                                                            <span className="text-foreground/80 font-medium">{text.split(':')[1]?.trim()}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100">
                                                                            <span className="font-mono text-xs text-green-600">
                                                                                {text.split('Verified')[1]?.replace('.', '').trim()}
                                                                            </span>
                                                                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-muted-foreground py-8">No specific verification details available.</p>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
