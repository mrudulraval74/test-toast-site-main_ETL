
import 'dotenv/config';
import axios from 'axios';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://qfjeicrvelgmyyecvlxo.supabase.co/functions/v1/etl-api';
// Hardcoded project ID from client.ts analysis
// If this changes, user must update it manually or we read from main project .env
const PROJECT_ID = 'qfjeicrvelgmyyecvlxo';

async function register() {
    console.log('Registering new ETL Agent...');
    console.log(`Target API: ${API_BASE_URL}`);

    try {
        const payload = {
            projectId: PROJECT_ID,
            agentName: `restored-local-agent-${Date.now()}`,
            agentType: 'etl',
            capacity: 5
        };

        const response = await axios.post(`${API_BASE_URL}/register`, payload);

        if (response.data.success) {
            console.log('\n✅ Agent Registered Successfully!');
            console.log('---------------------------------------------------');
            console.log(`Agent ID:  ${response.data.agent_id}`);
            console.log(`Agent Key: ${response.data.api_key}`);
            console.log('---------------------------------------------------');
            console.log('\nPlease update your .env file with this key:');
            console.log(`AGENT_KEY=${response.data.api_key}`);
            console.log(`AGENT_ID=${response.data.agent_id}`);
        } else {
            console.error('Registration failed:', response.data);
        }
    } catch (error: any) {
        if (error.response) {
            console.error(`Registration error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`Registration error: ${error.message}`);
        }
    }
}

register();
