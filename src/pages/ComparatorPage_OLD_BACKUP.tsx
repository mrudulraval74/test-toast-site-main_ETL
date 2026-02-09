import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SqlEditor } from '@/components/SqlEditor';
import { KeyMapping } from '@/components/KeyMapping';
import { ColumnMapping } from '@/components/ColumnMapping';
import { ComparisonResults } from '@/components/ComparisonResults';
import { MyQueries } from '@/components/MyQueries';
import { addToQueryHistory } from '@/components/QueryHistory';
import { QueryResultsTable } from '@/components/QueryResultsTable';
import { ComparisonHistory } from '@/components/ComparisonHistory';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';
import { QueryBuilderWizard, QueryBuilderState } from '@/components/QueryBuilderWizard';
import { queriesApi, compareApi, pollComparisonStatus, connectionsApi, reportsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Play,
  Save,
  History,
  FileText,
  Info,
  ArrowLeftRight,
  Clock,
  Database,
  Wand2,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { useRef } from 'react';
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
} from "@/components/ui/dialog";

interface QueryPreview {
  columns: string[];
  rows: any[];
}

export default function ComparatorPage() {
  const { toast } = useToast();

  // Query state
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [sourceConnectionId, setSourceConnectionId] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [savedConnections, setSavedConnections] = useState<any[]>([]);

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

  // Query builder wizard state
  const [showSourceWizard, setShowSourceWizard] = useState(false);
  const [showTargetWizard, setShowTargetWizard] = useState(false);

  const [wizardDatabaseTree, setWizardDatabaseTree] = useState<any[]>([]);
  const [sourceWizardState, setSourceWizardState] = useState<QueryBuilderState | undefined>(undefined);
  const [targetWizardState, setTargetWizardState] = useState<QueryBuilderState | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('connections');

  // Save query dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');
  const [savingSide, setSavingSide] = useState<'source' | 'target'>('source');

  const resultsRef = useRef<HTMLDivElement>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('comparatorState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setSourceConnectionId(parsed.sourceConnectionId || '');
        setTargetConnectionId(parsed.targetConnectionId || '');
        setSourceQuery(parsed.sourceQuery || '');
        setTargetQuery(parsed.targetQuery || '');
        setKeyMapping(parsed.keyMapping || { source: [], target: [] });
        setColumnMapping(parsed.columnMapping || []);
      } catch (e) {
        console.error('Failed to load saved state', e);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      sourceConnectionId,
      targetConnectionId,
      sourceQuery,
      targetQuery,
      keyMapping,
      columnMapping,
    };
    localStorage.setItem('comparatorState', JSON.stringify(state));
  }, [sourceConnectionId, targetConnectionId, sourceQuery, targetQuery, keyMapping, columnMapping]);

  // Auto-scroll to results when comparison completes
  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results]);

  useEffect(() => {
    loadSavedQueries();
    loadSavedConnections();
  }, []);

  const loadSavedConnections = async () => {
    const { data, error } = await connectionsApi.dropdown();
    if (!error && data && Array.isArray(data)) {
      setSavedConnections(data);
    }
  };

  const loadSavedQueries = async () => {
    const { data, error } = await queriesApi.list();
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    } else if (data && Array.isArray(data)) {
      setSavedQueries(data);
    }
  };

  const handleSourcePreview = async () => {
    if (!sourceConnectionId) {
      toast({
        title: 'No Connection',
        description: 'Please select a source connection.',
        variant: 'destructive',
      });
      return;
    }

    if (!sourceQuery || !sourceQuery.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a source query before previewing.',
        variant: 'destructive',
      });
      return;
    }

    setLoadingSourcePreview(true);
    const { data, error } = await queriesApi.preview({
      connectionId: sourceConnectionId,
      sql: sourceQuery,
    });
    setLoadingSourcePreview(false);

    if (error) {
      toast({
        title: 'Preview Failed',
        description: error,
        variant: 'destructive',
      });
    } else if (data && typeof data === 'object' && 'columns' in data && 'rows' in data) {
      setSourcePreview(data as QueryPreview);

      // Add to query history
      const conn = savedConnections.find(c => c.id === sourceConnectionId);
      addToQueryHistory(sourceQuery, sourceConnectionId, conn?.name);

      toast({
        title: 'Source Preview Successful',
        description: `Loaded ${(data as any).rows.length} rows with ${(data as any).columns.length} columns from source.`,
      });
    }
  };

  const handleTargetPreview = async () => {
    if (!targetConnectionId) {
      toast({
        title: 'No Connection',
        description: 'Please select a target connection.',
        variant: 'destructive',
      });
      return;
    }

    if (!targetQuery || !targetQuery.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a target query before previewing.',
        variant: 'destructive',
      });
      return;
    }

    setLoadingTargetPreview(true);
    const { data, error } = await queriesApi.preview({
      connectionId: targetConnectionId,
      sql: targetQuery,
    });
    setLoadingTargetPreview(false);

    if (error) {
      toast({
        title: 'Preview Failed',
        description: error,
        variant: 'destructive',
      });
    } else if (data && typeof data === 'object' && 'columns' in data && 'rows' in data) {
      setTargetPreview(data as QueryPreview);

      // Add to query history
      const conn = savedConnections.find(c => c.id === targetConnectionId);
      addToQueryHistory(targetQuery, targetConnectionId, conn?.name);

      toast({
        title: 'Target Preview Successful',
        description: `Loaded ${(data as any).rows.length} rows with ${(data as any).columns.length} columns from target.`,
      });
    }
  };

  const handleSaveQuery = async (side: 'source' | 'target') => {
    const query = side === 'source' ? sourceQuery : targetQuery;
    const connectionId = side === 'source' ? sourceConnectionId : targetConnectionId;

    if (!query || !query.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Cannot save an empty query.',
        variant: 'destructive',
      });
      return;
    }

    // Open dialog to get query name
    setSavingSide(side);
    setSaveQueryName(`${side} query - ${new Date().toLocaleString()}`);
    setShowSaveDialog(true);
  };

  const handleConfirmSave = async () => {
    const query = savingSide === 'source' ? sourceQuery : targetQuery;
    const connectionId = savingSide === 'source' ? sourceConnectionId : targetConnectionId;

    const { data, error } = await queriesApi.save({
      name: saveQueryName || `${savingSide} query - ${new Date().toLocaleString()}`,
      sql: query,
      connectionId,
    });

    if (error) {
      toast({
        title: 'Save Failed',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Query Saved Successfully',
        description: `Your ${savingSide} query has been saved as "${saveQueryName}".`,
      });
      loadSavedQueries();
      setShowSaveDialog(false);
      setSaveQueryName('');
    }
  };

  const handleOpenWizard = async (side: 'source' | 'target') => {
    const connectionId = side === 'source' ? sourceConnectionId : targetConnectionId;

    if (!connectionId) {
      toast({
        title: 'No Connection Selected',
        description: `Please select a ${side} connection first.`,
        variant: 'destructive',
      });
      return;
    }

    // Fetch database metadata for the wizard
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

  const handleWizardGenerateQuery = (query: string, state: QueryBuilderState, side: 'source' | 'target') => {
    if (side === 'source') {
      setSourceQuery(query);
      setSourceWizardState(state);
      setShowSourceWizard(false);
    } else {
      setTargetQuery(query);
      setTargetWizardState(state);
      setShowTargetWizard(false);
    }

    toast({
      title: 'Query Generated',
      description: 'SQL query has been generated from your selection.',
    });
  };

  const handleRunComparison = async () => {
    // Comprehensive validation
    if (!sourceConnectionId) {
      toast({
        title: 'Missing Source Connection',
        description: 'Please select a source connection.',
        variant: 'destructive',
      });
      return;
    }

    if (!targetConnectionId) {
      toast({
        title: 'Missing Target Connection',
        description: 'Please select a target connection.',
        variant: 'destructive',
      });
      return;
    }

    if (!sourceQuery || !sourceQuery.trim()) {
      toast({
        title: 'Empty Source Query',
        description: 'Please enter a source query.',
        variant: 'destructive',
      });
      return;
    }

    if (!targetQuery || !targetQuery.trim()) {
      toast({
        title: 'Empty Target Query',
        description: 'Please enter a target query.',
        variant: 'destructive',
      });
      return;
    }

    if (!sourcePreview || !targetPreview) {
      toast({
        title: 'Missing Preview',
        description: 'Please run previews for both source and target queries before comparing.',
        variant: 'destructive',
      });
      return;
    }

    if (keyMapping.source.length === 0) {
      toast({
        title: 'Missing Key Mapping',
        description: 'Please configure at least one key mapping to identify matching rows.',
        variant: 'destructive',
      });
      return;
    }

    if (columnMapping.length === 0) {
      toast({
        title: 'Missing Column Mapping',
        description: 'Please configure column mappings to compare. Use Auto-Map for quick setup.',
        variant: 'destructive',
      });
      return;
    }

    setComparing(true);
    setProgress(0);
    setResults(null);

    const { data, error } = await compareApi.run({
      sourceQuery,
      targetQuery,
      sourceConnectionId,
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
        description: 'Your data comparison is now in progress. This may take a few moments.',
      });

      // Start polling for progress updates
      const stopPolling = pollComparisonStatus(
        compId,
        (progressData) => {
          setProgress(progressData.progress || 0);
        },
        (error) => {
          setComparing(false);
          toast({
            title: 'Comparison Failed',
            description: error,
            variant: 'destructive',
          });
        },
        (results) => {
          setComparing(false);
          setResults(results);
          toast({
            title: 'Comparison Complete',
            description: 'The comparison has finished successfully. Review the results below.',
          });
        }
      );
    }
  };

  const handleClearAll = () => {
    setSourceConnectionId('');
    setTargetConnectionId('');
    setSourceQuery('');
    setTargetQuery('');
    setSourcePreview(null);
    setTargetPreview(null);
    setKeyMapping({ source: [], target: [] });
    setColumnMapping([]);
    setResults(null);
    setComparisonId(null);
    setProgress(0);
    localStorage.removeItem('comparatorState');
    toast({
      title: 'Cleared',
      description: 'All fields have been reset.',
    });
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto py-8 px-6">
          <div className="max-w-7xl mx-auto">

            <header className="mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-sm">
                    <ArrowLeftRight className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                    DataCompare
                  </h1>
                </div>
                <p className="text-muted-foreground text-lg ml-14">
                  Compare and synchronize data between source and target databases
                </p>
              </div>

              {/* Save Query Name Dialog */}
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Query</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="query-name">Query Name</Label>
                      <Input
                        id="query-name"
                        value={saveQueryName}
                        onChange={(e) => setSaveQueryName(e.target.value)}
                        placeholder="Enter a name for your query"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleConfirmSave();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleConfirmSave}>
                      Save Query
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </header>

            <div className="w-full max-w-5xl mx-auto mb-6">
              <div className="grid w-full grid-cols-4 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                <button
                  onClick={() => setActiveTab('connections')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${activeTab === 'connections' ? 'bg-background text-foreground shadow-sm' : ''}`}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Connections
                </button>
                <button
                  onClick={() => setActiveTab('compare')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${activeTab === 'compare' ? 'bg-background text-foreground shadow-sm' : ''}`}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Compare
                </button>
                <button
                  onClick={() => setActiveTab('my-queries')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${activeTab === 'my-queries' ? 'bg-background text-foreground shadow-sm' : ''}`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  My Queries
                </button>
                <button
                  onClick={() => setActiveTab('comparison-history')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${activeTab === 'comparison-history' ? 'bg-background text-foreground shadow-sm' : ''}`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Comparison History
                </button>
              </div>
            </div>

            <div className="mt-6">
              {activeTab === 'connections' && (
                <ConnectionsPanel onConnectionSaved={loadSavedConnections} />
              )}

              {activeTab === 'compare' && (
                <div className="space-y-6">

                  {/* SQL Editors */}
                  {sourceConnectionId && targetConnectionId && sourceConnectionId === targetConnectionId && (
                    <Alert variant="destructive" className="mb-6">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warning</AlertTitle>
                      <AlertDescription>
                        You have selected the same connection for both source and target. While possible, ensure this is intentional.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Source Editor */}
                    <Card className="p-6 shadow-lg border-2 hover:shadow-xl transition-shadow">
                      <h2 className="text-xl font-semibold mb-4">Source Query</h2>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Label>Connection</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Select the database to query as your comparison source</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex gap-2">
                            <Select value={sourceConnectionId} onValueChange={setSourceConnectionId}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select source connection" />
                              </SelectTrigger>
                              <SelectContent>
                                {savedConnections.map((conn) => (
                                  <SelectItem key={conn.id} value={conn.id}>
                                    {conn.name} ({conn.type} - {conn.host})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenWizard('source')}
                              disabled={!sourceConnectionId}
                              title="Open Query Builder"
                            >
                              <Wand2 className="h-4 w-4" />
                            </Button>
                            {sourceWizardState && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenWizard('source')}
                                className="ml-2"
                              >
                                Edit Query
                              </Button>
                            )}
                          </div>
                        </div>

                        <Dialog open={showSourceWizard} onOpenChange={setShowSourceWizard}>
                          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Query Builder - Source</DialogTitle>
                            </DialogHeader>
                            <QueryBuilderWizard
                              databaseTree={wizardDatabaseTree}
                              onGenerateQuery={(query, state) => {
                                handleWizardGenerateQuery(query, state, 'source');
                              }}
                              onClose={() => setShowSourceWizard(false)}
                              initialState={sourceWizardState}
                              connectionType={savedConnections.find(c => c.id === sourceConnectionId)?.type}
                            />
                          </DialogContent>
                        </Dialog>

                        <SqlEditor
                          value={sourceQuery}
                          onChange={setSourceQuery}
                          onRun={handleSourcePreview}
                          onSave={() => handleSaveQuery('source')}
                          loading={loadingSourcePreview}
                          label="SQL Query"
                        />
                        {sourcePreview && (
                          <QueryResultsTable
                            columns={sourcePreview.columns}
                            rows={sourcePreview.rows}
                            title="Source Preview"
                          />
                        )}
                      </div>
                    </Card>

                    {/* Target Editor */}
                    <Card className="p-6 shadow-lg border-2 hover:shadow-xl transition-shadow">
                      <h2 className="text-xl font-semibold mb-4">Target Query</h2>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Label>Connection</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Select the database to query as your comparison target</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex gap-2">
                            <Select value={targetConnectionId} onValueChange={setTargetConnectionId}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select target connection" />
                              </SelectTrigger>
                              <SelectContent>
                                {savedConnections.map((conn) => (
                                  <SelectItem key={conn.id} value={conn.id}>
                                    {conn.name} ({conn.type} - {conn.host})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenWizard('target')}
                              disabled={!targetConnectionId}
                              title="Open Query Builder"
                            >
                              <Wand2 className="h-4 w-4" />
                            </Button>
                            {targetWizardState && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenWizard('target')}
                                className="ml-2"
                              >
                                Edit Query
                              </Button>
                            )}
                          </div>
                        </div>

                        <Dialog open={showTargetWizard} onOpenChange={setShowTargetWizard}>
                          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Query Builder - Target</DialogTitle>
                            </DialogHeader>
                            <QueryBuilderWizard
                              databaseTree={wizardDatabaseTree}
                              onGenerateQuery={(query, state) => {
                                handleWizardGenerateQuery(query, state, 'target');
                              }}
                              onClose={() => setShowTargetWizard(false)}
                              initialState={targetWizardState}
                              connectionType={savedConnections.find(c => c.id === targetConnectionId)?.type}
                            />
                          </DialogContent>
                        </Dialog>

                        <SqlEditor
                          value={targetQuery}
                          onChange={setTargetQuery}
                          onRun={handleTargetPreview}
                          onSave={() => handleSaveQuery('target')}
                          loading={loadingTargetPreview}
                          label="SQL Query"
                        />
                        {targetPreview && (
                          <QueryResultsTable
                            columns={targetPreview.columns}
                            rows={targetPreview.rows}
                            title="Target Preview"
                          />
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Mapping Configuration */}
                  <Card className="p-6 mb-6 shadow-lg border-2 hover:shadow-xl transition-shadow">
                    <h2 className="text-xl font-semibold mb-4">
                      Mapping Configuration
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure how source and target columns should be matched for comparison
                    </p>
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">Key Mapping</h3>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Define which columns uniquely identify matching rows between source and target</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <KeyMapping
                          sourceColumns={sourcePreview?.columns || []}
                          targetColumns={targetPreview?.columns || []}
                          value={keyMapping}
                          onChange={setKeyMapping}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">Column Mapping</h3>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Map columns to compare. Use Auto-Map to automatically match columns with the same names</p>
                            </TooltipContent>
                          </Tooltip>
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

                  {/* Comparison Controls */}
                  <Card className="p-6 mb-6 shadow-lg border-2 hover:shadow-xl transition-shadow">
                    <h2 className="text-xl font-semibold mb-4">Comparison Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label>Compare Mode</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Full: Compare all rows | Sample: Compare a subset for faster results</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select value={compareMode} onValueChange={(v: any) => setCompareMode(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full Comparison</SelectItem>
                            <SelectItem value="sample">Sample Comparison</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label>Chunk Size</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Number of rows to process at once (larger = more memory)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="number"
                          value={chunkSize}
                          onChange={(e) => setChunkSize(e.target.value)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label>Numeric Tolerance</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Acceptable difference for numeric comparisons (e.g., 0.001 for rounding)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="number"
                          step="0.001"
                          value={numericTolerance}
                          onChange={(e) => setNumericTolerance(e.target.value)}
                        />
                      </div>
                      {compareMode === 'sample' && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Label>Sample Size</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Number of rows to randomly sample for comparison</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Input
                            type="number"
                            value={sampleSize}
                            onChange={(e) => setSampleSize(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      <Button
                        size="lg"
                        onClick={handleRunComparison}
                        disabled={comparing}
                        className="w-full md:w-auto"
                      >
                        {comparing ? (
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-5 w-5 mr-2" />
                        )}
                        Run Comparison
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="lg"
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear All
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Clear All Data?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will clear all your current selections, queries, mappings, and results. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Execute the comparison between source and target data</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {comparing && (
                      <div className="mt-4">
                        <Label>Progress: {Math.round(progress)}%</Label>
                        <Progress value={progress} className="mt-2" />
                      </div>
                    )}
                  </Card>

                  {/* Results Section - Always visible */}
                  <div ref={resultsRef}>
                    <Card className="p-6 shadow-lg border-2 hover:shadow-xl transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold">Results</h2>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Detailed comparison results will appear here after running the comparison</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {results && comparisonId ? (
                        <ComparisonResults comparisonId={comparisonId} results={results} />
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <p className="text-lg mb-2">No results yet</p>
                          <p className="text-sm">Run a comparison to see detailed results here</p>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'my-queries' && (
                <Card className="p-6">
                  <MyQueries
                    savedQueries={savedQueries}
                    onQuerySelect={(query) => {
                      setSourceQuery(query);
                      toast({
                        title: 'Query Loaded',
                        description: 'Query loaded into source editor',
                      });
                    }}
                    onRefreshSaved={loadSavedQueries}
                  />
                </Card>
              )}

              {activeTab === 'comparison-history' && (
                <Card className="p-6">
                  <ComparisonHistory />
                </Card>
              )}
            </div>
          </div>
        </div>
      </div >
    </TooltipProvider >
  );
}
