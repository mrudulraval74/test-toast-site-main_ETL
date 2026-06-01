
CREATE TABLE public.user_story_custom_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('jira','azure')),
  query_text TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uscq_project ON public.user_story_custom_queries(project_id);

ALTER TABLE public.user_story_custom_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view custom queries"
ON public.user_story_custom_queries FOR SELECT
USING (public.is_project_member(project_id) OR public.is_admin());

CREATE POLICY "Members can insert custom queries"
ON public.user_story_custom_queries FOR INSERT
WITH CHECK (public.is_project_member(project_id) OR public.is_admin());

CREATE POLICY "Members can update custom queries"
ON public.user_story_custom_queries FOR UPDATE
USING (public.is_project_member(project_id) OR public.is_admin());

CREATE POLICY "Members can delete custom queries"
ON public.user_story_custom_queries FOR DELETE
USING (public.is_project_member(project_id) OR public.is_admin());

CREATE TRIGGER trg_uscq_updated_at
BEFORE UPDATE ON public.user_story_custom_queries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
