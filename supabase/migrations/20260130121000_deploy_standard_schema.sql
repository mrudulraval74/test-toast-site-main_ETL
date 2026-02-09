-- ============================================================================
-- Deploy Standard Application Schema (Idempotent Version)
-- ============================================================================
-- Run this script to restore functionality for:
-- Dashboard, User Stories, Test Plans, Test Runs, Integrations, and Settings.
-- This script handles existing tables and policies gracefully.
-- ============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Common Functions
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
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- 3. Profiles & Auth
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

-- 4. Projects & Members
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

-- 5. User Stories & Test Cases
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

-- 6. Integration Configs
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

-- 7. Saved Test Plans
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

-- 8. Test Runs
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
  status TEXT NOT NULL DEFAULT 'not_run',
  executed_at TIMESTAMP WITH TIME ZONE,
  executed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(test_run_id, test_case_id)
);
ALTER TABLE public.test_run_cases ENABLE ROW LEVEL SECURITY;

-- 9. QA AI Components (Embeddings & Feedback)
CREATE TABLE IF NOT EXISTS public.qa_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_approved BOOLEAN DEFAULT false,
  approval_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);
ALTER TABLE public.qa_embeddings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.qa_ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_id UUID,
  action TEXT NOT NULL,
  original_content TEXT NOT NULL,
  edited_content TEXT,
  feedback_notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_ai_feedback ENABLE ROW LEVEL SECURITY;

-- 10. App Settings
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
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);

-- Populate default app settings
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES 
  ('admin_menu_visibility', '{"knowledgeBase": true, "qaInsights": true, "aiAnalytics": true, "roleManagement": true, "architecture": true}'::jsonb, 'Visibility settings for admin menu items'),
  ('testing_only_mode', '{"enabled": false}'::jsonb, 'Toggle testing-only mode for the UI')
ON CONFLICT (setting_key) DO NOTHING;

-- 11. Menu Configuration (Populate Default Items)
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
ON CONFLICT (menu_id) DO UPDATE SET is_visible = true;

-- 11. Triggers (Updated for idempotency)
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stories_updated_at ON public.user_stories;
CREATE TRIGGER update_user_stories_updated_at BEFORE UPDATE ON public.user_stories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_cases_updated_at ON public.test_cases;
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_configs_updated_at ON public.integration_configs;
CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON public.integration_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_test_plans_updated_at ON public.saved_test_plans;
CREATE TRIGGER update_saved_test_plans_updated_at BEFORE UPDATE ON public.saved_test_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_runs_updated_at ON public.test_runs;
CREATE TRIGGER update_test_runs_updated_at BEFORE UPDATE ON public.test_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_embeddings_updated_at ON public.qa_embeddings;
CREATE TRIGGER update_qa_embeddings_updated_at BEFORE UPDATE ON public.qa_embeddings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_config_updated_at ON public.menu_config;
CREATE TRIGGER update_menu_config_updated_at BEFORE UPDATE ON public.menu_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- End of Script
