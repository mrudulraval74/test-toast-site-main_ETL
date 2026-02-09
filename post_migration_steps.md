# Post-Migration Steps

To complete the move to your new Supabase project (`qfjeicrvelgmyyecvlxo`), please follow these final steps:

## 1. Apply Database Schema
The errors you sees (404/400) for `app_settings` and `test_cases` are because the tables haven't been created in your new project yet.

**Action**: Copy the contents of these two files and run them in the **SQL Editor** of your Supabase Dashboard:
1.  [20260130121000_deploy_standard_schema.sql](file:///c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/migrations/20260130121000_deploy_standard_schema.sql) - *Creates core tables (Dashboard, test cases, etc.)*
2.  [20260130120000_enable_etl_schema.sql](file:///c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/test-toast-site-main 1 (2)/test-toast-site-main_ETL/supabase/migrations/20260130120000_enable_etl_schema.sql) - *Enables specialized ETL tables*

## 2. Verify Agent Connectivity
I have fixed the `mssql` dependency and the startup script.
The agent is now configured to talk to `https://qfjeicrvelgmyyecvlxo.supabase.co/functions/v1/agent-api`.

**Action**:
1. Run `npm run dev:all`.
2. Check the terminal for: `[INFO] Starting ETL Agent etl-agent-prod...`
3. If it starts without errors, it's successfully polling your production Supabase.

## 3. Verify Edge Functions
You have already deployed `agent-api`. All requests from the frontend should now succeed (once the tables are created in Step 1).

---
### Summary of fixes I applied:
- **`etl-agent/package.json`**: Fixed `node server.js` -> `node agent.js`.
- **`etl-agent/.env`**: Pointed to production Supabase.
- **`.env` (root)**: Pointed frontend to production Supabase.
- **`src/hooks/useAIChat.ts`**: Removed hardcoded `localhost:3001` for AI suggestions.
- **`supabase/functions/agent-api/index.ts`**: Fixed CORS and path parsing bug for deployed URLs.
