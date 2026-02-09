import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Save, Loader2, AlignLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'sql-formatter';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSave?: () => void;
  placeholder?: string;
  loading?: boolean;
  label?: string;
  readOnly?: boolean;
  height?: string;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  onSave,
  placeholder = 'Enter SQL query...',
  loading = false,
  label,
  readOnly = false,
  height = '200px',
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to run query
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onRun && !readOnly) {
        e.preventDefault();
        onRun();
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('keydown', handleKeyDown);
      return () => textarea.removeEventListener('keydown', handleKeyDown);
    }
  }, [onRun, readOnly]);

  const handleFormat = () => {
    try {
      const formatted = format(value, {
        language: 'postgresql', // Default to postgresql, could be dynamic based on connection type
        tabWidth: 2,
        keywordCase: 'upper',
      });
      onChange(formatted);
    } catch (e) {
      console.error('Formatting failed', e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}
        <div className="flex gap-2">
          {onSave && !readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSave}
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          )}
          {onRun && (
            <Button
              size="sm"
              onClick={onRun}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Run Preview
            </Button>
          )}
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 font-mono text-sm resize-none"
        style={{ minHeight: height }}
        spellCheck={false}
        readOnly={readOnly}
      />
      {!readOnly && (
        <p className="text-xs text-muted-foreground mt-2">
          Press Ctrl+Enter (or Cmd+Enter) to run preview
        </p>
      )}
    </div>
  );
}
