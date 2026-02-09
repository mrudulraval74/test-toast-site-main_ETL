import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';

interface SQLDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sql: { source: string; target: string; name: string } | null;
    onCopy: (sql: string, type: string) => void;
}

export function SQLDialog({ open, onOpenChange, sql, onCopy }: SQLDialogProps) {
    if (!sql) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[800px] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{sql.name || 'Generated SQL'}</DialogTitle>
                    <DialogDescription>Review and copy the generated test SQL</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            Source SQL
                            <Button variant="ghost" size="sm" onClick={() => onCopy(sql.source, 'source')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </Label>
                        <Textarea className="font-mono text-xs h-[300px]" readOnly value={sql.source} />
                    </div>
                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            Target SQL
                            <Button variant="ghost" size="sm" onClick={() => onCopy(sql.target, 'target')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </Label>
                        <Textarea className="font-mono text-xs h-[300px]" readOnly value={sql.target} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
