# WISPR Performance Testing Agent (Self-hosted)

This agent executes **JMeter** performance tests on the machine where the agent is running.

## Why you saw `Unexpected token '<'` / `EJSONPARSE`

If you downloaded `run-agent.js` / `package.json` from a URL that returned an **HTML 404 page**, Node/npm will try to parse HTML as JS/JSON.

Use the hosted agent package files below (they are served as real files).

## Download Agent Files (recommended)

Create a new folder:

```bash
mkdir wispr-performance-agent
cd wispr-performance-agent
```

Download the files from your WISPR app (Published URL shown; Preview URL works too):

```bash
# Linux/macOS
curl -fsSL "https://test-toast-site.lovable.app/agent-package/performance-agent/package.json" -o package.json
curl -fsSL "https://test-toast-site.lovable.app/agent-package/performance-agent/run-agent.js" -o run-agent.js
curl -fsSL "https://test-toast-site.lovable.app/agent-package/performance-agent/Dockerfile" -o Dockerfile
```

> Windows: open the URLs in a browser and **Save As** (make sure the file is not HTML).

## Install JMeter

- Install Apache JMeter 5.x from https://jmeter.apache.org/
- Ensure `jmeter` is available in PATH, or set `JMETER_HOME`.

## Configure API token

```bash
export WISPR_API_TOKEN="your_agent_token_here"
```

## Start the agent

```bash
npm install
npm start
```

## Notes

- The agent polls: `GET /performance/jobs/poll`
- Claims a job: `POST /performance/jobs/:id/start`
- Submits results: `POST /performance/jobs/:id/result`

