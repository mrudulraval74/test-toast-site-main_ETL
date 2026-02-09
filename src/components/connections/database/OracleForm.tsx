import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OracleFormProps {
    data: {
        name?: string;
        host: string;
        port: string;
        serviceName: string;
        username: string;
        password: string;
    };
    onChange: (data: any) => void;
}

export function OracleForm({ data, onChange }: OracleFormProps) {
    const updateField = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="ora-name">Connection Name *</Label>
                <Input
                    id="ora-name"
                    placeholder="My Oracle DB"
                    value={data.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="ora-host">Host *</Label>
                    <Input
                        id="ora-host"
                        placeholder="localhost"
                        value={data.host || ''}
                        onChange={(e) => updateField('host', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ora-port">Port</Label>
                    <Input
                        id="ora-port"
                        type="number"
                        placeholder="1521"
                        value={data.port || ''}
                        onChange={(e) => updateField('port', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="ora-service">Service Name *</Label>
                <Input
                    id="ora-service"
                    placeholder="ORCL"
                    value={data.serviceName || ''}
                    onChange={(e) => updateField('serviceName', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Oracle Service Name (e.g., ORCL, XE)
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="ora-username">Username *</Label>
                    <Input
                        id="ora-username"
                        placeholder="system"
                        value={data.username || ''}
                        onChange={(e) => updateField('username', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ora-password">Password *</Label>
                    <Input
                        id="ora-password"
                        type="password"
                        placeholder="••••••••"
                        value={data.password || ''}
                        onChange={(e) => updateField('password', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
