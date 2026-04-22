# ETL Workflow Database Schema Documentation

Complete technical reference for all tables, columns, relationships, and policies.

## Table of Contents

1. [Authentication & Profiles](#1-authentication--profiles)
2. [Project Management](#2-project-management)
3. [ETL Core](#3-etl-core)
4. [No-Code Automation](#4-no-code-automation)
5. [Agent Management](#5-agent-management)
6. [Functions & Procedures](#6-functions--procedures)
7. [Storage](#7-storage)
8. [Relationships Diagram](#8-relationships-diagram)

---

## 1. Authentication & Profiles

### profiles table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique profile ID |
| user_id | UUID | NOT NULL, UNIQUE, REFERENCES auth.users(id) | Link to Supabase user |
| display_name | TEXT | Optional | User's display name |
| email | TEXT | Optional | User's email |
| role | TEXT | DEFAULT 'user' | User role (user, admin, etc.) |
| created_at | TIMESTAMP WITH TZ | NOT NULL, DEFAULT now() | Profile creation time |
| updated_at | TIMESTAMP WITH TZ | NOT NULL, DEFAULT now() | Last update time |

**RLS Policies:**
- `Users can view own profile`: SELECT when auth.uid() = user_id
- `Users can update own profile`: UPDATE when auth.uid() = user_id

**Trigger:**
- `update_profiles_updated_at`: Auto-updates `updated_at` on modification

---

## 2. Project Management

### projects table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique project ID |
| name | TEXT | NOT NULL | Project name |
| description | TEXT | Optional | Project description |
| created_by | UUID | NOT NULL, REFERENCES auth.users(id) | Project creator |
| created_at | TIMESTAMP WITH TZ | NOT NULL, DEFAULT now() | Creation date |
| updated_at | TIMESTAMP WITH TZ | NOT NULL, DEFAULT now() | Last update |

**RLS Policies:**
- `Projects`: Controlled via project_members table

**Trigger:**
- `update_projects_updated_at`: Auto-updates timestamp

**Indexes:**
- projects_pkey: Primary key

---

### project_members table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Member record ID |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| user_id | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | User reference |
| role | TEXT | DEFAULT 'member' | Member role (member, admin) |
| created_at | TIMESTAMP WITH TZ | NOT NULL, DEFAULT now() | Join date |
| updated_at | TIMESTAMP WITH TZ | NOT NULL, DEFAULT now() | Last update |

**Constraints:**
- UNIQUE(project_id, user_id): One user per project

**RLS Policies:**
- Access controlled through is_project_member() function

**Trigger:**
- `update_project_members_updated_at`: Auto-updates timestamp

---

## 3. ETL Core

### connections table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Connection ID |
| name | TEXT | NOT NULL | Connection display name |
| type | TEXT | NOT NULL | DB type (mssql, postgresql, mysql, oracle, snowflake, databricks) |
| host | TEXT | NOT NULL | Database host/server address |
| port | INTEGER | Optional | Port number |
| instance | TEXT | Optional | Instance name (SQL Server) |
| database | TEXT | Optional | Database name |
| username | TEXT | Optional | Database username |
| password | TEXT | Optional | Database password (encrypted) |
| trusted | BOOLEAN | Optional | Use Windows authentication |
| ssl | BOOLEAN | Optional | SSL connection required |
| charset | TEXT | Optional | Character set (MySQL) |
| save_credentials | BOOLEAN | DEFAULT true | Save credentials |
| schema_name | TEXT | Optional | Default schema |
| service_name | TEXT | Optional | Oracle service name |
| http_path | TEXT | Optional | Databricks HTTP path |
| token | TEXT | Optional | API token for cloud DBs |
| catalog | TEXT | Optional | Snowflake/Databricks catalog |
| account | TEXT | Optional | Snowflake account |
| warehouse | TEXT | Optional | Snowflake warehouse |
| role | TEXT | Optional | Database role |
| file_path | TEXT | Optional | File path for flat files |
| readonly | BOOLEAN | DEFAULT false | Read-only connection |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation time |

**RLS Policies:**
- Public viewing and creation allowed (RLS permissive)

**Indexes:**
- idx_connections_created_at: For sorting by creation date

---

### saved_queries table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Query ID |
| name | TEXT | NOT NULL | Query name |
| query | TEXT | NOT NULL | SQL query text |
| connection_id | UUID | REFERENCES connections(id) | Source connection |
| folder | TEXT | Optional | Folder/category |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Last update |

**RLS Policies:**
- Public viewing and creation allowed

**Trigger:**
- `update_saved_queries_updated_at`: Auto-updates timestamp

---

### reports table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Report ID |
| compare_id | TEXT | NOT NULL | Comparison job identifier |
| name | TEXT | Optional | Report name |
| note | TEXT | Optional | Report notes |
| source_connection_id | UUID | Optional | Source DB connection |
| target_connection_id | UUID | Optional | Target DB connection |
| status | TEXT | DEFAULT 'pending' | Status (pending, running, completed, failed) |
| progress | INTEGER | DEFAULT 0 | Completion percentage (0-100) |
| summary | JSONB | Optional | Summary statistics |
| column_stats | JSONB | Optional | Column-level statistics |
| sample_mismatches | JSONB | Optional | Sample mismatch data |
| column_mismatches | JSONB | Optional | Detailed column mismatches |
| storage_paths | JSONB | Optional | Paths to stored files |
| error_message | TEXT | Optional | Error details if failed |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation time |
| completed_at | TIMESTAMPTZ | Optional | Completion time |

**RLS Policies:**
- Public viewing allowed

**Indexes:**
- idx_reports_compare_id: For filtering by job
- idx_reports_created_at: For sorting chronologically

**JSONB Fields Structure:**
```json
summary: {
  "totalTests": 100,
  "passedTests": 95,
  "failedTests": 5,
  "testCases": [...]
}

column_stats: {
  "table_name": {
    "total_rows": 1000,
    "matched_rows": 950,
    "mismatched_rows": 50
  }
}
```

---

## 4. No-Code Automation

### nocode_tests table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Test ID |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| name | TEXT | NOT NULL | Test name |
| description | TEXT | Optional | Test description |
| base_url | TEXT | NOT NULL | Application URL to test |
| steps | JSONB | NOT NULL, DEFAULT '[]'::jsonb | Test steps array |
| status | TEXT | DEFAULT 'draft' | Status (draft, active, archived) |
| created_by | UUID | NOT NULL | Test creator |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Status Values:**
- draft: Test is being created
- active: Test is ready to run
- archived: Test is no longer used

**RLS Policies:**
- `Users can view tests in their projects`: is_project_member(project_id)
- `Users can create tests in their projects`: is_project_member(project_id) AND auth.uid() = created_by
- `Users can update tests in their projects`: is_project_member(project_id)
- `Users can delete tests in their projects`: is_project_member(project_id)

**Indexes:**
- idx_nocode_tests_project_id: For filtering by project
- idx_nocode_tests_status: For filtering by status

**Trigger:**
- `update_nocode_tests_updated_at`: Auto-updates timestamp

**Steps JSON Structure:**
```json
steps: [
  {
    "id": "step-1",
    "type": "navigate" | "click" | "type" | "wait" | "assert",
    "locator": "css selector or xpath",
    "value": "optional value",
    "timeout": 5000
  }
]
```

---

### nocode_test_executions table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Execution record ID |
| test_id | UUID | NOT NULL, REFERENCES nocode_tests(id) ON DELETE CASCADE | Test reference |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| status | TEXT | NOT NULL | Execution status (running, passed, failed, cancelled) |
| started_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Execution start time |
| completed_at | TIMESTAMPTZ | Optional | Execution end time |
| duration_ms | INTEGER | Optional | Total execution time in milliseconds |
| results | JSONB | Optional | Detailed step-by-step results |
| error_message | TEXT | Optional | Error details if failed |
| executed_by | UUID | NOT NULL | User who executed the test |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation time |

**RLS Policies:**
- `Users can view executions in their projects`: is_project_member(project_id)
- `Users can create executions in their projects`: is_project_member(project_id) AND auth.uid() = executed_by
- `Users can update executions in their projects`: is_project_member(project_id)

**Indexes:**
- idx_nocode_test_executions_test_id: For filtering by test
- idx_nocode_test_executions_project_id: For filtering by project
- idx_nocode_test_executions_status: For filtering by status

---

## 5. Agent Management

### self_hosted_agents table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Agent ID |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| agent_id | TEXT | UNIQUE, NOT NULL | Unique agent identifier (e.g., "WISPR-RUNNER-IND-01") |
| agent_name | TEXT | NOT NULL | Human-readable agent name |
| api_token_hash | TEXT | NOT NULL | Hashed API token |
| status | TEXT | NOT NULL, DEFAULT 'offline' | Status (online, offline, busy) |
| capacity | INTEGER | NOT NULL, DEFAULT 4 | Max concurrent jobs |
| running_jobs | INTEGER | NOT NULL, DEFAULT 0 | Current running jobs |
| config | JSONB | DEFAULT '{}'::jsonb | Agent configuration |
| browsers | TEXT[] | DEFAULT ARRAY['chromium'] | Supported browsers |
| last_heartbeat | TIMESTAMPTZ | Optional | Last heartbeat time |
| created_by | UUID | NOT NULL | Creator user ID |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**RLS Policies:**
- `Project members can view agents`: is_project_member(project_id) OR auth.uid() = created_by
- `Project members can create agents`: is_project_member(project_id) AND auth.uid() = created_by
- `Project members can update agents`: is_project_member(project_id) OR auth.uid() = created_by
- `Project members can delete agents`: is_project_member(project_id) OR auth.uid() = created_by

**Indexes:**
- idx_self_hosted_agents_project: Filter by project
- idx_self_hosted_agents_status: Filter by status

**Trigger:**
- `update_self_hosted_agents_updated_at`: Auto-updates timestamp

---

### agent_job_queue table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Job ID |
| agent_id | UUID | REFERENCES self_hosted_agents(id) ON DELETE SET NULL | Assigned agent |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| test_id | UUID | NOT NULL, REFERENCES nocode_tests(id) ON DELETE CASCADE | Test reference |
| run_id | TEXT | UNIQUE, NOT NULL | Unique run identifier (e.g., "RUN-00001") |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Job status (pending, assigned, running, completed, failed, cancelled) |
| steps | JSONB | NOT NULL, DEFAULT '[]'::jsonb | Test steps to execute |
| base_url | TEXT | NOT NULL | Application URL |
| priority | INTEGER | NOT NULL, DEFAULT 0 | Job priority (higher = sooner) |
| retries | INTEGER | NOT NULL, DEFAULT 0 | Retry count |
| max_retries | INTEGER | NOT NULL, DEFAULT 2 | Maximum retries |
| assigned_at | TIMESTAMPTZ | Optional | When assigned to agent |
| started_at | TIMESTAMPTZ | Optional | When execution started |
| completed_at | TIMESTAMPTZ | Optional | When execution completed |
| created_by | UUID | NOT NULL | Job creator |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Job creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**RLS Policies:**
- `Project members can view/create/update/delete jobs`: is_project_member(project_id)

**Indexes:**
- idx_agent_job_queue_project: Filter by project
- idx_agent_job_queue_status: Filter by status
- idx_agent_job_queue_agent: Filter by agent

**Trigger:**
- `update_agent_job_queue_updated_at`: Auto-updates timestamp

---

### agent_execution_results table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Result ID |
| job_id | UUID | NOT NULL, REFERENCES agent_job_queue(id) ON DELETE CASCADE | Job reference |
| agent_id | UUID | REFERENCES self_hosted_agents(id) ON DELETE SET NULL | Executing agent |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| status | TEXT | NOT NULL | Result status (passed, failed, error) |
| duration_ms | INTEGER | Optional | Execution time in milliseconds |
| total_steps | INTEGER | NOT NULL, DEFAULT 0 | Total test steps |
| passed_steps | INTEGER | NOT NULL, DEFAULT 0 | Steps that passed |
| failed_steps | INTEGER | NOT NULL, DEFAULT 0 | Steps that failed |
| artifact_url | TEXT | Optional | URL to result artifacts |
| screenshots | JSONB | DEFAULT '[]'::jsonb | Screenshot URLs and metadata |
| video_url | TEXT | Optional | URL to execution video |
| trace_url | TEXT | Optional | URL to browser trace |
| error_message | TEXT | Optional | Error details if failed |
| results | JSONB | DEFAULT '[]'::jsonb | Step-by-step results |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |

**RLS Policies:**
- `Project members can view/create results`: is_project_member(project_id)

**Indexes:**
- idx_agent_execution_results_job: Filter by job

---

### agent_activity_logs table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Log entry ID |
| agent_id | UUID | REFERENCES self_hosted_agents(id) ON DELETE CASCADE | Agent reference |
| project_id | UUID | NOT NULL, REFERENCES projects(id) ON DELETE CASCADE | Project reference |
| event_type | TEXT | NOT NULL | Event type (heartbeat, job_started, job_completed, error, connected, disconnected) |
| event_data | JSONB | DEFAULT '{}'::jsonb | Event details |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Log time |

**RLS Policies:**
- `Project members can view/create activity logs`: is_project_member(project_id)

**Indexes:**
- idx_agent_activity_logs_agent: Filter by agent

---

## 6. Functions & Procedures

### update_updated_at_column()

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Purpose:** Automatically update `updated_at` timestamp on table modifications

**Used by triggers:** All tables with `updated_at` column

---

### is_project_member(_project_id UUID, _user_id UUID)

```sql
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;
```

**Purpose:** Check if user is a member of a project

**Used by:** RLS policies on all project-scoped tables

**Returns:**
- TRUE if user is project member
- FALSE otherwise

---

### generate_agent_run_id()

```sql
CREATE OR REPLACE FUNCTION public.generate_agent_run_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  run_id TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN run_id ~ '^RUN-[0-9]+$'
      THEN CAST(SUBSTRING(run_id FROM 5) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1 INTO next_num
  FROM agent_job_queue;
  
  run_id := 'RUN-' || LPAD(next_num::text, 5, '0');
  RETURN run_id;
END;
$$;
```

**Purpose:** Generate unique sequential run IDs (RUN-00001, RUN-00002, etc.)

**Used by:** agent_job_queue.run_id default value

**Returns:** Next sequential run ID string

---

## 7. Storage

### reports bucket

```
Location: storage.buckets
Name: reports
Public: false (private)
Purpose: Store ETL comparison results and reports
```

**Policies:**
- Service role can INSERT: Add new files
- Service role can SELECT: Read files
- Service role can DELETE: Remove files

**Usage:**
- Stores comparison result CSVs
- Stores mismatch reports
- Stores validation SQL scripts

---

## 8. Relationships Diagram

```
┌───────────────────────────────────────────────────────────┐
│                       AUTH LAYER                          │
│                     auth.users (Supabase)                 │
└────────┬────────────────────────────────────────┬─────────┘
         │ 1:1                                    │ 1:N
    ┌────▼──────────┐                    ┌───────▼────────┐
    │   profiles    │                    │   projects     │
    │ (user info)   │                    │ (workspaces)   │
    └──────▲────────┘                    └───────┬────────┘
           │                                     │ N:1
           │                         ┌───────────▼──────────┐
           │                         │ project_members      │
           │                         │ (team permissions)   │
           │                         └──────────┬───────────┘
           │                                    │ N:1
           └────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│                     ETL CORE LAYER                        │
│                                                           │
│ ┌──────────────────┐    ┌─────────────────┐              │
│ │  connections     │    │  saved_queries  │              │
│ │ (DB configs)     │◄───┤ (SQL scripts)   │              │
│ └────────┬─────────┘    └─────────────────┘              │
│          │ 1:N                                           │
│    ┌─────▼─────────┐                                     │
│    │   reports     │                                     │
│    │ (results)     │                                     │
│    └───────────────┘                                     │
└───────────────────────────────────────────────────────────┘
         ↑ References both source & target connections

┌───────────────────────────────────────────────────────────┐
│              NO-CODE AUTOMATION LAYER                     │
│                                                           │
│ ┌──────────────────┐      ┌─────────────────────────┐   │
│ │ nocode_tests     │1:N───┤ nocode_test_executions  │   │
│ │ (test config)    │      │ (execution history)     │   │
│ └──────────────────┘      └─────────────────────────┘   │
│          │ N:1                                           │
│    ┌─────▼──────────┐                                    │
│    │ project_members│                                    │
│    │ (permission)   │                                    │
│    └────────────────┘                                    │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│                  AGENT LAYER                              │
│                                                           │
│ ┌────────────────────┐                                   │
│ │ self_hosted_agents │ 1:N                              │
│ │ (agent registry)   │  ├──► agent_job_queue             │
│ │                    │  │     (job assignments)          │
│ └─────┬──────────────┘  │                                │
│       │ N:1             │    ┌──────────────────┐        │
│       │                 └────┤ agent_execution  │        │
│       │                      │ results          │        │
│       │ N:1                  └──────────────────┘        │
│  ┌────▼──────────────────┐         │ N:1                │
│  │ project_members       │◄────────┘                    │
│  │ (permission)          │                              │
│  ├───────────────────────┤     ┌──────────────────┐    │
│  │ agent_activity_logs   │──────┤ nocode_tests    │    │
│  │ (audit trail)         │ N:1  │ (test ref)      │    │
│  └───────────────────────┘      └──────────────────┘    │
└───────────────────────────────────────────────────────────┘

```

---

## Row Level Security (RLS) Summary

| Table | RLS Enabled | Primary Policy |
|-------|-------------|-----------------|
| profiles | ✅ | Users access own profile |
| projects | ✅ | Via project_members |
| project_members | ✅ | is_project_member() check |
| connections | ✅ | Public (permissive) |
| saved_queries | ✅ | Public (permissive) |
| reports | ✅ | Public (permissive) |
| nocode_tests | ✅ | is_project_member() + auth.uid() |
| nocode_test_executions | ✅ | is_project_member() + auth.uid() |
| self_hosted_agents | ✅ | is_project_member() or created_by |
| agent_job_queue | ✅ | is_project_member() |
| agent_execution_results | ✅ | is_project_member() |
| agent_activity_logs | ✅ | is_project_member() |

---

## Storage Schema

### reports bucket

```
reports/
├── {project_id}/
│   ├── {report_id}/
│   │   ├── summary.json
│   │   ├── column_stats.csv
│   │   ├── mismatches.csv
│   │   └── validation_sql.sql
```

---

## Performance Indexes

```
Connections:
├─ idx_connections_created_at (DESC)

Reports:
├─ idx_reports_compare_id
├─ idx_reports_created_at (DESC)

NoCode Tests:
├─ idx_nocode_tests_project_id
├─ idx_nocode_tests_status
├─ idx_nocode_test_executions_test_id
├─ idx_nocode_test_executions_project_id
├─ idx_nocode_test_executions_status

Agents:
├─ idx_self_hosted_agents_project
├─ idx_self_hosted_agents_status
├─ idx_agent_job_queue_project
├─ idx_agent_job_queue_status
├─ idx_agent_job_queue_agent
├─ idx_agent_execution_results_job
├─ idx_agent_activity_logs_agent
```

---

## Triggers

All tables with `updated_at` have automatic timestamp update triggers:
- profiles
- projects
- project_members
- saved_queries
- nocode_tests
- self_hosted_agents
- agent_job_queue

---

**Version**: 1.0  
**Last Updated**: April 2, 2026  
**Status**: Complete ✅
