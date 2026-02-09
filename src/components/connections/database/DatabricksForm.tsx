import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DatabricksFormProps {
    data: {
        name?: string;
        host: string;
        httpPath: string;
        token: string;
        catalog?: string;
        schema?: string;
    };
    onChange: (data: any) => void;
}

export function DatabricksForm({ data, onChange }: DatabricksFormProps) {
    const updateField = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="db-name">Connection Name *</Label>
                <Input
                    id="db-name"
                    placeholder="My Databricks"
                    value={data.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="db-host">Server Hostname *</Label>
                <Input
                    id="db-host"
                    placeholder="abc-123.cloud.databricks.com"
                    value={data.host || ''}
                    onChange={(e) => updateField('host', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Your Databricks workspace URL
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="db-http-path">HTTP Path *</Label>
                <Input
                    id="db-http-path"
                    placeholder="/sql/1.0/warehouses/abc123"
                    value={data.httpPath || ''}
                    onChange={(e) => updateField('httpPath', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Found in cluster/SQL warehouse settings
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="db-token">Access Token *</Label>
                <Input
                    id="db-token"
                    type="password"
                    placeholder="dapi••••••••••••"
                    value={data.token || ''}
                    onChange={(e) => updateField('token', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Personal access token from user settings
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="db-catalog">Catalog (Optional)</Label>
                    <Input
                        id="db-catalog"
                        placeholder="hive_metastore"
                        value={data.catalog || ''}
                        onChange={(e) => updateField('catalog', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="db-schema">Schema (Optional)</Label>
                    <Input
                        id="db-schema"
                        placeholder="default"
                        value={data.schema || ''}
                        onChange={(e) => updateField('schema', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
