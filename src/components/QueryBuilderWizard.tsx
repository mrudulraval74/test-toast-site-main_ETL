import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  X,
  Wand2,
  Plus,
  Trash2,
  GripVertical,
  Filter,
  Link as LinkIcon,
  ArrowUpDown,
  Layers,
  Eye,
  Save,
  FolderOpen,
  Maximize2,
  Copy
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Column {
  name: string;
  type: string;
  tableName: string;
  schemaName: string;
  databaseName: string;
}

interface WhereCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface JoinCondition {
  id: string;
  joinType: string;
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
}

interface OrderByCondition {
  id: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

interface HavingCondition {
  id: string;
  aggregateFunction: string;
  column: string;
  operator: string;
  value: string;
}

export interface QueryBuilderState {
  selectedTable: {
    database: string;
    schema: string;
    table: string;
  } | null;
  selectedColumns: Column[];
  whereConditions: WhereCondition[];
  joinConditions: JoinCondition[];
  groupByColumns: string[];
  havingConditions: HavingCondition[];
  orderByConditions: OrderByCondition[];
  useDistinct: boolean;
  limitValue: string;
  offsetValue: string;
  useAliases: boolean;
  tableAlias: string;
  joinAliases: [string, string][]; // Map serialized as array of entries
}

interface QueryTemplate {
  id: string;
  name: string;
  config: QueryBuilderState;
}

interface QueryWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
}

interface QueryBuilderWizardProps {
  databaseTree: any[];
  onGenerateQuery: (query: string, state: QueryBuilderState) => void;
  onClose: () => void;
  initialState?: QueryBuilderState;
  connectionType?: string;
}

const OPERATORS = [
  { value: '=', label: '= (Equal)' },
  { value: '!=', label: '!= (Not Equal)' },
  { value: '>', label: '> (Greater Than)' },
  { value: '<', label: '< (Less Than)' },
  { value: '>=', label: '>= (Greater or Equal)' },
  { value: '<=', label: '<= (Less or Equal)' },
  { value: 'LIKE', label: 'LIKE (Pattern Match)' },
  { value: 'NOT LIKE', label: 'NOT LIKE' },
  { value: 'IN', label: 'IN (List)' },
  { value: 'NOT IN', label: 'NOT IN' },
  { value: 'IS NULL', label: 'IS NULL' },
  { value: 'IS NOT NULL', label: 'IS NOT NULL' },
];

const JOIN_TYPES = [
  { value: 'INNER JOIN', label: 'INNER JOIN' },
  { value: 'LEFT JOIN', label: 'LEFT JOIN' },
  { value: 'RIGHT JOIN', label: 'RIGHT JOIN' },
  { value: 'FULL OUTER JOIN', label: 'FULL OUTER JOIN' },
];

const AGGREGATE_FUNCTIONS = [
  { value: 'COUNT', label: 'COUNT' },
  { value: 'SUM', label: 'SUM' },
  { value: 'AVG', label: 'AVG' },
  { value: 'MIN', label: 'MIN' },
  { value: 'MAX', label: 'MAX' },
];

export function QueryBuilderWizard({
  databaseTree,
  onGenerateQuery,
  onClose,
  initialState,
  connectionType = 'postgres'
}: QueryBuilderWizardProps) {
  const [selectedColumns, setSelectedColumns] = useState<Column[]>(initialState?.selectedColumns || []);
  const [selectedTable, setSelectedTable] = useState<{
    database: string;
    schema: string;
    table: string;
  } | null>(initialState?.selectedTable || null);
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>(initialState?.whereConditions || []);
  const [joinConditions, setJoinConditions] = useState<JoinCondition[]>(initialState?.joinConditions || []);
  const [orderByConditions, setOrderByConditions] = useState<OrderByCondition[]>(initialState?.orderByConditions || []);
  const [groupByColumns, setGroupByColumns] = useState<string[]>(initialState?.groupByColumns || []);
  const [havingConditions, setHavingConditions] = useState<HavingCondition[]>(initialState?.havingConditions || []);
  const [generatedQuery, setGeneratedQuery] = useState<string>('');
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [templateName, setTemplateName] = useState<string>('');
  const [useDistinct, setUseDistinct] = useState<boolean>(initialState?.useDistinct || false);
  const [limitValue, setLimitValue] = useState<string>(initialState?.limitValue || '');
  const [offsetValue, setOffsetValue] = useState<string>(initialState?.offsetValue || '');
  const [queryWarnings, setQueryWarnings] = useState<QueryWarning[]>([]);
  const [showQueryDialog, setShowQueryDialog] = useState<boolean>(false);
  const [columnSearchFilter, setColumnSearchFilter] = useState<string>('');
  const [tableAlias, setTableAlias] = useState<string>(initialState?.tableAlias || 't1');
  const [useAliases, setUseAliases] = useState<boolean>(initialState?.useAliases || false);
  const [joinAliases, setJoinAliases] = useState<Map<string, string>>(
    initialState?.joinAliases ? new Map(initialState.joinAliases) : new Map()
  );

  // Helper to get identifier quote character based on dialect
  const getIdentifierQuote = (type: string) => {
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('mssql') || lowerType.includes('sqlserver')) return ['[', ']'];
    if (lowerType.includes('mysql')) return ['`', '`'];
    return ['"', '"']; // Postgres, Oracle, SQLite, etc.
  };

  // Helper to quote an identifier
  const quote = (identifier: string) => {
    if (!identifier) return '';
    const [start, end] = getIdentifierQuote(connectionType);
    return `${start}${identifier}${end}`;
  };

  // Helper to quote a fully qualified table name
  const quoteTable = (schema: string, table: string) => {
    return `${quote(schema)}.${quote(table)}`;
  };

  // Extract all tables from the tree
  const getAllTables = () => {
    const tables: any[] = [];
    databaseTree.forEach(db => {
      db.schemas?.forEach((schema: any) => {
        schema.tables?.forEach((table: any) => {
          tables.push({
            database: db.name,
            schema: schema.name,
            table: table.name,
            columns: table.columns
          });
        });
      });
    });
    return tables;
  };

  const allTables = getAllTables();

  // Load templates from localStorage on mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('queryTemplates');
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    }
  }, []);

  // Update generated query whenever any condition changes
  useEffect(() => {
    if (selectedTable && selectedColumns.length > 0) {
      const query = buildQuery();
      setGeneratedQuery(query);
      validateQuery(query);
    } else {
      setGeneratedQuery('');
      setQueryWarnings([]);
    }
  }, [selectedColumns, selectedTable, whereConditions, joinConditions, groupByColumns, havingConditions, orderByConditions, useDistinct, limitValue, offsetValue]);

  const handleTableSelect = (value: string) => {
    const [database, schema, table] = value.split('.');
    setSelectedTable({ database, schema, table });
    // Clear columns when switching tables
    setSelectedColumns([]);
  };

  const handleColumnAdd = (columnName: string) => {
    if (!selectedTable) return;

    const tableInfo = allTables.find(
      t => t.database === selectedTable.database &&
        t.schema === selectedTable.schema &&
        t.table === selectedTable.table
    );

    const column = tableInfo?.columns.find((c: any) => c.name === columnName);
    if (!column) return;

    const newColumn: Column = {
      name: column.name,
      type: column.type,
      tableName: selectedTable.table,
      schemaName: selectedTable.schema,
      databaseName: selectedTable.database
    };

    if (!selectedColumns.find(c => c.name === newColumn.name)) {
      setSelectedColumns([...selectedColumns, newColumn]);
    }
  };

  const handleColumnRemove = (index: number) => {
    setSelectedColumns(selectedColumns.filter((_, i) => i !== index));
  };

  const handleAddWhereCondition = () => {
    setWhereConditions([
      ...whereConditions,
      {
        id: Math.random().toString(36).substr(2, 9),
        column: '',
        operator: '=',
        value: '',
      },
    ]);
  };

  const handleRemoveWhereCondition = (id: string) => {
    setWhereConditions(whereConditions.filter(c => c.id !== id));
  };

  const handleUpdateWhereCondition = (id: string, field: string, value: string) => {
    setWhereConditions(
      whereConditions.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleAddJoinCondition = () => {
    const newJoin = {
      id: Math.random().toString(36).substr(2, 9),
      joinType: 'INNER JOIN',
      targetTable: '',
      sourceColumn: '',
      targetColumn: '',
    };
    setJoinConditions([...joinConditions, newJoin]);

    // Auto-enable aliases when joins are added
    if (!useAliases && joinConditions.length === 0) {
      setUseAliases(true);
    }
  };

  const handleRemoveJoinCondition = (id: string) => {
    setJoinConditions(joinConditions.filter(j => j.id !== id));
  };

  const handleUpdateJoinCondition = (id: string, field: string, value: string) => {
    setJoinConditions(
      joinConditions.map(j => {
        if (j.id === id) {
          const updated = { ...j, [field]: value };

          // Auto-generate alias for newly added table
          if (field === 'targetTable' && value && !joinAliases.has(value)) {
            const aliasNum = joinConditions.filter(jc => jc.targetTable).length + 2;
            const newAliases = new Map(joinAliases);
            newAliases.set(value, `t${aliasNum}`);
            setJoinAliases(newAliases);
          }

          return updated;
        }
        return j;
      })
    );
  };

  const handleAddOrderByCondition = () => {
    setOrderByConditions([
      ...orderByConditions,
      {
        id: Math.random().toString(36).substr(2, 9),
        column: '',
        direction: 'ASC',
      },
    ]);
  };

  const handleRemoveOrderByCondition = (id: string) => {
    setOrderByConditions(orderByConditions.filter(o => o.id !== id));
  };

  const handleUpdateOrderByCondition = (id: string, field: string, value: string) => {
    setOrderByConditions(
      orderByConditions.map(o => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const handleAddGroupByColumn = (column: string) => {
    if (!groupByColumns.includes(column)) {
      setGroupByColumns([...groupByColumns, column]);
    }
  };

  const handleRemoveGroupByColumn = (column: string) => {
    setGroupByColumns(groupByColumns.filter(c => c !== column));
  };

  const handleAddHavingCondition = () => {
    setHavingConditions([
      ...havingConditions,
      {
        id: Math.random().toString(36).substr(2, 9),
        aggregateFunction: 'COUNT',
        column: '',
        operator: '=',
        value: '',
      },
    ]);
  };

  const handleRemoveHavingCondition = (id: string) => {
    setHavingConditions(havingConditions.filter(h => h.id !== id));
  };

  const handleUpdateHavingCondition = (id: string, field: string, value: string) => {
    setHavingConditions(
      havingConditions.map(h => (h.id === id ? { ...h, [field]: value } : h))
    );
  };

  const validateQuery = (query: string) => {
    const warnings: QueryWarning[] = [];

    // Check for empty values in WHERE conditions
    const invalidWhere = whereConditions.some(w =>
      (w.operator !== 'IS NULL' && w.operator !== 'IS NOT NULL') && !w.value
    );
    if (invalidWhere) {
      warnings.push({
        type: 'error',
        message: 'Some WHERE conditions have missing values.'
      });
    }

    // Check for empty values in HAVING conditions
    const invalidHaving = havingConditions.some(h => !h.value);
    if (invalidHaving) {
      warnings.push({
        type: 'error',
        message: 'Some HAVING conditions have missing values.'
      });
    }

    // Check for cartesian joins (JOIN without ON condition)
    // Only validate if there are actual JOIN conditions defined by the user
    if (joinConditions.length > 0) {
      const validJoins = joinConditions.filter(
        j => j.targetTable && j.sourceColumn && j.targetColumn
      );
      const invalidJoins = joinConditions.filter(
        j => j.targetTable && (!j.sourceColumn || !j.targetColumn)
      );

      if (invalidJoins.length > 0) {
        warnings.push({
          type: 'error',
          message: 'Cartesian join detected! Missing ON condition will cause performance issues.'
        });
      }
    }

    // Check for SELECT * or too many columns without WHERE
    if (selectedColumns.length > 20 && whereConditions.length === 0 && !limitValue) {
      warnings.push({
        type: 'warning',
        message: 'Selecting many columns without filters or LIMIT may be slow on large tables.'
      });
    }

    // Check for missing WHERE with multiple JOINs
    if (joinConditions.length > 2 && whereConditions.length === 0 && !limitValue) {
      warnings.push({
        type: 'warning',
        message: 'Multiple JOINs without WHERE clause or LIMIT may result in very large result sets.'
      });
    }

    // Check for LIKE without leading wildcard (cannot use index)
    const leadingWildcardConditions = whereConditions.filter(
      w => w.operator === 'LIKE' && w.value.startsWith('%')
    );
    if (leadingWildcardConditions.length > 0) {
      warnings.push({
        type: 'info',
        message: 'LIKE with leading wildcard (%) cannot use indexes and may be slow.'
      });
    }

    // Check for OR conditions (harder to optimize)
    if (query.includes(' OR ')) {
      warnings.push({
        type: 'info',
        message: 'OR conditions detected. Consider using IN or UNION for better performance.'
      });
    }

    // Check for aggregation without LIMIT
    if (groupByColumns.length === 0 && havingConditions.length > 0) {
      warnings.push({
        type: 'warning',
        message: 'HAVING without GROUP BY may not work as expected.'
      });
    }

    // Performance tip for large OFFSET
    if (offsetValue && parseInt(offsetValue) > 1000) {
      warnings.push({
        type: 'warning',
        message: 'Large OFFSET values (>1000) can be slow. Consider using WHERE with indexed columns instead.'
      });
    }

    setQueryWarnings(warnings);
  };

  const buildQuery = () => {
    if (!selectedTable || selectedColumns.length === 0) return '';

    const distinctClause = useDistinct ? 'DISTINCT ' : '';

    // Use aliases if joins are present or user enabled them
    const mainTableRef = useAliases ? tableAlias : quoteTable(selectedTable.schema, selectedTable.table);
    const mainTableFrom = useAliases
      ? `${quoteTable(selectedTable.schema, selectedTable.table)} AS ${tableAlias}`
      : quoteTable(selectedTable.schema, selectedTable.table);

    // Build column list with aliases if needed
    const columnList = selectedColumns.map(c => {
      if (useAliases) {
        // Check if this column comes from joined table
        const joinedTable = joinConditions.find(j => j.targetTable && c.tableName === j.targetTable.split('.').pop());
        if (joinedTable) {
          const alias = joinAliases.get(joinedTable.targetTable) || 't2';
          return `    ${alias}.${quote(c.name)}`;
        }
        return `    ${tableAlias}.${quote(c.name)}`;
      }
      return `    ${quote(c.name)}`;
    }).join(',\n');

    let query = `SELECT ${distinctClause}\n${columnList}\nFROM ${mainTableFrom}`;

    // Add JOINs with aliases
    if (joinConditions.length > 0) {
      const validJoins = joinConditions.filter(
        j => j.targetTable && j.sourceColumn && j.targetColumn
      );
      if (validJoins.length > 0) {
        query += '\n' + validJoins
          .map(j => {
            const joinAlias = joinAliases.get(j.targetTable) || 't2';
            // Parse target table to quote schema and table separately if possible, otherwise just quote the whole string if it's simple
            // Assuming targetTable is "schema.table"
            const parts = j.targetTable.split('.');
            const quotedTargetTable = parts.length === 2 ? quoteTable(parts[0], parts[1]) : j.targetTable;

            const joinTableWithAlias = useAliases ? `${quotedTargetTable} AS ${joinAlias}` : quotedTargetTable;

            const sourceRef = useAliases ? `${tableAlias}.${quote(j.sourceColumn)}` : `${quoteTable(selectedTable.schema, selectedTable.table)}.${quote(j.sourceColumn)}`;

            // For target ref, if not using aliases, we need to quote the table part too
            let targetRef = '';
            if (useAliases) {
              targetRef = `${joinAlias}.${quote(j.targetColumn)}`;
            } else {
              const targetParts = j.targetTable.split('.');
              const quotedTarget = targetParts.length === 2 ? quoteTable(targetParts[0], targetParts[1]) : j.targetTable;
              targetRef = `${quotedTarget}.${quote(j.targetColumn)}`;
            }

            return `${j.joinType} ${joinTableWithAlias}\n    ON ${sourceRef} = ${targetRef}`;
          })
          .join('\n');
      }
    }

    // Add WHERE conditions with aliases
    if (whereConditions.length > 0) {
      const validConditions = whereConditions.filter(w => {
        if (w.operator === 'IS NULL' || w.operator === 'IS NOT NULL') {
          return w.column;
        }
        return w.column && w.operator && w.value;
      });

      if (validConditions.length > 0) {
        const conditions = validConditions.map(w => {
          const columnRef = useAliases ? `${mainTableRef}.${quote(w.column)}` : quote(w.column);

          if (w.operator === 'IS NULL' || w.operator === 'IS NOT NULL') {
            return `    ${columnRef} ${w.operator}`;
          }

          if (w.operator.includes('LIKE')) {
            return `    ${columnRef} ${w.operator} '${w.value}'`;
          }

          if (w.operator === 'IN' || w.operator === 'NOT IN') {
            return `    ${columnRef} ${w.operator} (${w.value})`;
          }

          return `    ${columnRef} ${w.operator} ${w.value}`;
        }).join(' AND\n');

        query += `\nWHERE\n${conditions}`;
      }
    }

    // Add GROUP BY with aliases
    if (groupByColumns.length > 0) {
      const groupByRefs = groupByColumns.map(col =>
        useAliases ? `${mainTableRef}.${quote(col)}` : quote(col)
      );
      query += `\nGROUP BY\n    ${groupByRefs.join(',\n    ')}`;
    }

    // Add HAVING with aliases
    if (havingConditions.length > 0) {
      const validHaving = havingConditions.filter(h => h.column && h.operator && h.value);
      if (validHaving.length > 0) {
        const havingClause = validHaving.map(h => {
          const columnRef = useAliases ? `${mainTableRef}.${quote(h.column)}` : quote(h.column);
          return `    ${h.aggregateFunction}(${columnRef}) ${h.operator} ${h.value}`;
        }).join(' AND\n');
        query += `\nHAVING\n${havingClause}`;
      }
    }

    // Add ORDER BY with aliases
    if (orderByConditions.length > 0) {
      const validOrders = orderByConditions.filter(o => o.column);
      if (validOrders.length > 0) {
        const orderClause = validOrders.map(o => {
          const columnRef = useAliases ? `${mainTableRef}.${quote(o.column)}` : quote(o.column);
          return `    ${columnRef} ${o.direction}`;
        }).join(',\n');
        query += `\nORDER BY\n${orderClause}`;
      }
    }

    // Add LIMIT/OFFSET based on dialect
    const lowerType = connectionType.toLowerCase();
    const limit = limitValue && parseInt(limitValue) > 0 ? limitValue : null;
    const offset = offsetValue && parseInt(offsetValue) > 0 ? offsetValue : null;

    let finalQuery = query;

    if (lowerType.includes('mssql') || lowerType.includes('sqlserver')) {
      // MSSQL handling
      if (offset) {
        // Must use OFFSET ... FETCH
        // Ensure ORDER BY exists (required for OFFSET)
        if (orderByConditions.length === 0) {
          finalQuery += `\nORDER BY (SELECT NULL)`;
        }
        finalQuery += `\nOFFSET ${offset} ROWS`;
        if (limit) {
          finalQuery += ` FETCH NEXT ${limit} ROWS ONLY`;
        }
      } else if (limit) {
        // Use TOP if no offset (simpler and works on older versions)
        // Inject TOP after SELECT/DISTINCT
        finalQuery = finalQuery.replace(/^SELECT( DISTINCT)?/i, `SELECT$1 TOP ${limit}`);
      }
    } else if (lowerType.includes('oracle')) {
      // Oracle handling (similar to MSSQL for OFFSET)
      if (offset || limit) {
        const offsetVal = offset || '0';
        finalQuery += `\nOFFSET ${offsetVal} ROWS`;
        if (limit) {
          finalQuery += ` FETCH NEXT ${limit} ROWS ONLY`;
        }
      }
    } else {
      // Standard/Postgres/MySQL: LIMIT Y OFFSET X
      if (limit) {
        finalQuery += `\nLIMIT ${limit}`;
      }
      if (offset) {
        finalQuery += `\nOFFSET ${offset}`;
      }
    }

    return finalQuery;
  };

  const handleGenerateQuery = () => {
    const query = buildQuery();
    if (query) {
      const state: QueryBuilderState = {
        selectedTable,
        selectedColumns,
        whereConditions,
        joinConditions,
        groupByColumns,
        havingConditions,
        orderByConditions,
        useDistinct,
        limitValue,
        offsetValue,
        useAliases,
        tableAlias,
        joinAliases: Array.from(joinAliases.entries())
      };
      onGenerateQuery(query, state);
    }
  };

  const handleCopyQuery = async () => {
    if (generatedQuery) {
      await navigator.clipboard.writeText(generatedQuery);
      toast.success('Query copied to clipboard');
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName || !selectedTable) return;

    const newTemplate: QueryTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name: templateName,
      config: {
        selectedTable,
        selectedColumns,
        whereConditions,
        joinConditions,
        groupByColumns,
        havingConditions,
        orderByConditions,
        useDistinct,
        limitValue,
        offsetValue,
        useAliases,
        tableAlias,
        joinAliases: Array.from(joinAliases.entries())
      }
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('queryTemplates', JSON.stringify(updatedTemplates));
    setTemplateName('');
    toast.success('Template saved successfully');
  };

  const handleLoadTemplate = (template: QueryTemplate) => {
    setSelectedTable(template.config.selectedTable);
    setSelectedColumns(template.config.selectedColumns);
    setWhereConditions(template.config.whereConditions);
    setJoinConditions(template.config.joinConditions);
    setGroupByColumns(template.config.groupByColumns);
    setHavingConditions(template.config.havingConditions);
    setOrderByConditions(template.config.orderByConditions);
    setUseDistinct(template.config.useDistinct || false);
    setLimitValue(template.config.limitValue || '');
    setOffsetValue(template.config.offsetValue || '');
    setUseAliases(template.config.useAliases || false);
    setTableAlias(template.config.tableAlias || 't1');
    setJoinAliases(template.config.joinAliases ? new Map(template.config.joinAliases) : new Map());
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleDeleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    setTemplates(updatedTemplates);
    localStorage.setItem('queryTemplates', JSON.stringify(updatedTemplates));
    toast.success('Template deleted');
  };

  const handleExportTemplates = () => {
    if (templates.length === 0) {
      toast.error('No templates to export');
      return;
    }

    const dataStr = JSON.stringify(templates, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Templates exported successfully');
  };

  const handleImportTemplates = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTemplates = JSON.parse(e.target?.result as string) as QueryTemplate[];

        // Validate imported data
        if (!Array.isArray(importedTemplates)) {
          throw new Error('Invalid template format');
        }

        // Merge with existing templates (avoid duplicates by name)
        const existingNames = new Set(templates.map(t => t.name));
        const newTemplates = importedTemplates.filter(t => !existingNames.has(t.name));

        if (newTemplates.length === 0) {
          toast.info('No new templates to import');
          return;
        }

        const updatedTemplates = [...templates, ...newTemplates];
        setTemplates(updatedTemplates);
        localStorage.setItem('queryTemplates', JSON.stringify(updatedTemplates));
        toast.success(`Imported ${newTemplates.length} template(s) successfully`);
      } catch (error) {
        toast.error('Failed to import templates. Invalid file format.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be imported again
    event.target.value = '';
  };

  const handleClear = () => {
    setSelectedTable(null);
    setSelectedColumns([]);
    setWhereConditions([]);
    setJoinConditions([]);
    setOrderByConditions([]);
    setGroupByColumns([]);
    setHavingConditions([]);
    setUseDistinct(false);
    setLimitValue('');
    setOffsetValue('');
    setTableAlias('t1');
    setUseAliases(false);
    setJoinAliases(new Map());
    setGeneratedQuery('');
    setQueryWarnings([]);
    toast.success('Query builder reset');
  };

  const getSelectedTableColumns = () => {
    if (!selectedTable) return [];

    const tableInfo = allTables.find(
      t => t.database === selectedTable.database &&
        t.schema === selectedTable.schema &&
        t.table === selectedTable.table
    );

    const columns = tableInfo?.columns || [];

    // Apply search filter for performance with large column lists
    if (columnSearchFilter.trim()) {
      const searchLower = columnSearchFilter.toLowerCase();
      return columns.filter((col: any) =>
        col.name.toLowerCase().includes(searchLower) ||
        col.type.toLowerCase().includes(searchLower)
      );
    }

    return columns;
  };

  const handleSelectAllColumns = () => {
    const availableColumns = getSelectedTableColumns();
    const newColumns: Column[] = availableColumns.map((col: any) => ({
      name: col.name,
      type: col.type,
      tableName: selectedTable!.table,
      schemaName: selectedTable!.schema,
      databaseName: selectedTable!.database
    }));
    setSelectedColumns(newColumns);
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Query Builder Wizard</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleClear} title="Reset all selections">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Table Selection */}
        <div className="space-y-2">
          <Label>Select Table</Label>
          <Select
            onValueChange={handleTableSelect}
            value={selectedTable ? `${selectedTable.database}.${selectedTable.schema}.${selectedTable.table}` : ''}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a table..." />
            </SelectTrigger>
            <SelectContent>
              {allTables.map((t) => (
                <SelectItem
                  key={`${t.database}.${t.schema}.${t.table}`}
                  value={`${t.database}.${t.schema}.${t.table}`}
                >
                  {t.database}.{t.schema}.{t.table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTable && (
          <>
            <Separator />

            {/* Available Columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Available Columns ({getSelectedTableColumns().length})</Label>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllColumns}
                    className="text-xs h-7"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllColumns}
                    className="text-xs h-7"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <Input
                type="text"
                placeholder="Search columns..."
                value={columnSearchFilter}
                onChange={(e) => setColumnSearchFilter(e.target.value)}
                className="h-8"
              />
              <ScrollArea className="h-[200px] border rounded-md p-3">
                <div className="space-y-1">
                  {getSelectedTableColumns().length === 0 ? (
                    <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
                      {columnSearchFilter ? 'No columns match your search' : 'No columns available'}
                    </div>
                  ) : (
                    getSelectedTableColumns().map((col: any) => (
                      <Button
                        key={col.name}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleColumnAdd(col.name)}
                        disabled={selectedColumns.some(c => c.name === col.name)}
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        <span className="font-mono text-xs">{col.name}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {col.type}
                        </Badge>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <Separator />

            {/* Selected Columns */}
            <div className="space-y-2">
              <Label>Selected Columns ({selectedColumns.length})</Label>
              <ScrollArea className="h-[150px] border rounded-md p-3">
                {selectedColumns.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Click columns above to add them
                  </div>
                ) : (
                  <div className="space-y-1">
                    {selectedColumns.map((col, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-accent rounded-md group"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-xs flex-1">{col.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {col.type}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleColumnRemove(index)}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <Separator />

            {/* Advanced Options */}
            <Accordion type="multiple" className="w-full">
              {/* WHERE Conditions */}
              <AccordionItem value="where">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>WHERE Conditions ({whereConditions.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {whereConditions.map((condition) => (
                      <div key={condition.id} className="flex gap-2 items-start p-3 bg-muted rounded-md">
                        <div className="flex-1 space-y-2">
                          <Select
                            value={condition.column}
                            onValueChange={(value) =>
                              handleUpdateWhereCondition(condition.id, 'column', value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedColumns.map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={condition.operator}
                            onValueChange={(value) =>
                              handleUpdateWhereCondition(condition.id, 'operator', value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {condition.operator !== 'IS NULL' && condition.operator !== 'IS NOT NULL' && (
                            <Input
                              placeholder={
                                condition.operator.includes('LIKE')
                                  ? 'Pattern (e.g., %value%)'
                                  : condition.operator.includes('IN')
                                    ? 'Values (e.g., 1, 2, 3)'
                                    : 'Value'
                              }
                              value={condition.value}
                              onChange={(e) =>
                                handleUpdateWhereCondition(condition.id, 'value', e.target.value)
                              }
                              className="h-8"
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveWhereCondition(condition.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddWhereCondition}
                      className="w-full"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add WHERE Condition
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* JOIN Conditions */}
              <AccordionItem value="joins">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    <span>JOIN Tables ({joinConditions.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {joinConditions.map((join) => (
                      <div key={join.id} className="flex gap-2 items-start p-3 bg-muted rounded-md">
                        <div className="flex-1 space-y-2">
                          <Select
                            value={join.joinType}
                            onValueChange={(value) =>
                              handleUpdateJoinCondition(join.id, 'joinType', value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {JOIN_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={join.targetTable}
                            onValueChange={(value) =>
                              handleUpdateJoinCondition(join.id, 'targetTable', value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select target table..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allTables
                                .filter(
                                  (t) =>
                                    selectedTable &&
                                    (t.database !== selectedTable.database ||
                                      t.schema !== selectedTable.schema ||
                                      t.table !== selectedTable.table)
                                )
                                .map((t) => (
                                  <SelectItem
                                    key={`${t.database}.${t.schema}.${t.table}`}
                                    value={`${t.schema}.${t.table}`}
                                  >
                                    {t.schema}.{t.table}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={join.sourceColumn}
                              onValueChange={(value) =>
                                handleUpdateJoinCondition(join.id, 'sourceColumn', value)
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Source column..." />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedColumns.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    {col.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Target column..."
                              value={join.targetColumn}
                              onChange={(e) =>
                                handleUpdateJoinCondition(join.id, 'targetColumn', e.target.value)
                              }
                              className="h-8"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveJoinCondition(join.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddJoinCondition}
                      className="w-full"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add JOIN
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            {/* Query Options */}
            <div className="space-y-3">
              <Label>Query Options</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <input
                    type="checkbox"
                    id="distinct"
                    checked={useDistinct}
                    onChange={(e) => setUseDistinct(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="distinct" className="cursor-pointer font-normal">
                    DISTINCT (Remove duplicates)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <input
                    type="checkbox"
                    id="use-aliases"
                    checked={useAliases}
                    onChange={(e) => setUseAliases(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="use-aliases" className="cursor-pointer font-normal">
                    Use Table Aliases (for JOINs)
                  </Label>
                </div>
                {useAliases && (
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="main-alias" className="text-xs">Main Table Alias</Label>
                    <Input
                      id="main-alias"
                      type="text"
                      placeholder="e.g., t1"
                      value={tableAlias}
                      onChange={(e) => setTableAlias(e.target.value || 't1')}
                      className="h-9"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="limit" className="text-xs">LIMIT (Max rows)</Label>
                  <Input
                    id="limit"
                    type="number"
                    placeholder="e.g., 100"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    min="1"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="offset" className="text-xs">OFFSET (Skip rows)</Label>
                  <Input
                    id="offset"
                    type="number"
                    placeholder="e.g., 0"
                    value={offsetValue}
                    onChange={(e) => setOffsetValue(e.target.value)}
                    min="0"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Advanced Options - Continued */}
            <Accordion type="multiple" className="w-full">
              {/* GROUP BY */}
              <AccordionItem value="groupby">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <span>GROUP BY ({groupByColumns.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedColumns.map((col) => (
                        <Button
                          key={col.name}
                          variant={groupByColumns.includes(col.name) ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            groupByColumns.includes(col.name)
                              ? handleRemoveGroupByColumn(col.name)
                              : handleAddGroupByColumn(col.name)
                          }
                          className="h-8"
                        >
                          {col.name}
                        </Button>
                      ))}
                    </div>
                    {groupByColumns.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Selected: {groupByColumns.join(', ')}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* HAVING */}
              <AccordionItem value="having">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>HAVING ({havingConditions.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {havingConditions.map((condition) => (
                      <div key={condition.id} className="flex gap-2 items-start p-3 bg-muted rounded-md">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={condition.aggregateFunction}
                              onValueChange={(value) =>
                                handleUpdateHavingCondition(condition.id, 'aggregateFunction', value)
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AGGREGATE_FUNCTIONS.map((fn) => (
                                  <SelectItem key={fn.value} value={fn.value}>
                                    {fn.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={condition.column}
                              onValueChange={(value) =>
                                handleUpdateHavingCondition(condition.id, 'column', value)
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select column..." />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedColumns.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    {col.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={condition.operator}
                              onValueChange={(value) =>
                                handleUpdateHavingCondition(condition.id, 'operator', value)
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATORS.slice(0, 6).map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Value"
                              value={condition.value}
                              onChange={(e) =>
                                handleUpdateHavingCondition(condition.id, 'value', e.target.value)
                              }
                              className="h-8"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveHavingCondition(condition.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddHavingCondition}
                      className="w-full"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add HAVING Condition
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ORDER BY */}
              <AccordionItem value="orderby">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    <span>ORDER BY ({orderByConditions.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {orderByConditions.map((condition) => (
                      <div key={condition.id} className="flex gap-2 items-start p-3 bg-muted rounded-md">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Select
                            value={condition.column}
                            onValueChange={(value) =>
                              handleUpdateOrderByCondition(condition.id, 'column', value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedColumns.map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={condition.direction}
                            onValueChange={(value) =>
                              handleUpdateOrderByCondition(condition.id, 'direction', value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ASC">ASC (A → Z)</SelectItem>
                              <SelectItem value="DESC">DESC (Z → A)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOrderByCondition(condition.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddOrderByCondition}
                      className="w-full"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add ORDER BY
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            {/* Query Performance Warnings */}
            {queryWarnings.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Performance Warnings</Label>
                  <div className="space-y-2">
                    {queryWarnings.map((warning, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md text-sm flex items-start gap-2 ${warning.type === 'error'
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : warning.type === 'warning'
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                      >
                        <span className="font-semibold mt-0.5">
                          {warning.type === 'error' ? '⛔' : warning.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Live SQL Preview */}
            {generatedQuery && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <Label>Live SQL Preview</Label>
                    </div>
                    <Dialog open={showQueryDialog} onOpenChange={setShowQueryDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Maximize2 className="h-3 w-3" />
                          View Full Query
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle>Generated SQL Query</DialogTitle>
                          <DialogDescription>
                            Review and copy the generated SQL query below.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <ScrollArea className="h-[500px] w-full border rounded-md p-4 bg-muted/50">
                            <pre className="text-sm font-mono whitespace-pre-wrap">{generatedQuery}</pre>
                          </ScrollArea>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowQueryDialog(false)}>
                              Close
                            </Button>
                            <Button onClick={handleCopyQuery} className="gap-2">
                              <Copy className="h-4 w-4" />
                              Copy Query
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <ScrollArea className="h-[120px] w-full border rounded-md p-3 bg-muted/50">
                    <pre className="text-xs font-mono">{generatedQuery}</pre>
                  </ScrollArea>
                </div>
                <Separator />
              </>
            )}

            {/* Template Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Query Templates</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTemplates}
                    disabled={templates.length === 0}
                    className="h-8"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('import-templates')?.click()}
                    className="h-8"
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Import
                  </Button>
                  <input
                    id="import-templates"
                    type="file"
                    accept=".json"
                    onChange={handleImportTemplates}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Save Template */}
              <div className="flex gap-2">
                <Input
                  placeholder="Template name..."
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveTemplate}
                  disabled={!selectedTable || selectedColumns.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>

              {/* Load Templates */}
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Saved Templates ({templates.length}):</Label>
                  <ScrollArea className="h-[120px] border rounded-md p-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-2 hover:bg-accent rounded-md group"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLoadTemplate(template)}
                          className="flex-1 justify-start h-8"
                        >
                          <FolderOpen className="h-3 w-3 mr-2" />
                          {template.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>

            <Separator />

            {/* Generate Button */}
            {/* Generate Button */}
            <div className="sticky bottom-0 bg-background pt-4 border-t mt-4 flex justify-end gap-2 pb-2 z-10">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateQuery}
                disabled={selectedColumns.length === 0 || queryWarnings.some(w => w.type === 'error')}
                className="flex-1 md:flex-none"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generate SQL Query
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
