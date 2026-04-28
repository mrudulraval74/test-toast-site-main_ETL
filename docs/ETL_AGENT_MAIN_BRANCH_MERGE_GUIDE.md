# ETL Workflow and Self-Hosted ETL Agent Merge Guide

This guide explains exactly what to move from this branch into another `main` branch, what SQL to run, and how to verify the setup.

It is written for someone with little or no project knowledge.

## 1. What you are merging

You are moving 3 things into the other branch:

1. ETL workflow UI changes
2. Self-hosted ETL agent registration/download changes
3. Backend + database support required for ETL jobs, metadata jobs, and ETL agent heartbeat/polling

## 2. Recommended merge approach

Do not merge random old commits one by one unless you already know their side effects.

Use this safer approach:

1. Create a new branch from the other `main` branch
2. Copy the files listed in this guide from this repo/branch into that new branch
3. Run the SQL from [etl_agent_main_branch_merge.sql](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/docs/etl_agent_main_branch_merge.sql>)
4. Deploy the two Supabase Edge Functions
5. Verify the ETL agent flow end to end

## 2A. Copy Source and Paste Target

This is the simplest way to understand the work.

### Source project

This current project is your source project:

`c:\Users\RavalMrudul\OneDrive - 1Rivet US, Inc\Lovable\New\test-toast-site-main 1 (2)\test-toast-site-main_ETL`

This is where you will copy files from.

### Target project

Your other main branch project is your target project.

This is where you will paste files into matching folders.

Example:

If your target project folder is:

`D:\Projects\my-other-main-branch`

then:

1. Copy from:
   `...\test-toast-site-main_ETL\src\components\AIComparison.tsx`
2. Paste to:
   `D:\Projects\my-other-main-branch\src\components\AIComparison.tsx`

Rule:

Always paste each file into the same relative folder path in the target project.

Example mappings:

1. Source:
   `test-toast-site-main_ETL\src\components\AIComparison.tsx`
   Target:
   `<target-project>\src\components\AIComparison.tsx`

2. Source:
   `test-toast-site-main_ETL\src\lib\api.ts`
   Target:
   `<target-project>\src\lib\api.ts`

3. Source:
   `test-toast-site-main_ETL\public\etl-agent\agent.js`
   Target:
   `<target-project>\public\etl-agent\agent.js`

4. Source:
   `test-toast-site-main_ETL\supabase\functions\etl-api\index.ts`
   Target:
   `<target-project>\supabase\functions\etl-api\index.ts`

5. Source:
   `test-toast-site-main_ETL\supabase\functions\agent-api\index.ts`
   Target:
   `<target-project>\supabase\functions\agent-api\index.ts`

6. Source:
   `test-toast-site-main_ETL\docs\etl_agent_main_branch_merge.sql`
   Target:
   `<target-project>\docs\etl_agent_main_branch_merge.sql`

If the folder does not exist in target, create it first, then paste the file.

## 2B. Very Simple Summary

You have 3 places where work happens:

1. Target project codebase
   This is where you paste frontend files, `public/etl-agent`, and `supabase/functions` files.
2. Supabase Dashboard
   This is where you run SQL and manage database/functions/settings.
3. Agent machine
   This is where you run the ETL agent using the token created from the app.

## 2C. If GitHub Has No Project Yet

If GitHub is completely empty and no repository exists yet, then first create a new GitHub repository and push the full project folder there.

This means:

1. First prepare the target project locally on your machine
2. Then create a new empty GitHub repository
3. Then push the full target project folder to GitHub
4. After that, continue with Supabase SQL, functions, and ETL setup

## 2D. What “full folder” means

When you say “add this entire folder,” it means the whole target project folder should become the GitHub repository contents.

Example:

If your target project folder is:

`D:\Projects\my-other-main-branch`

then GitHub should finally contain files like:

1. `src/...`
2. `public/...`
3. `supabase/...`
4. `package.json`
5. `vite.config.ts`
6. `docs/...`

In short:

The target project root folder becomes the GitHub repository root.

## 3. Files to merge into the other main branch

### 3.1 Frontend files

Copy these files:

1. [AIComparison.tsx](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/src/components/AIComparison.tsx>)
2. [AgentManagement.tsx](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/src/components/AgentManagement.tsx>)
3. [ConnectionsPanel.tsx](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/src/components/ConnectionsPanel.tsx>)
4. [Layout.tsx](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/src/components/Layout.tsx>)
5. [api.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/src/lib/api.ts>)

What these do:

1. `AIComparison.tsx`
   Adds ETL workflow execution changes, ETL agent selection, and metadata validation behavior.
2. `AgentManagement.tsx`
   Adds ETL agent registration support and ETL agent ZIP download support.
3. `ConnectionsPanel.tsx`
   Adds metadata fetch flow and agent-based connection test flow.
4. `Layout.tsx`
   Ensures menu items like `ETL Workflow` and `Self-Hosted Agents` are visible.
5. `api.ts`
   Routes ETL UI calls to `etl-api` for compare, connections, metadata, reports, and job polling.

### 3.2 Public ETL agent package files

Copy the full ETL agent folder:

1. [agent.js](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/public/etl-agent/agent.js>)
2. [package.json](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/public/etl-agent/package.json>)
3. [README.md](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/public/etl-agent/README.md>)
4. [dbConnector.js](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/public/etl-agent/utils/dbConnector.js>)
5. [compareEngine.js](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/public/etl-agent/utils/compareEngine.js>)

Important behavior included in these files:

1. Agent heartbeat to `etl-api`
2. Job polling from `agent_job_queue`
3. ETL comparison execution
4. Agent-driven connection testing
5. Agent-driven metadata fetching
6. MSSQL and Azure SQL handling
7. MSSQL Windows Authentication fallback support through SQLCMD

### 3.3 Supabase Edge Function files

Copy these files:

1. [etl-api/index.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/etl-api/index.ts>)
2. [etl-api/handlers/connections.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/etl-api/handlers/connections.ts>)
3. [etl-api/handlers/jobs.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/etl-api/handlers/jobs.ts>)
4. [etl-api/utils/metadata.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/etl-api/utils/metadata.ts>)
5. [etl-api/utils/supabase.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/etl-api/utils/supabase.ts>)
6. [etl-api/utils/cors.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/etl-api/utils/cors.ts>)
7. [agent-api/index.ts](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/functions/agent-api/index.ts>)

What these do:

1. `etl-api`
   Handles compare run creation, connection save/update/delete, metadata fetch, query preview, report fetch, job polling, job start, and job result submission.
2. `agent-api`
   Handles self-hosted agent registration and stores `agent_type` correctly so ETL agents appear in ETL screens.

## 4. Database changes you must move

You must bring these database capabilities into the other branch:

1. Core ETL tables:
   `connections`, `saved_queries`, `reports`
2. Self-hosted agent tables:
   `self_hosted_agents`, `agent_job_queue`, `agent_execution_results`, `agent_activity_logs`
3. Extended connection columns:
   `schema_name`, `service_name`, `http_path`, `token`, `catalog`, `account`, `warehouse`, `role`, `file_path`, `readonly`
4. Agent type support:
   `self_hosted_agents.agent_type`
5. App repair items used by the UI:
   `app_settings`, `menu_config`, and `test_cases` repair logic where needed

## 5. SQL to run

Use this SQL file:

[etl_agent_main_branch_merge.sql](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/docs/etl_agent_main_branch_merge.sql>)

Run it in the target Supabase project SQL Editor.

Why this is the best option:

1. It is idempotent
2. It includes the ETL workflow schema
3. It includes self-hosted ETL agent schema
4. It includes connection column extensions
5. It includes agent type fixes
6. It includes menu/app settings bootstrap
7. It includes test case repair needed by the current app shape

## 6. Exact merge steps for the other main branch

### Step 1: Create a working branch

```bash
git checkout main
git pull
git checkout -b merge-etl-agent-work
```

### Step 2: Copy code from this branch/repo

You can do this in 2 ways.

#### Option A: Manual copy paste in File Explorer or IDE

Open both projects side by side:

1. Source project:
   `c:\Users\RavalMrudul\OneDrive - 1Rivet US, Inc\Lovable\New\test-toast-site-main 1 (2)\test-toast-site-main_ETL`
2. Target project:
   your other main branch project folder

Then copy each file from source and paste into the same folder path in target.

#### Option B: If both branches are in the same git repo

Use checkout by path:

```bash
git checkout <etl-source-branch> -- src/components/AIComparison.tsx
git checkout <etl-source-branch> -- src/components/AgentManagement.tsx
git checkout <etl-source-branch> -- src/components/ConnectionsPanel.tsx
git checkout <etl-source-branch> -- src/components/Layout.tsx
git checkout <etl-source-branch> -- src/lib/api.ts
git checkout <etl-source-branch> -- public/etl-agent
git checkout <etl-source-branch> -- supabase/functions/etl-api
git checkout <etl-source-branch> -- supabase/functions/agent-api/index.ts
git checkout <etl-source-branch> -- docs/ETL_AGENT_MAIN_BRANCH_MERGE_GUIDE.md
git checkout <etl-source-branch> -- docs/etl_agent_main_branch_merge.sql
```

If the other main branch is in a different repo, copy the same files manually.

### Step 2A: Exact copy-paste list

Copy these from source project and paste into target project:

1. `src/components/AIComparison.tsx`
2. `src/components/AgentManagement.tsx`
3. `src/components/ConnectionsPanel.tsx`
4. `src/components/Layout.tsx`
5. `src/lib/api.ts`
6. Full folder: `public/etl-agent`
7. Full folder: `supabase/functions/etl-api`
8. File: `supabase/functions/agent-api/index.ts`
9. File: `docs/ETL_AGENT_MAIN_BRANCH_MERGE_GUIDE.md`
10. File: `docs/etl_agent_main_branch_merge.sql`

Paste them into the exact same folder names in target project.

### Step 2B: If there is no GitHub project yet

If GitHub has no repository yet, do this after you finish copying files into the target project.

#### Part 1: Create a new repository in GitHub

1. Open `https://github.com`
2. Login
3. Click `New repository`
4. Enter repository name
5. Choose owner
6. Choose `Public` or `Private`
7. Do not add README if your local folder already has project files
8. Click `Create repository`

Important:

If your local project already exists, create the GitHub repository as empty.

#### Part 2: Push the full local target project folder to GitHub

Open terminal inside the target project root folder:

```bash
cd <target-project>
git init
git add .
git commit -m "Initial project with ETL workflow and self-hosted ETL agent"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

After this:

1. the full target project folder will be available in GitHub
2. GitHub becomes your new main code source

#### Part 3: If git is already initialized locally but no remote exists

Run only:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

#### Part 4: If remote already exists but points to wrong repository

Check remote:

```bash
git remote -v
```

Change it:

```bash
git remote remove origin
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### Step 2C: Very basic GitHub full-folder upload process

If someone has zero Git knowledge, tell them this:

1. Keep all project files ready in one local folder
2. Create empty repository in GitHub
3. Open terminal in that local folder
4. Run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

That uploads the full folder to GitHub.

### Step 3: Install dependencies

At the project root:

```bash
npm install
```

For the ETL agent package:

```bash
cd public/etl-agent
npm install
cd ../..
```

### Step 3A: Recommended order if GitHub repository is empty

Use this order:

1. Prepare target project locally
2. Copy ETL files into target project
3. Verify files are in correct folders
4. Create empty GitHub repository
5. Push full target project folder to GitHub
6. Then continue with Supabase setup
7. Then deploy functions
8. Then run frontend and ETL agent

### Step 4: Run SQL in Supabase

1. Open Supabase Dashboard
2. Open `SQL Editor`
3. Open [etl_agent_main_branch_merge.sql](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/docs/etl_agent_main_branch_merge.sql>)
4. Copy all content
5. Paste into SQL Editor
6. Run it

This SQL is not pasted into your project code files.

It must be pasted into:

`Supabase Dashboard -> SQL Editor`

### Step 5: Deploy Edge Functions

```bash
supabase functions deploy etl-api
supabase functions deploy agent-api
```

These commands must be run from the target project folder where the `supabase` folder exists.

### Step 6: Start the frontend

```bash
npm run dev
```

### Step 7: Register one ETL agent from the UI

1. Open the app
2. Go to `Self-Hosted Agents`
3. Click `Register`
4. Use:
   `Agent Type = ETL`
5. Save the returned token

### Step 8: Start the ETL agent locally or on a server

Inside `public/etl-agent`, create `.env`:

```env
API_BASE_URL=https://<your-project-ref>.supabase.co/functions/v1/etl-api
AGENT_API_KEY=<token-from-registration>
POLL_INTERVAL=5000
HEARTBEAT_INTERVAL=60000
PROJECT_ID=<project-id-if-needed>
MSSQL_WINDOWS_AUTH_MODE=auto
```

Then run:

```bash
cd public/etl-agent
npm start
```

### Step 9: Verify the ETL flow

1. Open `ETL Workflow`
2. Create source connection
3. Test source connection
4. Create target connection
5. Test target connection
6. Fetch metadata
7. Enter source SQL
8. Enter target SQL
9. Select key columns
10. Run comparison
11. Confirm report is created

## 7. SQL verification checks

Run these after the merge SQL finishes.

### 7.1 Confirm required tables exist

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
    'agent_activity_logs',
    'app_settings',
    'menu_config'
  )
ORDER BY table_name;
```

### 7.2 Confirm `agent_type` exists

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'self_hosted_agents'
  AND column_name = 'agent_type';
```

### 7.3 Confirm extended connection columns exist

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'connections'
  AND column_name IN (
    'schema_name',
    'service_name',
    'http_path',
    'token',
    'catalog',
    'account',
    'warehouse',
    'role',
    'file_path',
    'readonly'
  )
ORDER BY column_name;
```

### 7.4 Confirm menu items exist

```sql
SELECT menu_id, label, is_visible, display_order
FROM public.menu_config
WHERE menu_id IN ('etl-workflow', 'agents')
ORDER BY display_order;
```

## 8. Functional checks for a zero-knowledge tester

Ask the tester to do this in order:

1. Login to the app
2. Open `Self-Hosted Agents`
3. Register an ETL agent
4. Confirm token is shown
5. Start the ETL agent process
6. Confirm agent becomes `online`
7. Open `ETL Workflow`
8. Add one source DB connection
9. Test it
10. Add one target DB connection
11. Test it
12. Fetch metadata
13. Run one ETL comparison
14. Confirm the job status moves from `pending` to `running` to `completed`
15. Confirm one row appears in `reports`

## 8A. Supabase Basic Registration and Setup Process

This section explains the full basic process from zero.

### Step 1: Create Supabase account

1. Open `https://supabase.com`
2. Click `Start your project`
3. Sign up using Google, GitHub, or email
4. Login to Supabase

What you need to keep safe:

1. Supabase login email
2. Supabase login method
3. Project database password

Do not lose the database password. It is needed later for some admin tasks.

### Step 1A: Create or select organization

After login:

1. Check top-left organization switcher
2. If needed, create a new organization
3. Select the organization where this ETL project should live

This matters because all projects, billing, and access permissions are managed inside the organization.

### Step 2: Create a new Supabase project

1. In Supabase Dashboard click `New Project`
2. Select your organization
3. Enter project name
4. Enter database password
5. Select region
6. Click `Create new project`

Wait until project creation finishes.

Recommended naming example:

1. Project name:
   `wispr-etl-prod`
2. Region:
   nearest to your app users or database

### Step 2A: Save the important project details

Save these in a secure note:

1. Supabase project name
2. Supabase project reference ID
3. Region
4. Database password
5. Dashboard URL

### Step 2B: Invite required team members

If other people need access:

1. Open `Organization Settings`
2. Open `Members`
3. Invite the required users
4. Give the correct role

At minimum, the person doing ETL deployment should be able to:

1. Open SQL Editor
2. View Table Editor
3. Manage Edge Functions
4. Manage API settings

### Step 3: Get project details

After project is created:

1. Open the project
2. Go to `Project Settings`
3. Open `API`
4. Copy these values:
   `Project URL`
   `anon public key`
   `service_role key`

These are used in app setup and function deployment.

Also copy:

1. `Project Reference ID`
   You will use this in `supabase link --project-ref ...`

### Step 3A: Check database connection screen

In Supabase:

1. Open `Project Settings`
2. Open `Database`
3. Open connection information

Save if needed:

1. host
2. port
3. database name
4. user
5. password

This is useful if later you need direct SQL connection from tools.

### Step 4: Put Supabase details into the target project

In target project root, create or update `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

This file stays in the target project codebase root.

### Step 4A: Check frontend Supabase client files

In the target project, make sure these files use the correct environment values:

1. `src/integrations/supabase/client.ts`
2. `src/lib/api.ts`

If the other main branch has old hardcoded Supabase values, replace them with the new project values.

### Step 5: Install Supabase CLI

If not already installed:

```bash
npm install -g supabase
```

Then login:

```bash
supabase login
```

This will open browser login.

### Step 5A: Verify CLI login

Run:

```bash
supabase --version
supabase projects list
```

If project list appears, CLI login is working.

### Step 6: Link target project to Supabase

Open terminal inside target project folder and run:

```bash
supabase link --project-ref your-project-ref
```

This connects the local target project with the Supabase project.

### Step 6A: Check `supabase/config.toml`

After linking:

1. Open `supabase/config.toml`
2. Confirm the project reference points to the correct Supabase project

This is important before deploying functions.

### Step 6B: Optional local Supabase folders to confirm

In target project confirm these folders exist:

1. `supabase/functions/etl-api`
2. `supabase/functions/agent-api`
3. `supabase/migrations`

### Step 7: Where to update database

Database updates are done in Supabase, not in React files.

You have 2 main places:

1. `Supabase Dashboard -> SQL Editor`
   Use this to paste and run [etl_agent_main_branch_merge.sql](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/docs/etl_agent_main_branch_merge.sql>)
2. `Target project terminal`
   Use this to deploy Edge Functions with Supabase CLI

### Step 7A: Exact Supabase screens you will use

During this ETL merge, these are the main Supabase screens:

1. `Project Settings -> API`
   For keys and project URL
2. `Project Settings -> Database`
   For connection details
3. `SQL Editor`
   For running the ETL merge SQL
4. `Table Editor`
   For checking tables and data
5. `Edge Functions`
   For functions and logs
6. `Edge Functions -> Secrets`
   For function secrets
7. `Authentication`
   For login settings if app auth is used
8. `Storage`
   For checking `reports` and `artifacts` buckets

### Step 8: Where to deploy ETL functions

Open terminal in target project root and run:

```bash
supabase functions deploy etl-api
supabase functions deploy agent-api
```

These commands upload your function code from:

1. `<target-project>\supabase\functions\etl-api`
2. `<target-project>\supabase\functions\agent-api`

to Supabase cloud.

### Step 8A: Deploy order

Use this order:

1. Paste files into target project
2. Run SQL in Supabase
3. Add required secrets
4. Deploy `etl-api`
5. Deploy `agent-api`
6. Start frontend
7. Register ETL agent
8. Start ETL agent

### Step 9: Where to add function secrets

In Supabase Dashboard:

1. Open project
2. Open `Edge Functions`
3. Open `Secrets`
4. Add secrets if needed:
   `SUPABASE_URL`
   `SUPABASE_SERVICE_ROLE_KEY`

If your functions depend on anything else in the other project, add those too.

### Step 9A: Minimum secrets checklist

For this ETL merge, verify these exist:

1. `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`

Optional project-specific secrets may also exist in your environment, but the above 2 are the core ones for this ETL setup.

### Step 9B: How to get service role key

1. Open `Project Settings`
2. Open `API`
3. Copy `service_role` key
4. Paste that value into `Edge Functions -> Secrets`

Warning:

Never expose `service_role` key in frontend code or browser-exposed `.env` files.

It must stay only in secure backend places like Supabase function secrets.

### Step 10: How to verify Supabase setup is complete

Check these places:

1. `Supabase Dashboard -> Table Editor`
   Confirm tables exist
2. `Supabase Dashboard -> SQL Editor`
   Run verification SQL from this guide
3. `Supabase Dashboard -> Edge Functions`
   Confirm `etl-api` and `agent-api` are deployed
4. `Supabase Dashboard -> Logs`
   Check logs if API calls fail

### Step 10A: Authentication setup check

If your application uses Supabase login:

1. Open `Authentication`
2. Confirm the login provider you use is enabled
3. If using email login, confirm email auth is enabled
4. If using Google or GitHub login, confirm provider keys are configured

Without working authentication:

1. agent registration may fail
2. ETL comparison creation may fail
3. user-specific data access may fail

### Step 10B: Storage bucket check

Open `Storage` in Supabase and verify these buckets exist:

1. `reports`
2. `artifacts`

If the SQL ran correctly, they should already be created.

### Step 10C: Table check after SQL run

Open `Table Editor` and confirm these tables exist:

1. `connections`
2. `saved_queries`
3. `reports`
4. `self_hosted_agents`
5. `agent_job_queue`
6. `agent_execution_results`
7. `agent_activity_logs`
8. `app_settings`
9. `menu_config`

### Step 10D: Function log check

After deployment:

1. Open `Edge Functions`
2. Open `etl-api`
3. Open logs
4. Open `agent-api`
5. Open logs

Use these logs when:

1. agent registration fails
2. metadata fetch fails
3. connection test fails
4. compare run fails

## 8C. Supabase Full Process in One Flow

If you want the full basic Supabase process in the correct order, follow this:

1. Create Supabase account
2. Create or select organization
3. Create new project
4. Save project URL, anon key, service role key, and project ref
5. Put frontend values in target project `.env`
6. Install and login to Supabase CLI
7. Link target project with `supabase link --project-ref ...`
8. Paste ETL SQL into `Supabase Dashboard -> SQL Editor`
9. Run SQL
10. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `Edge Functions -> Secrets`
11. Paste function files into target project `supabase/functions/...`
12. Deploy `etl-api`
13. Deploy `agent-api`
14. Verify tables in `Table Editor`
15. Verify functions in `Edge Functions`
16. Start frontend app
17. Register ETL agent from UI
18. Start ETL agent
19. Test connections
20. Fetch metadata
21. Run ETL comparison

## 8B. Where to Copy and Where to Paste Everything

This is the shortest answer to your question.

### Copy from current source project

Copy from:

`c:\Users\RavalMrudul\OneDrive - 1Rivet US, Inc\Lovable\New\test-toast-site-main 1 (2)\test-toast-site-main_ETL`

### Paste into target main branch project

Paste into:

`<your-other-main-branch-project-folder>`

### Paste mapping

1. Source `src/components/AIComparison.tsx`
   Paste to `<target>\src\components\AIComparison.tsx`

2. Source `src/components/AgentManagement.tsx`
   Paste to `<target>\src\components\AgentManagement.tsx`

3. Source `src/components/ConnectionsPanel.tsx`
   Paste to `<target>\src\components\ConnectionsPanel.tsx`

4. Source `src/components/Layout.tsx`
   Paste to `<target>\src\components\Layout.tsx`

5. Source `src/lib/api.ts`
   Paste to `<target>\src\lib\api.ts`

6. Source full folder `public/etl-agent`
   Paste to `<target>\public\etl-agent`

7. Source full folder `supabase/functions/etl-api`
   Paste to `<target>\supabase\functions\etl-api`

8. Source `supabase/functions/agent-api/index.ts`
   Paste to `<target>\supabase\functions\agent-api\index.ts`

9. Source `docs/ETL_AGENT_MAIN_BRANCH_MERGE_GUIDE.md`
   Paste to `<target>\docs\ETL_AGENT_MAIN_BRANCH_MERGE_GUIDE.md`

10. Source `docs/etl_agent_main_branch_merge.sql`
    Paste to `<target>\docs\etl_agent_main_branch_merge.sql`

### Paste into Supabase Dashboard

Copy the content of:

`docs\etl_agent_main_branch_merge.sql`

Paste into:

`Supabase Dashboard -> SQL Editor`

### Paste nowhere for functions

For functions you do not paste into Supabase Dashboard manually.

You paste function files into the target project folder:

1. `<target>\supabase\functions\etl-api`
2. `<target>\supabase\functions\agent-api`

Then deploy using terminal:

```bash
supabase functions deploy etl-api
supabase functions deploy agent-api
```

## 8D. How to Add Entire Folder to GitHub When GitHub Has No Project

This section is the direct answer for that case.

### Situation

You have:

1. a full local target project folder on your computer
2. no project yet in GitHub

### What to do

#### Step 1: Keep the final code ready locally

Make sure your target project already contains:

1. copied ETL files
2. copied `public/etl-agent` folder
3. copied `supabase/functions/etl-api` folder
4. copied `supabase/functions/agent-api/index.ts`
5. copied docs files

#### Step 2: Create empty GitHub repository

In GitHub:

1. Click `New repository`
2. Enter repository name
3. Choose `Private` or `Public`
4. Keep it empty
5. Click `Create repository`

#### Step 3: Open terminal in your local target project root

Example:

```bash
cd D:\Projects\my-other-main-branch
```

#### Step 4: Upload full folder to GitHub

Run:

```bash
git init
git add .
git commit -m "Initial ETL project upload"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

#### Step 5: Verify in GitHub

Open the repository in browser and confirm these folders exist:

1. `src`
2. `public`
3. `supabase`
4. `docs`

#### Step 6: Continue the rest of setup

After GitHub upload is complete:

1. run SQL in Supabase
2. deploy functions
3. start frontend
4. register ETL agent
5. start ETL agent

### If files are too large or push fails

Check:

1. `.gitignore`
2. remove unwanted files like:
   `node_modules`
   build output folders
   temp files

Then run:

```bash
git add .
git commit -m "Clean project upload"
git push -u origin main
```

### Good practice before pushing full folder

Do not push these if they contain secrets:

1. real `.env` files
2. secret tokens
3. service role keys
4. passwords

Instead:

1. keep secrets in local `.env`
2. keep backend secrets in Supabase function secrets
3. push only safe project files to GitHub

## 9. Common problems and their meaning

1. ETL agent never comes online
   Usually the token is wrong, the API URL is wrong, or the agent process is not running.

2. Connection test stays pending forever
   Usually no ETL agent is online for that project.

3. ETL agent is online but job fails
   Usually the source SQL, target SQL, DB credential, firewall, or MSSQL auth mode is wrong.

4. ETL agent does not appear in ETL workflow dropdown
   Usually `self_hosted_agents.agent_type` is missing or old rows still have wrong values.

5. Metadata fetch fails
   Usually the selected connection is valid in the UI but not reachable from the agent machine.

## 10. Final handover summary

If you only share one short instruction with another person, share this:

1. Copy the frontend files, ETL agent folder, and Supabase function files listed in this guide
2. Run [etl_agent_main_branch_merge.sql](</c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/docs/etl_agent_main_branch_merge.sql>) in Supabase
3. Deploy `etl-api` and `agent-api`
4. Register an ETL agent
5. Start `public/etl-agent`
6. Test connections, fetch metadata, and run one ETL comparison
