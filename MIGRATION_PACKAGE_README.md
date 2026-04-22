# ETL Workflow Migration Package

Complete migration scripts and setup guides for deploying the ETL Workflow to another user's Supabase instance.

## 📦 Package Contents

### 1. **ETL_MIGRATION_SCRIPT.sql**
Complete SQL migration script with all necessary tables, functions, policies, and storage configurations.

**Includes:**
- ✅ Core ETL tables (connections, queries, reports)
- ✅ Project management (projects, members)
- ✅ Authentication (profiles)
- ✅ No-code automation (tests, executions)
- ✅ Agent management (agents, jobs, results, logs)
- ✅ Storage buckets for reports
- ✅ RLS (Row Level Security) policies
- ✅ Performance indexes
- ✅ Utility functions and triggers

**Size:** ~15KB | **Tables:** 12 core + auth tables | **Functions:** 3 utility functions

### 2. **MIGRATION_SETUP_GUIDE.md**
Step-by-step setup instructions for:
- Creating new Supabase project
- Running migration script
- Getting credentials
- Updating environment variables
- Testing connection
- Optional: Authentication, Realtime, Functions

### 3. **.env.example**
Template environment configuration with:
- All required Supabase variables
- Instructions for obtaining credentials
- Security best practices
- Example completed .env

### 4. **README.md** (This file)
Quick-start guide and overview

---

## 🚀 Quick Start (5 minutes)

### For the person setting up the new instance:

```bash
# 1. Create new Supabase project
#    Go to https://app.supabase.com → New Project

# 2. Run the migration script
#    Copy ETL_MIGRATION_SCRIPT.sql → Supabase SQL Editor → Run

# 3. Get credentials
#    Settings > API > Copy URL, Project ID, anon key

# 4. Update environment file
cp .env.example .env
# Edit .env with your new credentials

# 5. Start development
npm install
npm run dev
```

### For the person providing this package:

```bash
# Just provide these 4 files to the other person:
1. ETL_MIGRATION_SCRIPT.sql    ← SQL migration
2. MIGRATION_SETUP_GUIDE.md    ← Instructions
3. .env.example                ← Configuration template
4. README.md (this file)        ← Overview

# The other person will:
# - Run the SQL script in their new Supabase project
# - Update .env with their credentials
# - Start using the ETL workflow
```

---

## 📋 Migration Checklist

- [ ] **Step 1**: Create new Supabase project at https://app.supabase.com
- [ ] **Step 2**: Copy entire SQL migration script to Supabase SQL Editor
- [ ] **Step 3**: Execute script and verify completion
- [ ] **Step 4**: Get Project URL from Settings > API
- [ ] **Step 5**: Get Project ID (from URL: `https://[ID].supabase.co`)
- [ ] **Step 6**: Get anon key from Settings > API
- [ ] **Step 7**: Update `.env` with new credentials
- [ ] **Step 8**: Test with `npm run dev`
- [ ] **Step 9**: Verify no console errors
- [ ] **Step 10**: Create first project and test upload

---

## 🔧 What Gets Migrated

### Core Tables
```
📊 projects              - Project metadata
👥 project_members       - Project team members
👤 profiles              - User profiles

🔌 connections           - Database connections (source/target)
💾 saved_queries         - Saved SQL queries
📈 reports               - Comparison results

🤖 self_hosted_agents    - Agent registry
📋 agent_job_queue       - Job queue
✅ agent_execution_results - Execution results
📝 agent_activity_logs   - Audit trail

🧪 nocode_tests          - No-code automation tests
⚙️ nocode_test_executions - Test execution history
```

### Features Immediately Available
```
✅ ETL Workflow (connections, queries, comparisons)
✅ Project Management (create projects, add members)
✅ Mapping Sheet Upload & Analysis
✅ Test Case Generation
✅ No-Code Automation
✅ Self-hosted Agent Support
✅ Report Storage and History
✅ Row-Level Security (RLS)
✅ Audit Logging
```

---

## 🔐 Security Notes

### Credentials to Keep Secret
- ❌ `VITE_SUPABASE_SECRET_KEY` - Service role key (backend only!)
- ❌ Database password
- ❌ API tokens

### Credentials Safe to Share
- ✅ `VITE_SUPABASE_URL` - Project URL
- ✅ `VITE_SUPABASE_PROJECT_ID` - Project ID
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon key (RLS protected)

### Best Practices Applied
- ✅ RLS enabled on all tables
- ✅ Service role policies for secure operations
- ✅ Project member access control
- ✅ User isolation via auth.uid()

---

## 📊 Database Schema Overview

```
┌─────────────────────────┐
│   Authentication        │
├─────────────────────────┤
│ • profiles (user info)  │
│ • projects (workspaces) │
│ • project_members (ACL) │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│   ETL Core              │
├─────────────────────────┤
│ • connections (DB info) │
│ • saved_queries (SQL)   │
│ • reports (results)     │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│   Automation            │
├─────────────────────────┤
│ • nocode_tests (config) │
│ • nocode_test_exec      │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│   Agent Management      │
├─────────────────────────┤
│ • self_hosted_agents    │
│ • agent_job_queue       │
│ • agent_exec_results    │
│ • agent_activity_logs   │
└─────────────────────────┘
```

---

## 🆘 Troubleshooting

### "Failed to fetch" errors
→ Check URL and credentials in `.env`

### "Tables not found" errors
→ Run migration script again and verify completion

### Authentication fails
→ Enable Email authentication in Supabase > Authentication > Providers

### Connection tests fail
→ Verify database credentials (host, port, username, password)

### Agents can't connect
→ Check agent API URL matches project ID

See **MIGRATION_SETUP_GUIDE.md** for full troubleshooting guide.

---

## 📞 Key Credentialslocations in Supabase

| Credential | Location | Purpose |
|-----------|----------|---------|
| Project URL | Settings > API | Connection string |
| Project ID | Settings > API / URL | In URLs |
| Anon Key | Settings > API | Browser client |
| Service Role | Settings > API | Backend only ⚠️ |
| Database Password | Settings > Database | Direct DB access |
| JWT Secret | Settings > API | Token verification |

---

## 🎯 After Setup

Once migration is complete:

1. **Create a Project**
   - In the UI: "New Project" → "Create"
   - Add team members (optional)

2. **Add Database Connections**
   - ETL > Connections
   - Add source and target databases

3. **Upload Mapping Sheet**
   - ETL > Upload & Validate
   - Upload Excel/CSV mapping sheet

4. **Generate Test Cases**
   - System generates tests automatically
   - Review and customize (optional)

5. **Run Validation**
   - Click "Validate Structure"
   - Compares source/target schemas

6. **Execute Tests**
   - Run test cases individually or in batch
   - View results and mismatches

7. **Deploy Agents** (Optional)
   - Set up self-hosted agents for automation
   - Scale test execution

---

## ✨ Key Features Now Available

### 🔌 Connection Management
- Save database connection configs
- Support for: MSSQL, PostgreSQL, MySQL, Oracle, Snowflake, Databricks
- Secure credential storage

### 📊 Query Builder
- Write and save SQL queries
- Execute against connections
- Preview results

### 🔄 ETL Validation
- Upload mapping sheets (Excel/CSV)
- Auto-detect and parse formats
- Generate validation SQL
- Compare source/target structures

### 🧪 Test Generation
- Automatic test case generation from mappings
- Support for complex transformations
- Business rule testing
- Data quality validation

### 🤖 Automation
- Self-hosted agent execution
- No-code test automation
- Browser automation support
- Screenshot and video capture

### 📈 Reporting
- Detailed comparison reports
- Column-level statistics
- Data quality metrics
- Audit trail logging

---

## 📚 File Reference

### ETL_MIGRATION_SCRIPT.sql
- **Lines 1-50**: Extensions and utility functions
- **Lines 51-150**: Auth & project management tables
- **Lines 151-300**: ETL core tables (connections, queries, reports)
- **Lines 301-400**: No-code test tables
- **Lines 401-600**: Agent management tables
- **Lines 601-700**: Indexes for performance
- **Lines 701-800**: Triggers for updated_at
- **Lines 801-900**: Storage buckets and policies
- **Lines 901+**: Verification query

### MIGRATION_SETUP_GUIDE.md
- **Section 1-3**: Project creation and script execution
- **Section 4-6**: Getting credentials and updating config
- **Section 7-8**: Testing and optional features
- **Section 9+**: Troubleshooting and reference

### .env.example
- **Section 1-2**: Required Supabase credentials
- **Section 3-5**: Optional API and agent config
- **Section 6-10**: Instructions and best practices

---

## 💡 Pro Tips

1. **Testing in Development**
   ```bash
   # Use the example .env values with a test Supabase project
   cp .env.example .env
   # Fill in test credentials
   npm run dev
   ```

2. **Multiple Environments**
   ```bash
   .env.local          # Local development (git ignored)
   .env.staging        # Staging deployment
   .env.production     # Production (⚠️ keep secrets safe!)
   ```

3. **Backup Credentials**
   - Save credentials in secure password manager
   - Not in version control
   - Not in plain text files

4. **Rotate Keys Periodically**
   - Supabase > Settings > API > Rotate keys
   - Update .env immediately
   - Restart servers

---

## 📝 Version Info

- **Migration Script Version**: 1.0
- **Compatible Supabase**: v1.0+
- **Last Updated**: April 2, 2026
- **Tables**: 12
- **Functions**: 3
- **Policies**: 20+

---

## 🎓 Next Steps

1. ✅ **Immediate**: Run migration script (5 min)
2. ✅ **Quick**: Update .env and test (5 min)
3. ✅ **First Use**: Create project and add connections (10 min)
4. ✅ **Validate**: Upload mapping sheet (5 min)
5. ✅ **Execute**: Generate and run test cases (ongoing)

---

## 📧 Support

If you encounter issues:

1. **Check Logs**
   - Supabase: Settings > Logs
   - Browser: F12 > Console
   - Terminal: npm run dev output

2. **Verify Setup**
   - [ ] SQL script executed without errors
   - [ ] .env has correct credentials
   - [ ] Project ID matches URL
   - [ ] Anon key is not service role key

3. **Common Issues** → See MIGRATION_SETUP_GUIDE.md section "Troubleshooting"

---

## 🎉 Success!

After following these steps:
- ✅ New Supabase instance ready
- ✅ All tables and functions created
- ✅ RLS policies active
- ✅ Ready to upload mapping sheets
- ✅ Ready to generate test cases
- ✅ Ready to execute ETL validation

**The ETL Workflow is now fully functional in the new Supabase instance!**

Enjoy! 🚀
