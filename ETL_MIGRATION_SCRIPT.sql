-- ============================================================================
-- ETL WORKFLOW COMPLETE MIGRATION SCRIPT
-- ============================================================================
-- This script migrates all ETL workflow tables, functions, policies, and 
-- storage configurations to another Supabase instance.
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
-- 2. COMMON UTILITY FUNCTIONS (Non-dependent)
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: is_project_member() and generate_agent_run_id() functions 
-- are created AFTER their dependent tables (see below)

-- ============================================================================
-- 3. AUTH & PROFILE TABLES
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
-- 4. PROJECT MANAGEMENT TABLES
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

-- Project members table
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
-- 5. ETL CORE TABLES
-- ============================================================================

-- Connections table: stores database connection configurations
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  host text NOT NULL,
  port integer,
  instance text,
  database text,
  username text,
  password text,
  trusted boolean,
  ssl boolean,
  charset text,
  save_credentials boolean DEFAULT true,
  -- Extended columns for ETL workflow
  schema_name text,
  service_name text,
  http_path text,
  token text,
  catalog text,
  account text,
  warehouse text,
  role text,
  file_path text,
  readonly boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view connections" ON public.connections;
CREATE POLICY "Users can view connections" ON public.connections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create connections" ON public.connections;
CREATE POLICY "Users can create connections" ON public.connections FOR INSERT WITH CHECK (true);

-- Saved Queries table: stores user saved SQL queries
CREATE TABLE IF NOT EXISTS public.saved_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  query text NOT NULL,
  connection_id uuid REFERENCES public.connections(id),
  folder text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.saved_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view saved queries" ON public.saved_queries;
CREATE POLICY "Users can view saved queries" ON public.saved_queries FOR SELECT USING (true);

-- Reports table: stores comparison job results and metadata
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_id text NOT NULL,
  name text,
  note text,
  source_connection_id uuid,
  target_connection_id uuid,
  status text DEFAULT 'pending',
  progress integer DEFAULT 0,
  summary jsonb,
  column_stats jsonb,
  sample_mismatches jsonb,
  column_mismatches jsonb,
  storage_paths jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reports" ON public.reports;
CREATE POLICY "Users can view reports" ON public.reports FOR SELECT USING (true);

-- ============================================================================
-- 6. NO-CODE TEST TABLES
-- ============================================================================

-- NoCode Tests table
CREATE TABLE IF NOT EXISTS public.nocode_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nocode_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tests in their projects"
  ON public.nocode_tests FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Users can create tests in their projects"
  ON public.nocode_tests FOR INSERT
  WITH CHECK (is_project_member(project_id) AND auth.uid() = created_by);

CREATE POLICY "Users can update tests in their projects"
  ON public.nocode_tests FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Users can delete tests in their projects"
  ON public.nocode_tests FOR DELETE
  USING (is_project_member(project_id));

-- NoCode Test Executions table
CREATE TABLE IF NOT EXISTS public.nocode_test_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.nocode_tests(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  results JSONB,
  error_message TEXT,
  executed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nocode_test_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions in their projects"
  ON public.nocode_test_executions FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Users can create executions in their projects"
  ON public.nocode_test_executions FOR INSERT
  WITH CHECK (is_project_member(project_id) AND auth.uid() = executed_by);

CREATE POLICY "Users can update executions in their projects"
  ON public.nocode_test_executions FOR UPDATE
  USING (is_project_member(project_id));

-- ============================================================================
-- 7. AGENT MANAGEMENT TABLES
-- ============================================================================

-- Self-Hosted Agents table
CREATE TABLE IF NOT EXISTS public.self_hosted_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id TEXT UNIQUE NOT NULL,
  agent_name TEXT NOT NULL,
  api_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  capacity INTEGER NOT NULL DEFAULT 4,
  running_jobs INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  browsers TEXT[] DEFAULT ARRAY['chromium'],
  last_heartbeat TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.self_hosted_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view agents" ON public.self_hosted_agents;
CREATE POLICY "Project members can view agents"
  ON public.self_hosted_agents FOR SELECT
  USING (is_project_member(project_id) OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Project members can create agents" ON public.self_hosted_agents;
CREATE POLICY "Project members can create agents"
  ON public.self_hosted_agents FOR INSERT
  WITH CHECK (is_project_member(project_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Project members can update agents" ON public.self_hosted_agents;
CREATE POLICY "Project members can update agents"
  ON public.self_hosted_agents FOR UPDATE
  USING (is_project_member(project_id) OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Project members can delete agents" ON public.self_hosted_agents;
CREATE POLICY "Project members can delete agents"
  ON public.self_hosted_agents FOR DELETE
  USING (is_project_member(project_id) OR auth.uid() = created_by);

-- Agent Job Queue table
CREATE TABLE IF NOT EXISTS public.agent_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.nocode_tests(id) ON DELETE CASCADE,
  run_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_url TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view jobs"
  ON public.agent_job_queue FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create jobs"
  ON public.agent_job_queue FOR INSERT
  WITH CHECK (is_project_member(project_id) AND auth.uid() = created_by);

CREATE POLICY "Project members can update jobs"
  ON public.agent_job_queue FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Project members can delete jobs"
  ON public.agent_job_queue FOR DELETE
  USING (is_project_member(project_id));

-- ============================================================================
-- 7B. DEPENDENT FUNCTIONS (Created after their dependent tables exist)
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
-- 8. AGENT EXECUTION TABLES (continued)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_execution_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.agent_job_queue(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  total_steps INTEGER NOT NULL DEFAULT 0,
  passed_steps INTEGER NOT NULL DEFAULT 0,
  failed_steps INTEGER NOT NULL DEFAULT 0,
  artifact_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  video_url TEXT,
  trace_url TEXT,
  error_message TEXT,
  results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_execution_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view results"
  ON public.agent_execution_results FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create results"
  ON public.agent_execution_results FOR INSERT
  WITH CHECK (is_project_member(project_id));

-- Agent Activity Logs table
CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view activity logs"
  ON public.agent_activity_logs FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create activity logs"
  ON public.agent_activity_logs FOR INSERT
  WITH CHECK (is_project_member(project_id));

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Connections indexes
CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.connections(created_at DESC);

-- Reports indexes
CREATE INDEX IF NOT EXISTS idx_reports_compare_id ON public.reports(compare_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- NoCode Tests indexes
CREATE INDEX IF NOT EXISTS idx_nocode_tests_project_id ON public.nocode_tests(project_id);
CREATE INDEX IF NOT EXISTS idx_nocode_tests_status ON public.nocode_tests(status);
CREATE INDEX IF NOT EXISTS idx_nocode_test_executions_test_id ON public.nocode_test_executions(test_id);
CREATE INDEX IF NOT EXISTS idx_nocode_test_executions_project_id ON public.nocode_test_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_nocode_test_executions_status ON public.nocode_test_executions(status);

-- Agent indexes
CREATE INDEX IF NOT EXISTS idx_self_hosted_agents_project ON public.self_hosted_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_self_hosted_agents_status ON public.self_hosted_agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_project ON public.agent_job_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_status ON public.agent_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_agent ON public.agent_job_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_results_job ON public.agent_execution_results(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_agent ON public.agent_activity_logs(agent_id);

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================

-- Profiles trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Projects trigger
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Project members trigger
DROP TRIGGER IF EXISTS update_project_members_updated_at ON public.project_members;
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Saved queries trigger
DROP TRIGGER IF EXISTS update_saved_queries_updated_at ON public.saved_queries;
CREATE TRIGGER update_saved_queries_updated_at
  BEFORE UPDATE ON public.saved_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- NoCode tests trigger
DROP TRIGGER IF EXISTS update_nocode_tests_updated_at ON public.nocode_tests;
CREATE TRIGGER update_nocode_tests_updated_at
  BEFORE UPDATE ON public.nocode_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Self-hosted agents trigger
DROP TRIGGER IF EXISTS update_self_hosted_agents_updated_at ON public.self_hosted_agents;
CREATE TRIGGER update_self_hosted_agents_updated_at
  BEFORE UPDATE ON public.self_hosted_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Agent job queue trigger
DROP TRIGGER IF EXISTS update_agent_job_queue_updated_at ON public.agent_job_queue;
CREATE TRIGGER update_agent_job_queue_updated_at
  BEFORE UPDATE ON public.agent_job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 11. STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Create reports storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Reports bucket policies for service role
DROP POLICY IF EXISTS "Service role can insert report files" ON storage.objects;
CREATE POLICY "Service role can insert report files"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'reports');

DROP POLICY IF EXISTS "Service role can select report files" ON storage.objects;
CREATE POLICY "Service role can select report files"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "Service role can delete report files" ON storage.objects;
CREATE POLICY "Service role can delete report files"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'reports');

-- ============================================================================
-- 12. VERIFICATION
-- ============================================================================

-- Verify all critical tables are created
SELECT 
  'Tables Created Successfully' as status,
  COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'profiles', 'projects', 'project_members', 
  'connections', 'saved_queries', 'reports',
  'nocode_tests', 'nocode_test_executions',
  'self_hosted_agents', 'agent_job_queue',
  'agent_execution_results', 'agent_activity_logs'
);

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================
