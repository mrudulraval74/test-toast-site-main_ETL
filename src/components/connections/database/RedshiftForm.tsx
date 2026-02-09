import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface RedshiftFormProps {
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

export function RedshiftForm({ data, onChange }: RedshiftFormProps) {
    const updateField = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="rs-name">Connection Name *</Label>
                <Input
                    id="rs-name"
                    placeholder="My Redshift"
                    value={data.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="rs-host">Endpoint *</Label>
                    <Input
                        id="rs-host"
                        placeholder="cluster.region.redshift.amazonaws.com"
                        value={data.host || ''}
                        onChange={(e) => updateField('host', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="rs-port">Port</Label>
                    <Input
                        id="rs-port"
                        type="number"
                        placeholder="5439"
                        value={data.port || ''}
                        onChange={(e) => updateField('port', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="rs-database">Database *</Label>
                <Input
                    id="rs-database"
                    placeholder="dev"
                    value={data.database || ''}
                    onChange={(e) => updateField('database', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="rs-username">Username *</Label>
                    <Input
                        id="rs-username"
                        placeholder="admin"
                        value={data.username || ''}
                        onChange={(e) => updateField('username', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="rs-password">Password *</Label>
                    <Input
                        id="rs-password"
                        type="password"
                        placeholder="••••••••"
                        value={data.password || ''}
                        onChange={(e) => updateField('password', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="rs-schema">Schema (Optional)</Label>
                <Input
                    id="rs-schema"
                    placeholder="public"
                    value={data.schema || ''}
                    onChange={(e) => updateField('schema', e.target.value)}
                />
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="rs-ssl"
                    checked={data.ssl !== false}
                    onCheckedChange={(checked) => updateField('ssl', checked)}
                />
                <Label htmlFor="rs-ssl" className="cursor-pointer">
                    Use SSL Connection (Recommended)
                </Label>
            </div>
        </div>
    );
}
