import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Clock, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  connectionId?: string;
  connectionName?: string;
}

interface QueryHistoryProps {
  onQuerySelect: (query: string) => void;
}

const MAX_HISTORY_ITEMS = 50;
const STORAGE_KEY = 'query-history';

export function QueryHistory({ onQuerySelect }: QueryHistoryProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
    toast({
      title: 'History Cleared',
      description: 'Query history has been cleared.',
    });
  };

  const removeItem = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <h3 className="font-medium">Query History</h3>
          <Badge variant="secondary">{history.length}</Badge>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            Clear All
          </Button>
        )}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <History className="h-8 w-8 mb-2" />
              <p className="text-sm">No query history yet</p>
            </div>
          ) : (
            history.map((item) => (
              <Card key={item.id} className="p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onQuerySelect(item.query)}
                    className="flex-1 text-left"
                  >
                    <p className="text-xs font-mono line-clamp-3 mb-2">
                      {item.query}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(item.timestamp)}
                      </div>
                      {item.connectionName && (
                        <Badge variant="outline" className="text-xs">
                          {item.connectionName}
                        </Badge>
                      )}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Utility function to add query to history
export function addToQueryHistory(
  query: string,
  connectionId?: string,
  connectionName?: string
) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const history: QueryHistoryItem[] = stored ? JSON.parse(stored) : [];

    // Don't add duplicate consecutive queries
    if (history.length > 0 && history[0].query === query) {
      return;
    }

    const newItem: QueryHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      query: query.trim(),
      timestamp: Date.now(),
      connectionId,
      connectionName,
    };

    const updated = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save to query history:', error);
  }
}
