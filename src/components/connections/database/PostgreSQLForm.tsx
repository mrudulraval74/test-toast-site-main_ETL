import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface PostgreSQLFormProps {
    data: {
        name?: string;
        host: string;
        port: string;
        database: string;
        username: string;
        password: string;
        schema?: string;
        ssl?: boolean;
    };
    onChange: (data: any) => void;
}

export function PostgreSQLForm({ data, onChange }: PostgreSQLFormProps) {
    const updateField = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="pg-name">Connection Name *</Label>
                <Input
                    id="pg-name"
                    placeholder="My PostgreSQL"
                    value={data.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pg-host">Host *</Label>
                    <Input
                        id="pg-host"
                        placeholder="localhost"
                        value={data.host || ''}
                        onChange={(e) => updateField('host', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pg-port">Port</Label>
                    <Input
                        id="pg-port"
                        type="number"
                        placeholder="5432"
                        value={data.port || ''}
                        onChange={(e) => updateField('port', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="pg-database">Database *</Label>
                <Input
                    id="pg-database"
                    placeholder="postgres"
                    value={data.database || ''}
                    onChange={(e) => updateField('database', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pg-username">Username *</Label>
                    <Input
                        id="pg-username"
                        placeholder="postgres"
                        value={data.username || ''}
                        onChange={(e) => updateField('username', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pg-password">Password *</Label>
                    <Input
                        id="pg-password"
                        type="password"
                        placeholder="••••••••"
                        value={data.password || ''}
                        onChange={(e) => updateField('password', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="pg-schema">Schema (Optional)</Label>
                <Input
                    id="pg-schema"
                    placeholder="public"
                    value={data.schema || ''}
                    onChange={(e) => updateField('schema', e.target.value)}
                />
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="pg-ssl"
                    checked={data.ssl || false}
                    onCheckedChange={(checked) => updateField('ssl', checked)}
                />
                <Label htmlFor="pg-ssl" className="cursor-pointer">
                    Use SSL Connection
                </Label>
            </div>
        </div>
    );
}
