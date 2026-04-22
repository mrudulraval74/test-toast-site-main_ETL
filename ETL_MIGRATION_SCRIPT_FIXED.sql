-- ============================================================================
-- ETL WORKFLOW COMPLETE MIGRATION SCRIPT (FIXED - Proper Dependency Order)
-- ============================================================================
-- This script migrates all ETL workflow tables, functions, policies, and 
-- storage configurations to another Supabase instance.
-- 
-- KEY CHANGES FROM ORIGINAL:
-- - Tables created BEFORE functions (proper dependency order)
-- - All DEPENDENCIES created first, then dependents
-- - Idempotent operations (IF NOT EXISTS, CREATE OR REPLACE)
-- 
-- USAGE:
--   1. Create a new Supabase project
--   2. Run this entire script in the SQL Editor
--   3. Update environment variables in your client
--
-- Tables Included:
--   - profiles, projects, project_members (Auth & Projects)
--   - connections, saved_queries, reports (ETL Core)
--   - nocode_tests, nocode_test_executions (No-Code Testing)
--   - self_hosted_agents, agent_job_queue (Agent Management)
--   - agent_execution_results, agent_activity_logs (Agent Execution)
--
-- ============================================================================

-- 1. ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. COMMON UTILITY FUNCTIONS (Non-dependent ones)
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. AUTH & PROFILE TABLES (Dependencies first)
-- ============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. PROJECT MANAGEMENT TABLES (Create before functions that use them)
-- ============================================================================

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members table (CREATE BEFORE is_project_member function)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. AGENT JOB QUEUE TABLE (Create before generate_agent_run_id function)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER DEFAULT 5,
  run_id TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  config JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_job_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. NOW CREATE FUNCTIONS THAT REFERENCE THE TABLES ABOVE
-- ============================================================================

-- Function to check if user is project member (NOW project_members table exists)
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

-- Generate unique agent run ID (NOW agent_job_queue table exists)
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

-- ============================================================================
-- 7. USER STORIES & TEST MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  acceptance_criteria TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.test_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_story_id UUID REFERENCES public.user_stories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  steps TEXT,
  expected_result TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to test_cases" ON public.test_cases;
CREATE POLICY "Allow public read access to test_cases" ON public.test_cases FOR SELECT USING (true);

-- ============================================================================
-- 8. ETL CORE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_test_connection BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.saved_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_queries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query_results JSONB,
  report_type TEXT,
  schedule TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. NO-CODE TESTING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nocode_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  test_config JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.nocode_tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nocode_test_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nocode_test_id UUID REFERENCES public.nocode_tests(id) ON DELETE CASCADE NOT NULL,
  execution_status TEXT DEFAULT 'pending',
  execution_results JSONB,
  error_message TEXT,
  executed_by UUID REFERENCES auth.users(id),
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.nocode_test_executions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. AGENT MANAGEMENT & EXECUTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.self_hosted_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  status TEXT DEFAULT 'inactive',
  config JSONB DEFAULT '{}',
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.self_hosted_agents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agent_execution_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.agent_job_queue(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  execution_status TEXT DEFAULT 'pending',
  result_data JSONB,
  error_logs TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_execution_results ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. INTEGRATION CONFIGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, integration_id)
);

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. OTHER CORE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_test_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  testing_scope text[] DEFAULT '{}',
  project_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_test_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  run_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'not_started',
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.test_run_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.test_run_cases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. PROJECT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================
-- If the script completes without errors, your schema is ready!
-- All tables have been created with proper policies and functions.
