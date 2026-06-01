import React, { useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, ShieldCheck, CheckCircle, AlertTriangle, XCircle, Download, Copy, Database, Layers, Plus, AlertCircle, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getRecognizedKeywords } from '@/utils/promptTestEnhancer';

type MappingSheetMode = 'qa_standard' | 'convert_to_qa_standard';

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
    onStopValidation?: () => void;

    mappingSheetMode?: MappingSheetMode;
    onMappingSheetModeChange?: (mode: MappingSheetMode) => void;
    onReplaceWorkbook?: (
        fileName: string,
        nextSheets: { name: string; data: any[] }[],
        options?: { analyze?: boolean }
    ) => void | Promise<void>;
    onConvertAndValidate?: (
        fileName: string,
        nextSheets: { name: string; data: any[] }[]
    ) => Promise<{ success: boolean; error?: string }>;

    promptInstructions?: string;
    onPromptInstructionsChange?: (value: string) => void;
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
    onAnalyzeSelected,
    mappingSheetMode = 'qa_standard',
    onMappingSheetModeChange,
    onReplaceWorkbook,
    onConvertAndValidate,
    promptInstructions = '',
    onPromptInstructionsChange
}: UploadValidationStepProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isPromptExpanded, setIsPromptExpanded] = useState(!!promptInstructions);
    const recognizedKeywords = useMemo(() => getRecognizedKeywords(promptInstructions), [promptInstructions]);
    const { toast } = useToast();

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

    const showSheetSelector = sheets.length > 1 && !!onSheetsSelectionChange;
    const showAnalyzeButton = !!uploadedFile && !!onAnalyzeSelected;

    const selectedSheetsForDisplay = useMemo(() => {
        if (!sheets || sheets.length === 0) return [];
        if (!selectedSheetNames || selectedSheetNames.length === 0) return [];
        return sheets.filter((s) => selectedSheetNames.includes(s.name));
    }, [sheets, selectedSheetNames]);

    const selectedRowsForDisplay = useMemo(() => {
        return selectedSheetsForDisplay.reduce((sum, s) => sum + (s.data?.length || 0), 0);
    }, [selectedSheetsForDisplay]);

    const [showConvertDialog, setShowConvertDialog] = useState(false);
    const [convertFileName, setConvertFileName] = useState<string>('');
    const [convertSheets, setConvertSheets] = useState<{ name: string; data: any[] }[]>([]);
    const [convertSelectedSheetNames, setConvertSelectedSheetNames] = useState<string[]>([]);
    const [convertError, setConvertError] = useState<string | null>(null);
    const [convertWarning, setConvertWarning] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [convertedPreviewSheets, setConvertedPreviewSheets] = useState<{ name: string; data: any[] }[]>([]);
    const [previewSheetName, setPreviewSheetName] = useState<string>('');
    const [showAllPreviewColumns, setShowAllPreviewColumns] = useState(true);
    const convertFileInputRef = useRef<HTMLInputElement | null>(null);

    const canUseConvertFlow = mappingSheetMode === 'convert_to_qa_standard';

    const clearConvertedPreview = () => {
        setConvertedPreviewSheets([]);
        setPreviewSheetName('');
        setConvertError(null);
        setConvertWarning(null);
    };

    const resetConvertDialogState = () => {
        setConvertFileName('');
        setConvertSheets([]);
        setConvertSelectedSheetNames([]);
        clearConvertedPreview();
        setIsConverting(false);
        if (convertFileInputRef.current) convertFileInputRef.current.value = '';
    };

    const handleConvertDialogOpenChange = (open: boolean) => {
        if (!open) resetConvertDialogState();
        setShowConvertDialog(open);
    };

    const handleConvertFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setConvertError(null);
        setConvertWarning(null);
        setConvertFileName(file.name);
        clearConvertedPreview();

        try {
            const XLSX = await import('xlsx');
            const reader = new FileReader();
            reader.onerror = () => {
                console.error('FileReader error:', reader.error);
                setConvertError("File is in use or inaccessible. Please close it in Excel/OneDrive and try again.");
            };
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const loadedSheets = wb.SheetNames.map((name) => ({
                        name,
                        data: XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false })
                    }));

                    if (loadedSheets.length === 0) {
                        setConvertError("No sheets found in the uploaded file.");
                        setConvertSheets([]);
                        setConvertSelectedSheetNames([]);
                        setConvertedPreviewSheets([]);
                        setPreviewSheetName('');
                        return;
                    }

                    setConvertSheets(loadedSheets);
                    // Do not auto-convert on upload. Ask the user which sheet(s) to process.
                    // For single-sheet workbooks, preselect the only sheet.
                    setConvertSelectedSheetNames(loadedSheets.length === 1 ? [loadedSheets[0].name] : []);
                } catch (err) {
                    console.error('Failed reading workbook:', err);
                    setConvertError("Could not read the uploaded file.");
                    setConvertSheets([]);
                    setConvertSelectedSheetNames([]);
                    clearConvertedPreview();
                }
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            console.error('Failed to load xlsx:', err);
            setConvertError("Missing XLSX parser dependency.");
        }
    };

    const buildQaStandardRows = (m: any) => ({
        'Target Table Name': m.targetTable || '',
        'Target Attribute Name': m.targetColumn || '',
        'Target Attribute DataType': m.targetDataType || '',
        'Target Attribute DataSize': '',
        'Target Key': m.isPrimaryKey ? 'Y' : '',
        'Target IsNullable': m.isNullable === false ? 'N' : (m.isNullable === true ? 'Y' : ''),

        'Source Table Name': m.sourceTable || '',
        'Source Attribute Name': m.sourceColumn || '',
        'Source Attribute DataType': m.sourceDataType || '',
        'Source Attribute DataSize': '',
        'Source Key': m.isPrimaryKey ? 'Y' : '',
        'Source IsNullable': m.isNullable === false ? 'N' : (m.isNullable === true ? 'Y' : ''),

        'Data Mapping Rule': m.transformationLogic || m.transformationType || '',
        'Notes': m.notes || m.comments || '',
        'Original Sheet': m._sheetName || ''
    });

    const handleGenerateConvertedPreview = async () => {
        console.log('[Convert Preview] handleGenerateConvertedPreview called', {
            showConvertDialog,
            convertSheetsCount: convertSheets.length,
            convertSelectedSheetNames,
        });

        if (!showConvertDialog) {
            console.warn('[Convert Preview] Dialog not open, aborting.');
            return;
        }
        if (convertSheets.length === 0) {
            const msg = "Upload a mapping sheet to start conversion.";
            setConvertError(msg);
            toast({ title: "Conversion Error", description: msg, variant: "destructive" });
            return;
        }
        if (convertSelectedSheetNames.length === 0) {
            const msg = "Select at least one sheet to convert.";
            setConvertError(msg);
            toast({ title: "Conversion Error", description: msg, variant: "destructive" });
            return;
        }

        setIsConverting(true);
        setConvertError(null);
        setConvertWarning(null);

        try {
            const { parseMappingSheet } = await import('@/utils/mappingSheetParser');
            const selected = convertSheets.filter((s) => convertSelectedSheetNames.includes(s.name));
            console.log(`[Convert Preview] Processing ${selected.length} selected sheet(s):`, selected.map(s => `${s.name} (${s.data?.length || 0} rows)`));

            const previewSheets: { name: string; data: any[] }[] = [];
            const blockingErrors: string[] = [];
            const warnings: string[] = [];

            for (const sheet of selected) {
                console.log(`[Convert Preview] Parsing sheet: "${sheet.name}" with ${sheet.data?.length || 0} rows`);
                if (sheet.data?.length > 0) {
                    const sampleKeys = Object.keys(sheet.data[0] || {});
                    console.log(`[Convert Preview] Column headers in "${sheet.name}":`, sampleKeys);
                    if (sheet.data.length > 0) {
                        console.log(`[Convert Preview] First row sample:`, JSON.stringify(sheet.data[0]).slice(0, 500));
                    }
                }

                const parsed = parseMappingSheet(sheet.data);
                console.log(`[Convert Preview] Parse result for "${sheet.name}":`, {
                    format: parsed.detectedFormat,
                    confidence: parsed.metadata.formatConfidence,
                    mappingsFound: parsed.columnMappings?.length || 0,
                    detectedColumns: parsed.metadata.detectedColumns,
                });

                if (!parsed.columnMappings || parsed.columnMappings.length === 0) {
                    const errorMsg = `[${sheet.name}] No valid mappings found (detected format: ${parsed.detectedFormat}, confidence: ${parsed.metadata.formatConfidence.toFixed(2)}). Please verify the sheet has Source/Target column headers and data values.`;
                    if (selected.length > 1) {
                        warnings.push(errorMsg);
                    } else {
                        blockingErrors.push(errorMsg);
                    }
                    continue;
                }

                const skipped = parsed.metadata?.skippedRows;
                if (skipped && (skipped.missingSource > 0 || skipped.missingTarget > 0)) {
                    if (selected.length > 1) {
                        warnings.push(
                            `[${sheet.name}] Missing required cells: ${skipped.missingSource} row(s) missing Source Attribute Name, ${skipped.missingTarget} row(s) missing Target Attribute Name. Some rows were skipped.`
                        );
                    } else {
                        blockingErrors.push(
                            `[${sheet.name}] Missing required cells: ${skipped.missingSource} row(s) missing Source Attribute Name, ${skipped.missingTarget} row(s) missing Target Attribute Name.`
                        );
                    }
                }
                if (skipped && skipped.placeholder > 0) {
                    warnings.push(`[${sheet.name}] Skipped ${skipped.placeholder} placeholder row(s) (e.g., N/A, -).`);
                }

                const rows = parsed.columnMappings.map((m: any) => buildQaStandardRows({ ...m, _sheetName: sheet.name }));
                previewSheets.push({
                    name: `QA - ${sheet.name}`,
                    data: rows
                });
                console.log(`[Convert Preview] Generated ${rows.length} QA standard rows for "${sheet.name}"`);
            }

            setConvertedPreviewSheets(previewSheets);
            setPreviewSheetName(previewSheets[0]?.name || '');

            if (warnings.length > 0) {
                setConvertWarning(warnings.join('\n'));
            }
            if (blockingErrors.length > 0) {
                setConvertError(blockingErrors.join('\n'));
            }

            if (previewSheets.length === 0 && blockingErrors.length === 0) {
                // All selected sheets had 0 mappings — warnings were added above.
                // Promote to a blocking error so the user sees it clearly.
                const errMsg = warnings.length > 0
                    ? warnings.join('\n')
                    : "No valid mappings were found in any of the selected sheets. Please verify the sheet structures.";
                setConvertError(errMsg);
                setConvertWarning(null);
            }

            // Show a toast if there's any error or no results
            if (previewSheets.length === 0) {
                toast({
                    title: "Conversion Failed",
                    description: `Could not extract mappings from ${selected.length} sheet(s). Check the column headers match Source/Target patterns.`,
                    variant: "destructive"
                });
            } else {
                const totalRows = previewSheets.reduce((sum, s) => sum + s.data.length, 0);
                toast({
                    title: "Preview Generated",
                    description: `Converted ${totalRows} mapping(s) across ${previewSheets.length} sheet(s).`
                });
            }
        } catch (err) {
            console.error('[Convert Preview] Unexpected error:', err);
            clearConvertedPreview();
            const errMsg = "Could not convert the selected sheet(s). Please verify the mapping has Source/Target columns.";
            setConvertError(errMsg);
            toast({ title: "Conversion Error", description: errMsg, variant: "destructive" });
        } finally {
            setIsConverting(false);
        }
    };

    const handleConvertToQaStandard = async () => {
        console.log('[Convert] handleConvertToQaStandard called', {
            convertSheetsCount: convertSheets.length,
            convertSelectedSheetNames,
            convertedPreviewSheetsCount: convertedPreviewSheets.length,
            hasOnConvertAndValidate: !!onConvertAndValidate,
            hasOnReplaceWorkbook: !!onReplaceWorkbook,
        });

        if (convertSheets.length === 0) {
            const msg = "Please upload a mapping file first.";
            setConvertError(msg);
            toast({ title: "Conversion Error", description: msg, variant: "destructive" });
            return;
        }
        if (convertSelectedSheetNames.length === 0) {
            const msg = "Please select at least one sheet to convert.";
            setConvertError(msg);
            toast({ title: "Conversion Error", description: msg, variant: "destructive" });
            return;
        }

        setIsConverting(true);
        setConvertError(null);

        // Step 1: If no preview generated yet, auto-generate it now
        let sheetsToLoad = convertedPreviewSheets;
        if (sheetsToLoad.length === 0) {
            console.log('🔄 [Convert] No preview yet — auto-generating preview before loading...');
            try {
                const { parseMappingSheet } = await import('@/utils/mappingSheetParser');
                const selected = convertSheets.filter((s) => convertSelectedSheetNames.includes(s.name));
                const newPreviewSheets: { name: string; data: any[] }[] = [];
                const blockingErrors: string[] = [];

                for (const sheet of selected) {
                    console.log(`[Convert] Auto-parsing sheet: "${sheet.name}" with ${sheet.data?.length || 0} rows`);
                    if (sheet.data?.length > 0) {
                        console.log(`[Convert] Column headers:`, Object.keys(sheet.data[0] || {}));
                    }
                    const parsed = parseMappingSheet(sheet.data);
                    console.log(`[Convert] Parse result for "${sheet.name}":`, {
                        format: parsed.detectedFormat,
                        confidence: parsed.metadata.formatConfidence,
                        mappingsFound: parsed.columnMappings?.length || 0,
                    });
                    if (!parsed.columnMappings || parsed.columnMappings.length === 0) {
                        blockingErrors.push(`[${sheet.name}] No valid mappings found (format: ${parsed.detectedFormat}). Please verify Source/Target column headers.`);
                        continue;
                    }
                    const rows = parsed.columnMappings.map((m: any) => buildQaStandardRows({ ...m, _sheetName: sheet.name }));
                    newPreviewSheets.push({ name: `QA - ${sheet.name}`, data: rows });
                }

                if (blockingErrors.length > 0 && newPreviewSheets.length === 0) {
                    const errMsg = blockingErrors.join('\n');
                    setConvertError(errMsg);
                    toast({ title: "Conversion Failed", description: `No valid mappings found in ${selected.length} sheet(s).`, variant: "destructive" });
                    setIsConverting(false);
                    return;
                }
                if (blockingErrors.length > 0) {
                    setConvertWarning(blockingErrors.join('\n'));
                }

                setConvertedPreviewSheets(newPreviewSheets);
                setPreviewSheetName(newPreviewSheets[0]?.name || '');
                sheetsToLoad = newPreviewSheets;
                console.log(`✅ [Convert] Auto-preview generated: ${sheetsToLoad.length} sheet(s)`);
            } catch (err) {
                console.error('[Convert] Preview generation failed:', err);
                const errMsg = 'Could not parse the selected sheet(s). Please verify the mapping has Source/Target columns.';
                setConvertError(errMsg);
                toast({ title: "Conversion Error", description: errMsg, variant: "destructive" });
                setIsConverting(false);
                return;
            }
        }

        const qaFileName = `QA_Standard_${convertFileName || 'mapping'}`;

        // Step 2: Load the converted QA standard workbook into Step 2.
        // Validation and test generation are intentionally separate user actions.
        if (onReplaceWorkbook) {
            console.log('🚀 [Convert Dialog] Loading converted workbook with', sheetsToLoad.length, 'sheets');
            try {
                await onReplaceWorkbook(qaFileName, sheetsToLoad, { analyze: true });
                setShowConvertDialog(false);
                setConvertFileName('');
                setConvertSheets([]);
                setConvertSelectedSheetNames([]);
                clearConvertedPreview();
                toast({ title: "Conversion Complete", description: "Mapping sheet converted. Review it in Step 2, then validate structure when ready." });
            } catch (err) {
                console.error('[Convert Dialog] Workbook load failed:', err);
                const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred while loading the converted workbook.';
                setConvertError(errMsg);
                toast({ title: "Conversion Error", description: errMsg, variant: "destructive" });
            } finally {
                setIsConverting(false);
            }
            return;
        }

        // Legacy fallback for callers that still provide the old combined callback.
        if (!onConvertAndValidate) {
            const msg = "Conversion is not available in this context.";
            setConvertError(msg);
            toast({ title: "Conversion Error", description: msg, variant: "destructive" });
            setIsConverting(false);
            return;
        }
        try {
            const result = await onConvertAndValidate(qaFileName, sheetsToLoad);
            if (!result.success) {
                throw new Error(result.error || "Conversion failed.");
            }
            setShowConvertDialog(false);
            setConvertFileName('');
            setConvertSheets([]);
            setConvertSelectedSheetNames([]);
            clearConvertedPreview();
            toast({ title: "Conversion Complete", description: "Mapping sheet converted successfully." });
        } catch (err) {
            console.error('Conversion error:', err);
            const errMsg = "Conversion failed. Please verify the sheet has mappable source/target columns.";
            setConvertError(errMsg);
            toast({ title: "Conversion Error", description: errMsg, variant: "destructive" });
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold sm:text-xl">Upload & Validate Structure</h2>
                <p className="text-sm text-muted-foreground">
                    Select connections, upload your mapping file, and validate against database structures
                </p>
            </div>

            <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Deployment Guide
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    Changes are validated against the selected target schema to protect data integrity during ETL execution.
                </p>
            </div>

            {/* Connection Selection */}
            <Card className="border-border shadow-sm">
                <CardHeader className="border-b bg-muted/10 px-4 py-3">
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
                        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                            <Label htmlFor="multi-source-toggle" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Multi-Source Mode</Label>
                            <Checkbox
                                id="multi-source-toggle"
                                checked={multiSourceMode}
                                onCheckedChange={(checked) => onMultiSourceModeChange(!!checked)}
                                className="border-border data-[state=checked]:bg-primary"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Source Side */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-2">
                                    Source {multiSourceMode ? 'Connections' : 'Connection'}
                                    {multiSourceMode && (
                                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-none">
                                            {sourceConnections.filter(c => c.id).length} Active
                                        </Badge>
                                    )}
                                </Label>
                            </div>

                            <div className="space-y-3">
                                {(multiSourceMode ? sourceConnections : [sourceConnections[0]]).map((conn, idx) => (
                                    <div key={idx} className="group relative flex gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/30">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-muted-foreground">Source #{idx + 1}</span>
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
                                                <SelectTrigger className="h-10 bg-background text-sm">
                                                    <SelectValue placeholder="Select Source Connection..." />
                                                </SelectTrigger>
                                                <SelectContent className="border-primary/10 shadow-xl">
                                                    <SelectItem value="none" className="text-sm font-normal">None selected</SelectItem>
                                                    {savedConnections.map((c: any) => (
                                                        <SelectItem key={c.id} value={c.id} className="text-sm font-normal">
                                                            {c.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {conn?.id && (
                                                <div className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
                                                    {conn.type || 'unknown'} | {conn.database || 'Default'}
                                                </div>
                                            )}
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
                            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-foreground">
                                Target Environment
                            </Label>
                            <div className="h-fit rounded-lg border bg-background p-3">
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground">Primary Sink</span>
                                    <Select
                                        value={targetConnection?.id || "none"}
                                        onValueChange={onTargetConnectionChange}
                                    >
                                    <SelectTrigger className="h-10 bg-background text-sm">
                                            <SelectValue placeholder="Select Target System..." />
                                        </SelectTrigger>
                                        <SelectContent className="border-primary/10 shadow-xl">
                                            <SelectItem value="none" className="text-sm font-normal">None selected</SelectItem>
                                            {savedConnections.map((conn: any) => (
                                                <SelectItem key={conn.id} value={conn.id} className="text-sm font-normal">
                                                    {conn.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {targetConnection?.id && (
                                        <div className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
                                            {targetConnection.type || 'unknown'} | {targetConnection.database || 'Default'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
                <CardHeader className="border-b bg-muted/10 px-4 py-3">
                    <CardTitle className="text-base font-medium">Mapping Sheet Type</CardTitle>
                    <CardDescription>
                        Choose whether you already have the QA standard mapping sheet format
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <RadioGroup
                        value={mappingSheetMode}
                        onValueChange={(v) => onMappingSheetModeChange?.(v as MappingSheetMode)}
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                        <div className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/20">
                            <RadioGroupItem id="mapping-mode-qa" value="qa_standard" className="mt-1" />
                            <Label htmlFor="mapping-mode-qa" className="cursor-pointer space-y-0.5">
                                <div className="text-sm font-medium">Yes — QA standard mapping sheet</div>
                                <div className="text-xs text-muted-foreground">Upload directly and continue</div>
                            </Label>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/20">
                            <RadioGroupItem id="mapping-mode-convert" value="convert_to_qa_standard" className="mt-1" />
                            <Label htmlFor="mapping-mode-convert" className="cursor-pointer space-y-0.5">
                                <div className="text-sm font-medium">No — convert my mapping sheet</div>
                                <div className="text-xs text-muted-foreground">Upload your sheet, convert to QA standard, then continue</div>
                            </Label>
                        </div>
                    </RadioGroup>

                    {canUseConvertFlow && (
                        <div className="mt-4 rounded-lg border bg-muted/10 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Upload your mapping sheet and we’ll normalize it into the QA standard tabular format.
                                </div>
                                <Button
                                    variant="default"
                                    className="h-9"
                                    onClick={() => {
                                        setConvertError(null);
                                        setShowConvertDialog(true);
                                    }}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload & Convert
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Prompt Instructions */}
            <Card className="border-border shadow-sm">
                <CardHeader
                    className="border-b bg-muted/10 px-4 py-3 cursor-pointer select-none"
                    onClick={() => setIsPromptExpanded(prev => !prev)}
                >
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                Test Generation Instructions
                                {recognizedKeywords.length > 0 && (
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-amber-500/10 text-amber-700 border-none">
                                        {recognizedKeywords.length} rule{recognizedKeywords.length !== 1 ? 's' : ''} detected
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Provide natural language instructions to generate targeted ETL test cases
                            </CardDescription>
                        </div>
                        {isPromptExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                    </div>
                </CardHeader>
                {isPromptExpanded && (
                    <CardContent className="pt-4 space-y-3">
                        <Textarea
                            value={promptInstructions}
                            onChange={(e) => onPromptInstructionsChange?.(e.target.value)}
                            placeholder={`Describe what to validate, e.g.:\n• Validate row counts between source and target\n• Check for NULL values in all date columns\n• Add aggregate SUM/MIN/MAX checks for Amount columns\n• Verify no leading or trailing whitespace\n• Check distinct counts for all columns\n• Validate referential integrity for ID columns`}
                            className="min-h-[120px] text-sm font-mono resize-y"
                        />
                        {recognizedKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-xs text-muted-foreground font-medium mr-1 self-center">Detected:</span>
                                {recognizedKeywords.map((kw) => (
                                    <Badge key={kw} variant="secondary" className="h-5 text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                                        {kw}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {promptInstructions.trim() && recognizedKeywords.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">
                                No recognized patterns yet. Try keywords like: row count, null, aggregate, duplicate, trim, date, distinct, boundary, completeness, rounding, data type, referential.
                            </p>
                        )}
                    </CardContent>
                )}
            </Card>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Left Column: Upload */}
                <div className="space-y-4">
                    {/* Upload Zone */}
                    <Card className="shadow-sm border-border">
                        <CardHeader className="pb-3 border-b bg-muted/10">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-primary" />
                                Upload Mapping File
                            </CardTitle>
                            <CardDescription>
                                Supports Excel (.xlsx, .xls) and CSV files
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">


                            {!uploadedFile && !canUseConvertFlow ? (
                                <div
                                    className={`
                                        border-2 border-dashed rounded-lg p-6 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center
                                        ${isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'}
                                    `}
                                    onDragOver={onDragOver}
                                    onDragLeave={onDragLeave}
                                    onDrop={onDrop}
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = '';
                                            fileInputRef.current.click();
                                        }
                                    }}
                                >
                                    <div className="mb-2 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Upload className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium">Drop mapping sheet here</p>
                                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                                </div>
                            ) : uploadedFile ? (
                                <div className="space-y-4">
                                    <div className="overflow-hidden rounded-xl border border-primary/10 bg-primary/5 p-3 flex items-center gap-4">
                                        <div className="flex-1 flex items-center gap-3 min-w-0">
                                            <div className="shrink-0 p-2.5 bg-background rounded-lg shadow-inner">
                                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">{uploadedFile.name}</p>
                                                <div className="flex items-center gap-2">
                                                    {showSheetSelector ? (
                                                        <>
                                                            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/10 text-primary border-none">
                                                                {selectedSheetNames.length} / {sheets.length} SHEETS
                                                            </Badge>
                                                            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/10 text-primary border-none">
                                                                {selectedRowsForDisplay} ROWS
                                                            </Badge>
                                                        </>
                                                    ) : (
                                                        <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/10 text-primary border-none">
                                                            {uploadedFile.data.length} ROWS
                                                        </Badge>
                                                    )}
                                                    {canUseConvertFlow && (
                                                        <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500/10 text-amber-700 border-none">
                                                            QA STANDARD
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                                        {showSheetSelector ? "Workbook" : "Excel Document"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 shrink-0 gap-1.5 rounded-lg border border-primary/20 bg-background/80 px-3 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-all"
                                            onClick={() => {
                                                if (canUseConvertFlow) {
                                                    if (onChangeFile) onChangeFile();
                                                    setConvertError(null);
                                                    setShowConvertDialog(true);
                                                    return;
                                                }

                                                if (onChangeFile) onChangeFile(); // Clear current file
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = '';
                                                    fileInputRef.current.click();
                                                }
                                            }}
                                        >
                                            <Upload className="h-3 w-3" />
                                            Change
                                        </Button>
                                    </div>

                                    {showSheetSelector && (
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

                                            <div className="text-xs text-muted-foreground">
                                                Selected:{" "}
                                                <span className="text-foreground">
                                                    {selectedSheetNames.length > 0
                                                        ? selectedSheetNames.join(", ")
                                                        : "None"}
                                                </span>
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

                                        </div>
                                    )}

                                    {showAnalyzeButton && (
                                        <Button
                                            className="w-full"
                                            size="sm"
                                            onClick={onAnalyzeSelected}
                                            disabled={isAnalyzing}
                                        >
                                            {isAnalyzing ? (
                                                <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Processing...</>
                                            ) : (
                                                `Analyze ${selectedSheetNames.length} Selected Sheet${selectedSheetNames.length !== 1 ? 's' : ''}`
                                            )}
                                        </Button>
                                    )}

                                    {!!uploadedFile && (
                                        <Button
                                            className="w-full"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onValidate()}
                                            disabled={isValidating || isAnalyzing}
                                        >
                                            {isValidating ? (
                                                <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Validating...</>
                                            ) : (
                                                "Validate Structure"
                                            )}
                                        </Button>
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
                            ) : (
                                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    Use “Upload & Convert” above to load your mapping sheet.
                                </div>
                            )}

                            {!canUseConvertFlow && (
                                <input
                                    ref={fileInputRef}
                                    id="file-input"
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={onFileSelect}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Validation Results */}
                <div className="h-full space-y-4">
                    {!validationResults ? (
                        <div className="h-full min-h-[340px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground p-6 bg-background">
                            <ShieldCheck className="mb-3 h-12 w-12 opacity-30" />
                            <h3 className="text-base font-semibold text-foreground">Validation Results</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">
                                Upload a file and analyze to see validation insights here.
                            </p>
                            <div className="mt-4 w-full max-w-xs">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => onValidate()}
                                    disabled={isValidating || isAnalyzing}
                                >
                                    {isValidating ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
                                    ) : (
                                        "Validate Structure"
                                    )}
                                </Button>
                                {!analysis?.mappings && (
                                    <p className="mt-2 text-center text-xs text-muted-foreground">
                                        Run Analyze first to enable validation.
                                    </p>
                                )}
                            </div>
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
                                                                        <span className="text-red-400 mt-1.5 text-[10px]">*</span> {err}
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
                                                                        <span className="text-red-400 mt-1.5 text-[10px]">*</span> {err}
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

            <Dialog open={showConvertDialog} onOpenChange={handleConvertDialogOpenChange}>
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Convert to QA Standard Mapping Sheet</DialogTitle>
                        <DialogDescription>
                            Upload your mapping sheet (single or multi-sheet). Select the sheets to convert, then load the QA standard version into the workflow.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Show errors prominently at the top of the dialog, OUTSIDE the scroll areas */}
                    {convertError && (
                        <Alert variant="destructive" className="mx-0 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="whitespace-pre-line text-sm">{convertError}</AlertDescription>
                        </Alert>
                    )}
                    {convertWarning && !convertError && (
                        <Alert className="mx-0 animate-in fade-in slide-in-from-top-2 border-amber-300 bg-amber-50/50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="whitespace-pre-line text-sm text-amber-800">{convertWarning}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex-1 min-h-0 overflow-hidden">
                        <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-5">
                            <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
                                <Card className="border-border shadow-sm">
                                    <CardHeader className="border-b bg-muted/10 px-4 py-3">
                                        <CardTitle className="text-sm font-semibold">Mapping Sheet</CardTitle>
                                        <CardDescription>Select a file to convert into QA standard format</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <input
                                                ref={convertFileInputRef}
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                className="hidden"
                                                onChange={handleConvertFileSelect}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-9"
                                                onClick={() => {
                                                    if (convertFileInputRef.current) {
                                                        convertFileInputRef.current.value = '';
                                                        convertFileInputRef.current.click();
                                                    }
                                                }}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                Choose file
                                            </Button>
                                            <div className="flex-1 rounded-md border bg-muted/10 px-3 py-2 text-sm text-muted-foreground min-w-0">
                                                <span className={convertFileName ? "text-foreground" : ""}>
                                                    {convertFileName || "No file selected"}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="flex flex-1 min-h-0 flex-col border-border shadow-sm">
                                    <CardHeader className="border-b bg-muted/10 px-4 py-3">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                                    Sheets to Convert
                                                </CardTitle>
                                                <CardDescription>
                                                    {convertSheets.length > 0
                                                        ? `${convertSelectedSheetNames.length} selected`
                                                        : "Upload a file to list sheets"}
                                                </CardDescription>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <Button
                                                    className="h-7 text-xs px-3"
                                                    onClick={handleGenerateConvertedPreview}
                                                    disabled={isConverting || convertSheets.length === 0 || convertSelectedSheetNames.length === 0}
                                                >
                                                    {isConverting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                                                    Preview Mappings
                                                </Button>
                                                {convertSheets.length > 1 && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            className="h-7 text-xs px-2"
                                                            onClick={() => {
                                                                clearConvertedPreview();
                                                                setConvertSelectedSheetNames(convertSheets.map((s) => s.name));
                                                            }}
                                                        >
                                                            All
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="h-7 text-xs px-2"
                                                            onClick={() => {
                                                                clearConvertedPreview();
                                                                setConvertSelectedSheetNames([]);
                                                            }}
                                                        >
                                                            None
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 min-h-0 pt-3">
                                        <ScrollArea className="h-full w-full">
                                            <div className="space-y-2 pr-3">
                                                {convertSheets.length === 0 ? (
                                                    <div className="rounded-md border bg-muted/10 p-3 text-sm text-muted-foreground">
                                                        Upload a mapping sheet to see available tabs/sheets here.
                                                    </div>
                                                ) : (
                                                    convertSheets.map((sheet) => (
                                                        <div key={sheet.name} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2">
                                                            <Checkbox
                                                                id={`convert-sheet-${sheet.name}`}
                                                                checked={convertSelectedSheetNames.includes(sheet.name)}
                                                                onCheckedChange={(checked) => {
                                                                    clearConvertedPreview();
                                                                    if (checked) {
                                                                        setConvertSelectedSheetNames((prev) => [...prev, sheet.name]);
                                                                    } else {
                                                                        setConvertSelectedSheetNames((prev) => prev.filter((n) => n !== sheet.name));
                                                                    }
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`convert-sheet-${sheet.name}`}
                                                                className="text-sm font-medium leading-none cursor-pointer flex-1 min-w-0 truncate"
                                                                title={sheet.name}
                                                            >
                                                                {sheet.name}
                                                            </label>
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {(sheet.data?.length || 0)} rows
                                                            </Badge>
                                                        </div>
                                                    ))
                                                )}

                                                {/* Inline warnings/errors are also shown at the top of the dialog for visibility */}
                                                {convertWarning && (
                                                    <Alert className="mt-2 border-amber-300 bg-amber-50/50">
                                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                        <AlertDescription className="whitespace-pre-line text-amber-800">{convertWarning}</AlertDescription>
                                                    </Alert>
                                                )}
                                                {convertError && (
                                                    <Alert variant="destructive" className="mt-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertDescription className="whitespace-pre-line">{convertError}</AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex min-h-0 flex-col lg:col-span-3">
                                <Card className="flex min-h-0 flex-col border-border shadow-sm">
                                    <CardHeader className="border-b bg-muted/10 px-4 py-3">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="space-y-0.5">
                                                <CardTitle className="text-sm font-semibold">Converted Preview</CardTitle>
                                                <CardDescription>
                                                    {convertedPreviewSheets.length > 0
                                                        ? `Showing first 25 rows`
                                                        : "Convert selections to preview output"}
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="preview-all-columns"
                                                        checked={showAllPreviewColumns}
                                                        onCheckedChange={(checked) => setShowAllPreviewColumns(Boolean(checked))}
                                                    />
                                                    <label htmlFor="preview-all-columns" className="cursor-pointer">
                                                        Show all columns
                                                    </label>
                                                </div>
                                                {isConverting && (
                                                    <span className="inline-flex items-center gap-2">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        Converting…
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 min-h-0 flex flex-col pt-4 gap-3">
                                        <Select value={previewSheetName} onValueChange={setPreviewSheetName} disabled={convertedPreviewSheets.length === 0}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={convertedPreviewSheets.length > 0 ? "Select converted sheet" : "No converted sheets yet"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {convertedPreviewSheets.map((s) => (
                                                    <SelectItem key={s.name} value={s.name}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="flex-1 min-h-0 rounded-md border bg-muted/10 overflow-hidden">
                                            <ScrollAreaPrimitive.Root type="always" className="relative h-full w-full overflow-hidden">
                                                <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
                                                    {(() => {
                                                        const sheet = convertedPreviewSheets.find((s) => s.name === previewSheetName) || convertedPreviewSheets[0];
                                                        const rows = (sheet?.data || []).slice(0, 25);
                                                        const allColumns = Object.keys(rows[0] || {});
                                                        const preferredColumns = [
                                                            'Target Table Name',
                                                            'Target Attribute Name',
                                                            'Target Attribute DataType',
                                                            'Target Attribute DataSize',
                                                            'Target Key',
                                                            'Target IsNullable',
                                                            'Source Table Name',
                                                            'Source Attribute Name',
                                                            'Source Attribute DataType',
                                                            'Source Attribute DataSize',
                                                            'Source Key',
                                                            'Source IsNullable',
                                                            'Data Mapping Rule',
                                                            'Notes',
                                                            'Original Sheet',
                                                        ];
                                                        const columns = showAllPreviewColumns
                                                            ? allColumns
                                                            : preferredColumns.filter((c) => allColumns.includes(c));

                                                        if (!sheet || rows.length === 0 || columns.length === 0) {
                                                            return (
                                                                <div className="p-4 text-sm text-muted-foreground">
                                                                    {convertSheets.length === 0
                                                                        ? "Upload a file to start conversion."
                                                                        : "Select at least one sheet to convert to see a preview."}
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <table className="min-w-[980px] w-full text-xs">
                                                                <thead className="sticky top-0 bg-background">
                                                                    <tr className="border-b">
                                                                        {columns.map((c) => (
                                                                            <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                                                                                {c}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rows.map((r, idx) => (
                                                                        <tr key={idx} className={idx % 2 === 0 ? "border-b bg-background" : "border-b bg-muted/20"}>
                                                                            {columns.map((c) => (
                                                                                <td
                                                                                    key={c}
                                                                                    className="px-3 py-2 align-top whitespace-nowrap max-w-[280px] truncate"
                                                                                    title={String((r as any)[c] ?? '')}
                                                                                >
                                                                                    {String((r as any)[c] ?? '')}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        );
                                                    })()}
                                                </ScrollAreaPrimitive.Viewport>
                                                {/* Always render scrollbars so users can discover them */}
                                                <ScrollBar orientation="vertical" forceMount />
                                                <ScrollBar orientation="horizontal" forceMount />
                                                <ScrollAreaPrimitive.Corner />
                                            </ScrollAreaPrimitive.Root>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleConvertDialogOpenChange(false)} disabled={isConverting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConvertToQaStandard}
                            disabled={isConverting || convertSheets.length === 0 || convertSelectedSheetNames.length === 0}
                        >
                            {isConverting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isConverting ? 'Converting...' : 'Convert'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

