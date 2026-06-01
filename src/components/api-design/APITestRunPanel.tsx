import { useState, useEffect, useCallback } from "react";
import { toast as sonnerToast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus,
  Play,
  Trash2,
  Download,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Timer,
  ListChecks,
  FileJson
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { APIEndpoint, GeneratedTestCase, TestExecutionResult } from "./types";

interface APITestRun {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed';
  createdAt: string;
  completedAt?: string;
  testCases: APITestRunCase[];
}

interface APITestRunCase {
  id: string;
  testCaseId: string;
  endpointId: string;
  testCaseName: string;
  endpointMethod: string;
  endpointPath: string;
  testCaseType: string;
  status: 'pending' | 'passed' | 'failed' | 'error' | 'skipped';
  execution?: TestExecutionResult;
}

interface APITestRunPanelProps {
  endpoints: APIEndpoint[];
  onExecuteTestCase: (testCase: GeneratedTestCase) => Promise<void>;
  isExecuting: boolean;
  projectId?: string;
}

export const APITestRunPanel = ({
  endpoints,
  onExecuteTestCase,
  isExecuting,
  projectId
}: APITestRunPanelProps) => {
  const [testRuns, setTestRuns] = useState<APITestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddCasesDialog, setShowAddCasesDialog] = useState(false);
  const [newRunName, setNewRunName] = useState("");
  const [newRunDescription, setNewRunDescription] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [filterEndpoint, setFilterEndpoint] = useState<string>("all");
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const { toast } = useToast();

  const selectedRun = testRuns.find(r => r.id === selectedRunId);

  // Load test runs from DB
  const loadTestRuns = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingRuns(true);
    try {
      const { data, error } = await supabase
        .from('api_test_runs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setTestRuns(data.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description || '',
          status: row.status as APITestRun['status'],
          createdAt: row.created_at,
          completedAt: row.completed_at || undefined,
          testCases: (row.test_cases as any[]) || []
        })));
      }
    } catch (err) {
      console.error('Error loading test runs:', err);
    } finally {
      setIsLoadingRuns(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTestRuns();
  }, [loadTestRuns]);

  // Save a single run to DB
  const saveRunToDB = async (run: APITestRun) => {
    if (!projectId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('api_test_runs')
        .upsert({
          id: run.id,
          project_id: projectId,
          user_id: user.id,
          name: run.name,
          description: run.description,
          status: run.status,
          test_cases: run.testCases as any,
          completed_at: run.completedAt || null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving test run:', err);
    }
  };

  // Delete a run from DB
  const deleteRunFromDB = async (runId: string) => {
    if (!projectId) return;
    try {
      await supabase
        .from('api_test_runs')
        .delete()
        .eq('id', runId);
    } catch (err) {
      console.error('Error deleting test run:', err);
    }
  };

  // Get all test cases across all endpoints
  const allTestCases = endpoints.flatMap(ep =>
    (ep.testCases || []).map(tc => ({
      ...tc,
      endpointId: ep.id,
      endpointMethod: ep.method,
      endpointPath: ep.path
    }))
  );

  const filteredTestCases = filterEndpoint === "all"
    ? allTestCases
    : allTestCases.filter(tc => tc.endpointId === filterEndpoint);

  const handleCreateRun = async () => {
    if (!newRunName.trim()) return;

    const newRun: APITestRun = {
      id: crypto.randomUUID(),
      name: newRunName.trim(),
      description: newRunDescription.trim(),
      status: 'draft',
      createdAt: new Date().toISOString(),
      testCases: []
    };

    setTestRuns(prev => [newRun, ...prev]);
    setSelectedRunId(newRun.id);
    setShowCreateDialog(false);
    setNewRunName("");
    setNewRunDescription("");
    await saveRunToDB(newRun);
    toast({ title: "Test Run Created", description: `"${newRun.name}" is ready` });
  };

  const handleAddCases = async () => {
    if (!selectedRun || selectedCaseIds.size === 0) return;

    const casesToAdd: APITestRunCase[] = [];
    selectedCaseIds.forEach(key => {
      const [endpointId, testCaseId] = key.split('::');
      const ep = endpoints.find(e => e.id === endpointId);
      const tc = ep?.testCases?.find(t => t.id === testCaseId);
      if (ep && tc) {
        if (selectedRun.testCases.some(c => c.testCaseId === testCaseId && c.endpointId === endpointId)) return;
        casesToAdd.push({
          id: crypto.randomUUID(),
          testCaseId: tc.id,
          endpointId: ep.id,
          testCaseName: tc.name,
          endpointMethod: ep.method,
          endpointPath: ep.path,
          testCaseType: tc.type,
          status: 'pending'
        });
      }
    });

    const updatedRun = { ...selectedRun, testCases: [...selectedRun.testCases, ...casesToAdd] };
    setTestRuns(prev => prev.map(r => r.id === selectedRunId ? updatedRun : r));
    setShowAddCasesDialog(false);
    setSelectedCaseIds(new Set());
    await saveRunToDB(updatedRun);
    toast({ title: "Test Cases Added", description: `${casesToAdd.length} cases added to the run` });
  };

  const handleRemoveCase = async (caseId: string) => {
    const run = testRuns.find(r => r.id === selectedRunId);
    if (!run) return;
    const updatedRun = { ...run, testCases: run.testCases.filter(c => c.id !== caseId) };
    setTestRuns(prev => prev.map(r => r.id === selectedRunId ? updatedRun : r));
    await saveRunToDB(updatedRun);
  };

  const handleExecuteRun = async () => {
    if (!selectedRun || selectedRun.testCases.length === 0) return;

    setIsRunning(true);
    setRunProgress(0);

    let currentRun: APITestRun = { ...selectedRun, status: 'running' };
    setTestRuns(prev => prev.map(r => r.id === selectedRunId ? currentRun : r));

    const total = selectedRun.testCases.length;
    let completed = 0;

    for (const runCase of selectedRun.testCases) {
      const ep = endpoints.find(e => e.id === runCase.endpointId);
      const tc = ep?.testCases?.find(t => t.id === runCase.testCaseId);

      if (!ep || !tc) {
        const noEndpoints = !endpoints || endpoints.length === 0;
        if (noEndpoints) {
          sonnerToast.error("Endpoints not loaded. Please load your saved API configuration first before running tests.");
          currentRun = {
            ...currentRun,
            status: 'draft' as any,
          };
          setTestRuns(prev => prev.map(r => r.id === selectedRunId ? currentRun : r));
          setRunProgress(0);
          setIsRunning(false);
          return;
        }
        currentRun = {
          ...currentRun,
          testCases: currentRun.testCases.map(c =>
            c.id === runCase.id ? { ...c, status: 'skipped' as const } : c
          )
        };
        setTestRuns(prev => prev.map(r => r.id === selectedRunId ? currentRun : r));
        completed++;
        setRunProgress(Math.round((completed / total) * 100));
        continue;
      }

      try {
        await onExecuteTestCase(tc);
        const updatedEp = endpoints.find(e => e.id === runCase.endpointId);
        const updatedTc = updatedEp?.testCases?.find(t => t.id === runCase.testCaseId);
        const execution = updatedTc?.lastExecution;

        currentRun = {
          ...currentRun,
          testCases: currentRun.testCases.map(c =>
            c.id === runCase.id
              ? { ...c, status: execution?.status || 'error', execution }
              : c
          )
        };
        setTestRuns(prev => prev.map(r => r.id === selectedRunId ? currentRun : r));
      } catch {
        currentRun = {
          ...currentRun,
          testCases: currentRun.testCases.map(c =>
            c.id === runCase.id ? { ...c, status: 'error' as const } : c
          )
        };
        setTestRuns(prev => prev.map(r => r.id === selectedRunId ? currentRun : r));
      }

      completed++;
      setRunProgress(Math.round((completed / total) * 100));
    }

    currentRun = { ...currentRun, status: 'completed' as const, completedAt: new Date().toISOString() };
    setTestRuns(prev => prev.map(r => r.id === selectedRunId ? currentRun : r));
    setIsRunning(false);
    await saveRunToDB(currentRun);
    toast({ title: "Test Run Completed", description: `All ${total} test cases executed` });
  };

  const handleDeleteRun = async (runId: string) => {
    setTestRuns(prev => prev.filter(r => r.id !== runId));
    if (selectedRunId === runId) setSelectedRunId(null);
    await deleteRunFromDB(runId);
    toast({ title: "Test Run Deleted" });
  };

  const handleExportResults = (run: APITestRun) => {
    const passedCount = run.testCases.filter(c => c.status === 'passed').length;
    const failedCount = run.testCases.filter(c => c.status === 'failed').length;
    const errorCount = run.testCases.filter(c => c.status === 'error').length;
    const skippedCount = run.testCases.filter(c => c.status === 'skipped').length;

    const report = {
      testRun: {
        name: run.name,
        description: run.description,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt
      },
      summary: {
        total: run.testCases.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
        skipped: skippedCount,
        passRate: run.testCases.length > 0
          ? ((passedCount / run.testCases.length) * 100).toFixed(1) + '%'
          : '0%'
      },
      results: run.testCases.map(c => ({
        testCase: c.testCaseName,
        endpoint: `${c.endpointMethod} ${c.endpointPath}`,
        type: c.testCaseType,
        status: c.status,
        responseStatus: c.execution?.responseStatus,
        responseTime: c.execution?.responseTime,
        timestamp: c.execution?.timestamp,
        assertionResults: c.execution?.assertionResults?.map(ar => ({
          assertion: ar.assertion.description,
          passed: ar.passed,
          actual: ar.actualValue,
          message: ar.message
        })),
        error: c.execution?.error
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-run-${run.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Results Exported", description: "Test run results downloaded as JSON" });
  };

  const handleExportCSV = (run: APITestRun) => {
    const headers = ['Test Case', 'Endpoint', 'Method', 'Type', 'Status', 'HTTP Status', 'Response Time (ms)', 'Assertions Passed', 'Assertions Total', 'Error'];
    const rows = run.testCases.map(c => [
      c.testCaseName,
      c.endpointPath,
      c.endpointMethod,
      c.testCaseType,
      c.status,
      c.execution?.responseStatus || '',
      c.execution?.responseTime || '',
      c.execution?.assertionResults?.filter(a => a.passed).length || 0,
      c.execution?.assertionResults?.length || 0,
      c.execution?.error || ''
    ]);

    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-run-${run.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV Exported", description: "Test run results downloaded as CSV" });
  };

  const toggleCaseExpand = (id: string) => {
    setExpandedCases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'skipped': return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'failed': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'error': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'skipped': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'negative': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'edge': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'security': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-muted';
    }
  };

  const getHttpStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-600';
    if (status >= 400 && status < 500) return 'text-amber-600';
    if (status >= 500) return 'text-red-600';
    return 'text-muted-foreground';
  };

  // List view
  if (!selectedRunId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">API Test Runs</h3>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Test Run
          </Button>
        </div>

        {isLoadingRuns ? (
          <Card className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </Card>
        ) : testRuns.length === 0 ? (
          <Card className="flex items-center justify-center h-[300px]">
            <div className="text-center">
              <ListChecks className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No test runs yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create a test run to group and execute API test cases together
              </p>
              <Button onClick={() => setShowCreateDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create First Test Run
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {testRuns.map(run => {
              const passed = run.testCases.filter(c => c.status === 'passed').length;
              const failed = run.testCases.filter(c => c.status === 'failed').length;
              const errors = run.testCases.filter(c => c.status === 'error').length;
              const total = run.testCases.length;
              const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

              return (
                <Card
                  key={run.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{run.name}</h4>
                          <Badge variant="outline" className={
                            run.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : run.status === 'running'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-muted'
                          }>
                            {run.status}
                          </Badge>
                        </div>
                        {run.description && (
                          <p className="text-sm text-muted-foreground mt-1">{run.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{total} test cases</span>
                          {run.status === 'completed' && (
                            <>
                              <span className="text-emerald-600">{passed} passed</span>
                              <span className="text-red-600">{failed} failed</span>
                              {errors > 0 && <span className="text-amber-600">{errors} errors</span>}
                              <span className="font-medium">{passRate}% pass rate</span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(run.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {run.status === 'completed' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleExportResults(run)}>
                              <Download className="h-4 w-4 mr-1" />
                              JSON
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleExportCSV(run)}>
                              <FileText className="h-4 w-4 mr-1" />
                              CSV
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRun(run.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {run.status === 'completed' && total > 0 && (
                      <Progress value={passRate} className="mt-3 h-1.5" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Run Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Test Run</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Run Name</Label>
                <Input
                  value={newRunName}
                  onChange={e => setNewRunName(e.target.value)}
                  placeholder="e.g., Sprint 12 API Regression"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newRunDescription}
                  onChange={e => setNewRunDescription(e.target.value)}
                  placeholder="Describe this test run..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateRun} disabled={!newRunName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Detail view
  const passedCount = selectedRun!.testCases.filter(c => c.status === 'passed').length;
  const failedCount = selectedRun!.testCases.filter(c => c.status === 'failed').length;
  const errorCount = selectedRun!.testCases.filter(c => c.status === 'error').length;
  const pendingCount = selectedRun!.testCases.filter(c => c.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{selectedRun!.name}</h3>
              <Badge variant="outline" className={
                selectedRun!.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : selectedRun!.status === 'running'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    : 'bg-muted'
              }>
                {selectedRun!.status}
              </Badge>
            </div>
            {selectedRun!.description && (
              <p className="text-sm text-muted-foreground">{selectedRun!.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedCaseIds(new Set());
              setFilterEndpoint("all");
              setShowAddCasesDialog(true);
            }}
            disabled={isRunning}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Test Cases
          </Button>
          {selectedRun!.status === 'completed' && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExportResults(selectedRun!)}>
                <Download className="h-4 w-4 mr-1" />
                Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(selectedRun!)}>
                <FileText className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={handleExecuteRun}
            disabled={isRunning || isExecuting || selectedRun!.testCases.length === 0}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Run All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: selectedRun!.testCases.length, color: 'text-foreground' },
          { label: 'Passed', value: passedCount, color: 'text-emerald-600' },
          { label: 'Failed', value: failedCount, color: 'text-red-600' },
          { label: 'Errors', value: errorCount, color: 'text-amber-600' },
          { label: 'Pending', value: pendingCount, color: 'text-muted-foreground' }
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bar during execution */}
      {isRunning && (
        <div className="space-y-1">
          <Progress value={runProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{runProgress}% complete</p>
        </div>
      )}

      {/* Test Cases List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Test Cases ({selectedRun!.testCases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedRun!.testCases.length === 0 ? (
            <div className="text-center py-8">
              <FileJson className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">No test cases added</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCaseIds(new Set());
                  setFilterEndpoint("all");
                  setShowAddCasesDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Test Cases
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {selectedRun!.testCases.map(runCase => (
                  <Collapsible
                    key={runCase.id}
                    open={expandedCases.has(runCase.id)}
                    onOpenChange={() => toggleCaseExpand(runCase.id)}
                  >
                    <div className={`border rounded-lg transition-all ${expandedCases.has(runCase.id) ? 'border-primary' : ''}`}>
                      <CollapsibleTrigger className="w-full">
                        <div className="p-3 flex items-center gap-3">
                          {expandedCases.has(runCase.id)
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                          {getStatusIcon(runCase.status)}
                          <Badge variant="outline" className="font-mono text-xs">
                            {runCase.endpointMethod}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">{runCase.endpointPath}</span>
                          <span className="font-medium text-sm flex-1 text-left truncate">
                            {runCase.testCaseName}
                          </span>
                          <Badge variant="outline" className={getTypeColor(runCase.testCaseType)}>
                            {runCase.testCaseType}
                          </Badge>
                          <Badge variant="outline" className={getStatusBadgeClass(runCase.status)}>
                            {runCase.status.toUpperCase()}
                          </Badge>
                          {runCase.execution && (
                            <>
                              <Badge variant="secondary" className={`font-mono text-xs ${getHttpStatusColor(runCase.execution.responseStatus)}`}>
                                {runCase.execution.responseStatus}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Timer className="h-3 w-3" />
                                {runCase.execution.responseTime}ms
                              </div>
                            </>
                          )}
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-0 space-y-3">
                          {runCase.execution && (
                            <>
                              <div className="grid grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                                  <Badge variant="outline" className={getStatusBadgeClass(runCase.status)}>
                                    {runCase.status.toUpperCase()}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">HTTP Status</p>
                                  <span className={`font-mono font-medium ${getHttpStatusColor(runCase.execution.responseStatus)}`}>
                                    {runCase.execution.responseStatus}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Response Time</p>
                                  <span className="font-mono text-sm">{runCase.execution.responseTime}ms</span>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Executed At</p>
                                  <span className="text-sm">
                                    {new Date(runCase.execution.timestamp).toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {runCase.execution.error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                  <p className="text-xs font-medium text-red-600 mb-1">Error</p>
                                  <p className="text-sm text-red-600">{runCase.execution.error}</p>
                                </div>
                              )}

                              {runCase.execution.assertionResults && runCase.execution.assertionResults.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2 font-medium">Assertions</p>
                                  <div className="space-y-1">
                                    {runCase.execution.assertionResults.map((result, idx) => (
                                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                                        {result.passed
                                          ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                                          : <XCircle className="h-4 w-4 text-red-500" />
                                        }
                                        <span className="flex-1">
                                          {result.assertion.description || `${result.assertion.type}: ${result.assertion.condition} ${result.assertion.value}`}
                                        </span>
                                        {result.actualValue !== undefined && (
                                          <span className="text-xs text-muted-foreground">
                                            Actual: <code className="bg-muted px-1 rounded">{String(result.actualValue)}</code>
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCase(runCase.id);
                              }}
                              disabled={isRunning}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add Test Cases Dialog */}
      <Dialog open={showAddCasesDialog} onOpenChange={setShowAddCasesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Test Cases to Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Filter by Endpoint</Label>
              <Select value={filterEndpoint} onValueChange={setFilterEndpoint}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Endpoints</SelectItem>
                  {endpoints.filter(e => e.testCases && e.testCases.length > 0).map(ep => (
                    <SelectItem key={ep.id} value={ep.id}>
                      {ep.method} {ep.path} ({ep.testCases?.length || 0} cases)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCaseIds(new Set(filteredTestCases.map(tc => `${tc.endpointId}::${tc.id}`)))}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCaseIds(new Set())}
              >
                Select None
              </Button>
              <span className="text-sm text-muted-foreground ml-auto">
                {selectedCaseIds.size} selected
              </span>
            </div>

            <ScrollArea className="h-[350px]">
              <div className="space-y-1">
                {filteredTestCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No test cases available. Generate test cases for endpoints first.
                  </div>
                ) : (
                  filteredTestCases.map(tc => {
                    const key = `${tc.endpointId}::${tc.id}`;
                    const alreadyAdded = selectedRun!.testCases.some(
                      c => c.testCaseId === tc.id && c.endpointId === tc.endpointId
                    );

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 ${alreadyAdded ? 'opacity-50' : ''}`}
                      >
                        <Checkbox
                          checked={selectedCaseIds.has(key)}
                          onCheckedChange={checked => {
                            const next = new Set(selectedCaseIds);
                            checked ? next.add(key) : next.delete(key);
                            setSelectedCaseIds(next);
                          }}
                          disabled={alreadyAdded}
                        />
                        <Badge variant="outline" className="font-mono text-xs">
                          {tc.endpointMethod}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">{tc.endpointPath}</span>
                        <span className="text-sm flex-1 truncate">{tc.name}</span>
                        <Badge variant="outline" className={getTypeColor(tc.type)}>
                          {tc.type}
                        </Badge>
                        {alreadyAdded && (
                          <span className="text-xs text-muted-foreground">Already added</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCasesDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCases} disabled={selectedCaseIds.size === 0}>
              Add {selectedCaseIds.size} Test Cases
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
