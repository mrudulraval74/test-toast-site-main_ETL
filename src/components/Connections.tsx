import { Database, Lightbulb } from 'lucide-react';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Connections() {
    return (
        <div className="space-y-6">
            <header>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                        <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Database Connections
                        </h1>
                    </div>
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                        Quick Tip: Set up at least two connections (source and target) to start comparing data.
                        Test each connection before using it in comparisons.
                    </AlertDescription>
                </Alert>
            </header>

            <div className="bg-card/50 backdrop-blur-sm rounded-2xl shadow-xl border border-border/50 p-6">
                <ConnectionsPanel onConnectionSaved={() => { }} />
            </div>
        </div>
    );
}
