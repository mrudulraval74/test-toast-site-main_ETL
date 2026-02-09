import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ChevronLeft, ChevronRight, BarChart3, AlertCircle, Code, Layers } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { compareApi } from '@/lib/api';
import { ColumnMismatchDrillDown } from './ColumnMismatchDrillDown';

interface ComparisonResultsProps {
  comparisonId: string;
  results: any;
}

export function ComparisonResults({
  comparisonId,
  results,
}: ComparisonResultsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  if (!results) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No results yet. Run a comparison to see results here.
      </div>
    );
  }

  const summary = results.summary || {};
  const rawMismatches = results.sampleMismatches;
  const mismatches = Array.isArray(rawMismatches)
    ? rawMismatches
    : rawMismatches && typeof rawMismatches === 'object'
      ? Object.values(rawMismatches).flatMap((v: any) =>
          Array.isArray(v) ? v : v ? [v] : []
        )
      : [];
  const columnStats = results.columnStats || [];
  const columnMismatches = results.columnMismatches || [];
  
  // Show mismatches section if there are any mismatches OR if match rate is 0%
  const shouldShowMismatches = mismatches.length > 0 || summary.matchRate === 0;

  const totalPages = Math.max(1, Math.ceil(mismatches.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const currentMismatches = mismatches.slice(startIdx, endIdx);

  const handleDownload = async (format: 'csv' | 'json' | 'excel') => {
    try {
      await compareApi.download(comparisonId, format);
    } catch (error) {
      console.error('Download error:', error);
      // Could add toast notification here
    }
  };

  return (
    <Tabs defaultValue="summary" className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="column-mismatches" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Column Drill-Down
          </TabsTrigger>
          <TabsTrigger value="mismatches" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Row Mismatches {mismatches.length > 0 && `(${mismatches.length})`}
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Raw JSON
          </TabsTrigger>
        </TabsList>

        {/* Download Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('csv')}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('json')}
          >
            <Download className="h-4 w-4 mr-1" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('excel')}
          >
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Tab */}
      <TabsContent value="summary" className="space-y-6 mt-0">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Rows</div>
            <div className="text-2xl font-bold">{summary.totalRows || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Matched</div>
            <div className="text-2xl font-bold text-primary">
              {summary.matchedRows || 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Mismatched</div>
            <div className="text-2xl font-bold text-destructive">
              {summary.mismatchedRows || 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Match Rate</div>
            <div className="text-2xl font-bold">
              {summary.matchRate ? `${(summary.matchRate * 100).toFixed(2)}%` : '0%'}
            </div>
          </Card>
        </div>

        {/* Column Statistics */}
        {columnStats.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Column Statistics</h3>
            <div className="space-y-2">
              {columnStats.map((stat: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <span className="font-mono text-sm">{stat.column}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">
                      {stat.matchCount} / {stat.totalCount} matched
                    </span>
                    <Badge variant={stat.matchRate > 0.95 ? 'default' : 'destructive'}>
                      {(stat.matchRate * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {columnStats.length === 0 && (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No column statistics available</p>
            </div>
          </Card>
        )}
      </TabsContent>

      {/* Column Mismatches Drill-Down Tab */}
      <TabsContent value="column-mismatches" className="mt-0">
        <ColumnMismatchDrillDown columnMismatches={columnMismatches} />
      </TabsContent>

      {/* Row Mismatches Tab */}
      <TabsContent value="mismatches" className="mt-0">
        {shouldShowMismatches && mismatches.length > 0 ? (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Mismatch Details</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Column</TableHead>
                    <TableHead colSpan={2}>Row Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMismatches.map((mismatch: any, index: number) => {
                    const mismatchType = mismatch._mismatchType;
                    const allColumns = Object.keys(mismatch).filter(k => k !== '_mismatchType');
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">
                          <Badge variant={mismatchType === 'missingInTarget' ? 'destructive' : 'secondary'}>
                            {mismatchType === 'missingInTarget' ? 'Missing in Target' : 'Missing in Source'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{allColumns[0]}</TableCell>
                        <TableCell className="font-mono text-xs" colSpan={2}>
                          {JSON.stringify(mismatch, null, 2).substring(0, 100)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              {summary.matchRate === 0 ? (
                <>
                  <p className="text-lg font-medium mb-1 text-destructive">Complete Mismatch</p>
                  <p className="text-sm">No matching rows found between source and target datasets</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium mb-1">No Mismatches Found</p>
                  <p className="text-sm">All compared rows matched successfully!</p>
                </>
              )}
            </div>
          </Card>
        )}
      </TabsContent>

      {/* Raw JSON Tab */}
      <TabsContent value="raw" className="mt-0">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Raw Comparison Data</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(results, null, 2));
              }}
            >
              Copy JSON
            </Button>
          </div>
          <ScrollArea className="h-[600px] w-full rounded-md border">
            <pre className="p-4 text-xs">
              <code>{JSON.stringify(results, null, 2)}</code>
            </pre>
          </ScrollArea>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
