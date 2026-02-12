# ETL Agent - Data Sentinel AI

A self-hosted agent for executing ETL data comparisons between databases.

## Features

- **Multi-Database Support**: PostgreSQL, MySQL, MSSQL
- **Automated Job Polling**: Continuously polls for comparison jobs
- **Secure**: Database credentials stay on your machine
- **Easy Setup**: Simple configuration via environment variables

## Requirements

- Node.js 18.0.0 or higher
- Network access to your databases
- Network access to Data Sentinel AI API

## Installation

1. **Extract the agent package**
   ```bash
   unzip etl-agent-*.zip
   cd etl-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Windows Authentication driver (mandatory)**
   ```bash
   npm run install:windows-auth
   ```

4. **Configure environment**
   
   The `.env` file has been pre-configured with your API key. You can modify settings if needed:
   
   ```env
   # API Configuration
   API_BASE_URL=https://your-domain.com/functions/v1/etl-api
   AGENT_API_KEY=your-agent-api-key
   
   # Agent Settings
   POLL_INTERVAL=5000
   PROJECT_ID=your-project-id
   ```

5. **Start the agent**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

- `API_BASE_URL`: Base URL of the ETL API (required)
- `AGENT_API_KEY`: Your agent API key (required, pre-configured)
- `POLL_INTERVAL`: Job polling interval in milliseconds (default: 5000)
- `PROJECT_ID`: Your project ID (required, pre-configured)

### Database Connections

Database connection details are provided by the API when jobs are assigned. The agent supports:

- **PostgreSQL**: Standard PostgreSQL databases
- **MySQL**: MySQL and MariaDB databases
- **MSSQL**: Microsoft SQL Server databases

## Usage

1. **Start the agent** using `npm start`
2. **Create comparisons** in the Data Sentinel AI web interface
3. **Monitor progress** - The agent will automatically:
   - Poll for new comparison jobs
   - Execute queries on source and target databases
   - Compare results
   - Submit results back to the API

## Logs

The agent provides detailed console output:

```
ETL Agent starting...
API Base URL: https://your-domain.com/functions/v1/etl-api
Poll Interval: 5000ms
[Agent] Starting job polling...
[Job] Received job: abc-123 (etl_comparison)
[Job abc-123] Started processing
[Comparison] Executing ETL comparison...
[Comparison] Source: postgresql://localhost:5432/source_db
[Comparison] Target: postgresql://localhost:5432/target_db
[Comparison] Complete - Status: passed
[Job abc-123] Completed successfully
```

## Troubleshooting

### Agent won't start

- Verify Node.js version: `node --version` (must be 18+)
- Check `.env` file exists and contains `AGENT_API_KEY`
- Ensure network connectivity to API

### Database connection errors

- Verify database credentials
- Check network access to database servers
- Ensure database allows connections from agent's IP
- Check SSL/TLS requirements

### Windows Authentication (MSSQL) issues

- Install native driver support:
  ```bash
  npm run install:windows-auth
  ```
- Install Microsoft ODBC Driver 17 or 18 for SQL Server on the agent machine.
- If build tools are missing, install Visual Studio C++ Build Tools and retry.

### Jobs not appearing

- Verify agent is running and polling
- Check `AGENT_API_KEY` is correct
- Ensure agent is registered in the web interface
- Check API connectivity

## Development

For development with auto-restart on file changes:

```bash
npm run dev
```

## Support

For issues or questions, please contact support or check the documentation at your Data Sentinel AI instance.

## License

MIT
