# ETL Workflow Migration - Quick Reference Card

## 🎯 5-Minute Setup Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                   ETL WORKFLOW MIGRATION FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

Step 1: CREATE SUPABASE PROJECT (2 min)
├─ Go to: https://app.supabase.com
├─ Click: "New Project"
├─ Fill: Project name, region, password
└─ Wait: ~2-3 minutes for initialization

Step 2: RUN MIGRATION SCRIPT (2 min)
├─ In Supabase: SQL Editor → "New Query"
├─ Paste: Entire content of ETL_MIGRATION_SCRIPT.sql
├─ Click: "Run"
└─ Verify: "Tables Created Successfully" message

Step 3: GET CREDENTIALS (1 min)
├─ Go to: Settings > API
├─ Copy:
│  ├─ Project URL → VITE_SUPABASE_URL
│  ├─ Project ID → VITE_SUPABASE_PROJECT_ID
│  └─ anon key → VITE_SUPABASE_PUBLISHABLE_KEY
└─ Keep: service_role key secret (backend only)

Step 4: UPDATE .env (1 min)
├─ Edit: .env file
├─ Paste: Your credentials from Step 3
└─ Save: File

Step 5: TEST & DONE (0 min)
└─ Run: npm run dev
   └─ Success! ETL workflow is live 🎉
```

---

## 🔑 Credentials Quick Lookup

```
┌─────────────────────────────────────────────────────────────────┐
│ LOCATION          │ CREDENTIAL              │ SAFE TO SHARE?   │
├─────────────────────────────────────────────────────────────────┤
│ Settings > API    │ Project URL             │ ✅ YES           │
│ Settings > API    │ Project ID              │ ✅ YES           │
│ Settings > API    │ anon public key         │ ✅ YES           │
│ Settings > API    │ service_role secret     │ ❌ NO (keep safe)│
│ Settings > DB     │ Database password       │ ❌ NO (keep safe)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 .env Configuration Template

```bash
# Copy this to your .env file after running migration

VITE_SUPABASE_URL="https://YOUR-PROJECT-ID.supabase.co"
VITE_SUPABASE_PROJECT_ID="YOUR-PROJECT-ID"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR-ANON-KEY"
VITE_API_BASE_URL="https://YOUR-PROJECT-ID.supabase.co/functions/v1/agent-api"
```

---

## ✅ Verification Checklist

### After Running Migration Script
- [ ] Saw "Tables Created Successfully" message
- [ ] All 12 tables created (check SQL Editor results)
- [ ] No error messages in output

### After Updating .env
- [ ] Project URL matches your Supabase URL
- [ ] Project ID is correct
- [ ] Anon key starts with "eyJh..." (JWT format)
- [ ] .env file is NOT committed to git

### After Starting Dev Server
- [ ] No "CORS" errors in console
- [ ] No "Failed to fetch" errors
- [ ] Supabase client initialized successfully
- [ ] Can access the application

---

## 🚨 Common Issues & Fixes

```
PROBLEM                      SOLUTION
─────────────────────────────────────────────────────────────────

"Failed to fetch"           → Check VITE_SUPABASE_URL is correct
                            → Verify anon key in .env

"Tables not found"          → Run migration script again
                            → Verify SQL execution completed

"Unauthorized" in console   → Make sure using anon key (not 
                              service_role key)

"Project not found"         → Verify Project ID matches URL
                            → Check Supabase project is created

Connection refused          → Make sure Supabase project is
                              done initializing (~2-3 min)
```

---

## 📊 What Gets Migrated

```
Core Tables (12 total)
├─ projects              (Project metadata)
├─ project_members       (Team members)
├─ profiles              (User info)
├─ connections           (Database configs)
├─ saved_queries         (SQL queries)
├─ reports               (Comparison results)
├─ nocode_tests          (Automation tests)
├─ nocode_test_executions (Test history)
├─ self_hosted_agents    (Agent registry)
├─ agent_job_queue       (Job queue)
├─ agent_execution_results (Results)
└─ agent_activity_logs   (Audit trail)

Functions (3 total)
├─ update_updated_at_column()  (Auto-timestamp)
├─ is_project_member()          (Permission check)
└─ generate_agent_run_id()      (ID generation)

Storage (1 bucket)
└─ reports (ETL result files)
```

---

## 🔒 Security Reminders

```
✅ DO:
  • Use anon key in browser
  • Keep service_role key secret
  • Don't commit .env to git
  • Use strong database password
  • Enable MFA in Supabase

❌ DON'T:
  • Put service_role key in .env file
  • Share credentials via email
  • Use weak passwords
  • Disable RLS in production
  • Commit secrets to version control
```

---

## 📱 Getting Credentials from Supabase

```
In Supabase Dashboard:

1. Settings (⚙️) → API
   ├─ Project URL = VITE_SUPABASE_URL
   ├─ Project ID = VITE_SUPABASE_PROJECT_ID
   └─ anon public = VITE_SUPABASE_PUBLISHABLE_KEY

2. Settings (⚙️) → Database
   └─ Password = Your DB password (for direct DB access)

3. Settings (⚙️) → General
   └─ Project ID = In URL after "projects/"
```

---

## 🎯 First Steps After Migration

```
1. Start Development Server
   └─ npm run dev

2. Create a Project
   ├─ Click "New Project"
   └─ Add name and description

3. Add Database Connection
   ├─ Go to: ETL > Connections
   ├─ Click: "Add Connection"
   └─ Fill: Database details

4. Upload Mapping Sheet
   ├─ Go to: ETL > Upload & Validate
   ├─ Click: "Choose File"
   └─ Select: Excel/CSV mapping sheet

5. Generate Test Cases
   ├─ System auto-generates tests
   ├─ Review generated tests
   └─ Proceed to validation

6. Validate & Execute
   ├─ Run: "Validate Structure"
   ├─ Generate: SQL validation queries
   └─ Execute: Compare source/target

7. View Results
   └─ Reports tab shows all historical results
```

---

## 📞 File Locations

```
In the Migration Package:
├─ ETL_MIGRATION_SCRIPT.sql      ← Run this in Supabase
├─ MIGRATION_SETUP_GUIDE.md      ← Detailed instructions
├─ .env.example                  ← Copy to .env
├─ MIGRATION_PACKAGE_README.md   ← Full overview
└─ THIS FILE (quick ref)         ← You are here
```

---

## 🆘 Emergency Troubleshooting

### If migration script fails:
```sql
-- Check if tables exist:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check for errors in logs:
-- Settings > Logs > Database
```

### If credentials don't work:
```bash
# Verify URL format:
# ✅ https://ABC123.supabase.co
# ❌ https://ABC123.supabase.co/  (no trailing slash)
# ❌ https://supabase.co/

# Verify key is anon, not service_role:
# ✅ anon key: "eyJhbGciOiJIUzI1NiIsInR5cCI6I..." (safe)
# ❌ service_role: "eyJhbGciOiJIUzI1NiIsInR5cCI6I..." (secret!)
```

### If can't connect after running migration:
1. Wait 2-3 minutes after project creation
2. Try stopping/restarting dev server
3. Clear browser cache (Ctrl+Shift+Del)
4. Check no VPN/proxy interfering
5. Verify CORS isn't blocking (check browser console)

---

## 📞 Support Resources

```
If you need more info:

1. Full setup guide
   → See: MIGRATION_SETUP_GUIDE.md

2. Deep dive architecture
   → See: MIGRATION_PACKAGE_README.md

3. Environment variables
   → See: .env.example

4. Supabase documentation
   → https://supabase.com/docs

5. Database schema details
   → See: ETL_MIGRATION_SCRIPT.sql (fully commented)
```

---

## ✨ Success Indicators

```
When everything is working:

✅ npm run dev runs without errors
✅ Application loads at http://localhost:8080
✅ No red errors in browser console
✅ Can create a new project
✅ Can add database connections
✅ Can upload mapping sheets
✅ Can generate test cases
✅ Reports are saved and viewable
```

---

## 🎉 You're Ready!

```
┌─────────────────────────────────────────────────────┐
│  Everything is set up and working correctly! 🚀     │
│                                                     │
│  Next step: Start using the ETL Workflow            │
│                                                     │
│  Questions? See MIGRATION_SETUP_GUIDE.md            │
└─────────────────────────────────────────────────────┘
```

---

**Last Updated**: April 2, 2026
**Version**: 1.0
**Status**: Production Ready ✅
