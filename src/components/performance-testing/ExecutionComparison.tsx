import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  GitCompare, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  X
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

// Color palette matching the project's design system
const CHART_COLORS = {
  magenta: '#E879F9',
  coral: '#FB7185',
  orange: '#FB923C',
  yellow: '#FACC15',
  lime: '#A3E635',
  green: '#4ADE80',
  teal: '#2DD4BF',
  blue: '#60A5FA',
  purple: '#A78BFA',
  violet: '#C084FC',
};

interface ExecutionSummary {
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
}

interface ExecutionResult {
  id: string;
  job_id: string;
  agent_id: string;
  status: string;
  created_at: string;
  summary: ExecutionSummary | null;
}

interface ExecutionComparisonProps {
  executions: ExecutionResult[];
  onClose: () => void;
}

export const ExecutionComparison = ({ executions, onClose }: ExecutionComparisonProps) => {
  const [baselineExecution, setBaselineExecution] = useState<ExecutionResult | null>(null);
  const [comparisonExecution, setComparisonExecution] = useState<ExecutionResult | null>(null);

  const calculateChange = (baseline: number, comparison: number): { value: number; type: 'improvement' | 'regression' | 'neutral' } => {
    if (baseline === 0) return { value: 0, type: 'neutral' };
    const change = ((comparison - baseline) / baseline) * 100;
    return {
      value: Math.abs(change),
      type: change < -5 ? 'improvement' : change > 5 ? 'regression' : 'neutral'
    };
  };

  const comparisonData = useMemo(() => {
    if (!baselineExecution?.summary || !comparisonExecution?.summary) return null;

    const baseline = baselineExecution.summary;
    const comparison = comparisonExecution.summary;

    return {
      responseTime: {
        avg: calculateChange(baseline.avgResponseTime, comparison.avgResponseTime),
        p90: calculateChange(baseline.p90ResponseTime, comparison.p90ResponseTime),
        p95: calculateChange(baseline.p95ResponseTime, comparison.p95ResponseTime),
        p99: calculateChange(baseline.p99ResponseTime, comparison.p99ResponseTime),
        min: calculateChange(baseline.minResponseTime, comparison.minResponseTime),
        max: calculateChange(baseline.maxResponseTime, comparison.maxResponseTime),
      },
      errorRate: calculateChange(baseline.errorRate, comparison.errorRate),
      throughput: calculateChange(baseline.totalRequests, comparison.totalRequests),
    };
  }, [baselineExecution, comparisonExecution]);

  const barChartData = useMemo(() => {
    if (!baselineExecution?.summary || !comparisonExecution?.summary) return [];

    return [
      { 
        metric: 'Avg', 
        Baseline: baselineExecution.summary.avgResponseTime, 
        Comparison: comparisonExecution.summary.avgResponseTime 
      },
      { 
        metric: 'P90', 
        Baseline: baselineExecution.summary.p90ResponseTime, 
        Comparison: comparisonExecution.summary.p90ResponseTime 
      },
      { 
        metric: 'P95', 
        Baseline: baselineExecution.summary.p95ResponseTime, 
        Comparison: comparisonExecution.summary.p95ResponseTime 
      },
      { 
        metric: 'P99', 
        Baseline: baselineExecution.summary.p99ResponseTime, 
        Comparison: comparisonExecution.summary.p99ResponseTime 
      },
      { 
        metric: 'Max', 
        Baseline: baselineExecution.summary.maxResponseTime, 
        Comparison: comparisonExecution.summary.maxResponseTime 
      },
    ];
  }, [baselineExecution, comparisonExecution]);

  const radarChartData = useMemo(() => {
    if (!baselineExecution?.summary || !comparisonExecution?.summary) return [];

    // Normalize values for radar chart (0-100 scale)
    const normalizeValue = (value: number, max: number) => Math.min((value / max) * 100, 100);
    
    const maxValues = {
      avgResponseTime: Math.max(baselineExecution.summary.avgResponseTime, comparisonExecution.summary.avgResponseTime) || 1,
      p99ResponseTime: Math.max(baselineExecution.summary.p99ResponseTime, comparisonExecution.summary.p99ResponseTime) || 1,
      totalRequests: Math.max(baselineExecution.summary.totalRequests, comparisonExecution.summary.totalRequests) || 1,
      successRate: 100,
      errorRate: Math.max(baselineExecution.summary.errorRate, comparisonExecution.summary.errorRate, 1),
    };

    return [
      { 
        metric: 'Avg Response', 
        Baseline: normalizeValue(baselineExecution.summary.avgResponseTime, maxValues.avgResponseTime), 
        Comparison: normalizeValue(comparisonExecution.summary.avgResponseTime, maxValues.avgResponseTime) 
      },
      { 
        metric: 'P99 Response', 
        Baseline: normalizeValue(baselineExecution.summary.p99ResponseTime, maxValues.p99ResponseTime), 
        Comparison: normalizeValue(comparisonExecution.summary.p99ResponseTime, maxValues.p99ResponseTime) 
      },
      { 
        metric: 'Throughput', 
        Baseline: normalizeValue(baselineExecution.summary.totalRequests, maxValues.totalRequests), 
        Comparison: normalizeValue(comparisonExecution.summary.totalRequests, maxValues.totalRequests) 
      },
      { 
        metric: 'Success Rate', 
        Baseline: 100 - baselineExecution.summary.errorRate, 
        Comparison: 100 - comparisonExecution.summary.errorRate 
      },
      { 
        metric: 'Error Rate', 
        Baseline: normalizeValue(baselineExecution.summary.errorRate, maxValues.errorRate), 
        Comparison: normalizeValue(comparisonExecution.summary.errorRate, maxValues.errorRate) 
      },
    ];
  }, [baselineExecution, comparisonExecution]);

  const getChangeIcon = (type: 'improvement' | 'regression' | 'neutral') => {
    switch (type) {
      case 'improvement':
        return <TrendingDown className="h-4 w-4 text-emerald-500" />;
      case 'regression':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getChangeBadge = (change: { value: number; type: 'improvement' | 'regression' | 'neutral' }, invertColors = false) => {
    const type = invertColors 
      ? (change.type === 'improvement' ? 'regression' : change.type === 'regression' ? 'improvement' : 'neutral')
      : change.type;
    
    const colorClass = type === 'improvement' 
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
      : type === 'regression' 
        ? 'bg-red-500/10 text-red-600 border-red-500/20'
        : 'bg-muted text-muted-foreground';

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
        {getChangeIcon(type)}
        {change.value.toFixed(1)}%
      </span>
    );
  };

  const validExecutions = executions.filter(e => e.summary && e.status === 'completed');

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Execution Comparison
          </CardTitle>
          <CardDescription>
            Compare two test executions to identify performance regressions
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Execution Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Badge variant="outline" style={{ backgroundColor: CHART_COLORS.blue + '20', borderColor: CHART_COLORS.blue }}>
                Baseline
              </Badge>
              <span className="text-muted-foreground">(Reference execution)</span>
            </label>
            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {validExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className={`p-2 rounded cursor-pointer transition-all text-sm ${
                      baselineExecution?.id === execution.id
                        ? 'bg-blue-500/10 border border-blue-500/30'
                        : 'hover:bg-muted'
                    } ${comparisonExecution?.id === execution.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (comparisonExecution?.id !== execution.id) {
                        setBaselineExecution(execution);
                      }
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {new Date(execution.created_at).toLocaleString()}
                      </span>
                      {execution.summary && (
                        <span className="text-xs font-medium">
                          {execution.summary.avgResponseTime}ms avg
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Badge variant="outline" style={{ backgroundColor: CHART_COLORS.coral + '20', borderColor: CHART_COLORS.coral }}>
                Comparison
              </Badge>
              <span className="text-muted-foreground">(Execution to compare)</span>
            </label>
            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {validExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className={`p-2 rounded cursor-pointer transition-all text-sm ${
                      comparisonExecution?.id === execution.id
                        ? 'bg-pink-500/10 border border-pink-500/30'
                        : 'hover:bg-muted'
                    } ${baselineExecution?.id === execution.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (baselineExecution?.id !== execution.id) {
                        setComparisonExecution(execution);
                      }
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {new Date(execution.created_at).toLocaleString()}
                      </span>
                      {execution.summary && (
                        <span className="text-xs font-medium">
                          {execution.summary.avgResponseTime}ms avg
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Comparison Results */}
        {baselineExecution && comparisonExecution && comparisonData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="flex items-center justify-center gap-4 py-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Baseline</p>
                <p className="text-sm font-medium">
                  {new Date(baselineExecution.created_at).toLocaleDateString()}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Comparison</p>
                <p className="text-sm font-medium">
                  {new Date(comparisonExecution.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Key Metrics Comparison */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg text-center space-y-2">
                <Activity className="h-5 w-5 mx-auto text-primary" />
                <div className="text-xs text-muted-foreground">Throughput</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">{baselineExecution.summary?.totalRequests}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{comparisonExecution.summary?.totalRequests}</span>
                </div>
                {getChangeBadge(comparisonData.throughput, true)}
              </div>

              <div className="p-4 border rounded-lg text-center space-y-2">
                <Clock className="h-5 w-5 mx-auto text-amber-500" />
                <div className="text-xs text-muted-foreground">Avg Response</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">{baselineExecution.summary?.avgResponseTime}ms</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{comparisonExecution.summary?.avgResponseTime}ms</span>
                </div>
                {getChangeBadge(comparisonData.responseTime.avg)}
              </div>

              <div className="p-4 border rounded-lg text-center space-y-2">
                <CheckCircle className="h-5 w-5 mx-auto text-emerald-500" />
                <div className="text-xs text-muted-foreground">Success Rate</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">{(100 - Number(baselineExecution.summary?.errorRate || 0)).toFixed(1)}%</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{(100 - Number(comparisonExecution.summary?.errorRate || 0)).toFixed(1)}%</span>
                </div>
              </div>

              <div className="p-4 border rounded-lg text-center space-y-2">
                <AlertTriangle className="h-5 w-5 mx-auto text-red-500" />
                <div className="text-xs text-muted-foreground">Error Rate</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">{Number(baselineExecution.summary?.errorRate || 0).toFixed(1)}%</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{Number(comparisonExecution.summary?.errorRate || 0).toFixed(1)}%</span>
                </div>
                {getChangeBadge(comparisonData.errorRate)}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Response Time Bar Chart */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4 text-sm">Response Time Comparison (ms)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Baseline" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Comparison" fill={CHART_COLORS.coral} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar Chart */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4 text-sm">Performance Profile Comparison</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarChartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Radar 
                      name="Baseline" 
                      dataKey="Baseline" 
                      stroke={CHART_COLORS.blue} 
                      fill={CHART_COLORS.blue} 
                      fillOpacity={0.3} 
                    />
                    <Radar 
                      name="Comparison" 
                      dataKey="Comparison" 
                      stroke={CHART_COLORS.coral} 
                      fill={CHART_COLORS.coral} 
                      fillOpacity={0.3} 
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Metrics Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">Comparison</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Average Response Time</TableCell>
                    <TableCell className="text-right">{baselineExecution.summary?.avgResponseTime}ms</TableCell>
                    <TableCell className="text-right">{comparisonExecution.summary?.avgResponseTime}ms</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.responseTime.avg.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.responseTime.avg)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">P90 Response Time</TableCell>
                    <TableCell className="text-right">{baselineExecution.summary?.p90ResponseTime}ms</TableCell>
                    <TableCell className="text-right">{comparisonExecution.summary?.p90ResponseTime}ms</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.responseTime.p90.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.responseTime.p90)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">P95 Response Time</TableCell>
                    <TableCell className="text-right">{baselineExecution.summary?.p95ResponseTime}ms</TableCell>
                    <TableCell className="text-right">{comparisonExecution.summary?.p95ResponseTime}ms</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.responseTime.p95.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.responseTime.p95)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">P99 Response Time</TableCell>
                    <TableCell className="text-right">{baselineExecution.summary?.p99ResponseTime}ms</TableCell>
                    <TableCell className="text-right">{comparisonExecution.summary?.p99ResponseTime}ms</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.responseTime.p99.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.responseTime.p99)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Maximum Response Time</TableCell>
                    <TableCell className="text-right">{baselineExecution.summary?.maxResponseTime}ms</TableCell>
                    <TableCell className="text-right">{comparisonExecution.summary?.maxResponseTime}ms</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.responseTime.max.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.responseTime.max)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Error Rate</TableCell>
                    <TableCell className="text-right">{Number(baselineExecution.summary?.errorRate || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{Number(comparisonExecution.summary?.errorRate || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.errorRate.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.errorRate)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total Requests</TableCell>
                    <TableCell className="text-right">{baselineExecution.summary?.totalRequests}</TableCell>
                    <TableCell className="text-right">{comparisonExecution.summary?.totalRequests}</TableCell>
                    <TableCell className="text-right">
                      {comparisonData.throughput.value.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">{getChangeBadge(comparisonData.throughput, true)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Regression Alert */}
            {(comparisonData.responseTime.avg.type === 'regression' || 
              comparisonData.responseTime.p99.type === 'regression' ||
              comparisonData.errorRate.type === 'regression') && (
              <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-600">Performance Regression Detected</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      The comparison execution shows degraded performance compared to the baseline. 
                      Review the metrics above to identify specific areas of concern.
                    </p>
                    <ul className="text-sm mt-2 space-y-1">
                      {comparisonData.responseTime.avg.type === 'regression' && (
                        <li className="text-red-600">• Average response time increased by {comparisonData.responseTime.avg.value.toFixed(1)}%</li>
                      )}
                      {comparisonData.responseTime.p99.type === 'regression' && (
                        <li className="text-red-600">• P99 response time increased by {comparisonData.responseTime.p99.value.toFixed(1)}%</li>
                      )}
                      {comparisonData.errorRate.type === 'regression' && (
                        <li className="text-red-600">• Error rate increased by {comparisonData.errorRate.value.toFixed(1)}%</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Improvement Alert */}
            {comparisonData.responseTime.avg.type === 'improvement' && 
             comparisonData.errorRate.type !== 'regression' && (
              <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-emerald-600">Performance Improvement Detected</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      The comparison execution shows improved performance compared to the baseline.
                    </p>
                    <ul className="text-sm mt-2 space-y-1">
                      {comparisonData.responseTime.avg.type === 'improvement' && (
                        <li className="text-emerald-600">• Average response time decreased by {comparisonData.responseTime.avg.value.toFixed(1)}%</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
            <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select two executions to compare</p>
            <p className="text-sm">Choose a baseline and comparison execution from the lists above</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
