import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, X, ArrowRight, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ColumnMappingItem {
  source: string;
  target: string;
  normalize?: boolean;
}

interface ColumnMappingProps {
  sourceColumns: string[];
  targetColumns: string[];
  value: ColumnMappingItem[];
  onChange: (value: ColumnMappingItem[]) => void;
}

export function ColumnMapping({
  sourceColumns,
  targetColumns,
  value,
  onChange,
}: ColumnMappingProps) {
  const addMapping = () => {
    if (sourceColumns.length > 0 && targetColumns.length > 0) {
      onChange([
        ...value,
        {
          source: sourceColumns[0],
          target: targetColumns[0],
          normalize: false,
        },
      ]);
    }
  };

  const removeMapping = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, updates: Partial<ColumnMappingItem>) => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], ...updates };
    onChange(newValue);
  };

  const autoMapColumns = () => {
    if (sourceColumns.length === 0 || targetColumns.length === 0) {
      return;
    }

    const mapped: ColumnMappingItem[] = [];
    sourceColumns.forEach((sourceCol) => {
      // Try exact match first
      let targetCol = targetColumns.find(
        (tc) => tc.toLowerCase() === sourceCol.toLowerCase()
      );

      // If no exact match, try fuzzy match (contains)
      if (!targetCol) {
        targetCol = targetColumns.find((tc) =>
          tc.toLowerCase().includes(sourceCol.toLowerCase()) ||
          sourceCol.toLowerCase().includes(tc.toLowerCase())
        );
      }

      if (targetCol) {
        mapped.push({
          source: sourceCol,
          target: targetCol,
          normalize: false,
        });
      }
    });
    onChange(mapped);
  };

  const clearMappings = () => {
    onChange([]);
  };

  const hasColumns = sourceColumns.length > 0 && targetColumns.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Column Mapping</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={autoMapColumns}
            disabled={!hasColumns}
          >
            Auto-Map
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addMapping}
            disabled={!hasColumns}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Mapping
          </Button>
          {value.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearMappings}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {!hasColumns && (
        <div className="border border-dashed rounded-md p-4 text-center text-muted-foreground text-sm">
          Please run query previews for both source and target to load column information.
        </div>
      )}

      {hasColumns && value.length === 0 ? (
        <div className="border border-dashed rounded-md p-4 text-center text-muted-foreground text-sm">
          No column mappings defined. Use Auto-Map or manually add mappings.
        </div>
      ) : hasColumns ? (
        <div className="space-y-3">
          {value.map((mapping, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-3 bg-card border rounded-md"
            >
              <div className="flex-1">
                <Select
                  value={mapping.source}
                  onValueChange={(val) => updateMapping(index, { source: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <div className="flex-1">
                <Select
                  value={mapping.target}
                  onValueChange={(val) => updateMapping(index, { target: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={mapping.normalize || false}
                  onCheckedChange={(checked) =>
                    updateMapping(index, { normalize: checked })
                  }
                />
                <Label className="text-xs">Normalize</Label>
              </div>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeMapping(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {hasColumns && (
        <div className="bg-muted p-3 rounded-md space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong>Normalize:</strong> Trim whitespace, convert to lowercase, and standardize formats before comparison.
          </p>
          <p className="text-xs text-muted-foreground">
            Mapped columns: {value.length} / {Math.max(sourceColumns.length, targetColumns.length)}
          </p>
        </div>
      )}
    </div>
  );
}
