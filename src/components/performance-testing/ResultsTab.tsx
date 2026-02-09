import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileJson, FileSpreadsheet, BarChart3, LineChart, TrendingUp, TrendingDown, CheckCircle, XCircle, Clock, Zap, Activity, History, RefreshCw, PieChart as PieChartIcon, Users, Timer, Gauge, AlertTriangle, Globe } from "lucide-react";
import { ExecutionProgress, ExecutionMetrics } from "./types";
import { useToast } from "@/hooks/use-toast";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar } from "recharts";
import { supabase } from "@/integrations/supabase/client";

// Vibrant color palette from provided image
const CHART_COLORS = {
  magenta: '#A31560',
  coral: '#F55057',
  orange: '#F7A34F',
  yellow: '#F0F055',
  lime: '#B4DC4A',
  green: '#4DC469',
  teal: '#49C4B8',
  blue: '#6C9DD6',
  purple: '#8B78D0',
  violet: '#7C2EA3',
};

const CHART_PALETTE = [
  CHART_COLORS.coral,
  CHART_COLORS.orange,
  CHART_COLORS.lime,
  CHART_COLORS.green,
  CHART_COLORS.teal,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.magenta,
];

interface JobConfig {
  threads: number;
  rampup: number;
  duration: number;
}

interface APIRequestDetail {
  label: string;
  url: string;
  method: string;
  responseTime: number;
  statusCode: string;
  success: boolean;
  bytes: number;
  latency: number;
}

interface ExecutionHistoryResult {
  id: string;
  job_id: string;
  agent_id: string;
  status: string;
  created_at: string;
  jtl_base64?: string;
  summary: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    totalBytes: number;
  } | null;
}

interface ResultsTabProps {
  progress: ExecutionProgress;
  projectId: string;
}

export const ResultsTab = ({ progress, projectId }: ResultsTabProps) => {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<'summary' | 'charts' | 'details' | 'history'>('history');
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionHistoryResult | null>(null);
  const [selectedJobConfig, setSelectedJobConfig] = useState<JobConfig | null>(null);
  const [apiRequestDetails, setApiRequestDetails] = useState<APIRequestDetail[]>([]);

  const { summary, metrics } = progress;

  // Parse JTL base64 data to extract API request details
  const parseJTLData = (jtlBase64: string): APIRequestDetail[] => {
    try {
      const decoded = atob(jtlBase64);
      const lines = decoded.split('\n').filter(line => line.trim());
      if (lines.length <= 1) return [];
      
      // Skip header row
      const dataLines = lines.slice(1);
      return dataLines.map(line => {
        const parts = line.split(',');
        return {
          label: parts[2] || 'Unknown',
          responseTime: parseInt(parts[1]) || 0,
          statusCode: parts[3] || 'Error',
          success: parts[7] === 'true',
          bytes: parseInt(parts[9]) || 0,
          url: parts[13] || '',
          method: parts[2]?.split(' ')[0] || 'GET',
          latency: parseInt(parts[14]) || 0,
        };
      }).filter(r => r.label);
    } catch (e) {
      console.error('Error parsing JTL data:', e);
      return [];
    }
  };

  // Fetch job configuration for selected execution
  const fetchJobConfig = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from('performance_jobs')
        .select('threads, rampup, duration')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedJobConfig({
          threads: data.threads,
          rampup: data.rampup,
          duration: data.duration
        });
      }
    } catch (error) {
      console.error('Error fetching job config:', error);
      setSelectedJobConfig(null);
    }
  };

  // Fetch execution history from database
  const fetchExecutionHistory = async () => {
    if (!projectId) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('performance_results')
        .select('id, job_id, agent_id, status, created_at, summary, jtl_base64')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const transformedData: ExecutionHistoryResult[] = (data || []).map(item => ({
        id: item.id,
        job_id: item.job_id,
        agent_id: item.agent_id,
        status: item.status,
        created_at: item.created_at,
        jtl_base64: item.jtl_base64 || undefined,
        summary: item.summary as ExecutionHistoryResult['summary']
      }));

      setExecutionHistory(transformedData);
      
      // Auto-select first execution if none selected
      if (transformedData.length > 0 && !selectedExecution) {
        const first = transformedData[0];
        setSelectedExecution(first);
        if (first.job_id) fetchJobConfig(first.job_id);
        if (first.jtl_base64) setApiRequestDetails(parseJTLData(first.jtl_base64));
      }
    } catch (error: any) {
      console.error('Error fetching execution history:', error);
      toast({
        title: "Error loading execution history",
        description: error.message || "Failed to load execution results",
        variant: "destructive"
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle execution selection
  const handleExecutionSelect = (execution: ExecutionHistoryResult) => {
    setSelectedExecution(execution);
    if (execution.job_id) fetchJobConfig(execution.job_id);
    if (execution.jtl_base64) {
      setApiRequestDetails(parseJTLData(execution.jtl_base64));
    } else {
      setApiRequestDetails([]);
    }
  };

  // Get slowest API request
  const slowestAPI = useMemo(() => {
    if (apiRequestDetails.length === 0) return null;
    return apiRequestDetails.reduce((slowest, current) => 
      current.responseTime > slowest.responseTime ? current : slowest
    );
  }, [apiRequestDetails]);

  // Aggregate API stats by label
  const apiStats = useMemo(() => {
    if (apiRequestDetails.length === 0) return [];
    
    const grouped: Record<string, APIRequestDetail[]> = {};
    apiRequestDetails.forEach(r => {
      const key = r.label;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    return Object.entries(grouped).map(([label, requests]) => {
      const responseTimes = requests.map(r => r.responseTime);
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const successCount = requests.filter(r => r.success).length;
      
      return {
        label,
        count: requests.length,
        avgResponseTime: Math.round(avgTime),
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        successRate: (successCount / requests.length) * 100,
        url: requests[0]?.url || '',
      };
    }).sort((a, b) => b.avgResponseTime - a.avgResponseTime);
  }, [apiRequestDetails]);

  // Load history on mount and when projectId changes
  useEffect(() => {
    fetchExecutionHistory();
  }, [projectId]);

  // Calculate aggregated metrics by request
  const aggregatedByRequest = useMemo(() => {
    const grouped: Record<string, ExecutionMetrics[]> = {};
    
    metrics.forEach(m => {
      if (!grouped[m.requestName]) {
        grouped[m.requestName] = [];
      }
      grouped[m.requestName].push(m);
    });

    return Object.entries(grouped).map(([name, items]) => {
      const successCount = items.filter(i => i.success).length;
      const responseTimes = items.map(i => i.responseTime);
      
      return {
        requestName: name,
        samples: items.length,
        avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / items.length,
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        errorRate: ((items.length - successCount) / items.length) * 100,
        throughput: items.length / ((summary?.endTime || Date.now()) - (summary?.startTime || Date.now())) * 1000,
        p90: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.9)] || 0,
        p95: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] || 0,
        p99: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.99)] || 0
      };
    });
  }, [metrics, summary]);

  // Chart data - Response time over time
  const responseTimeChartData = useMemo(() => {
    if (metrics.length === 0) return [];
    
    const startTime = metrics[0]?.timestamp || 0;
    const bucketSize = 1000; // 1 second buckets
    const buckets: Record<number, number[]> = {};
    
    metrics.forEach(m => {
      const bucket = Math.floor((m.timestamp - startTime) / bucketSize);
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(m.responseTime);
    });

    return Object.entries(buckets).map(([bucket, times]) => ({
      time: parseInt(bucket),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times)
    }));
  }, [metrics]);

  // Chart data - Requests and errors over time
  const requestsChartData = useMemo(() => {
    if (metrics.length === 0) return [];
    
    const startTime = metrics[0]?.timestamp || 0;
    const bucketSize = 1000;
    const buckets: Record<number, { success: number; error: number }> = {};
    
    metrics.forEach(m => {
      const bucket = Math.floor((m.timestamp - startTime) / bucketSize);
      if (!buckets[bucket]) buckets[bucket] = { success: 0, error: 0 };
      if (m.success) {
        buckets[bucket].success++;
      } else {
        buckets[bucket].error++;
      }
    });

    return Object.entries(buckets).map(([bucket, counts]) => ({
      time: parseInt(bucket),
      success: counts.success,
      errors: counts.error
    }));
  }, [metrics]);

  // Status code distribution
  const statusCodeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    metrics.forEach(m => {
      const code = m.statusCode === 0 ? 'Error' : m.statusCode.toString();
      distribution[code] = (distribution[code] || 0) + 1;
    });
    return Object.entries(distribution).map(([code, count]) => ({
      code,
      count,
      percentage: (count / metrics.length) * 100
    }));
  }, [metrics]);

  const exportToJSON = () => {
    const data = {
      summary,
      aggregatedByRequest,
      metrics: metrics.slice(0, 10000), // Limit for large tests
      statusCodeDistribution
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Results exported", description: "JSON file downloaded" });
  };

  const exportToCSV = () => {
    const headers = ['Request Name', 'Timestamp', 'Response Time (ms)', 'Status Code', 'Success', 'Bytes', 'Error'];
    const rows = metrics.map(m => [
      m.requestName,
      new Date(m.timestamp).toISOString(),
      m.responseTime.toFixed(2),
      m.statusCode,
      m.success,
      m.bytes,
      m.errorMessage || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Results exported", description: "CSV file downloaded" });
  };

  // Render execution history view
  const renderHistoryView = () => {
    if (isLoadingHistory) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      );
    }

    if (executionHistory.length === 0) {
      return (
        <Card>
          <CardContent className="py-16 text-center">
            <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Execution History</h3>
            <p className="text-muted-foreground">
              Run a performance test using an agent to see results here
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Execution History</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchExecutionHistory}
                disabled={isLoadingHistory}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription>{executionHistory.length} executions found</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {executionHistory.map((execution) => (
                  <div
                    key={execution.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedExecution?.id === execution.id 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleExecutionSelect(execution)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={execution.status === 'completed' ? 'default' : execution.status === 'failed' ? 'destructive' : 'secondary'}>
                        {execution.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(execution.created_at).toLocaleString()}
                      </span>
                    </div>
                    {execution.summary && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Requests:</span>{' '}
                          <span className="font-medium">{execution.summary.totalRequests}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg:</span>{' '}
                          <span className="font-medium">{execution.summary.avgResponseTime}ms</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Execution Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Execution Details
            </CardTitle>
            <CardDescription>
              {selectedExecution 
                ? `Executed on ${new Date(selectedExecution.created_at).toLocaleString()}` 
                : "Select an execution from the list to view details"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedExecution ? (
              selectedExecution.summary ? (
                <div className="space-y-6">
                  {/* Load Test Configuration */}
                  {selectedJobConfig && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Gauge className="h-4 w-4" />
                        Load Test Configuration
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.teal}20` }}>
                          <Users className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.teal }} />
                          <p className="text-2xl font-bold">{selectedJobConfig.threads}</p>
                          <p className="text-xs text-muted-foreground">Virtual Users</p>
                        </div>
                        <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.orange}20` }}>
                          <Timer className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.orange }} />
                          <p className="text-2xl font-bold">{selectedJobConfig.rampup}s</p>
                          <p className="text-xs text-muted-foreground">Ramp-up Time</p>
                        </div>
                        <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.purple}20` }}>
                          <Clock className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.purple }} />
                          <p className="text-2xl font-bold">{selectedJobConfig.duration}s</p>
                          <p className="text-xs text-muted-foreground">Duration</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.blue}20` }}>
                      <Activity className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.blue }} />
                      <p className="text-2xl font-bold">{selectedExecution.summary.totalRequests}</p>
                      <p className="text-xs text-muted-foreground">Total Requests</p>
                    </div>
                    <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.yellow}20` }}>
                      <Clock className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.orange }} />
                      <p className="text-2xl font-bold">{selectedExecution.summary.avgResponseTime}ms</p>
                      <p className="text-xs text-muted-foreground">Avg Response Time</p>
                    </div>
                    <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.green}20` }}>
                      <CheckCircle className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.green }} />
                      <p className="text-2xl font-bold">{selectedExecution.summary.successCount}</p>
                      <p className="text-xs text-muted-foreground">Successful</p>
                    </div>
                    <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${CHART_COLORS.coral}20` }}>
                      <XCircle className="h-5 w-5 mx-auto mb-2" style={{ color: CHART_COLORS.coral }} />
                      <p className="text-2xl font-bold">{Number(selectedExecution.summary.errorRate || 0).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Error Rate</p>
                    </div>
                  </div>

                  {/* Slowest API Alert */}
                  {slowestAPI && slowestAPI.responseTime > 0 && (
                    <div className="p-4 rounded-lg border-2" style={{ borderColor: CHART_COLORS.coral, backgroundColor: `${CHART_COLORS.coral}10` }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: CHART_COLORS.coral }} />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: CHART_COLORS.coral }}>
                            Slowest API Request
                          </h4>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{slowestAPI.method}</Badge>
                              <span className="text-sm font-medium truncate">{slowestAPI.label}</span>
                            </div>
                            {slowestAPI.url && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {slowestAPI.url}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="font-semibold" style={{ color: CHART_COLORS.coral }}>
                                {slowestAPI.responseTime}ms
                              </span>
                              <span className="text-muted-foreground">
                                Status: <span className={slowestAPI.success ? 'text-green-500' : 'text-red-500'}>{slowestAPI.statusCode}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Latency: {slowestAPI.latency}ms
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Response Time Distribution Chart */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Response Time Distribution
                      </h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Min', value: selectedExecution.summary.minResponseTime },
                              { name: 'Avg', value: selectedExecution.summary.avgResponseTime },
                              { name: 'P90', value: selectedExecution.summary.p90ResponseTime },
                              { name: 'P95', value: selectedExecution.summary.p95ResponseTime },
                              { name: 'P99', value: selectedExecution.summary.p99ResponseTime },
                              { name: 'Max', value: selectedExecution.summary.maxResponseTime },
                            ]}
                            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v}ms`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number) => [`${value}ms`, 'Response Time']}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              <Cell fill={CHART_COLORS.lime} />
                              <Cell fill={CHART_COLORS.green} />
                              <Cell fill={CHART_COLORS.yellow} />
                              <Cell fill={CHART_COLORS.orange} />
                              <Cell fill={CHART_COLORS.coral} />
                              <Cell fill={CHART_COLORS.magenta} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Success/Error Pie Chart */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4" />
                        Success vs Error Rate
                      </h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Successful', value: selectedExecution.summary.successCount },
                                { name: 'Errors', value: selectedExecution.summary.errorCount },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              <Cell fill={CHART_COLORS.green} />
                              <Cell fill={CHART_COLORS.coral} />
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number, name: string) => [value, name]}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* API Request Details Table */}
                  {apiStats.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        API Request Details
                      </h4>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[40%]">Endpoint</TableHead>
                              <TableHead className="text-center">Requests</TableHead>
                              <TableHead className="text-center">Avg Time</TableHead>
                              <TableHead className="text-center">Min</TableHead>
                              <TableHead className="text-center">Max</TableHead>
                              <TableHead className="text-center">Success Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {apiStats.map((api, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
                                    />
                                    <span className="font-medium text-sm truncate max-w-[200px]" title={api.label}>
                                      {api.label}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-medium">{api.count}</TableCell>
                                <TableCell className="text-center">
                                  <span 
                                    className="font-medium"
                                    style={{ 
                                      color: api.avgResponseTime > 1000 ? CHART_COLORS.coral : 
                                             api.avgResponseTime > 500 ? CHART_COLORS.orange : 
                                             CHART_COLORS.green 
                                    }}
                                  >
                                    {api.avgResponseTime}ms
                                  </span>
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">{api.minResponseTime}ms</TableCell>
                                <TableCell className="text-center text-muted-foreground">{api.maxResponseTime}ms</TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant={api.successRate === 100 ? 'default' : api.successRate >= 90 ? 'secondary' : 'destructive'}
                                    style={{ 
                                      backgroundColor: api.successRate === 100 ? `${CHART_COLORS.green}30` : 
                                                       api.successRate >= 90 ? `${CHART_COLORS.yellow}30` : 
                                                       `${CHART_COLORS.coral}30`,
                                      color: api.successRate === 100 ? CHART_COLORS.green : 
                                             api.successRate >= 90 ? CHART_COLORS.orange : 
                                             CHART_COLORS.coral
                                    }}
                                  >
                                    {api.successRate.toFixed(0)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* API Response Time Chart */}
                  {apiStats.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        API Response Times Comparison
                      </h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={apiStats.slice(0, 8).map((api, idx) => ({
                              name: api.label.length > 15 ? api.label.substring(0, 15) + '...' : api.label,
                              avg: api.avgResponseTime,
                              max: api.maxResponseTime,
                              fill: CHART_PALETTE[idx % CHART_PALETTE.length]
                            }))}
                            margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="name" 
                              fontSize={10} 
                              angle={-45} 
                              textAnchor="end" 
                              height={60}
                              interval={0}
                            />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v}ms`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number) => [`${value}ms`]}
                            />
                            <Bar dataKey="avg" name="Avg Response Time" radius={[4, 4, 0, 0]}>
                              {apiStats.slice(0, 8).map((_, idx) => (
                                <Cell key={`cell-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                              ))}
                            </Bar>
                            <Legend />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Response Time Comparison Chart - Trend across all executions */}
                  {executionHistory.length > 1 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Response Time Trend (All Executions)
                      </h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={executionHistory
                              .filter(e => e.summary)
                              .slice(0, 10)
                              .reverse()
                              .map((e, idx) => ({
                                execution: `#${idx + 1}`,
                                date: new Date(e.created_at).toLocaleDateString(),
                                avg: e.summary?.avgResponseTime || 0,
                                min: e.summary?.minResponseTime || 0,
                                max: e.summary?.maxResponseTime || 0,
                                p90: e.summary?.p90ResponseTime || 0,
                              }))}
                            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" fontSize={10} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v}ms`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number) => [`${value}ms`]}
                            />
                            <Area type="monotone" dataKey="max" stroke={CHART_COLORS.coral} fill={`${CHART_COLORS.coral}20`} name="Max" />
                            <Area type="monotone" dataKey="p90" stroke={CHART_COLORS.orange} fill={`${CHART_COLORS.orange}20`} name="P90" />
                            <Area type="monotone" dataKey="avg" stroke={CHART_COLORS.blue} fill={`${CHART_COLORS.blue}30`} name="Avg" />
                            <Area type="monotone" dataKey="min" stroke={CHART_COLORS.green} fill={`${CHART_COLORS.green}20`} name="Min" />
                            <Legend />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Error Rate Trend Chart */}
                  {executionHistory.length > 1 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Error Rate Trend (All Executions)
                      </h4>
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={executionHistory
                              .filter(e => e.summary)
                              .slice(0, 10)
                              .reverse()
                              .map((e, idx) => ({
                                execution: `#${idx + 1}`,
                                date: new Date(e.created_at).toLocaleDateString(),
                                errorRate: Number(e.summary?.errorRate || 0),
                                successRate: 100 - Number(e.summary?.errorRate || 0),
                              }))}
                            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" fontSize={10} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number) => [`${value}%`]}
                            />
                            <Bar dataKey="successRate" stackId="a" fill={CHART_COLORS.green} name="Success %" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="errorRate" stackId="a" fill={CHART_COLORS.coral} name="Error %" radius={[4, 4, 0, 0]} />
                            <Legend />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Response Time Stats Table */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Detailed Statistics</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Minimum Response Time</TableCell>
                          <TableCell className="text-right">{selectedExecution.summary.minResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Maximum Response Time</TableCell>
                          <TableCell className="text-right">{selectedExecution.summary.maxResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Average Response Time</TableCell>
                          <TableCell className="text-right">{selectedExecution.summary.avgResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>90th Percentile</TableCell>
                          <TableCell className="text-right">{selectedExecution.summary.p90ResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>95th Percentile</TableCell>
                          <TableCell className="text-right">{selectedExecution.summary.p95ResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>99th Percentile</TableCell>
                          <TableCell className="text-right">{selectedExecution.summary.p99ResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Total Bytes Transferred</TableCell>
                          <TableCell className="text-right">{(Number(selectedExecution.summary.totalBytes || 0) / 1024).toFixed(2)} KB</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No summary data available for this execution
                </div>
              )
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                Select an execution to view its details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Check if we have current session data
  const hasCurrentSessionData = summary && metrics.length > 0;

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
          <TabsList>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            {hasCurrentSessionData && (
              <>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </>
            )}
          </TabsList>
        </Tabs>
        
        {hasCurrentSessionData && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToJSON}>
              <FileJson className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* History View (default) */}
      {activeView === 'history' && renderHistoryView()}

      {/* Summary View */}
      {activeView === 'summary' && (
        <>
          {/* Overall Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.avgResponseTime.toFixed(0)}ms</p>
                    <p className="text-xs text-muted-foreground">Avg Response Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Zap className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.throughput.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Throughput (req/s)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${summary.errorRate > 5 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                    {summary.errorRate > 5 ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.errorRate.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">Error Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Response Time Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Response Time Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <TrendingDown className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
                  <p className="text-2xl font-bold">{summary.minResponseTime.toFixed(0)}ms</p>
                  <p className="text-xs text-muted-foreground">Minimum</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Clock className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold">{summary.avgResponseTime.toFixed(0)}ms</p>
                  <p className="text-xs text-muted-foreground">Average</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold">{summary.maxResponseTime.toFixed(0)}ms</p>
                  <p className="text-xs text-muted-foreground">Maximum</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Request Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Summary</CardTitle>
              <CardDescription>Aggregated metrics per request type</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request</TableHead>
                      <TableHead className="text-right">Samples</TableHead>
                      <TableHead className="text-right">Avg (ms)</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                      <TableHead className="text-right">P90</TableHead>
                      <TableHead className="text-right">P95</TableHead>
                      <TableHead className="text-right">Error %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedByRequest.map((req, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{req.requestName}</TableCell>
                        <TableCell className="text-right">{req.samples}</TableCell>
                        <TableCell className="text-right">{req.avgResponseTime.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{req.minResponseTime.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{req.maxResponseTime.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{req.p90.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{req.p95.toFixed(0)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={req.errorRate > 5 ? 'destructive' : 'outline'}>
                            {req.errorRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Charts View */}
      {activeView === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Response Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                Response Time Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={responseTimeChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'bottom' }} />
                    <YAxis label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area type="monotone" dataKey="max" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.1)" name="Max" />
                    <Area type="monotone" dataKey="avg" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Avg" />
                    <Area type="monotone" dataKey="min" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.1)" name="Min" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Requests vs Errors Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Requests vs Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'bottom' }} />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="success" stackId="a" fill="hsl(142 76% 36%)" name="Success" />
                    <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" name="Errors" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Code Distribution */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">HTTP Status Code Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {statusCodeDistribution.map(({ code, count, percentage }) => (
                  <div
                    key={code}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      code.startsWith('2') ? 'bg-emerald-500/10' :
                      code.startsWith('4') ? 'bg-amber-500/10' :
                      code.startsWith('5') || code === 'Error' ? 'bg-red-500/10' :
                      'bg-muted'
                    }`}
                  >
                    <Badge variant="outline" className={
                      code.startsWith('2') ? 'border-emerald-500' :
                      code.startsWith('4') ? 'border-amber-500' :
                      code.startsWith('5') || code === 'Error' ? 'border-red-500' :
                      ''
                    }>
                      {code}
                    </Badge>
                    <div>
                      <p className="font-bold">{count.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Details View */}
      {activeView === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Raw Request Details</CardTitle>
            <CardDescription>
              Showing latest 500 requests (out of {metrics.length.toLocaleString()} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Response (ms)</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.slice(-500).reverse().map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{metrics.length - idx}</TableCell>
                      <TableCell className="font-medium">{m.requestName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">{m.responseTime.toFixed(0)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={m.success ? 'outline' : 'destructive'}>
                          {m.statusCode || 'ERR'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {(m.bytes / 1024).toFixed(1)}KB
                      </TableCell>
                      <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                        {m.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
