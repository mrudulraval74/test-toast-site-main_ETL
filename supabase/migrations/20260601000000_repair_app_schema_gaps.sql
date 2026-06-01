CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_project_member(project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = $1
      AND pm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = $1
      AND p.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = $1
      AND ur.role::text = 'admin'
  );
$$;

CREATE TABLE IF NOT EXISTS public.api_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  test_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_name text NOT NULL,
  report_content text NOT NULL,
  csv_files_metadata jsonb,
  ai_provider text NOT NULL DEFAULT 'openai',
  status text DEFAULT 'completed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.performance_jobs(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.self_hosted_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  summary jsonb,
  jtl_base64 text,
  report_base64 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qa_proven_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL,
  pattern_name text NOT NULL,
  pattern_content jsonb NOT NULL,
  description text,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  confidence_score numeric(3,2) DEFAULT 0.50,
  project_ids uuid[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  is_global boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.qa_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  standard_type text NOT NULL,
  name text NOT NULL,
  rules jsonb NOT NULL,
  examples jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_api_test_runs_project ON public.api_test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_performance_reports_project ON public.performance_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_performance_results_project ON public.performance_results(project_id);
CREATE INDEX IF NOT EXISTS idx_qa_proven_patterns_type ON public.qa_proven_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_qa_standards_project ON public.qa_standards(project_id);

ALTER TABLE public.api_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_proven_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_standards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Project members can manage api test runs" ON public.api_test_runs
  FOR ALL USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can manage performance reports" ON public.performance_reports
  FOR ALL USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can manage performance results" ON public.performance_results
  FOR ALL USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view global patterns or own project patterns" ON public.qa_proven_patterns
  FOR SELECT USING (is_global = true OR auth.uid() = created_by OR EXISTS (SELECT 1 FROM unnest(project_ids) AS pid WHERE public.is_project_member(pid)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own patterns" ON public.qa_proven_patterns
  FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can view standards" ON public.qa_standards
  FOR SELECT USING (public.is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can manage standards" ON public.qa_standards
  FOR ALL USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('test-plan-templates', 'test-plan-templates', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Users can view their own templates" ON storage.objects
  FOR SELECT USING (bucket_id = 'test-plan-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload their own templates" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'test-plan-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own templates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'test-plan-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own templates" ON storage.objects
  FOR DELETE USING (bucket_id = 'test-plan-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
