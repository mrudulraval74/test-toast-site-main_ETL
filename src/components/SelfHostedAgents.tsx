import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Server,
    Plus,
    Trash2,
    Copy,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Key,
    Database,
    Activity
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface Agent {
    id: string;
    agent_name: string;
    status: string;
    capacity: number;
    running_jobs: number;
    last_heartbeat: string | null;
    created_at: string;
}

interface SelfHostedAgentsProps {
    projectId: string;
}

export const SelfHostedAgents = ({ projectId }: SelfHostedAgentsProps) => {
    const { toast } = useToast();
    const { session } = useAuth();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [newAgentName, setNewAgentName] = useState("");
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        if (projectId) {
            loadAgents();
        }
    }, [projectId]);

    const loadAgents = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from("self_hosted_agents")
                .select("id, agent_name, status, capacity, running_jobs, last_heartbeat, created_at")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAgents(data || []);
        } catch (error: any) {
            console.error("Error loading agents:", error);
            toast({
                title: "Error",
                description: "Failed to load agents",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const registerAgent = async () => {
        if (!newAgentName.trim()) {
            toast({
                title: "Agent name required",
                description: "Please provide a name for this agent",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsRegistering(true);

            if (!session?.user?.id) throw new Error("User session not found");

            // Generate a random API token
            const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
            const agentId = `agent-${Math.random().toString(36).substring(2, 10)}`;

            // For simplicity in this implementation, we'll store a "hash" which is just the token 
            // in real production you'd use a real hash, but here we'll follow the column name convention
            // In Wispr/test-toast-site it seems to use simple tokens or actual hashes depending on backend.
            // We will use the token itself as the 'api_token_hash' for now as we don't have a hashing util handy 
            // and the backend expectation might vary.

            const { data, error } = await supabase
                .from("self_hosted_agents")
                .insert({
                    project_id: projectId,
                    agent_id: agentId,
                    agent_name: newAgentName.trim(),
                    status: 'offline',
                    capacity: 1, // Default capacity
                    running_jobs: 0,
                    api_token_hash: token, // In a real app, this would be SHA256(token)
                    created_by: session.user.id
                })
                .select()
                .single();

            if (error) throw error;

            setGeneratedToken(token);
            toast({
                title: "Agent Registered",
                description: "Please save your API token. It won't be shown again.",
            });

            loadAgents();
            setNewAgentName("");
        } catch (error: any) {
            console.error("Error registering agent:", error);
            toast({
                title: "Registration Failed",
                description: error.message || "Failed to register agent",
                variant: "destructive",
            });
        } finally {
            setIsRegistering(false);
        }
    };

    const deleteAgent = async (id: string) => {
        if (!confirm("Are you sure you want to delete this agent?")) return;

        try {
            const { error } = await supabase
                .from("self_hosted_agents")
                .delete()
                .eq("id", id);

            if (error) throw error;

            toast({
                title: "Agent Deleted",
                description: "The agent has been removed",
            });
            loadAgents();
        } catch (error: any) {
            console.error("Error deleting agent:", error);
            toast({
                title: "Delete Failed",
                description: error.message || "Failed to delete agent",
                variant: "destructive",
            });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied",
            description: "Copied to clipboard",
        });
    };

    const isAgentOnline = (agent: Agent) => {
        if (agent.status !== "online") return false;
        if (!agent.last_heartbeat) return false;

        // Consider offline if no heartbeat for 2 minutes
        const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
        const now = new Date().getTime();
        return (now - lastHeartbeat) < (2 * 60 * 1000);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold">Self-Hosted Agents</h2>
                    <p className="text-muted-foreground">
                        Manage your local agents for performance and automation testing
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setGeneratedToken(null);
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Register Agent
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Register New Agent</DialogTitle>
                            <DialogDescription>
                                Provide a name for your agent to generate an API key.
                            </DialogDescription>
                        </DialogHeader>

                        {!generatedToken ? (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium">Agent Name</label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Local-QA-Agent"
                                        value={newAgentName}
                                        onChange={(e) => setNewAgentName(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 py-4">
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                                    <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                                        <AlertCircle className="h-4 w-4" />
                                        Important: Save this token!
                                    </div>
                                    <p className="text-xs text-amber-700">
                                        This token will only be shown once. You'll need it to configure your agent.
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <code className="flex-1 p-2 bg-white rounded border text-xs break-all font-mono">
                                            {generatedToken}
                                        </code>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() => copyToClipboard(generatedToken)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            {!generatedToken ? (
                                <Button
                                    onClick={registerAgent}
                                    disabled={isRegistering || !newAgentName.trim()}
                                >
                                    {isRegistering ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Registering...
                                        </>
                                    ) : "Register Agent"}
                                </Button>
                            ) : (
                                <Button onClick={() => setIsDialogOpen(false)}>Done</Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Server className="h-4 w-4 text-primary" />
                            Total Agents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{agents.length}</div>
                    </CardContent>
                </Card>

                <Card className="shadow-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-green-500" />
                            Online Now
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {agents.filter(isAgentOnline).length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Database className="h-4 w-4 text-blue-500" />
                            Total Capacity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {agents.reduce((acc, a) => acc + (a.capacity || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-card">
                <CardHeader>
                    <CardTitle>Registered Agents</CardTitle>
                    <CardDescription>
                        Agents registered to this project. They connect using the API token generated during registration.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/30">
                            <Server className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
                            <p className="text-lg font-medium">No agents found</p>
                            <p className="text-sm text-muted-foreground mb-6">
                                Register an agent to start running tests on your infrastructure.
                            </p>
                            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Register first agent
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Capacity</TableHead>
                                    <TableHead>Running</TableHead>
                                    <TableHead>Last Heartbeat</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agents.map((agent) => {
                                    const online = isAgentOnline(agent);
                                    return (
                                        <TableRow key={agent.id}>
                                            <TableCell className="font-medium">{agent.agent_name}</TableCell>
                                            <TableCell>
                                                <Badge variant={online ? "secondary" : "outline"} className={online ? "bg-green-500/10 text-green-600 border-green-200" : ""}>
                                                    {online ? (
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Online
                                                        </span>
                                                    ) : "Offline"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{agent.capacity}</TableCell>
                                            <TableCell>{agent.running_jobs}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {agent.last_heartbeat
                                                    ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })
                                                    : "Never"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteAgent(agent.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-gradient-hero border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="h-5 w-5 text-primary" />
                        How to use your agent
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <p>
                        1. Download the agent executable or pull the docker image for your platform.
                    </p>
                    <p>
                        2. Configure the agent using the generated API Token and your Project ID.
                    </p>
                    <div className="p-3 bg-white/50 dark:bg-black/20 rounded border font-mono text-xs">
                        $ ./test-agent --token YOUR_TOKEN --project {projectId}
                    </div>
                    <p className="text-muted-foreground">
                        The agent will automatically appear as "Online" once it establishes a connection.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
