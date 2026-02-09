import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface KeyMappingProps {
  sourceColumns: string[];
  targetColumns: string[];
  value: { source: string[]; target: string[] };
  onChange: (value: { source: string[]; target: string[] }) => void;
}

export function KeyMapping({
  sourceColumns,
  targetColumns,
  value,
  onChange,
}: KeyMappingProps) {
  const addKeyMapping = () => {
    if (sourceColumns.length > 0 && targetColumns.length > 0) {
      onChange({
        source: [...value.source, sourceColumns[0]],
        target: [...value.target, targetColumns[0]],
      });
    }
  };

  const removeKeyMapping = (index: number) => {
    onChange({
      source: value.source.filter((_, i) => i !== index),
      target: value.target.filter((_, i) => i !== index),
    });
  };

  const updateSourceKey = (index: number, column: string) => {
    const newSource = [...value.source];
    newSource[index] = column;
    onChange({ ...value, source: newSource });
  };

  const updateTargetKey = (index: number, column: string) => {
    const newTarget = [...value.target];
    newTarget[index] = column;
    onChange({ ...value, target: newTarget });
  };

  const hasColumns = sourceColumns.length > 0 && targetColumns.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Key Mapping (Primary Keys)</Label>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={addKeyMapping}
          disabled={!hasColumns}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Key
        </Button>
      </div>

      {!hasColumns && (
        <div className="border border-dashed rounded-md p-4 text-center text-muted-foreground text-sm">
          Please run query previews for both source and target to load column information.
        </div>
      )}

      {hasColumns && value.source.length === 0 ? (
        <div className="border border-dashed rounded-md p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            No key mappings defined. Add at least one key to identify matching rows.
          </p>
          <p className="text-xs text-destructive font-medium">
            ⚠️ Key mapping is required to run comparison
          </p>
        </div>
      ) : hasColumns && value.source.length > 0 ? (
        <div className="space-y-2">
          {value.source.map((sourceKey, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={sourceKey}
                  onValueChange={(val) => updateSourceKey(index, val)}
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
              <span className="text-muted-foreground">→</span>
              <div className="flex-1">
                <Select
                  value={value.target[index]}
                  onValueChange={(val) => updateTargetKey(index, val)}
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
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeKeyMapping(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {hasColumns && value.source.length > 1 && (
        <div className="bg-muted p-3 rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Composite Key:</strong> Multiple columns will be combined to uniquely identify rows.
          </p>
        </div>
      )}

      {hasColumns && value.source.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-3 rounded-md">
          <p className="text-xs text-primary">
            ✓ Key mapping configured with {value.source.length} column{value.source.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
