-- WISPR ETL integration baseline schema
-- Idempotent script for Supabase/Postgres.
-- Aligns with:
--   - supabase/functions/etl-api/*
--   - public/etl-agent/*
--   - src/lib/api.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Membership helper used by RLS policies across WISPR.
CREATE OR REPLACE FUNCTION public.is_project_member(project_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = is_project_member.project_id
      AND pm.user_id = is_project_member.user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = is_project_member.project_id
      AND p.created_by = is_project_member.user_id
  );
$$;

-- ---------------------------------
-- ETL domain tables
-- ---------------------------------

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  host text,
  port integer,
  instance text,
  database text,
  username text,
  password text,
  trusted boolean DEFAULT false,
  ssl boolean DEFAULT false,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connections
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
  connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
  folder text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_id text NOT NULL,
  job_id uuid,
  name text,
  note text,
  source_connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
  target_connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
  source_query text,
  target_query text,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  summary jsonb,
  column_stats jsonb,
  sample_mismatches jsonb,
  column_mismatches jsonb,
  storage_paths jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS source_query text,
  ADD COLUMN IF NOT EXISTS target_query text,
  ADD COLUMN IF NOT EXISTS column_mismatches jsonb,
  ADD COLUMN IF NOT EXISTS storage_paths jsonb;

CREATE TABLE IF NOT EXISTS public.self_hosted_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id text UNIQUE NOT NULL,
  agent_name text NOT NULL,
  agent_type text DEFAULT 'etl',
  api_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  capacity integer NOT NULL DEFAULT 3,
  running_jobs integer NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  browsers text[] DEFAULT ARRAY['chromium'],
  last_heartbeat timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.self_hosted_agents
  ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'etl';

CREATE TABLE IF NOT EXISTS public.agent_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_id uuid,
  run_id text NOT NULL UNIQUE,
  job_type text NOT NULL DEFAULT 'etl_comparison',
  status text NOT NULL DEFAULT 'pending',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb,
  result jsonb,
  error_log text,
  base_url text NOT NULL DEFAULT 'N/A',
  priority integer NOT NULL DEFAULT 0,
  retries integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 2,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_job_queue
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS error_log text,
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'etl_comparison';

CREATE TABLE IF NOT EXISTS public.agent_execution_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.agent_job_queue(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL,
  duration_ms integer,
  total_steps integer NOT NULL DEFAULT 0,
  passed_steps integer NOT NULL DEFAULT 0,
  failed_steps integer NOT NULL DEFAULT 0,
  artifact_url text,
  screenshots jsonb DEFAULT '[]'::jsonb,
  video_url text,
  trace_url text,
  error_message text,
  results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.self_hosted_agents(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------
-- Indexes
-- ---------------------------------

CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.connections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_queries_connection ON public.saved_queries(connection_id);
CREATE INDEX IF NOT EXISTS idx_reports_compare_id ON public.reports(compare_id);
CREATE INDEX IF NOT EXISTS idx_reports_job_id ON public.reports(job_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_self_hosted_agents_project ON public.self_hosted_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_self_hosted_agents_status ON public.self_hosted_agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_project ON public.agent_job_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_status ON public.agent_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_agent_job_queue_agent ON public.agent_job_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_results_job ON public.agent_execution_results(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_agent ON public.agent_activity_logs(agent_id);

-- ---------------------------------
-- Triggers
-- ---------------------------------

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

-- ---------------------------------
-- Storage buckets used by ETL agent uploads
-- ---------------------------------

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

-- ---------------------------------
-- RLS for agent tables
-- ---------------------------------

ALTER TABLE public.self_hosted_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members and owners can view agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can view agents"
  ON public.self_hosted_agents FOR SELECT
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can create agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can create agents"
  ON public.self_hosted_agents FOR INSERT
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can update agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can update agents"
  ON public.self_hosted_agents FOR UPDATE
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can delete agents" ON public.self_hosted_agents;
CREATE POLICY "Project members and owners can delete agents"
  ON public.self_hosted_agents FOR DELETE
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can view jobs" ON public.agent_job_queue;
CREATE POLICY "Project members and owners can view jobs"
  ON public.agent_job_queue FOR SELECT
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can create jobs" ON public.agent_job_queue;
CREATE POLICY "Project members and owners can create jobs"
  ON public.agent_job_queue FOR INSERT
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can update jobs" ON public.agent_job_queue;
CREATE POLICY "Project members and owners can update jobs"
  ON public.agent_job_queue FOR UPDATE
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can delete jobs" ON public.agent_job_queue;
CREATE POLICY "Project members and owners can delete jobs"
  ON public.agent_job_queue FOR DELETE
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can view execution results" ON public.agent_execution_results;
CREATE POLICY "Project members and owners can view execution results"
  ON public.agent_execution_results FOR SELECT
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can create execution results" ON public.agent_execution_results;
CREATE POLICY "Project members and owners can create execution results"
  ON public.agent_execution_results FOR INSERT
  WITH CHECK (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can view activity logs" ON public.agent_activity_logs;
CREATE POLICY "Project members and owners can view activity logs"
  ON public.agent_activity_logs FOR SELECT
  USING (is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and owners can create activity logs" ON public.agent_activity_logs;
CREATE POLICY "Project members and owners can create activity logs"
  ON public.agent_activity_logs FOR INSERT
  WITH CHECK (is_project_member(project_id, auth.uid()));

-- ---------------------------------
-- Verification queries
-- ---------------------------------

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
