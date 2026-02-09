
export interface Agent {
    id: string;
    agent_name: string;
    status: string;
    capacity: number;
    running_jobs: number;
    last_heartbeat: string | null;
    created_at: string;
    agent_type?: string;
}

export const isAgentOnline = (agent: Agent) => {
    if (agent.status === "busy") return true; // Busy implies online
    if (agent.status !== "online") return false;
    if (!agent.last_heartbeat) return false;

    // Consider offline if no heartbeat for 2 minutes
    const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
    const now = new Date().getTime();
    return (now - lastHeartbeat) < (2 * 60 * 1000);
};
