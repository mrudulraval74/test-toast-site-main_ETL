import React from 'react';
import { Upload, FileSpreadsheet, Loader2, ShieldCheck, CheckCircle, AlertTriangle, XCircle, Download, Copy, Database, Layers, Plus, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface UploadValidationStepProps {
    uploadedFile: { name: string; data: any[] } | null;
    isDragging: boolean;
    isAnalyzing: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onChangeFile?: () => void; // Callback to clear current file

    savedConnections?: any[];
    sourceConnections: any[];
    multiSourceMode: boolean;
    onMultiSourceModeChange: (enabled: boolean) => void;
    targetConnection: any;
    onSourceConnectionsChange: (connections: any[]) => void;
    onTargetConnectionChange?: (id: string) => void;
    onValidate: () => void;
    onExportValidationSQL: () => void;
    onCopyValidationSQL?: () => void;
    isValidating: boolean;
    validationResults: any;
    analysis: any;
    analysisError?: string | null;
    sheets?: { name: string; data: any[] }[];
    selectedSheetNames?: string[];
    onSheetsSelectionChange?: (names: string[]) => void;
    onAnalyzeSelected?: () => void;
}

export function UploadValidationStep({
    uploadedFile,
    isDragging,
    isAnalyzing,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileSelect,
    onChangeFile,
    savedConnections = [],
    sourceConnections,
    multiSourceMode,
    onMultiSourceModeChange,
    targetConnection,
    onSourceConnectionsChange,
    onTargetConnectionChange,
    onValidate,
    onExportValidationSQL,
    onCopyValidationSQL,
    isValidating,
    validationResults,
    analysis,
    analysisError,
    sheets = [],
    selectedSheetNames = [],
    onSheetsSelectionChange,
    onAnalyzeSelected
}: UploadValidationStepProps) {
    const handleAddSource = () => {
        onSourceConnectionsChange([...sourceConnections, { id: null, name: 'None' }]);
    };

    const handleRemoveSource = (index: number) => {
        const newConns = [...sourceConnections];
        newConns.splice(index, 1);
        if (newConns.length === 0) newConns.push({ id: null, name: 'None' });
        onSourceConnectionsChange(newConns);
    };

    const handleSourceChange = (index: number, id: string) => {
        const newConns = [...sourceConnections];
        if (id === "none") {
            newConns[index] = { id: null, name: 'None' };
        } else {
            const found = savedConnections.find(c => c.id === id);
            newConns[index] = found || { id: null, name: 'None' };
        }
        onSourceConnectionsChange(newConns);
    };

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold sm:text-2xl">Upload & Validate Structure</h2>
                <p className="text-sm text-muted-foreground">
                    Select connections, upload your mapping file, and validate against database structures
                </p>
            </div>

            {/* Connection Selection */}
            <Card className="border-border/80 shadow-sm">
                <CardHeader className="border-b bg-muted/20 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Database className="h-4 w-4" />
                                Connection Configuration
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Configure source and target database instances for validation
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                            <Label htmlFor="multi-source-toggle" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Multi-Source Mode</Label>
                            <Checkbox
                                id="multi-source-toggle"
                                checked={multiSourceMode}
                                onCheckedChange={(checked) => onMultiSourceModeChange(!!checked)}
                                className="border-border data-[state=checked]:bg-primary"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Source Side */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    Source {multiSourceMode ? 'Connections' : 'Connection'}
                                    {multiSourceMode && (
                                        <Badge variant="secondary" className="h-4 text-[9px] px-1.5 bg-primary/10 text-primary border-none font-bold">
                                            {sourceConnections.filter(c => c.id).length} Active
                                        </Badge>
                                    )}
                                </Label>
                            </div>

                            <div className="space-y-3">
                                {(multiSourceMode ? sourceConnections : [sourceConnections[0]]).map((conn, idx) => (
                                    <div key={idx} className="group relative flex gap-3 rounded-lg border bg-background p-3 shadow-sm transition-colors hover:border-primary/30">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-semibold text-muted-foreground">Source #{idx + 1}</span>
                                                {multiSourceMode && sourceConnections.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5"
                                                        onClick={() => handleRemoveSource(idx)}
                                                    >
                                                        <XCircle className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            <Select
                                                value={conn?.id || "none"}
                                                onValueChange={(val) => handleSourceChange(idx, val)}
                                            >
                                                <SelectTrigger className="h-9 bg-background text-sm">
                                                    <SelectValue placeholder="Select Source Connection..." />
                                                </SelectTrigger>
                                                <SelectContent className="border-primary/10 shadow-xl">
                                                    <SelectItem value="none">None selected</SelectItem>
                                                    {savedConnections.map((c: any) => (
                                                        <SelectItem key={c.id} value={c.id} className="text-sm">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold">{c.name}</span>
                                                                <span className="text-[10px] opacity-60 uppercase">{c.type} • {c.database || 'Default'}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}

                                {multiSourceMode && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-full gap-2 border-dashed text-xs font-semibold"
                                        onClick={handleAddSource}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Source System
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Target Side */}
                        <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                                Target Environment
                            </Label>
                            <div className="h-fit rounded-lg border bg-background p-3 shadow-sm">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-muted-foreground">Primary Sink</span>
                                    <Select
                                        value={targetConnection?.id || "none"}
                                        onValueChange={onTargetConnectionChange}
                                    >
                                    <SelectTrigger className="h-9 bg-background text-sm">
                                            <SelectValue placeholder="Select Target System..." />
                                        </SelectTrigger>
                                        <SelectContent className="border-primary/10 shadow-xl">
                                            <SelectItem value="none">None selected</SelectItem>
                                            {savedConnections.map((conn: any) => (
                                                <SelectItem key={conn.id} value={conn.id} className="text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{conn.name}</span>
                                                        <span className="text-[10px] opacity-60 uppercase">{conn.type} • {conn.database || 'Default'}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-primary">
                                    <AlertCircle className="h-3 w-3" />
                                    Deployment Guide
                                </div>
                                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                                    Changes will be validated against the target schema to ensure data integrity during ETL execution.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Upload */}
                <div className="space-y-6">
                    {/* Upload Zone */}
                    <Card className="shadow-sm border-border/50">
                        <CardHeader className="pb-3 border-b bg-muted/5">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-primary" />
                                Upload Mapping File
                            </CardTitle>
                            <CardDescription>
                                Supports Excel (.xlsx, .xls) and CSV files
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">


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
                                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                                    <input
                                        id="file-input"
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={onFileSelect}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="border border-primary/10 rounded-xl p-3 bg-primary/5 flex items-center gap-4 shadow-sm overflow-hidden">
                                        <div className="flex-1 flex items-center gap-3 min-w-0">
                                            <div className="shrink-0 p-2.5 bg-background rounded-lg shadow-inner">
                                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <p className="text-sm font-bold truncate text-foreground">{uploadedFile.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="h-4 text-[9px] px-1 font-bold bg-primary/10 text-primary border-none">{uploadedFile.data.length} ROWS</Badge>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Excel Document</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="shrink-0 h-8 text-[11px] font-bold gap-1.5 px-3 rounded-lg border border-primary/20 bg-background/80 hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                                            onClick={() => {
                                                if (onChangeFile) onChangeFile(); // Clear current file
                                                const el = document.getElementById('file-input') as HTMLInputElement;
                                                if (el) { el.value = ''; el.click(); }
                                            }}
                                        >
                                            <Upload className="h-3 w-3" />
                                            Change
                                        </Button>
                                    </div>

                                    {sheets.length > 1 && onSheetsSelectionChange && (
                                        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="flex items-center gap-2">
                                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                                    Select Sheets to Process
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" className="h-6 text-xs px-2" onClick={() => onSheetsSelectionChange(sheets.map(s => s.name))}>
                                                        All
                                                    </Button>
                                                    <Button variant="ghost" className="h-6 text-xs px-2" onClick={() => onSheetsSelectionChange([])}>
                                                        None
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="border rounded-md p-3 space-y-2 max-h-[150px] overflow-y-auto bg-muted/10">
                                                {sheets.map((sheet, idx) => (
                                                    <div key={idx} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`sheet-${idx}`}
                                                            checked={selectedSheetNames.includes(sheet.name)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    onSheetsSelectionChange([...selectedSheetNames, sheet.name]);
                                                                } else {
                                                                    onSheetsSelectionChange(selectedSheetNames.filter(n => n !== sheet.name));
                                                                }
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={`sheet-${idx}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                                        >
                                                            {sheet.name} <span className="text-muted-foreground text-xs font-normal">({sheet.data.length} rows)</span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>

                                            <Button
                                                className="w-full"
                                                size="sm"
                                                onClick={onAnalyzeSelected}
                                                disabled={selectedSheetNames.length === 0 || isAnalyzing}
                                            >
                                                {isAnalyzing ? (
                                                    <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Processing...</>
                                                ) : (
                                                    `Analyze ${selectedSheetNames.length} Selected Sheet${selectedSheetNames.length !== 1 ? 's' : ''}`
                                                )}
                                            </Button>
                                        </div>
                                    )}

                                    {analysisError && (
                                        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                                            <XCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                {analysisError}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {(isAnalyzing || isValidating) && (
                                        <Alert>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <AlertDescription>
                                                {isAnalyzing ? "Parsing mapping structure..." : "Validating against database..."}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Validation Results */}
                <div className="space-y-6 h-full">
                    {!validationResults ? (
                        <div className="h-full min-h-[400px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/5">
                            <ShieldCheck className="h-16 w-16 mb-4 opacity-10" />
                            <h3 className="text-lg font-medium opacity-50">Validation Results</h3>
                            <p className="text-sm opacity-50 text-center max-w-xs mt-2">
                                Upload a file and analyze to see validation insights here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Summary Card */}
                            <Card className={`border-l-4 ${validationResults.success ? 'border-l-green-500 bg-green-50/30' : 'border-l-red-500 bg-red-50/30'} shadow-sm`}>
                                <CardContent className="p-0">
                                    <div className="p-6">
                                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-xl ${validationResults.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {validationResults.success ? <CheckCircle className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                                                </div>
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

                                            <div className="flex flex-wrap items-center gap-2">
                                                {onCopyValidationSQL && (
                                                    <Button variant="outline" size="sm" onClick={onCopyValidationSQL} className="gap-2 h-9 rounded-lg border-primary/20 hover:bg-primary/5 transition-all">
                                                        <Copy className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Copy Report</span><span className="lg:hidden">Copy</span>
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="sm" onClick={onExportValidationSQL} className="gap-2 h-9 rounded-lg border-primary/20 hover:bg-primary/5 transition-all">
                                                    <Download className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Export Report</span><span className="lg:hidden">Export</span>
                                                </Button>
                                            </div>
                                        </div>

                                        {!validationResults.success && analysis?.mappings && (
                                            <div className="mt-6 pt-6 border-t border-red-200/50 flex flex-col md:flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-100/50 px-3 py-1.5 rounded-full font-medium">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Missing objects detected
                                                </div>
                                                <Button size="sm" className="gap-2 h-10 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02]" variant="default" onClick={() => {
                                                    import('xlsx').then(XLSX => {
                                                        const exportData = analysis.mappings.map((m: any) => ({
                                                            'Source Table': m.sourceTable,
                                                            'Source Column': m.sourceColumn,
                                                            'Target Table': m.targetTable,
                                                            'Target Column': m.targetColumn,
                                                            'Transformation Logic': m.transformationLogic || (m.transformationType === 'direct_move' ? 'Direct' : '')
                                                        }));

                                                        const wb = XLSX.utils.book_new();
                                                        const ws = XLSX.utils.json_to_sheet(exportData);
                                                        const wscols = Object.keys(exportData[0] || {}).map(k => ({ wch: 20 }));
                                                        ws['!cols'] = wscols;
                                                        XLSX.utils.book_append_sheet(wb, ws, 'Standardized Mapping');
                                                        XLSX.writeFile(wb, `Cleaned_Mapping_${new Date().toISOString().slice(0, 10)}.xlsx`);
                                                    });
                                                }} disabled={!analysis?.mappings}>
                                                    <FileSpreadsheet className="h-4 w-4" /> Download Standardized Sheet
                                                </Button>
                                            </div>
                                        )}
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
                                                        <p className="text-center text-muted-foreground py-8">No verification details available.</p>
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
        </div >
    );
}
