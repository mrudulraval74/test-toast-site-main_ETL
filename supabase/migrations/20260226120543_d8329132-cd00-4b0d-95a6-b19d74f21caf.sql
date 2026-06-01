
CREATE TABLE public.defects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  steps_to_reproduce TEXT DEFAULT '',
  expected_result TEXT DEFAULT '',
  actual_result TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  severity TEXT NOT NULL DEFAULT '3 - Medium',
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'manual',
  test_case_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view defects in their projects"
  ON public.defects FOR SELECT
  USING (
    public.is_project_member(project_id) OR public.is_admin()
  );

CREATE POLICY "Users can insert defects in their projects"
  ON public.defects FOR INSERT
  WITH CHECK (
    public.is_project_member(project_id) OR public.is_admin()
  );

CREATE POLICY "Users can update defects in their projects"
  ON public.defects FOR UPDATE
  USING (
    public.is_project_member(project_id) OR public.is_admin()
  );

CREATE POLICY "Users can delete defects in their projects"
  ON public.defects FOR DELETE
  USING (
    public.is_project_member(project_id) OR public.is_admin()
  );

CREATE TRIGGER update_defects_updated_at
  BEFORE UPDATE ON public.defects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
