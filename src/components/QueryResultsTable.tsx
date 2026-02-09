
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Database, Rows3 } from 'lucide-react';

interface QueryResultsTableProps {
  columns: string[];
  rows: any[];
  title?: string;
}

export function QueryResultsTable({ columns, rows, title }: QueryResultsTableProps) {
  if (!columns || columns.length === 0) {
    return null;
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value);
  };

  return (
    <Card className="mt-4">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && <h3 className="font-medium">{title}</h3>}
          <Badge variant="secondary" className="gap-1">
            <Rows3 className="h-3 w-3" />
            {rows.length} rows
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Database className="h-3 w-3" />
            {columns.length} columns
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csvContent = [
                columns.join(','),
                ...rows.map(row => columns.map(col => {
                  const val = row[col];
                  if (val === null || val === undefined) return '';
                  const str = String(val);
                  return str.includes(',') ? `"${str}"` : str;
                }).join(','))
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `query_results_${new Date().toISOString()}.csv`;
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const jsonContent = JSON.stringify(rows, null, 2);
              const blob = new Blob([jsonContent], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `query_results_${new Date().toISOString()}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
        </div>
      </div>

      <div className="h-[400px] overflow-auto relative w-full">
        <div className="min-w-full inline-block align-middle">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center font-semibold">#</TableHead>
                {columns.map((col, index) => (
                  <TableHead key={index} className="font-semibold min-w-[150px] whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                    No data returned
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50">
                    <TableCell className="text-center text-muted-foreground font-mono text-xs">
                      {rowIndex + 1}
                    </TableCell>
                    {columns.map((col, colIndex) => {
                      const value = row[col];
                      const displayValue = formatValue(value);
                      const isNull = value === null || value === undefined;

                      return (
                        <TableCell
                          key={colIndex}
                          className={`font-mono text-xs whitespace-nowrap ${isNull ? 'text-muted-foreground italic' : ''}`}
                        >
                          {displayValue}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}
