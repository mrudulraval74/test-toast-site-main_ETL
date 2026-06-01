const fs = require('fs');
const file = 'src/components/AIComparison.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Subscribe to agent changes[\s\S]*?supabase\.removeChannel\(channel\);\s*};/m;

const replaceStr = `// Polling keeps heartbeat status fresh without excessive websocket connections
        const intervalId = window.setInterval(() => {
            fetchAgents({ silent: true });
        }, 30000);

        return () => {
            window.clearInterval(intervalId);
        };`;

if (regex.test(content)) {
    content = content.replace(regex, replaceStr);
    fs.writeFileSync(file, content);
    console.log('Fixed AIComparison.tsx successfully');
} else {
    console.log('Regex not matched in AIComparison.tsx');
}
