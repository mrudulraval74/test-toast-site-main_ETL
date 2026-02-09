import { useState, useEffect } from 'react';
import { reportsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { MappingAnalysis, Connection } from '@/types/ai-comparison';

export function useSavedRuns() {
    const { toast } = useToast();
    const [savedRuns, setSavedRuns] = useState<any[]>([]);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

    useEffect(() => {
        loadSavedRuns();
    }, []);

    const loadSavedRuns = async () => {
        try {
            const { data } = await reportsApi.list();
            // API returns {reports: [...], total, limit, offset}
            if (data && data.reports && Array.isArray(data.reports)) {
                const tests = data.reports.filter((r: any) => r.summary?.isTestSuite);
                setSavedRuns(tests);
            }
        } catch (error) {
            console.error("Failed to load saved runs:", error);
        }
    };

    const handleSave = async (
        name: string,
        folderName: string,
        analysis: MappingAnalysis,
        sourceConnection?: Connection,
        targetConnection?: Connection
    ) => {
        try {
            const res = await reportsApi.saveTestRun({
                sourceConnectionId: sourceConnection?.id,
                targetConnectionId: targetConnection?.id,
                testCases: analysis.testCases,
                fileName: name,
                folderName: folderName
            });

            if (res.error) throw new Error(res.error);

            setIsSaveDialogOpen(false);
            toast({
                title: "Results Saved",
                description: `Saved ${analysis.testCases.length} test cases to ${folderName}`
            });

            // Refresh list
            await loadSavedRuns();
        } catch (error) {
            console.error('Failed to save results:', error);
            toast({
                title: "Save Failed",
                description: error instanceof Error ? error.message : "Could not save results.",
                variant: "destructive"
            });
        }
    };

    const handleLoad = (run: any, setUploadedFile: any, setAnalysis: any, setSourceConnection: any, setTargetConnection: any, savedConnections: Connection[]) => {
        if (!run.summary || !run.summary.testCases) return;

        setUploadedFile({ name: run.summary.fileName || 'Loaded Run', data: [] });
        setAnalysis({
            sourceTables: [],
            targetTables: [],
            businessRules: [],
            testCases: run.summary.testCases
        });

        // Try to restore connections
        if (run.source_connection_id) {
            const found = savedConnections.find(c => c.id === run.source_connection_id);
            setSourceConnection(found || { id: run.source_connection_id, name: 'Restored Connection', database: 'Unknown' });
        }
        if (run.target_connection_id) {
            const found = savedConnections.find(c => c.id === run.target_connection_id);
            setTargetConnection(found || { id: run.target_connection_id, name: 'Restored Connection', database: 'Unknown' });
        }

        toast({ title: "Run Loaded", description: `Loaded ${run.summary.testCases.length} test cases.` });
    };

    const handleDelete = async (id: string) => {
        try {
            await reportsApi.delete(id);
            toast({ title: "Run Deleted", description: "Test run removed from history." });
            await loadSavedRuns();
        } catch (error) {
            console.error("Delete failed", error);
            toast({ title: "Delete Failed", description: "Could not delete run.", variant: "destructive" });
        }
    };

    return {
        savedRuns,
        isSaveDialogOpen,
        setIsSaveDialogOpen,
        handleSave,
        handleLoad,
        handleDelete,
        loadSavedRuns
    };
}
