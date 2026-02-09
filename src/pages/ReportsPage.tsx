import { useState, useEffect } from 'react';
import { FileText, Trash2, Trash, Loader2, ChevronDown, ChevronUp, Lightbulb, Search, Sparkles, X } from 'lucide-react';
import { ComparisonResults } from '@/components/ComparisonResults';
import { HelpTooltip } from '@/components/HelpTooltip';
import { AIButton } from '@/components/AIButton';
import { AIResponseModal } from '@/components/AIResponseModal';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { reportsApi, API_BASE_URL } from '@/lib/api';

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


export default function ReportsPage() {
    const { toast } = useToast();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showClearAllDialog, setShowClearAllDialog] = useState(false);
    const [clearingAll, setClearingAll] = useState(false);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date-desc');

    // AI State
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiModalTitle, setAiModalTitle] = useState('');
    const [aiModalContent, setAiModalContent] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAction, setAiAction] = useState<string | null>(null);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        const { data, error } = await reportsApi.list();

        if (error) {
            toast({
                title: 'Failed to Load Reports',
                description: error,
                variant: 'destructive',
            });
        } else if (data && typeof data === 'object' && 'reports' in data) {
            // Filter to only show saved reports (those with a name or note)
            const allReports = (data as { reports: any[] }).reports || [];
            const savedReports = allReports.filter(report => report.name || report.note);
            setReports(savedReports);
        }

        setLoading(false);
    };

    const handleDelete = async (compareId: string) => {
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

    const handleAISummarize = async (report: any) => {
        setAiAction(`summarize-${report.compare_id}`);
        setAiLoading(true);
        setAiModalOpen(true);
        setAiModalTitle('Report Summary');
        setAiModalContent('');

        try {
            // Prepare a summary of the report for the AI
            const summary = {
                name: report.name,
                note: report.note,
                source_rows: report.summary?.sourceRowCount,
                target_rows: report.summary?.targetRowCount,
                match_percentage: report.summary?.match_percentage,
                mismatches: report.summary?.mismatched_rows,
                column_mismatches: report.column_mismatches
            };

            const prompt = `Summarize this comparison report for a non-technical stakeholder:\n\n${JSON.stringify(summary, null, 2)}\n\nFocus on data quality and key findings.`;

            const response = await fetch(`${API_BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    context: 'reports',
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-3 text-muted-foreground">Loading reports...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                            <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Saved Reports</h1>
                            <p className="text-muted-foreground">
                                {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                            </p>
                        </div>
                    </div>

                    {reports.length > 0 && (
                        <Button
                            variant="outline"
                            size="lg"
                            className="gap-2"
                            onClick={() => setShowClearAllDialog(true)}
                            title="Delete all saved reports"
                        >
                            <Trash className="h-4 w-4" />
                            Clear All
                        </Button>
                    )}
                </header>

                {/* Quick Tips */}
                {reports.length === 0 && (
                    <Alert className="bg-primary/5 border-primary/20">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-sm">
                            <strong>No Reports Yet:</strong> Run a comparison from the Compare page and save it to see reports here.
                        </AlertDescription>
                    </Alert>
                )}



                {/* Search and Filter */}
                {reports.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search reports..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date-desc">Newest First</SelectItem>
                                    <SelectItem value="date-asc">Oldest First</SelectItem>
                                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>


                    </div>
                )}

                {/* Clear All Dialog */}
                <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
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

                {/* Reports List */}
                {(() => {
                    // Filter and sort reports
                    const filteredReports = reports
                        .filter(r => r.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => {
                            switch (sortBy) {
                                case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                                case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                                case 'name-asc': return (a.name || '').localeCompare(b.name || '');
                                default: return 0;
                            }
                        });

                    if (filteredReports.length === 0 && searchTerm) {
                        return (
                            <Card className="p-12 text-center">
                                <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                                <p className="text-muted-foreground">
                                    No reports match "{searchTerm}"
                                </p>
                            </Card>
                        );
                    }

                    if (reports.length === 0) {
                        return (
                            <Card className="p-12 text-center">
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Saved Reports</h3>
                                <p className="text-muted-foreground">
                                    Run a comparison and click "Save Result" to save reports here.
                                </p>
                            </Card>
                        );
                    }

                    return filteredReports.map((report) => (
                        <Collapsible
                            key={report.compare_id}
                            open={expandedReport === report.compare_id}
                            onOpenChange={(open) => setExpandedReport(open ? report.compare_id : null)}
                        >
                            <Card className="shadow-lg border-2 overflow-hidden">
                                <CollapsibleTrigger asChild>
                                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h2 className="text-xl font-semibold">
                                                        {report.name || `Comparison ${report.compare_id.slice(0, 8)}`}
                                                    </h2>
                                                    {expandedReport === report.compare_id ? (
                                                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDate(report.created_at)}
                                                </p>
                                                {report.note && (
                                                    <p className="text-sm text-muted-foreground mt-2 italic">
                                                        Note: {report.note}
                                                    </p>
                                                )}
                                                {report.summary && (
                                                    <div className="flex gap-4 mt-3 text-sm">
                                                        <span className="text-muted-foreground">
                                                            Source: <span className="font-medium text-foreground">{report.summary.sourceRowCount?.toLocaleString() || 0} rows</span>
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            Target: <span className="font-medium text-foreground">{report.summary.targetRowCount?.toLocaleString() || 0} rows</span>
                                                        </span>
                                                        {report.summary.match_percentage !== undefined && (
                                                            <span className="text-muted-foreground">
                                                                Match: <span className="font-medium text-foreground">{report.summary.match_percentage.toFixed(2)}%</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <AIButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAISummarize(report);
                                                    }}
                                                    label="Summarize"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-2"
                                                    isLoading={aiAction === `summarize-${report.compare_id}`}
                                                    tooltip="Get an AI summary of this report"
                                                />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete this comparison report. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(report.compare_id)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <CardContent className="pt-0 pb-6 px-6 border-t">
                                        {report.status === 'completed' ? (
                                            <div className="mt-6">
                                                <ComparisonResults
                                                    comparisonId={report.compare_id}
                                                    results={{
                                                        ...report,
                                                        columnStats: report.column_stats,
                                                        sampleMismatches: report.sample_mismatches,
                                                        columnMismatches: report.column_mismatches
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <p className="text-sm">This comparison is {report.status}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    ));
                })()}
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
