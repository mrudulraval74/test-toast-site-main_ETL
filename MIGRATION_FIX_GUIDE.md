# Supabase Migration Fix - Complete Guide

## Problem Description

**Error Encountered:**
```
Failed to run sql query: ERROR: 42P01: relation "public.project_members" does not exist 
LINE 46: SELECT 1 FROM public.project_members ^
```

## Root Cause

The original `ETL_MIGRATION_SCRIPT.sql` had **incorrect dependency ordering**:

1. **Line 40-50**: Function `is_project_member()` was created, which references the `public.project_members` table
2. **Line 60-75**: Function `generate_agent_run_id()` was created, which references the `agent_job_queue` table
3. **But the tables weren't created until later:**
   - Line 117: `public.project_members` table created
   - Line 321: `agent_job_queue` table created

When the second PC tries to run these functions AND execute queries that USE them, PostgreSQL attempts to validate the function bodies and fails because the referenced tables don't exist yet.

## Solution: Dependency-First Ordering

### Option 1: Use the Pre-Fixed Migration Script (Recommended)

**File**: `ETL_MIGRATION_SCRIPT.sql` (now fixed)

✅ **Changes Made:**
- All table definitions moved BEFORE function definitions that reference them
- Functions now created in the proper order
- All policies moved to after both tables and functions exist

**Steps:**
1. Go to your Supabase dashboard
2. Navigate to: **SQL Editor** → **New Query**
3. Copy the entire content from `ETL_MIGRATION_SCRIPT.sql`
4. Paste it into the SQL Editor
5. Click **Run** button
6. Wait for completion message

### Option 2: Use the Alternative Complete Script

**File**: `ETL_MIGRATION_SCRIPT_FIXED.sql`

This is a completely rewritten, well-organized version with:
- Clear section markers
- Proper dependency ordering from the start
- Idempotent operations (`CREATE TABLE IF NOT EXISTS`)
- Comprehensive comments

**Steps:** Same as Option 1

### Option 3: Manual Ordered Execution (Advanced)

If you need to debug, run these groups in sequence:

```sql
-- Step 1: Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Base functions (no dependencies)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()...

-- Step 3: Tables (in dependency order)
-- 3a: Profiles
CREATE TABLE IF NOT EXISTS public.profiles...

-- 3b: Projects (depends on: profiles)
CREATE TABLE IF NOT EXISTS public.projects...

-- 3c: Project Members (depends on: projects)
CREATE TABLE IF NOT EXISTS public.project_members...

-- 3d: Agent Job Queue (depends on: projects)
CREATE TABLE IF NOT EXISTS public.agent_job_queue...

-- Step 4: THEN create dependent functions
CREATE OR REPLACE FUNCTION public.is_project_member()...
CREATE OR REPLACE FUNCTION public.generate_agent_run_id()...

-- Step 5: Create remaining tables and policies
...
```

## Proper Dependency Order Summary

```
Extensions (vector)
    ↓
Base Functions (update_updated_at_column)
    ↓
Base Tables (profiles)
    ↓
Projects Table
    ↓
project_members Table
    ├─→ is_project_member() function
    └─→ Policies using is_project_member()
    ↓
Other Tables (connections, saved_queries, etc.)
    ↓
agent_job_queue Table
    ├─→ generate_agent_run_id() function
    └─→ Policies using is_project_member()
    ↓
Agent Execution Tables (agent_execution_results, agent_activity_logs)
    ↓
Indexes
    ↓
Triggers
    ↓
Storage Policies
```

## Verification

After running the migration, verify success:

```sql
-- Check all critical tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Test is_project_member function
SELECT public.is_project_member('00000000-0000-0000-0000-000000000000'::uuid, 
                                 '00000000-0000-0000-0000-000000000000'::uuid);
```

Expected output for last query: `false` (because test IDs don't exist)

## Troubleshooting

### Still getting "relation does not exist" error?

1. **Check current PC's schema** - The existing PC might have a different migration path
2. **Use Supabase Dashboard** - Go to SQL Editor and check existing tables first:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```
3. **Drop and recreate** (if starting fresh):
   ```sql
   -- Only if you want to start completely fresh
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   
   -- Then run the full migration script
   ```

### Error: "function is_project_member already exists"?

This is normal if running the script multiple times. The script uses `CREATE OR REPLACE FUNCTION` which is safe to run repeatedly.

### Policies aren't working?

Ensure RLS is enabled on tables:
```sql
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_job_queue ENABLE ROW LEVEL SECURITY;
```

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Function defined at Line | 40-50 | After table creation |
| Table defined at Line | 117 | Before function use |
| Script succeeds on 1st run | ❌ Fails | ✅ Works |
| Idempotent* | ⚠️ Partial | ✅ Full |
| Clear sections | ⚠️ Some | ✅ Clear |

*Idempotent = safe to run multiple times without errors

## Files Modified

1. **ETL_MIGRATION_SCRIPT.sql** - Original file, fixed with proper ordering
2. **ETL_MIGRATION_SCRIPT_FIXED.sql** - New version, completely reorganized

Use **either one** - both are correct now. The choice is stylistic preference.

## Next Steps

1. ✅ Choose which migration script to use
2. ✅ Run the full script in Supabase SQL Editor
3. ✅ Verify all tables and functions created
4. ✅ Update application to use new instance
5. ✅ Test functionality with real data

---

**Questions?** Check the Supabase docs or refer to the inline comments in the migration scripts.
