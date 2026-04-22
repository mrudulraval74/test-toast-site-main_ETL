-- Restore the application-facing test_cases shape without removing existing
-- ETL comparison columns/data that may already exist on the remote database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  ADD COLUMN IF NOT EXISTS automated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.test_case_folders(id) ON DELETE SET NULL;

ALTER TABLE public.test_cases
  ALTER COLUMN test_type DROP NOT NULL,
  ALTER COLUMN title SET DEFAULT 'Untitled test case',
  ALTER COLUMN priority SET DEFAULT 'medium',
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN automated SET DEFAULT false;

UPDATE public.test_cases
SET
  title = COALESCE(
    NULLIF(title, ''),
    NULLIF(test_type, ''),
    NULLIF(source_table, ''),
    'Untitled test case'
  ),
  updated_at = COALESCE(updated_at, created_at, now()),
  priority = COALESCE(priority, 'medium'),
  automated = COALESCE(automated, false);

ALTER TABLE public.test_cases
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.test_cases
  DROP CONSTRAINT IF EXISTS test_cases_status_check;

CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON public.test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_user_story_id ON public.test_cases(user_story_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_folder_id ON public.test_cases(folder_id);
CREATE INDEX IF NOT EXISTS idx_test_case_folders_project_id ON public.test_case_folders(project_id);

ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to test_cases" ON public.test_cases;
DROP POLICY IF EXISTS "Users can view test cases from their projects" ON public.test_cases;
DROP POLICY IF EXISTS "Users can create test cases in their projects" ON public.test_cases;
DROP POLICY IF EXISTS "Users can update test cases in their projects" ON public.test_cases;
DROP POLICY IF EXISTS "Users can delete test cases in their projects" ON public.test_cases;
DROP POLICY IF EXISTS "Project members can view test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Project members can create test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Project members can update test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Project members can delete test cases" ON public.test_cases;

CREATE POLICY "Project members can view test cases"
ON public.test_cases FOR SELECT
USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

CREATE POLICY "Project members can create test cases"
ON public.test_cases FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

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

CREATE POLICY "Project members can delete test cases"
ON public.test_cases FOR DELETE
USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_cases.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_cases.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view folders in their projects" ON public.test_case_folders;
DROP POLICY IF EXISTS "Users can create folders in their projects" ON public.test_case_folders;
DROP POLICY IF EXISTS "Users can update folders in their projects" ON public.test_case_folders;
DROP POLICY IF EXISTS "Users can delete folders in their projects" ON public.test_case_folders;

CREATE POLICY "Users can view folders in their projects"
ON public.test_case_folders FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

CREATE POLICY "Users can create folders in their projects"
ON public.test_case_folders FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

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

CREATE POLICY "Users can delete folders in their projects"
ON public.test_case_folders FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = test_case_folders.project_id AND p.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = test_case_folders.project_id AND pm.user_id = auth.uid())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_test_cases_updated_at'
      AND tgrelid = 'public.test_cases'::regclass
  ) THEN
    CREATE TRIGGER update_test_cases_updated_at
    BEFORE UPDATE ON public.test_cases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_test_case_folders_updated_at'
      AND tgrelid = 'public.test_case_folders'::regclass
  ) THEN
    CREATE TRIGGER update_test_case_folders_updated_at
    BEFORE UPDATE ON public.test_case_folders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
