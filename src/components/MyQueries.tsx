import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, Star, StarOff, Save, Edit2, Trash2, FileText, History, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queriesApi } from '@/lib/api';

interface QueryHistoryItem {
    id: string;
    query: string;
    timestamp: number;
    connectionId?: string;
    connectionName?: string;
}

interface SavedQuery {
    id: string;
    name: string;
    query: string;
    connection_id: string | null;
    created_at: string;
    updated_at: string;
}

interface MyQueriesProps {
    savedQueries: SavedQuery[];
    onQuerySelect: (query: string) => void;
    onRefreshSaved: () => void;
}

const HISTORY_KEY = 'query-history';
const FAVORITES_KEY = 'query-favorites';
const MAX_RECENT = 20;

export function MyQueries({ savedQueries, onQuerySelect, onRefreshSaved }: MyQueriesProps) {
    const { toast } = useToast();
    const [recentQueries, setRecentQueries] = useState<QueryHistoryItem[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Save dialog state
    const [savingQuery, setSavingQuery] = useState<string | null>(null);
    const [saveName, setSaveName] = useState('');
    const [saving, setSaving] = useState(false);

    // Edit dialog state
    const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
    const [editName, setEditName] = useState('');
    const [editSql, setEditSql] = useState('');

    // Delete confirmation
    const [deletingQuery, setDeletingQuery] = useState<SavedQuery | null>(null);

    useEffect(() => {
        loadRecent();
        loadFavorites();
    }, []);

    const loadRecent = () => {
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setRecentQueries(parsed.slice(0, MAX_RECENT));
            }
        } catch (error) {
            console.error('Failed to load recent queries:', error);
        }
    };

    const loadFavorites = () => {
        try {
            const stored = localStorage.getItem(FAVORITES_KEY);
            if (stored) {
                setFavorites(new Set(JSON.parse(stored)));
            }
        } catch (error) {
            console.error('Failed to load favorites:', error);
        }
    };

    const toggleFavorite = (queryId: string) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(queryId)) {
            newFavorites.delete(queryId);
        } else {
            newFavorites.add(queryId);
        }
        setFavorites(newFavorites);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
    };

    const removeRecent = (id: string) => {
        const updated = recentQueries.filter(q => q.id !== id);
        setRecentQueries(updated);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    };

    const clearRecent = () => {
        setRecentQueries([]);
        localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
        toast({ title: 'Recent Cleared', description: 'Recent queries have been cleared.' });
    };

    const handleSaveRecent = async () => {
        if (!savingQuery || !saveName) return;

        setSaving(true);
        const { error } = await queriesApi.save({
            name: saveName,
            sql: savingQuery,
            connectionId: null,
        });
        setSaving(false);

        if (error) {
            toast({ title: 'Save Failed', description: error, variant: 'destructive' });
        } else {
            toast({ title: 'Query Saved', description: 'Query has been saved successfully.' });
            setSavingQuery(null);
            setSaveName('');
            onRefreshSaved();
        }
    };

    const handleEditSaved = async () => {
        if (!editingQuery) return;

        setSaving(true);
        const { error } = await queriesApi.update(editingQuery.id, {
            name: editName,
            query: editSql,
        });
        setSaving(false);

        if (error) {
            toast({ title: 'Update Failed', description: error, variant: 'destructive' });
        } else {
            toast({ title: 'Query Updated', description: 'Query has been updated successfully.' });
            setEditingQuery(null);
            onRefreshSaved();
        }
    };

    const handleDeleteSaved = async () => {
        if (!deletingQuery) return;

        const { error } = await queriesApi.delete(deletingQuery.id);

        if (error) {
            toast({ title: 'Delete Failed', description: error, variant: 'destructive' });
        } else {
            toast({ title: 'Query Deleted', description: 'Query has been deleted successfully.' });
            favorites.delete(deletingQuery.id);
            setFavorites(new Set(favorites));
            localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
            setDeletingQuery(null);
            onRefreshSaved();
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const filterQueries = (queries: any[]) => {
        if (!searchQuery) return queries;
        const search = searchQuery.toLowerCase();
        return queries.filter(q =>
            (q.name?.toLowerCase().includes(search)) ||
            (q.query.toLowerCase().includes(search))
        );
    };

    const favoriteQueries = savedQueries.filter(q => favorites.has(q.id));

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search queries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                    />
                </div>

                <Tabs defaultValue="recent" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="recent" className="gap-2">
                            <History className="h-4 w-4" />
                            Recent ({recentQueries.length})
                        </TabsTrigger>
                        <TabsTrigger value="saved" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Saved ({savedQueries.length})
                        </TabsTrigger>
                        <TabsTrigger value="favorites" className="gap-2">
                            <Star className="h-4 w-4" />
                            Favorites ({favoriteQueries.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="recent" className="mt-4">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-sm text-muted-foreground">Auto-saved recent queries (last {MAX_RECENT})</p>
                            {recentQueries.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearRecent}>Clear All</Button>
                            )}
                        </div>
                        <ScrollArea className="h-[500px]">
                            <div className="space-y-2 pr-4">
                                {filterQueries(recentQueries).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                        <History className="h-8 w-8 mb-2" />
                                        <p className="text-sm">{searchQuery ? 'No matching queries' : 'No recent queries yet'}</p>
                                    </div>
                                ) : (
                                    filterQueries(recentQueries).map((item) => (
                                        <Card key={item.id} className="p-3 hover:bg-accent/50 transition-colors">
                                            <div className="flex items-start gap-2">
                                                <button onClick={() => onQuerySelect(item.query)} className="flex-1 text-left">
                                                    <p className="text-xs font-mono line-clamp-2 mb-2">{item.query}</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            {formatTimestamp(item.timestamp)}
                                                        </div>
                                                        {item.connectionName && (
                                                            <Badge variant="outline" className="text-xs">{item.connectionName}</Badge>
                                                        )}
                                                    </div>
                                                </button>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => { setSavingQuery(item.query); setSaveName(''); }}
                                                        className="h-7 w-7 p-0"
                                                        title="Save permanently"
                                                    >
                                                        <Save className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeRecent(item.id)}
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="saved" className="mt-4">
                        <p className="text-sm text-muted-foreground mb-3">Permanently saved queries with names</p>
                        <ScrollArea className="h-[500px]">
                            <div className="space-y-2 pr-4">
                                {filterQueries(savedQueries).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                        <FileText className="h-8 w-8 mb-2" />
                                        <p className="text-sm">{searchQuery ? 'No matching queries' : 'No saved queries yet'}</p>
                                    </div>
                                ) : (
                                    filterQueries(savedQueries).map((query) => (
                                        <Card key={query.id} className="p-3 hover:bg-accent/50 transition-colors">
                                            <div className="flex items-start gap-2">
                                                <button onClick={() => onQuerySelect(query.query)} className="flex-1 text-left">
                                                    <h4 className="font-medium text-sm mb-1">{query.name}</h4>
                                                    <p className="text-xs text-muted-foreground line-clamp-2 font-mono mb-2">
                                                        {query.query}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(query.updated_at).toLocaleDateString()}
                                                    </div>
                                                </button>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleFavorite(query.id)}
                                                        className="h-7 w-7 p-0"
                                                        title={favorites.has(query.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                    >
                                                        {favorites.has(query.id) ? (
                                                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                                        ) : (
                                                            <StarOff className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => { setEditingQuery(query); setEditName(query.name); setEditSql(query.query); }}
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeletingQuery(query)}
                                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="favorites" className="mt-4">
                        <p className="text-sm text-muted-foreground mb-3">Your starred favorite queries</p>
                        <ScrollArea className="h-[500px]">
                            <div className="space-y-2 pr-4">
                                {favoriteQueries.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                        <Star className="h-8 w-8 mb-2" />
                                        <p className="text-sm">No favorites yet</p>
                                        <p className="text-xs">Star queries from the Saved tab</p>
                                    </div>
                                ) : (
                                    favoriteQueries.map((query) => (
                                        <Card key={query.id} className="p-3 hover:bg-accent/50 transition-colors">
                                            <div className="flex items-start gap-2">
                                                <button onClick={() => onQuerySelect(query.query)} className="flex-1 text-left">
                                                    <h4 className="font-medium text-sm mb-1">{query.name}</h4>
                                                    <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
                                                        {query.query}
                                                    </p>
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleFavorite(query.id)}
                                                    className="h-7 w-7 p-0"
                                                >
                                                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                                </Button>
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Save Recent Query Dialog */}
            <Dialog open={!!savingQuery} onOpenChange={(open) => !open && setSavingQuery(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Query</DialogTitle>
                        <DialogDescription>Give this query a name to save it permanently.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Query Name</Label>
                            <Input
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                placeholder="e.g., Customer Orders Report"
                            />
                        </div>
                        <div>
                            <Label>SQL Preview</Label>
                            <Textarea value={savingQuery || ''} readOnly rows={5} className="font-mono text-xs" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSavingQuery(null)}>Cancel</Button>
                        <Button onClick={handleSaveRecent} disabled={saving || !saveName}>
                            {saving ? 'Saving...' : 'Save Query'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Saved Query Dialog */}
            <Dialog open={!!editingQuery} onOpenChange={(open) => !open && setEditingQuery(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Query</DialogTitle>
                        <DialogDescription>Update the name and SQL for this saved query.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Query Name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                            <Label>SQL Query</Label>
                            <Textarea
                                value={editSql}
                                onChange={(e) => setEditSql(e.target.value)}
                                rows={10}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingQuery(null)}>Cancel</Button>
                        <Button onClick={handleEditSaved} disabled={saving || !editName || !editSql}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingQuery} onOpenChange={(open) => !open && setDeletingQuery(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Query</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deletingQuery?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSaved}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
