import { useState, useEffect } from 'react';
import { reportsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Pencil, Save, X, Trash } from 'lucide-react';
import { ComparisonResults } from '@/components/ComparisonResults';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface QuickNoteProps {
  compareId: string;
  initialNote?: string;
  onSave: () => void;
}

function QuickNote({ compareId, initialNote, onSave }: QuickNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    const { error } = await reportsApi.updateNote(compareId, note);
    setSaving(false);

    if (error) {
      toast({
        title: 'Failed to save note',
        description: error,
        variant: 'destructive',
      });
    } else {
      setIsEditing(false);
      onSave();
      toast({
        title: 'Note saved',
        description: 'Your note has been updated successfully.',
      });
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Quick Note</label>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-6 px-2 text-xs">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this comparison..."
          className="min-h-[80px] text-sm resize-none bg-background"
        />
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Quick Note</label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit Note"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
      {note ? (
        <p className="text-sm whitespace-pre-wrap">{note}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic cursor-pointer hover:text-foreground transition-colors" onClick={() => setIsEditing(true)}>
          Click to add a note...
        </p>
      )}
    </div>
  );
}

interface ComparisonHistoryProps {
  onSelect?: (report: any) => void;
}

export function ComparisonHistory({ onSelect }: ComparisonHistoryProps) {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data, error } = await reportsApi.list();

    if (error) {
      toast({
        title: 'Failed to Load History',
        description: error,
        variant: 'destructive',
      });
    } else if (data && typeof data === 'object' && 'reports' in data) {
      setReports((data as { reports: any[] }).reports || []);
    }

    setLoading(false);
  };

  const handleDelete = async (compareId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const { error } = await reportsApi.delete(compareId);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Report Deleted',
        description: 'The comparison report has been removed.',
      });
      loadReports();
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);

    // Delete all reports
    const deletePromises = reports.map(report => reportsApi.delete(report.compare_id));
    const results = await Promise.allSettled(deletePromises);

    const failedCount = results.filter(r => r.status === 'rejected').length;

    setClearingAll(false);
    setShowClearAllDialog(false);

    if (failedCount > 0) {
      toast({
        title: 'Partial Deletion',
        description: `${results.length - failedCount} reports deleted, ${failedCount} failed.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'All Reports Deleted',
        description: `Successfully deleted ${results.length} reports.`,
      });
    }

    loadReports();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      completed: 'default',
      running: 'secondary',
      failed: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'secondary'} className="flex items-center gap-1 text-xs px-1.5 py-0 h-5">
        {getStatusIcon(status)}
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No comparison history</p>
        <p className="text-xs text-muted-foreground mt-1">
          Run your first comparison to see results here
        </p>
      </div>
    );
  }

  return (
    <>
      {reports.length > 0 && (
        <div className="flex justify-between items-center mb-4 pb-3 border-b">
          <p className="text-sm text-muted-foreground">
            {reports.length} {reports.length === 1 ? 'report' : 'reports'}
          </p>
          <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash className="h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Reports?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {reports.length} comparison reports. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearingAll}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearingAll && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <ScrollArea className="h-full pr-4">
        <div className="space-y-3">
          {reports.map((report) => (
            <Collapsible
              key={report.compare_id}
              open={expandedReport === report.compare_id}
              onOpenChange={(open) => setExpandedReport(open ? report.compare_id : null)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span className="truncate">
                              {report.name || `Comparison ${report.compare_id.slice(0, 8)}`}
                            </span>
                          </CardTitle>
                          {getStatusBadge(report.status)}
                        </div>
                        <CardDescription className="text-xs flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {formatDate(report.created_at)}
                        </CardDescription>

                        {/* Quick Note Display (Collapsed View) */}
                        {report.note && expandedReport !== report.compare_id && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded border border-border/50 truncate">
                            <span className="font-semibold mr-1">Note:</span> {report.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="p-3 pt-0 border-t bg-muted/10">
                    <div className="flex items-center justify-between gap-2 mt-3 mb-3">
                      <div className="flex gap-2">
                        {onSelect && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => onSelect(report)}
                          >
                            Load Config
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Comparison</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this comparison report? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => handleDelete(report.compare_id, e)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setExpandedReport(null)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Quick Note Section */}
                    <div className="mb-3">
                      <QuickNote
                        compareId={report.compare_id}
                        initialNote={report.note}
                        onSave={() => loadReports()}
                      />
                    </div>

                    {/* Summary Stats */}
                    {report.summary && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                        <div className="bg-background p-2 rounded border">
                          <span className="block font-semibold">Source</span>
                          {report.summary.source_count?.toLocaleString() ?? '-'} rows
                        </div>
                        <div className="bg-background p-2 rounded border">
                          <span className="block font-semibold">Target</span>
                          {report.summary.target_count?.toLocaleString() ?? '-'} rows
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}
