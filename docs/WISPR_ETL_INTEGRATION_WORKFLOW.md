# WISPR ETL Integration Workflow Runbook (Detailed Step-by-Step)

This is a detailed implementation runbook for integrating ETL workflow into the WISPR codebase in this repository.

It is written for real project onboarding and production rollout, not only local demo usage.

## 0. What this runbook covers

This runbook gives exact steps for:
1. Preparing environment and Supabase project
2. Running database schema SQL for ETL workflow
3. Deploying required Edge Functions
4. Registering and starting self-hosted ETL agent
5. Running first end-to-end ETL comparison
6. Validating every layer (UI, API, DB, agent)
7. Troubleshooting common failures
8. Hardening for production

Implementation reference files in this repo:
- Frontend ETL API wrapper: `src/lib/api.ts`
- Compare flow UI: `src/components/AIComparison.tsx`
- Connections flow UI: `src/components/ConnectionsPanel.tsx`
- ETL API entrypoint: `supabase/functions/etl-api/index.ts`
- ETL jobs handlers: `supabase/functions/etl-api/handlers/jobs.ts`
- ETL connections handlers: `supabase/functions/etl-api/handlers/connections.ts`
- ETL agent process: `public/etl-agent/agent.js`
- ETL compare engine: `public/etl-agent/utils/compareEngine.js`
- ETL DB connectors: `public/etl-agent/utils/dbConnector.js`
- SQL baseline script: `docs/wispr_etl_schema.sql`

## 0A. Where to find everything (Repo + Supabase + Runtime)

Use this section when someone asks “where is this configured?” or “where does this run from?”.

### 0A.1 Repo folders and what they contain

1. `supabase/migrations/`
- All DB migrations already in project history.

2. `docs/wispr_etl_schema.sql`
- ETL baseline SQL script you can run directly for ETL/agent tables and policies.

3. `supabase/functions/etl-api/`
- Main ETL function.
- `index.ts`: route dispatching.
- `handlers/connections.ts`: connection test/save/metadata/preview logic.
- `handlers/jobs.ts`: polling/start/result/artifact endpoints.
- `utils/supabase.ts`: service-role client and auth helpers.

4. `supabase/functions/agent-api/`
- Agent registration and broader agent workflow function.

5. `public/etl-agent/`
- Self-hosted ETL agent package downloaded/run on agent machine.
- `agent.js`: polling loop + job execution.
- `utils/compareEngine.js`: comparison algorithm and output payload.
- `utils/dbConnector.js`: DB connectors (Postgres/MySQL/MSSQL/Azure SQL).
- `README.md`: install and runtime notes.

6. `src/components/AIComparison.tsx`
- ETL compare UI flow, run submission, polling, result rendering.

7. `src/components/ConnectionsPanel.tsx`
- Connection create/test/edit/delete UI.

8. `src/lib/api.ts`
- Central client mapping from UI actions to `etl-api` endpoints.

### 0A.2 Supabase dashboard locations

1. Project settings and keys:
- Supabase Dashboard -> `Project Settings` -> `API`
- Get `Project URL`, `anon key`, and reference IDs.

2. Function secrets:
- Supabase Dashboard -> `Edge Functions` -> `Secrets`
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

3. Deployed functions list:
- Supabase Dashboard -> `Edge Functions`
- Verify `etl-api` and `agent-api` are present and recently updated.

4. Database tables:
- Supabase Dashboard -> `Table Editor`
- Check: `connections`, `saved_queries`, `reports`, `self_hosted_agents`, `agent_job_queue`, `agent_execution_results`, `agent_activity_logs`.

5. SQL query validation:
- Supabase Dashboard -> `SQL Editor`
- Run verification SQL snippets from this runbook.

6. Storage buckets:
- Supabase Dashboard -> `Storage`
- Verify buckets: `artifacts`, `reports`.

7. Function logs:
- Supabase Dashboard -> `Edge Functions` -> open function -> `Logs`
- Use for `etl-api`/`agent-api` runtime troubleshooting.

### 0A.3 Environment files and exact values location

1. Frontend env file:
- Path: `test-toast-site-main_ETL/.env`
- Keys used by UI/API wrapper:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

2. Agent env file:
- Path: `test-toast-site-main_ETL/public/etl-agent/.env`
- Required keys:
  - `API_BASE_URL`
  - `AGENT_API_KEY`
  - `POLL_INTERVAL`
  - `HEARTBEAT_INTERVAL`

3. Supabase project ref already linked in:
- `supabase/config.toml` (`project_id`)

### 0A.4 Runtime URLs used by this ETL flow

1. Base function URL pattern:
- `https://<project-ref>.supabase.co/functions/v1`

2. ETL API base used by frontend:
- `https://<project-ref>.supabase.co/functions/v1/etl-api`

3. Key ETL routes:
- `POST /etl-api/compare/run`
- `GET /etl-api/jobs/poll` (agent)
- `POST /etl-api/jobs/{id}/start` (agent)
- `POST /etl-api/jobs/{id}/result` (agent)
- `GET /etl-api/jobs/{id}`
- `POST /etl-api/connections/test`
- `POST /etl-api/connections/save`
- `GET|POST /etl-api/connections/{id}/metadata`
- `POST /etl-api/queries/preview`

4. Agent registration route:
- `POST /functions/v1/agent-api/register`

### 0A.5 Where to check each stage during execution

1. Connection test submitted:
- UI: Connections page toast/status
- DB: `agent_job_queue` with `job_type='test_connection'` (if agent mode)
- Logs: `etl-api` + agent process logs

2. Compare job submitted:
- DB: new `agent_job_queue` row (`etl_comparison`, `pending`)
- DB: new `reports` row (`pending`)

3. Agent picked job:
- DB: `agent_job_queue.status='running'` and `started_at` set
- Agent console: poll/start logs

4. Job completed:
- DB: `agent_job_queue.status='completed'|'failed'`
- DB: `agent_job_queue.result` or `error_log`
- UI: compare status and mismatch rendering

5. Report saved:
- DB: `reports` new completed row
- UI: ETL Reports page list update

## 1. End-to-end architecture (before implementation)

Data flow (actual flow in this codebase):
1. User creates source and target DB connections from ETL Connections UI.
2. UI calls `etl-api` (`/connections/test`, `/connections/save`, `/connections/{id}/metadata`).
3. User executes comparison from ETL Compare UI.
4. UI calls `/compare/run`.
5. `etl-api` inserts one row into `agent_job_queue` with `status='pending'` and `job_type='etl_comparison'`.
6. ETL agent polls `/jobs/poll` with `x-agent-key`.
7. Agent picks pending job, marks start via `/jobs/{id}/start`, runs comparison, submits `/jobs/{id}/result`.
8. UI polls `/jobs/{id}` until terminal state.
9. UI saves result to `reports` table using `reportsApi.saveTestRun()`.

## 2. Prerequisites checklist

Complete this checklist before coding/deployment:
1. Node.js 18+ installed.
2. npm installed.
3. Supabase CLI installed and logged in.
4. Access to target Supabase project.
5. Access to databases you want to compare (network/firewall opened).
6. For MSSQL Windows authentication support (if required):
- SQLCMD tools installed.
- ODBC Driver 17/18 installed.

## 3. Step-by-step setup (local project)

### Step 3.1: Move to project directory

```bash
cd test-toast-site-main_ETL
```

### Step 3.2: Install dependencies

```bash
npm install
```

### Step 3.3: Configure frontend `.env`

Create/update `.env` in `test-toast-site-main_ETL` with:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Step 3.4: Link Supabase project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

## 4. Database schema execution (very detailed)

This codebase expects ETL and agent tables that are not only generic but include job payload/result fields used by handlers.

### Step 4.1: Ensure base app schema exists

The ETL script assumes these core tables already exist:
- `public.projects`
- `public.project_members`

If your environment is fresh, run your base schema migrations first:

```bash
supabase db push
```

### Step 4.2: Execute ETL SQL baseline script

Run:

```bash
psql "<supabase-connection-string>" -f docs/wispr_etl_schema.sql
```

Or copy/paste `docs/wispr_etl_schema.sql` in Supabase SQL editor and execute.

### Step 4.3: Validate created tables

Run this SQL query and confirm all rows exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'connections',
  'saved_queries',
  'reports',
  'self_hosted_agents',
  'agent_job_queue',
  'agent_execution_results',
  'agent_activity_logs'
)
ORDER BY table_name;
```

Expected: all 7 table names returned.

### Step 4.4: Validate critical columns used by runtime

#### 4.4.1 `agent_job_queue` must include:
- `job_type`
- `payload` (jsonb)
- `result` (jsonb)
- `error_log`
- `status`
- `project_id`
- `agent_id`

Check:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='agent_job_queue'
ORDER BY ordinal_position;
```

#### 4.4.2 `reports` must include:
- `compare_id`
- `job_id`
- `source_query`
- `target_query`
- `status`
- `summary`

Check:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='reports'
ORDER BY ordinal_position;
```

#### 4.4.3 `connections` must include extended fields:
- `schema_name`, `service_name`, `http_path`, `token`, `catalog`, `account`, `warehouse`, `role`, `file_path`, `readonly`

Check:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='connections'
ORDER BY ordinal_position;
```

### Step 4.5: Validate storage buckets used by ETL flow

```sql
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('artifacts', 'reports');
```

Expected: both `artifacts` and `reports`.

## 5. Deploy and configure Edge Functions

### Step 5.1: Set required secrets

Set these in Supabase project secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Step 5.2: Deploy ETL function

```bash
supabase functions deploy etl-api
```

### Step 5.3: Deploy agent registration function

```bash
supabase functions deploy agent-api
```

### Step 5.4: Verify endpoint health quickly

Use any HTTP client to call:
- `https://<project-ref>.supabase.co/functions/v1/etl-api/agents`
- `https://<project-ref>.supabase.co/functions/v1/agent-api`

If protected routes are used, pass auth headers accordingly.

## 6. Register ETL agent (detailed)

You need one row in `self_hosted_agents` and one generated API token.

### Option A: Register from UI (recommended)

1. Open app.
2. Go to Agent Management.
3. Register new agent:
- `agentType = etl`
- Give clear `agentId` like `WISPR-ETL-01`
4. Save token returned by API.

### Option B: Register via API

Call:
`POST /functions/v1/agent-api/register`

Payload:

```json
{
  "projectId": "<project-uuid>",
  "agentId": "WISPR-ETL-01",
  "agentName": "WISPR ETL Runner 01",
  "agentType": "etl",
  "browsers": ["chromium"],
  "capacity": 1
}
```

Response includes:
- `api_key`
- `apiToken`

### Step 6.1: Validate registration in DB

```sql
SELECT id, project_id, agent_id, agent_name, agent_type, status, last_heartbeat
FROM public.self_hosted_agents
ORDER BY created_at DESC
LIMIT 5;
```

## 7. ETL agent installation and startup

Path: `public/etl-agent`

### Step 7.1: Create agent `.env`

In `public/etl-agent/.env`:

```env
API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/etl-api
AGENT_API_KEY=<token-from-registration>
POLL_INTERVAL=5000
HEARTBEAT_INTERVAL=60000
MSSQL_WINDOWS_AUTH_MODE=auto
```

### Step 7.2: Install and run

```bash
cd public/etl-agent
npm install
npm start
```

### Step 7.3: Confirm heartbeat updates

Run in DB:

```sql
SELECT agent_id, status, running_jobs, last_heartbeat
FROM public.self_hosted_agents
ORDER BY updated_at DESC
LIMIT 10;
```

Expected:
- `last_heartbeat` updates regularly.
- status becomes `online` or `busy`.

## 8. Connections workflow (granular functional steps)

### Step 8.1: Create source connection

UI route: ETL -> Connections

1. Fill connection parameters.
2. Click Test.
3. If testing through agent, pass `agentId` (UI already supports this).
4. Confirm test succeeded.
5. Save connection.

API calls involved:
- `POST /connections/test`
- `POST /connections/save`

### Step 8.2: Create target connection

Repeat same process for target DB.

### Step 8.3: Validate two saved connections exist

```sql
SELECT id, name, type, host, database, created_at
FROM public.connections
ORDER BY created_at DESC
LIMIT 20;
```

## 9. Metadata and SQL preparation workflow

### Step 9.1: Fetch metadata for source

API:
- direct: `GET /connections/{id}/metadata`
- agent queued: `POST /connections/{id}/metadata` with `{ "agentId": "..." }`

### Step 9.2: Fetch metadata for target

Same as source.

### Step 9.3: Prepare source and target SQL

Use Query Builder or manual SQL.

### Step 9.4: Validate SQL using preview endpoint

`POST /queries/preview`

Payload:

```json
{
  "connectionId": "<connection-uuid>",
  "sql": "SELECT ...",
  "limit": 100
}
```

Expected response:
- `columns`
- `rows`

## 10. Comparison run workflow (single test case, detailed)

### Step 10.1: Build compare payload

Minimum payload for this codebase:

```json
{
  "projectId": "<project-uuid>",
  "agentId": "<agent-uuid>",
  "sourceConnectionId": "<source-connection-uuid>",
  "targetConnectionId": "<target-connection-uuid>",
  "sourceConnection": { "...full source connection object..." },
  "targetConnection": { "...full target connection object..." },
  "sourceQuery": "SELECT ...",
  "targetQuery": "SELECT ...",
  "keyColumns": ["id"]
}
```

### Step 10.2: Submit run

API:
- `POST /compare/run`

Expected response:
- `success: true`
- `compareId`
- `jobId`

### Step 10.3: Validate queue insertion

```sql
SELECT id, project_id, job_type, status, run_id, created_at
FROM public.agent_job_queue
ORDER BY created_at DESC
LIMIT 10;
```

Expected: new row with `status = pending`, `job_type = etl_comparison`.

### Step 10.4: Validate agent claims job

Same query should show transition to:
- `status = running`
- `started_at` populated

### Step 10.5: Validate completion

Final state should become:
- `status = completed` or `failed`
- `completed_at` populated
- `result` populated for completed jobs

Check:

```sql
SELECT id, status, started_at, completed_at, error_log, result
FROM public.agent_job_queue
ORDER BY created_at DESC
LIMIT 5;
```

## 11. Result interpretation workflow

`compareEngine.js` currently compares hashed rows across common columns or configured key columns.

Important result fields:
- `summary.sourceRowCount`
- `summary.targetRowCount`
- `summary.matchedRows`
- `summary.mismatchedRows`
- `summary.sourceOnlyRows`
- `summary.targetOnlyRows`
- `summary.comparisonStatus` (`passed`/`failed`)
- `mismatches[]`
- `sampleMismatches[]`

### Step 11.1: Validate compare outcome from DB

```sql
SELECT
  id,
  status,
  result->'summary' AS summary,
  jsonb_array_length(COALESCE(result->'mismatches', '[]'::jsonb)) AS mismatch_count
FROM public.agent_job_queue
ORDER BY created_at DESC
LIMIT 10;
```

## 12. Save report workflow

UI save action writes into `reports` via `reportsApi.saveTestRun()`.

### Step 12.1: Validate saved report row

```sql
SELECT
  id,
  compare_id,
  name,
  source_connection_id,
  target_connection_id,
  status,
  progress,
  completed_at
FROM public.reports
ORDER BY created_at DESC
LIMIT 20;
```

### Step 12.2: Open report in UI

Go to ETL -> Reports page and verify:
- row visible
- metadata visible
- summary/mismatch values match job result

## 13. Full end-to-end UAT script (copy for QA team)

Run this exact sequence in one sitting:
1. Register ETL agent from Agent Management.
2. Start ETL agent process.
3. Create source connection and test it.
4. Create target connection and test it.
5. Fetch metadata for both.
6. Create source query and preview.
7. Create target query and preview.
8. Submit compare run.
9. Observe `pending -> running -> completed/failed` in `agent_job_queue`.
10. Validate `result.summary` fields in DB.
11. Save report from UI.
12. Validate row in `reports`.
13. Delete one report and confirm deletion path works.

## 14. API contract summary by endpoint

### 14.1 Connection endpoints
- `GET /connections`
- `POST /connections/save`
- `PUT /connections/{id}`
- `DELETE /connections/{id}`
- `POST /connections/test`
- `GET|POST /connections/{id}/metadata`

### 14.2 Query endpoints
- `GET /queries/saved`
- `POST /queries/saved`
- `DELETE /queries/saved/{id}`
- `POST /queries/preview`

### 14.3 Compare/job endpoints
- `POST /compare/run`
- `GET /jobs/poll` (agent)
- `POST /jobs/{id}/start` (agent)
- `POST /jobs/{id}/result` (agent)
- `POST /jobs/{id}/artifacts` (agent)
- `GET /jobs/{id}`

### 14.4 Reports endpoints
- `GET /reports`
- `GET /reports/{compareId}`
- `DELETE /reports/{compareId}`

## 15. Failure handling and troubleshooting (detailed)

### 15.1 `/compare/run` returns unauthorized
Cause:
- Missing or invalid bearer token in frontend request.

Action:
1. Verify user is logged in.
2. Verify `Authorization` header exists.
3. Check `getUserIdFromRequest()` behavior in `supabase/functions/etl-api/utils/supabase.ts`.

### 15.2 Job remains pending forever
Cause:
- Agent not polling or wrong `AGENT_API_KEY`.

Action:
1. Confirm agent process running.
2. Confirm `API_BASE_URL` points to your Supabase project.
3. Confirm `AGENT_API_KEY` matches `self_hosted_agents.api_token_hash`.
4. Check agent logs for auth or network failures.

### 15.3 Job fails immediately
Cause:
- SQL syntax failure, connection failure, unsupported DB path.

Action:
1. Check `agent_job_queue.error_log`.
2. Re-run query via `/queries/preview` first.
3. Validate DB connectivity from agent machine.

### 15.4 MSSQL Windows auth fails
Cause:
- Native driver missing or trust/domain issue.

Action:
1. Install SQLCMD and ODBC Driver 17/18.
2. Use `MSSQL_WINDOWS_AUTH_MODE=sqlcmd` to force fallback.
3. If still failing, switch to SQL auth username/password.

### 15.5 No common columns found
Cause:
- Source and target SQL return different column names.

Action:
1. Align selected output columns in both SQL queries.
2. Use explicit aliases to standardize names.
3. Use `keyColumns` only if those columns are present in both outputs.

## 16. Production hardening plan (recommended next steps)

1. Add `project_id` to `connections`, `saved_queries`, and `reports` and enforce strict RLS.
2. Move DB credentials out of plain columns into encrypted secret store.
3. Add periodic archival for large `agent_job_queue.result` payloads.
4. Add retry/dead-letter handling for failed jobs.
5. Add observability dashboards for queue depth, job latency, mismatch rates.
6. Add integration tests for `/compare/run` and agent result submission.

## 17. Exact quick-start sequence for new WISPR projects

If you need fastest path, do only these in order:
1. `supabase db push`
2. run `docs/wispr_etl_schema.sql`
3. deploy `etl-api` and `agent-api`
4. run frontend (`npm run dev`)
5. register ETL agent from UI
6. start `public/etl-agent` with `.env`
7. create 2 connections
8. run one compare
9. save report
10. validate DB rows in `agent_job_queue` and `reports`

That sequence confirms the full ETL integration is alive in a real project environment.
