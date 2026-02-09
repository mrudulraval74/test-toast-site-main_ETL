import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface SQLiteFormProps {
    data: {
        name?: string;
        filePath: string;
        readonly?: boolean;
    };
    onChange: (data: any) => void;
}

export function SQLiteForm({ data, onChange }: SQLiteFormProps) {
    const updateField = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="sqlite-name">Connection Name *</Label>
                <Input
                    id="sqlite-name"
                    placeholder="My SQLite DB"
                    value={data.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="sqlite-path">Database File Path *</Label>
                <Input
                    id="sqlite-path"
                    placeholder="C:\data\mydb.sqlite or /data/mydb.sqlite"
                    value={data.filePath || ''}
                    onChange={(e) => updateField('filePath', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Full path to the SQLite database file (.db, .sqlite, .sqlite3)
                </p>
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="sqlite-readonly"
                    checked={data.readonly || false}
                    onCheckedChange={(checked) => updateField('readonly', checked)}
                />
                <Label htmlFor="sqlite-readonly" className="cursor-pointer">
                    Read-only mode
                </Label>
            </div>

            <div className="p-4 bg-muted/50 rounded-md space-y-2">
                <p className="text-sm font-medium">Note:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>SQLite is a file-based database (no server required)</li>
                    <li>The file will be created if it doesn't exist (unless readonly)</li>
                    <li>Use absolute paths for reliability</li>
                </ul>
            </div>
        </div>
    );
}
