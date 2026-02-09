import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Database, Table, Columns3, Loader2, Key, Circle, Search, LayoutGrid, ListTree, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table as UiTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  defaultValue?: string;
}

interface Table {
  name: string;
  columns: Column[];
}

interface Schema {
  name: string;
  tables: Table[];
}

interface DatabaseNode {
  name: string;
  schemas: Schema[];
}

interface DatabaseTreeProps {
  data: DatabaseNode[];
  loading?: boolean;
  error?: string | null;
}

export function DatabaseTree({ data, loading, error }: DatabaseTreeProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<{ db: string, schema: string, table: Table } | null>(null);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();

    return data.map(db => {
      const dbMatches = db.name.toLowerCase().includes(lowerSearch);
      const filteredSchemas = (db.schemas || []).map(schema => {
        const schemaMatches = schema.name.toLowerCase().includes(lowerSearch);
        const filteredTables = (schema.tables || []).filter(table => {
          const tableMatches = table.name.toLowerCase().includes(lowerSearch);
          const columnMatches = (table.columns || []).some(col => col.name.toLowerCase().includes(lowerSearch));
          return tableMatches || columnMatches || schemaMatches || dbMatches;
        });

        if (filteredTables.length > 0 || schemaMatches || dbMatches) {
          return { ...schema, tables: filteredTables };
        }
        return null;
      }).filter(Boolean) as Schema[];

      if (filteredSchemas.length > 0 || dbMatches) {
        return { ...db, schemas: filteredSchemas };
      }
      return null;
    }).filter(Boolean) as DatabaseNode[];
  }, [data, searchTerm]);

  const toggleDb = (dbName: string) => {
    setExpandedDbs((prev) => {
      const next = new Set(prev);
      if (next.has(dbName)) next.delete(dbName);
      else next.add(dbName);
      return next;
    });
  };

  const toggleSchema = (key: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTable = (key: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleTableSelect = (dbName: string, schemaName: string, table: Table) => {
    setSelectedTable({ db: dbName, schema: schemaName, table });
    if (viewMode === 'tree') {
      // In tree mode, just toggle expansion
      toggleTable(`${dbName}.${schemaName}.${table.name}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading database structure...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive p-4 text-center">
        <Database className="h-8 w-8 mb-2 opacity-50" />
        <p className="font-semibold text-sm mb-1">Failed to Load Schema</p>
        <p className="text-xs opacity-80 max-w-[250px]">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No databases loaded. Test connection and fetch databases first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search databases, tables, columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center border rounded-md bg-muted/50 p-1">
          <Button
            variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('tree')}
            className="h-7 px-2"
            title="Tree View"
          >
            <ListTree className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-7 px-2"
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-4", viewMode === 'grid' ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1")}>
        {/* Tree Section */}
        <ScrollArea className={cn("border rounded-md p-2", viewMode === 'grid' ? "h-[500px] md:col-span-1" : "h-[500px]")}>
          <div className="space-y-1">
            {filteredData.map((db) => (
              <div key={db.name}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleDb(db.name)}
                  className="w-full justify-start h-8 px-2 font-semibold"
                >
                  {expandedDbs.has(db.name) ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                  <Database className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="truncate">{db.name}</span>
                </Button>
                {expandedDbs.has(db.name) && (
                  <div className="ml-4 space-y-1 border-l pl-2">
                    {(db.schemas || []).map((schema) => {
                      const schemaKey = `${db.name}.${schema.name}`;
                      return (
                        <div key={schemaKey}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSchema(schemaKey)}
                            className="w-full justify-start h-8 px-2"
                          >
                            {expandedSchemas.has(schemaKey) ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                            <Columns3 className="h-4 w-4 mr-2 text-orange-500" />
                            <span className="truncate">{schema.name}</span>
                          </Button>
                          {expandedSchemas.has(schemaKey) && (
                            <div className="ml-4 space-y-1 border-l pl-2">
                              {schema.tables.map((table) => {
                                const tableKey = `${schemaKey}.${table.name}`;
                                const isSelected = selectedTable?.table.name === table.name && selectedTable?.schema === schema.name;
                                return (
                                  <div key={tableKey}>
                                    <Button
                                      variant={isSelected && viewMode === 'grid' ? 'secondary' : 'ghost'}
                                      size="sm"
                                      onClick={() => handleTableSelect(db.name, schema.name, table)}
                                      className="w-full justify-start h-8 px-2"
                                    >
                                      {viewMode === 'tree' && (
                                        expandedTables.has(tableKey) ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />
                                      )}
                                      <Table className="h-4 w-4 mr-2 text-green-500" />
                                      <span className="truncate">{table.name}</span>
                                    </Button>

                                    {/* Tree View Columns */}
                                    {viewMode === 'tree' && expandedTables.has(tableKey) && (
                                      <div className="ml-4 space-y-1 border-l pl-2 py-1">
                                        <TooltipProvider>
                                          {table.columns.map((col) => (
                                            <Tooltip key={col.name}>
                                              <TooltipTrigger asChild>
                                                <div className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded text-xs cursor-default">
                                                  {col.isPrimaryKey ? (
                                                    <Key className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                                  ) : (
                                                    <Circle className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                                                  )}
                                                  <span className="font-mono truncate flex-1">{col.name}</span>
                                                  <span className="text-muted-foreground text-[10px]">{col.type}</span>
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent side="right">
                                                <div className="text-xs space-y-1">
                                                  <p><strong>Type:</strong> {col.type}</p>
                                                  {col.maxLength && <p><strong>Length:</strong> {col.maxLength}</p>}
                                                  {col.nullable && <p><strong>Nullable:</strong> Yes</p>}
                                                  {col.defaultValue && <p><strong>Default:</strong> {col.defaultValue}</p>}
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          ))}
                                        </TooltipProvider>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Grid View Details Section */}
        {viewMode === 'grid' && (
          <div className="md:col-span-2 h-[500px] border rounded-md flex flex-col">
            {selectedTable ? (
              <>
                <div className="p-3 border-b bg-muted/20 flex items-center gap-2">
                  <Table className="h-5 w-5 text-green-500" />
                  <span className="font-semibold">{selectedTable.schema}.{selectedTable.table.name}</span>
                  <Badge variant="outline" className="ml-auto">
                    {selectedTable.table.columns.length} Columns
                  </Badge>
                </div>
                <ScrollArea className="flex-1">
                  <UiTable>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30px]"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Length/Prec</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead className="w-[80px]">Attributes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTable.table.columns.map((col) => (
                        <TableRow key={col.name} className="hover:bg-muted/50">
                          <TableCell>
                            {col.isPrimaryKey && <Key className="h-4 w-4 text-yellow-500" />}
                          </TableCell>
                          <TableCell className="font-medium font-mono">{col.name}</TableCell>
                          <TableCell className="text-muted-foreground">{col.type}</TableCell>
                          <TableCell>
                            {col.maxLength ? col.maxLength :
                              col.precision ? `${col.precision}${col.scale ? `,${col.scale}` : ''}` : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs truncate max-w-[100px]" title={col.defaultValue}>
                            {col.defaultValue || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {col.isPrimaryKey && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">PK</Badge>}
                              {col.nullable && <Badge variant="secondary" className="text-[10px]">NULL</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </UiTable>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <LayoutGrid className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium">Select a table to view details</p>
                <p className="text-sm">Click on any table in the tree to view its columns and metadata.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
