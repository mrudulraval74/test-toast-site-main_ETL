# ETL Agent - Data Sentinel AI

A self-hosted agent for executing ETL data comparisons between databases.

## Features

- **Multi-Database Support**: PostgreSQL, MySQL, MSSQL, Azure SQL
- **Automated Job Polling**: Continuously polls for comparison jobs
- **Secure**: Database credentials stay on your machine
- **Node Upgrade Safe**: Native MSSQL Windows auth first, with SQLCMD fallback

## Requirements

- Node.js 18+ (works across modern Node versions)
- Network access to your databases
- Network access to Data Sentinel AI API
- For MSSQL Windows Authentication portability:
  - Microsoft SQLCMD tools installed (`sqlcmd`)
  - Microsoft ODBC Driver 17 or 18 for SQL Server

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

3. **Optional: install native Windows auth driver**
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
- `MSSQL_WINDOWS_AUTH_MODE`: `auto` (default), `native`, or `sqlcmd`
- `MSSQL_SQLCMD_PATH`: Optional absolute path to `sqlcmd` executable
- `MSSQL_SQLCMD_DELIMITER`: Optional SQLCMD output delimiter (single character only, default: tab)

### Windows Authentication Behavior

- `auto` (default): try native `msnodesqlv8` first, then SQLCMD fallback
- `native`: use only native `msnodesqlv8`
- `sqlcmd`: force SQLCMD path

This preserves current behavior on machines where native auth already works, and adds resilience on Node upgrades where native modules may fail.

## Usage

1. Start the agent using `npm start`
2. Create comparisons in the Data Sentinel AI web interface
3. Monitor progress in logs

## Troubleshooting

### Agent starts but MSSQL Windows auth fails

1. Verify SQLCMD availability:
   ```bash
   sqlcmd -?
   ```
2. Install ODBC Driver 17 or 18 for SQL Server
3. If native driver is desired, run:
   ```bash
   npm run install:windows-auth
   ```
4. You can also switch to SQL authentication (username/password) for MSSQL connections

### SQLCMD not found

- Add SQLCMD to PATH, or set:
  ```env
  MSSQL_SQLCMD_PATH=C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\sqlcmd.exe
  ```

### Database connection errors

- Verify credentials and auth type
- Check network/firewall access
- Check SSL/TLS requirements

## Development

For development with auto-restart:

```bash
npm run dev
```

## License

MIT
