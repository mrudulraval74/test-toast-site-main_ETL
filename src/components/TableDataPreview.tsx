import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface TableDataPreviewProps {
  data: any[];
  columns: string[];
  loading?: boolean;
  tableName?: string;
}

export function TableDataPreview({ data, columns, loading, tableName }: TableDataPreviewProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading table data...
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground py-8">
          {tableName ? `No data found in table "${tableName}"` : 'Select a table to preview data'}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {tableName ? `Table: ${tableName}` : 'Table Data Preview'}
        </h3>
        <div className="flex gap-2">
          <Badge variant="secondary">{data.length} rows</Badge>
          <Badge variant="secondary">{columns.length} columns</Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[400px] border rounded-md">
        <div className="min-w-full">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="font-mono text-xs whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell className="text-center text-muted-foreground text-xs">
                    {rowIndex + 1}
                  </TableCell>
                  {columns.map((col) => {
                    const value = row[col];
                    const isNull = value === null || value === undefined;
                    
                    return (
                      <TableCell key={col} className="font-mono text-xs whitespace-nowrap">
                        {isNull ? (
                          <span className="text-muted-foreground italic bg-muted px-1 rounded">
                            NULL
                          </span>
                        ) : (
                          String(value)
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
