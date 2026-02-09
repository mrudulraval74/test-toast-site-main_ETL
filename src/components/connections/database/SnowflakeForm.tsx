import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SnowflakeFormProps {
    data: {
        name?: string;
        account: string;
        username: string;
        password: string;
        warehouse: string;
        database: string;
        schema?: string;
        role?: string;
    };
    onChange: (data: any) => void;
}

export function SnowflakeForm({ data, onChange }: SnowflakeFormProps) {
    const updateField = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="sf-name">Connection Name *</Label>
                <Input
                    id="sf-name"
                    placeholder="My Snowflake"
                    value={data.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="sf-account">Account Identifier *</Label>
                <Input
                    id="sf-account"
                    placeholder="abc12345.us-east-1"
                    value={data.account || ''}
                    onChange={(e) => updateField('account', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Format: account_name.region (e.g., xy12345.us-east-1)
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="sf-username">Username *</Label>
                    <Input
                        id="sf-username"
                        placeholder="username"
                        value={data.username || ''}
                        onChange={(e) => updateField('username', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sf-password">Password *</Label>
                    <Input
                        id="sf-password"
                        type="password"
                        placeholder="••••••••"
                        value={data.password || ''}
                        onChange={(e) => updateField('password', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="sf-warehouse">Warehouse *</Label>
                    <Input
                        id="sf-warehouse"
                        placeholder="COMPUTE_WH"
                        value={data.warehouse || ''}
                        onChange={(e) => updateField('warehouse', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sf-database">Database *</Label>
                    <Input
                        id="sf-database"
                        placeholder="PROD_DB"
                        value={data.database || ''}
                        onChange={(e) => updateField('database', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="sf-schema">Schema (Optional)</Label>
                    <Input
                        id="sf-schema"
                        placeholder="PUBLIC"
                        value={data.schema || ''}
                        onChange={(e) => updateField('schema', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sf-role">Role (Optional)</Label>
                    <Input
                        id="sf-role"
                        placeholder="ACCOUNTADMIN"
                        value={data.role || ''}
                        onChange={(e) => updateField('role', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
