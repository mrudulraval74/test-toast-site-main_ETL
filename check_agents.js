
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qfjeicrvelgmyyecvlxo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmamVpY3J2ZWxnbXl5ZWN2bHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NjgwNDcsImV4cCI6MjA3OTU0NDA0N30.HntMCQgGp7PmfryCvilswUNOvyTHuRPYdTgZGvY6z7k";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkAgents() {
    console.log("Fetching self_hosted_agents...");
    const { data, error } = await supabase
        .from('self_hosted_agents')
        .select('*');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} agents:`);

    // Sort by type then name
    data.sort((a, b) => (a.agent_type || '').localeCompare(b.agent_type || '') || a.agent_name.localeCompare(b.agent_name));

    data.forEach(agent => {
        console.log(`- [${agent.id}] ${agent.agent_name} (${agent.status})`);
        console.log(`  Type: '${agent.agent_type}'`);
        console.log(`  Last Heartbeat: ${agent.last_heartbeat}`);
        // console.log(`  Capabilities:`, JSON.stringify(agent.capabilities));
        // Check if fits ETL criteria
        const isEtl = agent.agent_type === 'etl';
        console.log(`  -> Visible in ETL Dropdown? ${isEtl ? 'YES' : 'NO'}`);
        console.log('---');
    });
}

checkAgents();
