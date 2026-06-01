
-- Desktop Agents (Windows machines running the .NET Desktop Execution Agent)
CREATE TABLE public.desktop_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  api_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'offline',
  agent_type TEXT NOT NULL DEFAULT 'desktop',
  platform TEXT DEFAULT 'windows',
  engine_mode TEXT NOT NULL DEFAULT 'uia', -- 'uia' or 'vision'
  capabilities JSONB DEFAULT '{"engines": ["uia", "vision"], "max_capacity": 1}'::jsonb,
  system_info JSONB,
  last_heartbeat TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view desktop agents in their projects"
  ON public.desktop_agents FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can create desktop agents"
  ON public.desktop_agents FOR INSERT
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Users can update desktop agents in their projects"
  ON public.desktop_agents FOR UPDATE
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can delete desktop agents in their projects"
  ON public.desktop_agents FOR DELETE
  USING (public.is_project_member(project_id));

-- Desktop Tests (thick client test definitions with JSON steps)
CREATE TABLE public.desktop_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  application_name TEXT NOT NULL DEFAULT '',
  application_path TEXT, -- e.g. C:\Program Files\
  application_args TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  engine_mode TEXT NOT NULL DEFAULT 'uia', -- 'uia' or 'vision'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view desktop tests in their projects"
  ON public.desktop_tests FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can create desktop tests"
  ON public.desktop_tests FOR INSERT
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Users can update desktop tests"
  ON public.desktop_tests FOR UPDATE
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can delete desktop tests"
  ON public.desktop_tests FOR DELETE
  USING (public.is_project_member(project_id));

-- Selector Repository (versioned composite selectors)
CREATE TABLE public.desktop_selector_repository (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  element_name TEXT NOT NULL,
  application_name TEXT NOT NULL DEFAULT '',
  selector JSONB NOT NULL, -- { automationId, label, controlType, classHint, parentWindow, xpath }
  fallback_selectors JSONB DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  validation_status TEXT DEFAULT 'unknown', -- 'valid', 'invalid', 'unknown'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_selector_repository ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view selectors in their projects"
  ON public.desktop_selector_repository FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can create selectors"
  ON public.desktop_selector_repository FOR INSERT
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Users can update selectors"
  ON public.desktop_selector_repository FOR UPDATE
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can delete selectors"
  ON public.desktop_selector_repository FOR DELETE
  USING (public.is_project_member(project_id));

CREATE INDEX idx_desktop_selectors_project ON public.desktop_selector_repository(project_id);
CREATE INDEX idx_desktop_selectors_element ON public.desktop_selector_repository(element_name, application_name);

-- Desktop Job Queue
CREATE TABLE public.desktop_job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.desktop_tests(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.desktop_agents(id) ON DELETE SET NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, assigned, running, passed, failed, cancelled
  priority INTEGER NOT NULL DEFAULT 5,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  application_path TEXT,
  application_args TEXT,
  engine_mode TEXT NOT NULL DEFAULT 'uia',
  created_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view desktop jobs in their projects"
  ON public.desktop_job_queue FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can create desktop jobs"
  ON public.desktop_job_queue FOR INSERT
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Users can update desktop jobs"
  ON public.desktop_job_queue FOR UPDATE
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can delete desktop jobs"
  ON public.desktop_job_queue FOR DELETE
  USING (public.is_project_member(project_id));

-- Desktop Execution Results
CREATE TABLE public.desktop_execution_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.desktop_job_queue(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.desktop_agents(id) ON DELETE SET NULL,
  test_id UUID REFERENCES public.desktop_tests(id) ON DELETE SET NULL,
  status TEXT NOT NULL, -- passed, failed, error
  duration_ms INTEGER,
  total_steps INTEGER NOT NULL DEFAULT 0,
  passed_steps INTEGER NOT NULL DEFAULT 0,
  failed_steps INTEGER NOT NULL DEFAULT 0,
  step_results JSONB DEFAULT '[]'::jsonb,
  screenshots JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  engine_mode TEXT, -- uia or vision
  failure_category TEXT, -- element_not_found, timeout, assertion_failed, app_crash, etc.
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_execution_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view desktop results in their projects"
  ON public.desktop_execution_results FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can create desktop results"
  ON public.desktop_execution_results FOR INSERT
  WITH CHECK (public.is_project_member(project_id));

-- Self-Healing Logs
CREATE TABLE public.desktop_self_healing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.desktop_tests(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.desktop_job_queue(id) ON DELETE SET NULL,
  original_selector JSONB NOT NULL,
  suggested_selector JSONB,
  ui_tree_snapshot TEXT, -- compressed UI tree dump
  confidence_score NUMERIC(4,2), -- 0.00 to 1.00
  status TEXT NOT NULL DEFAULT 'pending', -- pending, auto_applied, approved, rejected
  applied_at TIMESTAMPTZ,
  reviewed_by UUID,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_self_healing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view self-healing logs in their projects"
  ON public.desktop_self_healing_logs FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Users can create self-healing logs"
  ON public.desktop_self_healing_logs FOR INSERT
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Users can update self-healing logs"
  ON public.desktop_self_healing_logs FOR UPDATE
  USING (public.is_project_member(project_id));

-- Triggers
CREATE TRIGGER update_desktop_agents_updated_at BEFORE UPDATE ON public.desktop_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_desktop_tests_updated_at BEFORE UPDATE ON public.desktop_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_desktop_selectors_updated_at BEFORE UPDATE ON public.desktop_selector_repository
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_desktop_jobs_updated_at BEFORE UPDATE ON public.desktop_job_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Run ID generator for desktop jobs
CREATE OR REPLACE FUNCTION public.generate_desktop_run_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
  run_id TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN run_id ~ '^DESK-[0-9]+$'
      THEN CAST(SUBSTRING(run_id FROM 6) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1 INTO next_num
  FROM desktop_job_queue;
  
  run_id := 'DESK-' || LPAD(next_num::text, 5, '0');
  RETURN run_id;
END;
$$;
