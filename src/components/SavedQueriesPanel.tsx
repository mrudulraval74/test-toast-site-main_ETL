import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
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
import { Edit2, Trash2, Clock, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queriesApi } from '@/lib/api';

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  connection_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SavedQueriesPanelProps {
  queries: SavedQuery[];
  onQuerySelect: (query: SavedQuery) => void;
  onRefresh: () => void;
}

export function SavedQueriesPanel({ queries, onQuerySelect, onRefresh }: SavedQueriesPanelProps) {
  const { toast } = useToast();
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const [deletingQuery, setDeletingQuery] = useState<SavedQuery | null>(null);
  const [editName, setEditName] = useState('');
  const [editSql, setEditSql] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = (query: SavedQuery) => {
    setEditingQuery(query);
    setEditName(query.name);
    setEditSql(query.query);
  };

  const handleSaveEdit = async () => {
    if (!editingQuery) return;

    setSaving(true);
    const { error } = await queriesApi.update(editingQuery.id, {
      name: editName,
      query: editSql,
    });
    setSaving(false);

    if (error) {
      toast({
        title: 'Update Failed',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Query Updated',
        description: 'Query has been updated successfully.',
      });
      setEditingQuery(null);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deletingQuery) return;

    const { error } = await queriesApi.delete(deletingQuery.id);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Query Deleted',
        description: 'Query has been deleted successfully.',
      });
      setDeletingQuery(null);
      onRefresh();
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <ScrollArea className="h-[600px]">
        <div className="space-y-2 pr-4">
          {queries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">No saved queries yet</p>
            </div>
          ) : (
            queries.map((query) => (
              <Card key={query.id} className="p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onQuerySelect(query)}
                    className="flex-1 text-left"
                  >
                    <h4 className="font-medium text-sm mb-1">{query.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
                      {query.query}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(query.updated_at)}
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(query)}
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

      {/* Edit Dialog */}
      <Dialog open={!!editingQuery} onOpenChange={(open) => !open && setEditingQuery(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Query</DialogTitle>
            <DialogDescription>
              Update the name and SQL for this saved query.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Query Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter query name"
              />
            </div>
            <div>
              <Label>SQL Query</Label>
              <Textarea
                value={editSql}
                onChange={(e) => setEditSql(e.target.value)}
                placeholder="Enter SQL query"
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuery(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editName || !editSql}>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
