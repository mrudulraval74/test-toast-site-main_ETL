
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from parent directory (where .env usually is)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    data.forEach(agent => {
        console.log(`- [${agent.id}] ${agent.agent_name} (${agent.status})`);
        console.log(`  Type: ${agent.agent_type}`);
        console.log(`  Last Heartbeat: ${agent.last_heartbeat}`);
        console.log(`  Capabilities:`, agent.capabilities);
        console.log('---');
    });
}

checkAgents();
