import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ColumnMismatch {
  column: string;
  mismatchCount: number;
  mismatches: Array<{
    key: Record<string, any>;
    sourceValue: any;
    targetValue: any;
    rowIndex: number;
  }>;
}

interface ColumnMismatchDrillDownProps {
  columnMismatches: ColumnMismatch[];
}

export function ColumnMismatchDrillDown({ columnMismatches }: ColumnMismatchDrillDownProps) {
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  const toggleColumn = (column: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(column)) {
      newExpanded.delete(column);
    } else {
      newExpanded.add(column);
    }
    setExpandedColumns(newExpanded);
  };

  const columnsWithMismatches = columnMismatches.filter(cm => cm.mismatchCount > 0);

  if (columnsWithMismatches.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-lg font-medium mb-1">No Column Mismatches</p>
          <p className="text-sm">All column values matched between source and target</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Column-Level Mismatches</h3>
          <p className="text-sm text-muted-foreground">
            {columnsWithMismatches.length} column{columnsWithMismatches.length !== 1 ? 's' : ''} with value differences
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedColumns(new Set(columnsWithMismatches.map(cm => cm.column)))}
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedColumns(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {columnsWithMismatches.map((columnMismatch) => {
          const isExpanded = expandedColumns.has(columnMismatch.column);

          return (
            <Collapsible
              key={columnMismatch.column}
              open={isExpanded}
              onOpenChange={() => toggleColumn(columnMismatch.column)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-mono font-semibold">{columnMismatch.column}</p>
                        <p className="text-sm text-muted-foreground">
                          {columnMismatch.mismatchCount} value{columnMismatch.mismatchCount !== 1 ? 's' : ''} differ
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">
                      {columnMismatch.mismatchCount}
                    </Badge>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Row Index</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead className="bg-destructive/5">Source Value</TableHead>
                            <TableHead className="bg-primary/5">Target Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columnMismatch.mismatches.map((mismatch, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">
                                {mismatch.rowIndex}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {JSON.stringify(mismatch.key)}
                              </TableCell>
                              <TableCell className="font-mono text-xs bg-destructive/5">
                                <div className="max-w-xs truncate" title={String(mismatch.sourceValue)}>
                                  {mismatch.sourceValue === null || mismatch.sourceValue === undefined
                                    ? <span className="text-muted-foreground italic">null</span>
                                    : String(mismatch.sourceValue)}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs bg-primary/5">
                                <div className="max-w-xs truncate" title={String(mismatch.targetValue)}>
                                  {mismatch.targetValue === null || mismatch.targetValue === undefined
                                    ? <span className="text-muted-foreground italic">null</span>
                                    : String(mismatch.targetValue)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {columnMismatch.mismatchCount > columnMismatch.mismatches.length && (
                      <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                        Showing {columnMismatch.mismatches.length} of {columnMismatch.mismatchCount} mismatches
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
