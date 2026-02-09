import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { KeyMapping } from '@/components/KeyMapping';
import { ColumnMapping } from '@/components/ColumnMapping';
import { ComparisonResults } from '@/components/ComparisonResults';
import { QueryResultsTable } from '@/components/QueryResultsTable';
import { SqlEditor } from '@/components/SqlEditor';
import { QueryBuilderWizard, QueryBuilderState } from '@/components/QueryBuilderWizard';
import { WorkflowSteps, WorkflowStep } from '@/components/WorkflowSteps';
import { HelpTooltip } from '@/components/HelpTooltip';
import { queriesApi, compareApi, pollComparisonStatus, connectionsApi, reportsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { helpContent } from '@/lib/helpContent';
import {
    Loader2,
    Play,
    Info,
    AlertTriangle,
    Trash2,
    FileCode,
    Save,
    Wand2,
    Plus,
    BookmarkPlus,
    Lightbulb,
    Sparkles,
    Lock,
    AlertCircle
} from 'lucide-react';

import { AIButton } from '@/components/AIButton';
import { AIResponseModal } from '@/components/AIResponseModal';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Progress } from '@/components/ui/progress';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

import { Connection, SavedQuery, QueryResult } from '@/types';


interface QueryPreview {
    columns: string[];
    rows: any[];
}

export default function ComparatorPage() {
    const { toast } = useToast();


    // Query mode state
    const [sourceMode, setSourceMode] = useState<'saved' | 'custom'>('saved');
    const [targetMode, setTargetMode] = useState<'saved' | 'custom'>('saved');

    // Selection state
    const [sourceQueryId, setSourceQueryId] = useState('');
    const [targetQueryId, setTargetQueryId] = useState('');

    // Multi-source state
    const [multiSourceMode, setMultiSourceMode] = useState(false);
    const [sources, setSources] = useState<{ connectionId: string; sql: string }[]>([
        { connectionId: '', sql: '' }
    ]);

    // Derived state (from selected queries or custom input)
    const [sourceConnectionId, setSourceConnectionId] = useState('');
    const [targetConnectionId, setTargetConnectionId] = useState('');
    const [sourceQuerySql, setSourceQuerySql] = useState('');
    const [targetQuerySql, setTargetQuerySql] = useState('');

    // Data
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [savedConnections, setSavedConnections] = useState<Connection[]>([]);

    // Preview state
    const [sourcePreview, setSourcePreview] = useState<QueryPreview | null>(null);
    const [targetPreview, setTargetPreview] = useState<QueryPreview | null>(null);
    const [loadingSourcePreview, setLoadingSourcePreview] = useState(false);
    const [loadingTargetPreview, setLoadingTargetPreview] = useState(false);

    // Mapping state
    const [keyMapping, setKeyMapping] = useState<{ source: string[]; target: string[] }>({
        source: [],
        target: [],
    });
    const [columnMapping, setColumnMapping] = useState<any[]>([]);

    // Comparison controls
    const [compareMode, setCompareMode] = useState<'full' | 'sample'>('full');
    const [chunkSize, setChunkSize] = useState('1000');
    const [numericTolerance, setNumericTolerance] = useState('0.001');
    const [sampleSize, setSampleSize] = useState('100');

    // Comparison state
    const [comparing, setComparing] = useState(false);
    const [comparisonId, setComparisonId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<any>(null);

    // Query Builder wizard state
    const [showSourceWizard, setShowSourceWizard] = useState(false);
    const [showTargetWizard, setShowTargetWizard] = useState(false);
    const [wizardDatabaseTree, setWizardDatabaseTree] = useState<any[]>([]);
    const [sourceWizardState, setSourceWizardState] = useState<QueryBuilderState | undefined>(undefined);
    const [targetWizardState, setTargetWizardState] = useState<QueryBuilderState | undefined>(undefined);

    // Save Result dialog state
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [reportName, setReportName] = useState('');
    const [reportNote, setReportNote] = useState('');
    const [savingReport, setSavingReport] = useState(false);

    // AI State
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiModalTitle, setAiModalTitle] = useState('');
    const [aiModalContent, setAiModalContent] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAction, setAiAction] = useState<string | null>(null);

    const resultsRef = useRef<HTMLDivElement>(null);

    // Load initial data
    useEffect(() => {
        loadSavedQueries();
        loadSavedConnections();
    }, []);

    // Auto-scroll to results
    useEffect(() => {
        if (results && resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [results]);

    const loadSavedConnections = async () => {
        const { data, error } = await connectionsApi.dropdown();
        if (error) {
            toast({
                title: 'Error loading connections',
                description: error,
                variant: 'destructive',
            });
            return;
        }
        if (data && Array.isArray(data)) {
            setSavedConnections(data);
        }
    };

    const loadSavedQueries = async () => {
        const { data, error } = await queriesApi.list();
        if (error) {
            toast({
                title: 'Error loading queries',
                description: error,
                variant: 'destructive',
            });
        } else if (data && Array.isArray(data)) {
            setSavedQueries(data);
        }
    };

    const handleQuerySelect = async (side: 'source' | 'target', queryId: string) => {
        const query = savedQueries.find(q => q.id === queryId);
        if (!query) return;

        if (side === 'source') {
            setSourceQueryId(queryId);
            setSourceConnectionId(query.connection_id);
            setSourceQuerySql(query.query);
            setSourcePreview(null);
        } else {
            setTargetQueryId(queryId);
            setTargetConnectionId(query.connection_id);
            setTargetQuerySql(query.query);
            setTargetPreview(null);
        }
    };

    const handleRunPreview = async (side: 'source' | 'target') => {
        const connectionId = side === 'source' ? sourceConnectionId : targetConnectionId;
        const sql = side === 'source' ? sourceQuerySql : targetQuerySql;

        if (!connectionId || !sql) {
            toast({
                title: 'Missing Information',
                description: 'Please select a connection and provide a query.',
                variant: 'destructive',
            });
            return;
        }

        if (side === 'source') {
            setLoadingSourcePreview(true);
        } else {
            setLoadingTargetPreview(true);
        }

        const { data, error } = await queriesApi.preview({
            connectionId,
            sql,
            limit: 100
        });

        if (side === 'source') {
            setLoadingSourcePreview(false);
        } else {
            setLoadingTargetPreview(false);
        }

        if (error) {
            toast({
                title: `${side === 'source' ? 'Source' : 'Target'} Preview Failed`,
                description: error,
                variant: 'destructive',
            });
        } else if (data) {
            if (side === 'source') {
                setSourcePreview(data as QueryPreview);
            } else {
                setTargetPreview(data as QueryPreview);
            }
        }
    };

    const handleModeChange = (side: 'source' | 'target', mode: 'saved' | 'custom') => {
        if (side === 'source') {
            setSourceMode(mode);
            setSourceQueryId('');
            setSourceConnectionId('');
            setSourceQuerySql('');
            setSourcePreview(null);
        } else {
            setTargetMode(mode);
            setTargetQueryId('');
            setTargetConnectionId('');
            setTargetQuerySql('');
            setTargetPreview(null);
        }
    };

    const handleOpenWizard = async (side: 'source' | 'target') => {
        const connectionId = side === 'source' ? sourceConnectionId : targetConnectionId;

        if (!connectionId) {
            toast({
                title: 'No Connection Selected',
                description: 'Please select a connection first.',
                variant: 'destructive',
            });
            return;
        }

        // Fetch database metadata
        const { data, error } = await connectionsApi.metadata(connectionId);

        if (error) {
            toast({
                title: 'Failed to Load Database Structure',
                description: error,
                variant: 'destructive',
            });
            return;
        }

        const databases = (data as any)?.databases;
        if (databases && Array.isArray(databases)) {
            setWizardDatabaseTree(databases);
            if (side === 'source') {
                setShowSourceWizard(true);
            } else {
                setShowTargetWizard(true);
            }
        }
    };

    const handleWizardGenerate = (query: string, state: QueryBuilderState, side: 'source' | 'target') => {
        if (side === 'source') {
            setSourceQuerySql(query);
            setSourceWizardState(state);
            setShowSourceWizard(false);
        } else {
            setTargetQuerySql(query);
            setTargetWizardState(state);
            setShowTargetWizard(false);
        }
    };

    const handleFormatQuery = (side: 'source' | 'target') => {
        const sql = side === 'source' ? sourceQuerySql : targetQuerySql;
        const formatted = sql
            .replace(/\s+/g, ' ')
            .replace(/\s*([,;])\s*/g, '$1\n')
            .replace(/\s+(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|UNION)\s+/gi, '\n$1 ')
            .trim();

        if (side === 'source') {
            setSourceQuerySql(formatted);
        } else {
            setTargetQuerySql(formatted);
        }
    };

    const handleClear = (side: 'source' | 'target') => {
        if (side === 'source') {
            setSourceQueryId('');
            setSourceConnectionId('');
            setSourceQuerySql('');
            setSourcePreview(null);
        } else {
            setTargetQueryId('');
            setTargetConnectionId('');
            setTargetQuerySql('');
            setTargetPreview(null);
        }
    };

    const handleRunComparison = async () => {
        const finalSourceSql = multiSourceMode ? sources.map(s => s.sql) : sourceQuerySql;
        const finalSourceConnId = multiSourceMode ? sources.map(s => s.connectionId) : sourceConnectionId;

        if (!finalSourceSql || (Array.isArray(finalSourceSql) && finalSourceSql.some(s => !s)) || !targetQuerySql) {
            toast({
                title: 'Missing Queries',
                description: 'Please provide all source and target queries.',
                variant: 'destructive',
            });
            return;
        }

        if ((!multiSourceMode && !sourcePreview) || !targetPreview) {
            toast({
                title: 'Previews Not Ready',
                description: 'Please run previews for both queries first.',
                variant: 'destructive',
            });
            return;
        }

        if (keyMapping.source.length === 0) {
            toast({
                title: 'Missing Key Mapping',
                description: 'Please configure at least one key mapping.',
                variant: 'destructive',
            });
            return;
        }

        if (columnMapping.length === 0) {
            toast({
                title: 'Missing Column Mapping',
                description: 'Please configure column mappings.',
                variant: 'destructive',
            });
            return;
        }

        setComparing(true);
        setProgress(0);
        setResults(null);

        const { data, error } = await compareApi.run({
            sourceQuery: finalSourceSql,
            targetQuery: targetQuerySql,
            sourceConnectionId: finalSourceConnId,
            targetConnectionId,
            keyMapping,
            columnMapping,
            compareMode,
            chunkSize: parseInt(chunkSize),
            numericTolerance: parseFloat(numericTolerance),
            sampleSize: compareMode === 'sample' ? parseInt(sampleSize) : undefined,
        });

        if (error) {
            setComparing(false);
            toast({
                title: 'Comparison Failed',
                description: error,
                variant: 'destructive',
            });
            return;
        }

        if (data && typeof data === 'object' && 'compareId' in data) {
            const compId = (data as any).compareId;
            setComparisonId(compId);
            toast({
                title: 'Comparison Started',
                description: 'Comparison is running...',
            });

            pollComparisonStatus(
                compId,
                (progressData) => setProgress(progressData.progress || 0),
                (error) => {
                    setComparing(false);
                    toast({ title: 'Comparison Failed', description: error, variant: 'destructive' });
                },
                (results) => {
                    setComparing(false);
                    setResults(results);
                    toast({ title: 'Comparison Complete', description: 'Review results below.' });
                }
            );
        }
    };

    const handleClearAll = () => {
        setSourceQueryId('');
        setTargetQueryId('');
        setSourceConnectionId('');
        setTargetConnectionId('');
        setSourceQuerySql('');
        setTargetQuerySql('');
        setSources([{ connectionId: '', sql: '' }]);
        setSourcePreview(null);
        setTargetPreview(null);
        setKeyMapping({ source: [], target: [] });
        setColumnMapping([]);
        setResults(null);
        setComparisonId(null);
        setProgress(0);
        toast({ title: 'Cleared', description: 'All fields reset.' });
    };

    const handleSaveResult = async () => {
        if (!comparisonId) return;

        if (!reportName.trim()) {
            toast({
                title: 'Name Required',
                description: 'Please enter a name for your report.',
                variant: 'destructive',
            });
            return;
        }

        setSavingReport(true);
        const { error } = await reportsApi.update(comparisonId, {
            name: reportName,
            note: reportNote
        });

        setSavingReport(false);

        if (error) {
            toast({
                title: 'Failed to save',
                description: error,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Report Saved',
                description: 'Your comparison has been saved successfully.',
            });
            setShowSaveDialog(false);
            setReportName('');
            setReportNote('');
        }
    };

    const handleAIAnalyze = async () => {
        if (!results) return;

        setAiAction('analyze');
        setAiLoading(true);
        setAiModalOpen(true);
        setAiModalTitle('Comparison Analysis');
        setAiModalContent('');

        try {
            // Prepare a summary of the results for the AI
            const summary = {
                source_rows: results.summary.source_count,
                target_rows: results.summary.target_count,
                missing_in_target: results.summary.missing_in_target,
                missing_in_source: results.summary.missing_in_source,
                mismatches: results.summary.mismatched_rows,
                column_mismatches: results.column_mismatches
            };

            const prompt = `Analyze these database comparison results and provide insights:\n\n${JSON.stringify(summary, null, 2)}\n\nHighlight key discrepancies and suggest potential causes.`;

            const response = await fetch('http://localhost:3001/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    context: 'comparison',
                    history: [],
                    contextData: { summary }
                })
            });

            const data = await response.json();
            if (data.success) {
                setAiModalContent(data.response);
            } else {
                setAiModalContent('Failed to get AI response.');
            }
        } catch (error) {
            setAiModalContent('An error occurred while communicating with AI.');
        } finally {
            setAiLoading(false);
            setAiAction(null);
        }
    };



    const renderQuerySection = (side: 'source' | 'target') => {
        const mode = side === 'source' ? sourceMode : targetMode;
        const queryId = side === 'source' ? sourceQueryId : targetQueryId;
        const connectionId = side === 'source' ? sourceConnectionId : targetConnectionId;
        const querySql = side === 'source' ? sourceQuerySql : targetQuerySql;
        const preview = side === 'source' ? sourcePreview : targetPreview;
        const loading = side === 'source' ? loadingSourcePreview : loadingTargetPreview;
        const setConnectionId = side === 'source' ? setSourceConnectionId : setTargetConnectionId;
        const setQuerySql = side === 'source' ? setSourceQuerySql : setTargetQuerySql;

        return (
            <Card className="p-6 shadow-lg border-2 bg-card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold capitalize">{side}</h2>
                        {(queryId || querySql) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleClear(side)}
                                title={`Clear ${side}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {/* Show Visual Builder in custom mode even without SQL */}
                        {mode === 'custom' && connectionId && !querySql && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenWizard(side)}
                                title="Visual Builder - Build your query visually"
                            >
                                <Wand2 className="h-3 w-3 mr-1" />
                                Visual Builder
                            </Button>
                        )}

                        {side === 'source' && (
                            <div className="flex items-center gap-2 mr-4">
                                <Label htmlFor="multi-source" className="text-xs font-normal">Multi-Source</Label>
                                <input
                                    id="multi-source"
                                    type="checkbox"
                                    checked={multiSourceMode}
                                    onChange={(e) => {
                                        setMultiSourceMode(e.target.checked);
                                        if (e.target.checked && sources.length === 0) {
                                            setSources([{ connectionId: '', sql: '' }]);
                                        }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                            </div>
                        )}
                        {(queryId || querySql) && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFormatQuery(side)}
                                    title="Format SQL"
                                >
                                    <FileCode className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenWizard(side)}
                                    title="Visual Builder"
                                >
                                    <Wand2 className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleRunPreview(side)}
                                    disabled={loading}
                                    title="Run Preview"
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {loading ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                        <Play className="h-3 w-3 mr-1" />
                                    )}
                                    Run Preview
                                </Button>
                            </>
                        )}
                    </div>
                </div>



                <div className="space-y-4">
                    {/* Mode Toggle */}
                    <div>
                        <Label className="mb-2 block">Query Mode</Label>
                        <ToggleGroup
                            type="single"
                            value={mode}
                            onValueChange={(value) => value && handleModeChange(side, value as 'saved' | 'custom')}
                            className="justify-start"
                        >
                            <ToggleGroupItem value="saved" aria-label="Saved Query">
                                Saved Query
                            </ToggleGroupItem>
                            <ToggleGroupItem value="custom" aria-label="Custom Query">
                                Custom Query
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>

                    {/* Saved Query Mode */}
                    {mode === 'saved' && !multiSourceMode && (
                        <div>
                            <Label>Select Saved Query</Label>
                            <Select value={queryId} onValueChange={(val) => handleQuerySelect(side, val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a query..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {savedQueries.map(q => (
                                        <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Multi-Source Mode UI */}
                    {side === 'source' && multiSourceMode && (
                        <div className="space-y-6">
                            {sources.map((source, index) => (
                                <div key={index} className="p-4 border rounded-md bg-muted/20 relative group">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-sm font-medium">Source {index + 1}</h3>
                                        {sources.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    const newSources = [...sources];
                                                    newSources.splice(index, 1);
                                                    setSources(newSources);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-xs">Connection</Label>
                                            <Select
                                                value={source.connectionId}
                                                onValueChange={(val) => {
                                                    const newSources = [...sources];
                                                    newSources[index].connectionId = val;
                                                    setSources(newSources);
                                                }}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue placeholder="Select connection..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {savedConnections.map(conn => (
                                                        <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="border rounded-md overflow-hidden">
                                            <SqlEditor
                                                value={source.sql}
                                                onChange={(val) => {
                                                    const newSources = [...sources];
                                                    newSources[index].sql = val;
                                                    setSources(newSources);
                                                }}
                                                readOnly={false}
                                                height="120px"
                                                label={`Source ${index + 1} SQL`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed"
                                onClick={() => setSources([...sources, { connectionId: '', sql: '' }])}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add Another Source
                            </Button>
                        </div>
                    )}

                    {/* Custom Query Mode */}
                    {mode === 'custom' && !multiSourceMode && (
                        <div className="space-y-3">
                            <div>
                                <Label>Connection</Label>
                                <Select
                                    value={connectionId}
                                    onValueChange={(val) => setConnectionId(val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a connection..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {savedConnections.map(conn => (
                                            <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>


                        </div>
                    )}

                    {/* SQL Editor */}
                    {(queryId || mode === 'custom') && (
                        <div className="border rounded-md overflow-hidden">
                            <SqlEditor
                                value={querySql}
                                onChange={setQuerySql}
                                readOnly={false}
                                height="200px"
                                label={`${side} SQL`}
                            />
                        </div>
                    )}

                    {/* Preview Results */}
                    {loading && (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading preview...
                        </div>
                    )}

                    {preview && (
                        <div className="mt-4">
                            <QueryResultsTable
                                columns={preview.columns}
                                rows={preview.rows}
                                title="Preview Results"
                            />
                        </div>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <header className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Compare Data</h1>
                            <p className="text-muted-foreground">Select or create queries to compare results</p>
                        </div>
                    </header>

                    {/* Workflow Steps */}
                    {(() => {
                        const workflowSteps: WorkflowStep[] = [
                            {
                                id: 'select-queries',
                                label: 'Select Queries',
                                description: 'Choose source and target',
                                completed: !!(sourceQuerySql && targetQuerySql),
                                active: !sourceQuerySql || !targetQuerySql
                            },
                            {
                                id: 'preview',
                                label: 'Preview Data',
                                description: 'Run query previews',
                                completed: !!(sourcePreview && targetPreview),
                                active: !!(sourceQuerySql && targetQuerySql) && (!sourcePreview || !targetPreview)
                            },
                            {
                                id: 'map-keys',
                                label: 'Map Keys',
                                description: 'Configure key mapping',
                                completed: keyMapping.source.length > 0,
                                active: !!(sourcePreview && targetPreview) && keyMapping.source.length === 0
                            },
                            {
                                id: 'map-columns',
                                label: 'Map Columns',
                                description: 'Configure column mapping',
                                completed: columnMapping.length > 0,
                                active: keyMapping.source.length > 0 && columnMapping.length === 0
                            },
                            {
                                id: 'configure',
                                label: 'Configure',
                                description: 'Set comparison settings',
                                completed: columnMapping.length > 0,
                                active: columnMapping.length > 0 && !results
                            },
                            {
                                id: 'compare',
                                label: 'Compare',
                                description: 'Run comparison',
                                completed: !!results,
                                active: false
                            }
                        ];
                        return <WorkflowSteps steps={workflowSteps} className="mb-6" />;
                    })()}

                    {/* Quick Tips */}
                    {!sourceQuerySql && !targetQuerySql && (
                        <Alert className="bg-primary/5 border-primary/20">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-sm">
                                <strong>Getting Started:</strong> Select or create queries for both source and target,
                                then run previews before configuring the comparison.
                            </AlertDescription>
                        </Alert>
                    )}


                    {sourceConnectionId && targetConnectionId && sourceConnectionId === targetConnectionId && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Warning</AlertTitle>
                            <AlertDescription>
                                Same connection selected for both source and target. Ensure this is intentional.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {renderQuerySection('source')}
                        {renderQuerySection('target')}
                    </div>

                    {/* Mappings - Only show when both queries are selected */}
                    {sourceQuerySql && targetQuerySql && (
                        <Card className="p-6 shadow-lg border-2">
                            <h2 className="text-xl font-semibold mb-4">Mapping Configuration</h2>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-medium mb-2">Key Mapping</h3>
                                    <KeyMapping
                                        sourceColumns={sourcePreview?.columns || []}
                                        targetColumns={targetPreview?.columns || []}
                                        value={keyMapping}
                                        onChange={setKeyMapping}
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-medium">Column Mapping</h3>

                                    </div>
                                    <ColumnMapping
                                        sourceColumns={sourcePreview?.columns || []}
                                        targetColumns={targetPreview?.columns || []}
                                        value={columnMapping}
                                        onChange={setColumnMapping}
                                    />
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Controls */}
                    <Card className="p-6 shadow-lg border-2">
                        <h2 className="text-xl font-semibold mb-4">Comparison Settings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label>Compare Mode</Label>
                                <Select value={compareMode} onValueChange={(v: any) => setCompareMode(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full">Full Comparison</SelectItem>
                                        <SelectItem value="sample">Sample Comparison</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Chunk Size</Label>
                                <Input type="number" value={chunkSize} onChange={(e) => setChunkSize(e.target.value)} />
                            </div>
                            <div>
                                <Label>Numeric Tolerance</Label>
                                <Input type="number" step="0.001" value={numericTolerance} onChange={(e) => setNumericTolerance(e.target.value)} />
                            </div>
                            {compareMode === 'sample' && (
                                <div>
                                    <Label>Sample Size</Label>
                                    <Input type="number" value={sampleSize} onChange={(e) => setSampleSize(e.target.value)} />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-6">
                            <Button
                                size="lg"
                                onClick={handleRunComparison}
                                disabled={comparing}
                                title="Start data comparison"
                            >
                                {comparing ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Play className="h-5 w-5 mr-2" />}
                                Run Comparison
                            </Button>

                            {results && comparisonId && (
                                <>
                                    <AIButton
                                        onClick={handleAIAnalyze}
                                        label="Analyze Differences"
                                        isLoading={aiAction === 'analyze'}
                                        disabled={aiLoading}
                                        tooltip="Get AI insights on the comparison results"
                                        size="lg"
                                        className="gap-2"
                                    />
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => setShowSaveDialog(true)}
                                    >
                                        <BookmarkPlus className="h-4 w-4" />
                                        Save Result
                                    </Button>
                                </>
                            )}

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="lg" className="gap-2">
                                        <Trash2 className="h-4 w-4" /> Clear All
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Clear All?</AlertDialogTitle>
                                        <AlertDialogDescription>This will reset all selections.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>


                        {comparing && (
                            <div className="mt-4">
                                <Label>Progress: {Math.round(progress)}%</Label>
                                <Progress value={progress} className="mt-2" />
                            </div>
                        )}
                    </Card>

                    {/* Results */}
                    <div ref={resultsRef}>
                        <Card className="p-6 shadow-lg border-2">
                            <h2 className="text-xl font-semibold mb-4">Results</h2>
                            {results && comparisonId ? (
                                <ComparisonResults comparisonId={comparisonId} results={results} />
                            ) : (
                                <p className="text-muted-foreground text-center py-8">
                                    No comparison results yet. Configure your queries and run a comparison.
                                </p>
                            )}
                        </Card>
                    </div>

                    {/* Query Builder Wizards */}
                    <Dialog open={showSourceWizard} onOpenChange={setShowSourceWizard}>
                        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Visual Query Builder - Source</DialogTitle>
                            </DialogHeader>
                            <QueryBuilderWizard
                                databaseTree={wizardDatabaseTree}
                                onGenerateQuery={(query, state) => handleWizardGenerate(query, state, 'source')}
                                onClose={() => setShowSourceWizard(false)}
                                initialState={sourceWizardState}
                                connectionType={savedConnections.find(c => c.id === sourceConnectionId)?.type}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showTargetWizard} onOpenChange={setShowTargetWizard}>
                        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Visual Query Builder - Target</DialogTitle>
                            </DialogHeader>
                            <QueryBuilderWizard
                                databaseTree={wizardDatabaseTree}
                                onGenerateQuery={(query, state) => handleWizardGenerate(query, state, 'target')}
                                onClose={() => setShowTargetWizard(false)}
                                initialState={targetWizardState}
                                connectionType={savedConnections.find(c => c.id === targetConnectionId)?.type}
                            />
                        </DialogContent>
                    </Dialog>

                    {/* Save Result Dialog */}
                    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Comparison Result</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label htmlFor="report-name" className="after:content-['*'] after:ml-0.5 after:text-red-500">
                                        Report Name
                                    </Label>
                                    <Input
                                        id="report-name"
                                        placeholder="e.g., Production vs Staging - Nov 2024"
                                        value={reportName}
                                        onChange={(e) => setReportName(e.target.value)}
                                        className={!reportName.trim() ? "border-red-200 focus-visible:ring-red-500" : ""}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="report-note">Note</Label>
                                    <Textarea
                                        id="report-note"
                                        placeholder="Add any notes about this comparison..."
                                        value={reportNote}
                                        onChange={(e) => setReportNote(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveResult} disabled={savingReport}>
                                    {savingReport && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <AIResponseModal
                    isOpen={aiModalOpen}
                    onClose={() => setAiModalOpen(false)}
                    title={aiModalTitle}
                    content={aiModalContent}
                    isLoading={aiLoading}
                />
            </div>
        </TooltipProvider>
    );
}
