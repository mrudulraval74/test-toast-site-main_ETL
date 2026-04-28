-- ============================================================================
-- ETL Workflow + Self-Hosted ETL Agent Merge Script
-- ============================================================================
-- Purpose:
-- 1. Create/repair application tables needed by the current frontend
-- 2. Create/repair ETL workflow tables
-- 3. Create/repair self-hosted agent tables
-- 4. Add ETL connection columns
-- 5. Add/repair self_hosted_agents.agent_type
-- 6. Add menu items used by the UI
--
-- Safe to run more than once.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- COMMON FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
  );
$$;

-- ============================================================================
-- CORE APP TABLES USED BY CURRENT UI
-- ============================================================================

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
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

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
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_story_id UUID REFERENCES public.user_stories(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  steps TEXT,
  expected_result TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  test_data TEXT,
  readable_id TEXT,
  structured_steps JSONB,
  automated BOOLEAN NOT NULL DEFAULT false,
  folder_id UUID
);
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to app_settings" ON public.app_settings;
CREATE POLICY "Allow public read access to app_settings"
ON public.app_settings FOR SELECT
USING (true);

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('admin_menu_visibility', '{"knowledgeBase": true, "qaInsights": true, "aiAnalytics": true, "roleManagement": true, "architecture": true}'::jsonb, 'Visibility settings for admin menu items'),
  ('testing_only_mode', '{"enabled": false}'::jsonb, 'Toggle testing-only mode for the UI')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.menu_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id text NOT NULL UNIQUE,
  label text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.menu_config (menu_id, label, is_visible, display_order)
VALUES
  ('dashboard', 'Testing Dashboard', true, 1),
  ('projects', 'Projects', true, 2),
  ('user-stories', 'User Stories', true, 3),
  ('test-plan', 'Test Plans', true, 4),
  ('test-cases', 'Test Case', true, 5),
  ('repository', 'Automation Testing', true, 6),
  ('api', 'API Testing', true, 7),
  ('etl-workflow', 'ETL Workflow', true, 8),
  ('performance-testing', 'Performance Testing', true, 9),
  ('nocode-automation', 'Automation (No-code)', true, 10),
  ('agents', 'Self-Hosted Agents', true, 11),
  ('defects', 'Defects', true, 12),
  ('test-report', 'Test Report', true, 13),
  ('integrations', 'Integrations', true, 14),
  ('knowledge-base', 'Knowledge Base', true, 15),
  ('role-manager', 'Role Management', true, 16)
ON CONFLICT (menu_id) DO UPDATE
SET
  label = EXCLUDED.label,
  is_visible = true,
  display_order = EXCLUDED.display_order;

-- ============================================================================
-- TEST CASE REPAIR USED BY CURRENT APP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.test_case_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_story_id uuid REFERENCES public.user_stories(id) ON DELETE SET NULL,
  is_custom boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_story_id uuid REFERENCES public.user_stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS steps text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS test_data text,
  ADD COLUMN IF NOT EXISTS readable_id text,
  ADD COLUMN IF NOT EXISTS structured_steps jsonb,
  ADD COLUMN IF NOT EXISTS automated boolean NOT NULL DEFAULT false;

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.test_case_folders(id) ON DELETE SET NULL;

UPDATE public.test_cases
SET
  title = COALESCE(NULLIF(title, ''), 'Untitled test case'),
  updated_at = COALESCE(updated_at, created_at, now()),
  priority = COALESCE(priority, 'medium'),
  automated = COALESCE(automated, false);

CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON public.test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_user_story_id ON public.test_cases(user_story_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_folder_id ON public.test_cases(folder_id);
CREATE INDEX IF NOT EXISTS idx_test_case_folders_project_id ON public.test_case_folders(project_id);

ALTER TABLE public.test_case_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view test cases" ON public.test_cases;
CREATE POLICY "Project members can view test cases"
ON public.test_cases FOR SELECT
USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Project members can create test cases" ON public.test_cases;
CREATE POLICY "Project members can create test cases"
ON public.test_cases FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Project members can update test cases" ON public.test_cases;
CREATE POLICY "Project members can update test cases"
ON public.test_cases FOR UPDATE
USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
)
WITH CHECK (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Project members can delete test cases" ON public.test_cases;
CREATE POLICY "Project members can delete test cases"
ON public.test_cases FOR DELETE
USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view folders in their projects" ON public.test_case_folders;
CREATE POLICY "Users can view folders in their projects"
ON public.test_case_folders FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create folders in their projects" ON public.test_case_folders;
CREATE POLICY "Users can create folders in their projects"
ON public.test_case_folders FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update folders in their projects" ON public.test_case_folders;
CREATE POLICY "Users can update folders in their projects"
ON public.test_case_folders FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete folders in their projects" ON public.test_case_folders;
CREATE POLICY "Users can delete folders in their projects"
ON public.test_case_folders FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

-- ============================================================================
-- ETL TABLES
-- ============================================================================

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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.connections
  ADD COLUMN IF NOT EXISTS schema_name text,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS http_path text,
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS catalog text,
  ADD COLUMN IF NOT EXISTS account text,
  ADD COLUMN IF NOT EXISTS warehouse text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS readonly boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.saved_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  query text NOT NULL,
  connection_id uuid REFERENCES public.connections(id),
  folder text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_id text NOT NULL,
  job_id uuid,
  name text,
  note text,
  source_connection_id uuid,
  target_connection_id uuid,
  source_query text,
  target_query text,
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

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS source_query text,
  ADD COLUMN IF NOT EXISTS target_query text,
  ADD COLUMN IF NOT EXISTS column_mismatches jsonb,
  ADD COLUMN IF NOT EXISTS storage_paths jsonb;

CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.connections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_queries_connection ON public.saved_queries(connection_id);
CREATE INDEX IF NOT EXISTS idx_reports_compare_id ON public.reports(compare_id);
CREATE INDEX IF NOT EXISTS idx_reports_job_id ON public.reports(job_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- ============================================================================
-- SELF-HOSTED AGENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.self_hosted_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id TEXT UNIQUE NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type text DEFAULT 'selenium',
  api_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  capacity INTEGER NOT NULL DEFAULT 4,
  running_jobs INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  browsers TEXT[] DEFAULT ARRAY['chromium'],
  last_heartbeat TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.self_hosted_agents
  ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'selenium';

CREATE TABLE IF NOT EXISTS public.agent_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_id UUID,
  run_id TEXT UNIQUE NOT NULL,
  job_type text NOT NULL DEFAULT 'etl_comparison',
  status TEXT NOT NULL DEFAULT 'pending',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb,
  result jsonb,
  error_log text,
  base_url TEXT NOT NULL DEFAULT 'N/A',
  priority INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_job_queue
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS error_log text,
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'etl_comparison';

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

CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.self_hosted_agents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_self_hosted_agents_project ON public.self_hosted_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_self_hosted_agents_status ON public.self_hosted_agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_project ON public.agent_job_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_status ON public.agent_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_agent ON public.agent_job_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_results_job ON public.agent_execution_results(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_agent ON public.agent_activity_logs(agent_id);

ALTER TABLE public.self_hosted_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members and owners can view agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can view agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can view agents"
  ON public.self_hosted_agents FOR SELECT
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members and owners can create agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can create agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can create agents"
  ON public.self_hosted_agents FOR INSERT
  WITH CHECK (
    (
      is_project_member(project_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
    )
    AND (created_by IS NULL OR auth.uid() = created_by)
  );

DROP POLICY IF EXISTS "Project members and owners can update agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can update agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can update agents"
  ON public.self_hosted_agents FOR UPDATE
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members and owners can delete agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can delete agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can delete agents"
  ON public.self_hosted_agents FOR DELETE
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can view jobs" ON public.agent_job_queue;
CREATE POLICY "Project members can view jobs"
  ON public.agent_job_queue FOR SELECT
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members can create jobs" ON public.agent_job_queue;
CREATE POLICY "Project members can create jobs"
  ON public.agent_job_queue FOR INSERT
  WITH CHECK (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_job_queue.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can update jobs" ON public.agent_job_queue;
CREATE POLICY "Project members can update jobs"
  ON public.agent_job_queue FOR UPDATE
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_job_queue.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can delete jobs" ON public.agent_job_queue;
CREATE POLICY "Project members can delete jobs"
  ON public.agent_job_queue FOR DELETE
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_job_queue.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can view results" ON public.agent_execution_results;
CREATE POLICY "Project members can view results"
  ON public.agent_execution_results FOR SELECT
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_execution_results.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can create results" ON public.agent_execution_results;
CREATE POLICY "Project members can create results"
  ON public.agent_execution_results FOR INSERT
  WITH CHECK (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_execution_results.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can view activity logs" ON public.agent_activity_logs;
CREATE POLICY "Project members can view activity logs"
  ON public.agent_activity_logs FOR SELECT
  USING (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_activity_logs.project_id AND projects.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Project members can create activity logs" ON public.agent_activity_logs;
CREATE POLICY "Project members can create activity logs"
  ON public.agent_activity_logs FOR INSERT
  WITH CHECK (
    is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_activity_logs.project_id AND projects.created_by = auth.uid())
  );

-- ============================================================================
-- AGENT TYPE DATA REPAIR
-- ============================================================================

UPDATE public.self_hosted_agents
SET agent_type = COALESCE(
  NULLIF(agent_type, ''),
  NULLIF(config->'metadata'->>'agent_type', ''),
  CASE
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%etl%' THEN 'etl'
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%elt%' THEN 'etl'
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%performance%' THEN 'performance'
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%playwright%' THEN 'playwright'
    ELSE 'selenium'
  END
)
WHERE agent_type IS NULL OR agent_type = '';

UPDATE public.self_hosted_agents
SET agent_type = 'etl'
WHERE agent_type = 'selenium'
  AND (
    lower(COALESCE(config->'metadata'->>'agent_type', '')) IN ('etl', 'elt')
    OR lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%etl%'
    OR lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%elt%'
  );

ALTER TABLE public.self_hosted_agents
  ALTER COLUMN agent_type SET DEFAULT 'selenium';

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('artifacts', 'artifacts', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role can insert ETL artifacts" ON storage.objects;
CREATE POLICY "Service role can insert ETL artifacts"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'artifacts');

DROP POLICY IF EXISTS "Service role can read ETL artifacts" ON storage.objects;
CREATE POLICY "Service role can read ETL artifacts"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'artifacts');

DROP POLICY IF EXISTS "Service role can delete ETL artifacts" ON storage.objects;
CREATE POLICY "Service role can delete ETL artifacts"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'artifacts');

DROP POLICY IF EXISTS "Service role can insert ETL reports" ON storage.objects;
CREATE POLICY "Service role can insert ETL reports"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'reports');

DROP POLICY IF EXISTS "Service role can read ETL reports" ON storage.objects;
CREATE POLICY "Service role can read ETL reports"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "Service role can delete ETL reports" ON storage.objects;
CREATE POLICY "Service role can delete ETL reports"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'reports');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_members_updated_at ON public.project_members;
CREATE TRIGGER update_project_members_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stories_updated_at ON public.user_stories;
CREATE TRIGGER update_user_stories_updated_at
BEFORE UPDATE ON public.user_stories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_cases_updated_at ON public.test_cases;
CREATE TRIGGER update_test_cases_updated_at
BEFORE UPDATE ON public.test_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_case_folders_updated_at ON public.test_case_folders;
CREATE TRIGGER update_test_case_folders_updated_at
BEFORE UPDATE ON public.test_case_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_config_updated_at ON public.menu_config;
CREATE TRIGGER update_menu_config_updated_at
BEFORE UPDATE ON public.menu_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_connections_updated_at ON public.connections;
CREATE TRIGGER update_connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_queries_updated_at ON public.saved_queries;
CREATE TRIGGER update_saved_queries_updated_at
BEFORE UPDATE ON public.saved_queries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_self_hosted_agents_updated_at ON public.self_hosted_agents;
CREATE TRIGGER update_self_hosted_agents_updated_at
BEFORE UPDATE ON public.self_hosted_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_job_queue_updated_at ON public.agent_job_queue;
CREATE TRIGGER update_agent_job_queue_updated_at
BEFORE UPDATE ON public.agent_job_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

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
