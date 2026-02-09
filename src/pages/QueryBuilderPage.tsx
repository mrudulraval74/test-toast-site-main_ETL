import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SqlEditor } from '@/components/SqlEditor';
import { QueryBuilderWizard } from '@/components/QueryBuilderWizard';
import { QueryResultsTable } from '@/components/QueryResultsTable';
import { HelpTooltip } from '@/components/HelpTooltip';
import { connectionsApi, queriesApi, API_BASE_URL } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { helpContent } from '@/lib/helpContent';
import { Wand2, Save, Play, Loader2, FileCode, Folder, ChevronRight, ChevronDown, FileText, Trash2, Database, AlertTriangle, History, Code2, Lightbulb, Sparkles } from 'lucide-react';
import { AIButton } from '@/components/AIButton';
import { AIResponseModal } from '@/components/AIResponseModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { FolderPlus, Lock, AlertCircle } from 'lucide-react';
import type { Connection, SavedQuery, FolderNode, QueryHistoryItem, QueryValidationResult } from '@/types';


// Utility: SQL Formatter (simple version)
const formatSQL = (sql: string): string => {
    return sql
        .replace(/\bSELECT\b/gi, 'SELECT')
        .replace(/\bFROM\b/gi, '\nFROM')
        .replace(/\bWHERE\b/gi, '\nWHERE')
        .replace(/\bAND\b/gi, '\n  AND')
        .replace(/\bOR\b/gi, '\n  OR')
        .replace(/\bJOIN\b/gi, '\nJOIN')
        .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
        .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
        .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
        .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
        .replace(/\bORDER BY\b/gi, '\nORDER BY')
        .replace(/\bLIMIT\b/gi, '\nLIMIT')
        .trim();
};

// Utility: Query Validation
const validateQuery = (sql: string): QueryValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const upperSQL = sql.toUpperCase();

    if (upperSQL.includes('DROP TABLE') || upperSQL.includes('DROP DATABASE')) {
        warnings.push('⚠️ Query contains DROP statement - this will permanently delete data!');
    }
    if (upperSQL.includes('DELETE FROM') && !upperSQL.includes('WHERE')) {
        warnings.push('⚠️ DELETE without WHERE clause - this will delete ALL rows!');
    }
    if (upperSQL.includes('UPDATE') && !upperSQL.includes('WHERE')) {
        warnings.push('⚠️ UPDATE without WHERE clause - this will update ALL rows!');
    }
    if (upperSQL.includes('TRUNCATE')) {
        warnings.push('⚠️ TRUNCATE will delete all rows from the table!');
    }

    return { valid: errors.length === 0, warnings, errors };
};

// Utility: Query History Management
const QUERY_HISTORY_KEY = 'query_builder_history';
const MAX_HISTORY_ITEMS = 10;

const saveToHistory = (query: string, connectionId: string, connectionName: string) => {
    try {
        const history: QueryHistoryItem[] = JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || '[]');
        const newItem: QueryHistoryItem = {
            query,
            timestamp: Date.now(),
            connectionId,
            connectionName
        };
        const updated = [newItem, ...history.filter(h => h.query !== query)].slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to save query history:', e);
    }
};

const loadHistory = (): QueryHistoryItem[] => {
    try {
        return JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || '[]');
    } catch (e) {
        return [];
    }
};

export default function QueryBuilderPage() {
    const { toast } = useToast();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [connectionId, setConnectionId] = useState('');
    const [databaseTree, setDatabaseTree] = useState<any[]>([]);
    const [loadingTree, setLoadingTree] = useState(false);

    const [query, setQuery] = useState('');
    const [previewResults, setPreviewResults] = useState<any>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const [showWizard, setShowWizard] = useState(false);
    const [wizardState, setWizardState] = useState<any>(null);

    // Save Dialog State
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveQueryName, setSaveQueryName] = useState('');
    const [saveFolderName, setSaveFolderName] = useState('');
    const [savingQuery, setSavingQuery] = useState(false);
    const [existingFolders, setExistingFolders] = useState<string[]>([]);

    // Saved Queries State
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

    // New Features State
    const [previewLimit, setPreviewLimit] = useState(100);
    const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const [queryWarnings, setQueryWarnings] = useState<string[]>([]);

    // Create Folder Dialog State
    const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
    const [newFolderPath, setNewFolderPath] = useState('');
    const [createFolderParent, setCreateFolderParent] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);

    // AI State
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiModalTitle, setAiModalTitle] = useState('');
    const [aiModalContent, setAiModalContent] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAction, setAiAction] = useState<string | null>(null);

    useEffect(() => {
        loadConnections();
        loadSavedQueries();
        setQueryHistory(loadHistory());
    }, []);

    useEffect(() => {
        // Reset state when connection changes
        setQuery('');
        setPreviewResults(null);
        setWizardState(null);
        setQueryWarnings([]);

        if (connectionId && connectionId !== 'no-selection') {
            loadDatabaseTree(connectionId);
        } else {
            setDatabaseTree([]);
        }
    }, [connectionId]);

    // Handle URL query parameters for deep linking
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const queryIdParam = params.get('queryId');

        if (queryIdParam && savedQueries.length > 0) {
            const queryToLoad = savedQueries.find(q => q.id === queryIdParam);
            if (queryToLoad) {
                handleLoadQuery(queryToLoad);
                // Optional: Clear the param so refreshing doesn't reload it if user navigates away? 
                // For now, keeping it is fine.
            }
        }
    }, [savedQueries]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+Enter: Run query
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleRunPreview();
            }
            // Ctrl+S: Save query
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (query.trim()) {
                    setShowSaveDialog(true);
                }
            }
            // Ctrl+K: Open visual builder
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                if (connectionId) {
                    setShowWizard(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [query, connectionId]);

    const loadConnections = async () => {
        const { data, error } = await connectionsApi.list();
        if (error) {
            toast({
                title: 'Failed to Load Connections',
                description: error,
                variant: 'destructive',
            });
            return;
        }
        if (data && Array.isArray(data)) {
            setConnections(data);
        }
    };

    const loadSavedQueries = async () => {
        const { data, error } = await queriesApi.list();
        if (error) {
            toast({
                title: 'Failed to Load Saved Queries',
                description: error,
                variant: 'destructive',
            });
            return;
        }
        if (data && Array.isArray(data)) {
            setSavedQueries(data);
            // Extract unique folders
            const folders = Array.from(new Set((data as any[]).map(q => q.folder).filter(Boolean))) as string[];
            setExistingFolders(folders);
        }
    };

    const loadDatabaseTree = async (connId: string) => {
        setLoadingTree(true);
        const { data, error } = await connectionsApi.metadata(connId);
        setLoadingTree(false);
        if (error) {
            toast({
                title: 'Error fetching schema',
                description: error,
                variant: 'destructive',
            });
        } else if (data) {
            setDatabaseTree((data as any).databases || []);
        }
    };

    const handleRunPreview = async () => {
        if (!query.trim() || !connectionId) return;

        // Validate query
        const validation = validateQuery(query);
        setQueryWarnings(validation.warnings);

        setLoadingPreview(true);
        const { data, error } = await queriesApi.preview({
            connectionId,
            sql: query,
            limit: previewLimit
        });
        setLoadingPreview(false);

        if (error) {
            toast({
                title: 'Preview Failed',
                description: error,
                variant: 'destructive',
            });
            setPreviewResults(null);
        } else if (data) {
            setPreviewResults(data);
            toast({
                title: 'Preview Successful',
                description: `Fetched ${(data as any).rows?.length || 0} rows.`,
            });

            // Save to history
            const conn = connections.find(c => c.id === connectionId);
            if (conn) {
                saveToHistory(query, connectionId, conn.name);
                setQueryHistory(loadHistory());
            }
        }
    };

    const handleSaveQuery = async () => {
        if (!saveQueryName.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Please enter a name for the query.',
                variant: 'destructive',
            });
            return;
        }

        setSavingQuery(true);
        const { error } = await queriesApi.save({
            name: saveQueryName,
            sql: query,
            connectionId,
            folder: saveFolderName || undefined
        });
        setSavingQuery(false);

        if (error) {
            toast({
                title: 'Save Failed',
                description: error,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Query Saved',
                description: 'Your query has been saved successfully.',
            });
            setShowSaveDialog(false);
            setSaveQueryName('');
            setSaveFolderName('');
            loadSavedQueries(); // Refresh list
        }
    };

    const handleWizardGenerate = (generatedQuery: string, state: any) => {
        setQuery(generatedQuery);
        setWizardState(state);
        setShowWizard(false);
    };

    const handleFormatQuery = () => {
        if (query.trim()) {
            setQuery(formatSQL(query));
            toast({
                title: 'Query Formatted',
                description: 'SQL query has been formatted.',
            });
        }
    };

    const handleLoadFromHistory = (historyItem: QueryHistoryItem) => {
        setQuery(historyItem.query);
        setConnectionId(historyItem.connectionId);
        setShowHistory(false);
        toast({
            title: 'Query Loaded from History',
            description: `Loaded query from ${new Date(historyItem.timestamp).toLocaleString()}`,
        });
    };

    const toggleFolder = (folder: string) => {
        setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
    };

    const handleLoadQuery = (savedQuery: any) => {
        setQuery(savedQuery.query);
        setConnectionId(savedQuery.connection_id);
        toast({
            title: 'Query Loaded',
            description: `Loaded "${savedQuery.name}"`,
        });
    };

    const selectedConnection = connections.find(c => c.id === connectionId);

    // Filter by selected connection, or show all if no connection selected
    const filteredSavedQueries = connectionId
        ? savedQueries.filter(q => q.connection_id === connectionId)
        : savedQueries;

    // Build folder tree (memoized for performance)
    const buildFolderTree = useCallback((queries: SavedQuery[]): FolderNode => {
        const root: FolderNode = { name: 'root', children: {}, queries: [] };

        queries.forEach(q => {
            if (!q.folder) {
                if (q.name !== '.folder_placeholder') {
                    root.queries.push(q);
                }
            } else {
                const parts = q.folder.split('/');
                let current = root;
                parts.forEach((part: string) => {
                    if (!current.children[part]) {
                        current.children[part] = { name: part, children: {}, queries: [] };
                    }
                    current = current.children[part];
                });
                if (q.name !== '.folder_placeholder') {
                    current.queries.push(q);
                }
            }
        });

        return root;
    }, []);

    const folderTree = useMemo(() => buildFolderTree(filteredSavedQueries), [filteredSavedQueries, buildFolderTree]);

    // Group folders by connection for display (memoized)
    const foldersByConnection = useMemo(() => {
        return connections.reduce((acc: any, conn: Connection) => {
            const connQueries = savedQueries.filter(q => q.connection_id === conn.id);
            if (connQueries.length > 0) {
                acc[conn.id] = {
                    connection: conn,
                    tree: buildFolderTree(connQueries)
                };
            }
            return acc;
        }, {});
    }, [connections, savedQueries, buildFolderTree]);

    const handleDeleteQuery = async (queryId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent loading the query when clicking delete
        if (!confirm('Are you sure you want to delete this query?')) return;

        const { error } = await queriesApi.delete(queryId);
        if (error) {
            toast({
                title: 'Delete Failed',
                description: error,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Query Deleted',
                description: 'The query has been deleted successfully.',
            });
            loadSavedQueries();
        }
    };

    const handleCreateFolder = async () => {
        let finalPath = newFolderPath.trim();

        if (createFolderParent && createFolderParent !== 'root') {
            finalPath = `${createFolderParent}/${finalPath}`;
        }

        if (!finalPath) {
            toast({
                title: 'Validation Error',
                description: 'Please enter a folder name.',
                variant: 'destructive',
            });
            return;
        }

        if (!connectionId) {
            toast({
                title: 'Validation Error',
                description: 'Please select a connection first.',
                variant: 'destructive',
            });
            return;
        }

        setCreatingFolder(true);
        // Create a placeholder query to establish the folder structure
        // We DO NOT delete this query anymore, so the folder persists even if empty
        const { error } = await queriesApi.save({
            name: '.folder_placeholder',
            sql: '-- Folder placeholder',
            connectionId,
            folder: finalPath
        });

        if (error) {
            toast({
                title: 'Folder Creation Failed',
                description: error,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Folder Created',
                description: `Folder "${finalPath}" has been created.`,
            });
            setShowCreateFolderDialog(false);
            setNewFolderPath('');
            setCreateFolderParent('');
            loadSavedQueries();
        }
        setCreatingFolder(false);
    };

    const handleAIAction = async (actionType: 'optimize' | 'explain') => {
        if (!query.trim()) {
            toast({
                title: 'Empty Query',
                description: 'Please enter a query first.',
                variant: 'destructive',
            });
            return;
        }

        setAiAction(actionType);
        setAiLoading(true);
        setAiModalOpen(true);
        setAiModalTitle(actionType === 'optimize' ? 'Query Optimization' : 'Query Explanation');
        setAiModalContent('');

        try {
            const prompt = actionType === 'optimize'
                ? `Optimize this SQL query for better performance:\n\n${query}`
                : `Explain this SQL query in simple terms:\n\n${query}`;

            const response = await fetch(`${API_BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    context: 'query-builder',
                    history: [],
                    contextData: { query, connectionId }
                })
            });

            const data = await response.json();
            if (data.success) {
                setAiModalContent(data.response);
            } else {
                setAiModalContent('Failed to get AI response.');
                toast({
                    title: 'AI Error',
                    description: data.error || 'Failed to process request',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            setAiModalContent('An error occurred while communicating with AI.');
            console.error('AI Error:', error);
        } finally {
            setAiLoading(false);
            setAiAction(null);
        }
    };

    // Recursive Folder Component
    const FolderItem = ({ name, node, path }: { name: string, node: any, path: string }) => {
        const fullPath = path ? `${path}/${name}` : name;
        const isOpen = openFolders[fullPath];

        const handleCreateSubfolder = (e: any) => {
            e.preventDefault();
            setCreateFolderParent(fullPath);
            setNewFolderPath('');
            setShowCreateFolderDialog(true);
        };

        const handleDeleteFolder = async (e: any) => {
            e.preventDefault();
            if (!confirm(`Are you sure you want to delete folder "${name}" and all its contents?`)) return;

            // Find all queries in this folder (including subfolders)
            // Note: We don't filter by connectionId here because folders can contain
            // queries from any connection, and we want to delete ALL contents
            const queriesToDelete = savedQueries.filter(q =>
                q.folder === fullPath || q.folder?.startsWith(fullPath + '/')
            );

            // Deleting folder and all its contents

            let errorCount = 0;
            for (const q of queriesToDelete) {
                const { error } = await queriesApi.delete(q.id);
                if (error) {
                    // Failed to delete query
                    errorCount++;
                }
            }

            if (errorCount > 0) {
                toast({
                    title: 'Delete Completed with Errors',
                    description: `Failed to delete ${errorCount} items.`,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Folder Deleted',
                    description: `Folder "${name}" deleted successfully.`,
                });
            }
            loadSavedQueries();
        };

        return (
            <ContextMenu>
                <ContextMenuTrigger>
                    <Collapsible
                        open={isOpen}
                        onOpenChange={() => setOpenFolders(prev => ({ ...prev, [fullPath]: !prev[fullPath] }))}
                        className="mb-1"
                    >
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-start p-2 h-auto font-medium hover:bg-muted/50">
                                {isOpen ? <ChevronDown className="h-4 w-4 mr-2 shrink-0" /> : <ChevronRight className="h-4 w-4 mr-2 shrink-0" />}
                                <Folder className="h-4 w-4 mr-2 shrink-0 text-blue-500" />
                                <span className="truncate">{name}</span>
                                <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 rounded-full">
                                    {Object.keys(node.children).length + node.queries.length}
                                </span>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 border-l ml-2 space-y-1 mt-1">
                            {/* Render Subfolders */}
                            {Object.entries(node.children).map(([childName, childNode]: [string, any]) => (
                                <FolderItem key={childName} name={childName} node={childNode} path={fullPath} />
                            ))}
                            {/* Render Queries */}
                            {node.queries.map((q: any) => (
                                <div key={q.id} className="flex items-center group">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 justify-start h-auto py-1 text-sm truncate hover:bg-muted/50"
                                        onClick={() => handleLoadQuery(q)}
                                        title={q.name}
                                    >
                                        <FileText className="h-3 w-3 mr-2 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{q.name}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => handleDeleteQuery(q.id, e)}
                                        title="Delete Query"
                                    >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={handleCreateSubfolder}>
                        <FolderPlus className="h-4 w-4 mr-2" />
                        New Subfolder
                    </ContextMenuItem>
                    <ContextMenuItem onClick={handleDeleteFolder} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Folder
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 p-8">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* Header */}
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                            <FileCode className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                Query Builder
                            </h1>
                            <p className="text-muted-foreground">Build, test, and save queries for comparison</p>
                        </div>
                    </div>
                </header>

                {/* Quick Tips */}
                <Alert className="bg-primary/5 border-primary/20">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                        <strong>Quick Tip:</strong> Use the Visual Builder if you're not familiar with SQL syntax.
                        Save frequently used queries to avoid rewriting them. Press Ctrl+Enter to run, Ctrl+S to save.
                    </AlertDescription>
                </Alert>



                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Sidebar - Saved Queries Only */}
                    <div className="lg:col-span-3 space-y-4">
                        <Card className="p-4 h-[calc(100vh-200px)] flex flex-col shadow-md">
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <Folder className="h-4 w-4" /> Saved Queries
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => {
                                                setCreateFolderParent('');
                                                setNewFolderPath('');
                                                setShowCreateFolderDialog(true);
                                            }}
                                            disabled={!connectionId}
                                            title="Create New Folder"
                                        >
                                            <FolderPlus className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            {savedQueries.length} total
                                        </span>
                                    </div>
                                </div>

                                {!connectionId && (
                                    <Alert className="mb-4 py-2">
                                        <AlertDescription className="text-xs">
                                            Select a connection to create folders, or browse all below.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <ScrollArea className="flex-1 pr-4">
                                    {/* When no connection selected: Show folders grouped by connection */}
                                    {!connectionId && Object.entries(foldersByConnection).map(([connId, data]: [string, any]) => (
                                        <div key={connId} className="mb-4">
                                            <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-muted/30 rounded">
                                                <Database className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {data.connection.name}
                                                </span>
                                            </div>

                                            {/* Root Level Folders for this connection */}
                                            {Object.entries(data.tree.children).map(([name, node]: [string, any]) => (
                                                <FolderItem key={name} name={name} node={node} path="" />
                                            ))}

                                            {/* Root Level Queries for this connection */}
                                            {data.tree.queries.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {data.tree.children && Object.keys(data.tree.children).length > 0 && <Separator className="my-2" />}
                                                    {data.tree.queries.map((q: any) => (
                                                        <div key={q.id} className="flex items-center group">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="flex-1 justify-start h-auto py-1 text-sm truncate hover:bg-muted/50"
                                                                onClick={() => handleLoadQuery(q)}
                                                                title={q.name}
                                                            >
                                                                <FileText className="h-3 w-3 mr-2 shrink-0 text-muted-foreground" />
                                                                <span className="truncate">{q.name}</span>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => handleDeleteQuery(q.id, e)}
                                                                title="Delete Query"
                                                            >
                                                                <Trash2 className="h-3 w-3 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* When connection selected: Show flat folder view for that connection */}
                                    {connectionId && (
                                        <>
                                            {/* Root Level Folders */}
                                            {Object.entries(folderTree.children).map(([name, node]: [string, any]) => (
                                                <FolderItem key={name} name={name} node={node} path="" />
                                            ))}

                                            {/* Root Level Queries */}
                                            {folderTree.queries.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {folderTree.children && Object.keys(folderTree.children).length > 0 && <Separator className="my-2" />}
                                                    {folderTree.queries.map((q: any) => (
                                                        <div key={q.id} className="flex items-center group">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="flex-1 justify-start h-auto py-1 text-sm truncate hover:bg-muted/50"
                                                                onClick={() => handleLoadQuery(q)}
                                                                title={q.name}
                                                            >
                                                                <FileText className="h-3 w-3 mr-2 shrink-0 text-muted-foreground" />
                                                                <span className="truncate">{q.name}</span>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => handleDeleteQuery(q.id, e)}
                                                                title="Delete Query"
                                                            >
                                                                <Trash2 className="h-3 w-3 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {filteredSavedQueries.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">No saved queries for this connection.</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {!connectionId && Object.keys(foldersByConnection).length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No saved queries yet.</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </Card>
                    </div>

                    {/* Main Content - Editor & Results */}
                    <div className="lg:col-span-9 space-y-6">
                        <Card className="p-6 shadow-lg border-2">
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold">SQL Editor</h2>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowWizard(true)}
                                            disabled={!connectionId}
                                            title="Build queries visually without writing SQL (Ctrl+K)"
                                        >
                                            <Wand2 className="h-4 w-4 mr-2" />
                                            Visual Builder
                                        </Button>
                                        <AIButton
                                            onClick={() => handleAIAction('optimize')}
                                            label="Optimize"
                                            isLoading={aiAction === 'optimize'}
                                            disabled={!query.trim() || aiLoading}
                                            tooltip="Get AI suggestions to improve query performance"
                                        />
                                        <AIButton
                                            onClick={() => handleAIAction('explain')}
                                            label="Explain"
                                            isLoading={aiAction === 'explain'}
                                            disabled={!query.trim() || aiLoading}
                                            tooltip="Get an AI explanation of what this query does"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowSaveDialog(true)}
                                            disabled={!query.trim()}
                                            title="Save query for later use (Ctrl+S)"
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            Save
                                        </Button>
                                        <Button
                                            onClick={handleRunPreview}
                                            disabled={!query.trim() || loadingPreview || !connectionId}
                                            title="Execute query (Ctrl+Enter)"
                                        >
                                            {loadingPreview ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Play className="h-4 w-4 mr-2" />
                                            )}
                                            Run
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleFormatQuery}
                                            disabled={!query.trim()}
                                            title="Format SQL"
                                        >
                                            <Code2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowHistory(true)}
                                            title="Query History"
                                        >
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Select value={previewLimit.toString()} onValueChange={(v) => setPreviewLimit(Number(v))}>
                                            <SelectTrigger className="w-[80px]">
                                                <SelectValue placeholder="Limit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                                <SelectItem value="500">500</SelectItem>
                                                <SelectItem value="1000">1000</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-1/3">
                                        <Select value={connectionId} onValueChange={(val) => setConnectionId(val === 'no-selection' ? '' : val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select connection" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="no-selection">Select connection</SelectItem>
                                                {connections.map(conn => (
                                                    <SelectItem key={conn.id} value={conn.id}>
                                                        {conn.name} ({conn.type})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {queryWarnings.length > 0 && (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        <ul className="list-disc list-inside text-xs">
                                            {queryWarnings.map((warning, i) => (
                                                <li key={i}>{warning}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Embedded AI Input */}


                            <SqlEditor
                                value={query}
                                onChange={setQuery}
                                loading={loadingPreview}
                                label="Write your SQL query here"
                            />
                        </Card>

                        {previewResults && (
                            <Card className="p-6 shadow-lg border-2">
                                <QueryResultsTable
                                    columns={previewResults.columns}
                                    rows={previewResults.rows}
                                    title="Query Results"
                                />
                            </Card>
                        )}
                    </div>
                </div>

                {/* Visual Builder Dialog */}
                <Dialog open={showWizard} onOpenChange={setShowWizard}>
                    <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Visual Query Builder</DialogTitle>
                        </DialogHeader>
                        <QueryBuilderWizard
                            databaseTree={databaseTree}
                            onGenerateQuery={handleWizardGenerate}
                            onClose={() => setShowWizard(false)}
                            initialState={wizardState}
                            connectionType={selectedConnection?.type}
                        />
                    </DialogContent>
                </Dialog>

                {/* Save Dialog */}
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
                                    placeholder="e.g., Monthly Sales Report"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="folder-name">Folder (Optional)</Label>
                                <div className="flex gap-2">
                                    <Select value={saveFolderName} onValueChange={setSaveFolderName}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select existing folder" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                                            {existingFolders.map(folder => (
                                                <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">Or create new</span>
                                    </div>
                                </div>
                                <Input
                                    placeholder="Folder path (e.g., Marketing/Q1 or Reports/Sales)"
                                    value={saveFolderName}
                                    onChange={(e) => setSaveFolderName(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    💡 Use "/" to create nested folders (e.g., "Parent/Child/Grandchild")
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
                            <Button onClick={handleSaveQuery} disabled={savingQuery}>
                                {savingQuery && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Folder Dialog */}
                <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Folder</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm text-muted-foreground">
                                    <Folder className="h-4 w-4" />
                                    <span>
                                        {createFolderParent && createFolderParent !== 'root' ? createFolderParent : 'Root (Top Level)'}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="folder-path">Folder Name</Label>
                                <Input
                                    id="folder-path"
                                    value={newFolderPath}
                                    onChange={(e) => setNewFolderPath(e.target.value)}
                                    placeholder="e.g., Sales"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>Cancel</Button>
                            <Button onClick={handleCreateFolder} disabled={creatingFolder}>
                                {creatingFolder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Create Folder
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Query History Dialog */}
                <Dialog open={showHistory} onOpenChange={setShowHistory}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Query History</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {queryHistory.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No query history yet.</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2 pr-4">
                                        {queryHistory.map((item, i) => (
                                            <Card key={i} className="p-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleLoadFromHistory(item)}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-xs">
                                                            {item.connectionName}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(item.timestamp).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
                                                    {item.query}
                                                </pre>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
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
    );
}
