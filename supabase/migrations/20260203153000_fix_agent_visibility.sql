-- Fix RLS policies for self_hosted_agents to explicitly include project owners
-- The is_project_member function does not automatically include owners (based on usage in other tables)

-- 1. DROP existing policies
DROP POLICY IF EXISTS "Project members can view agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can create agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can update agents" ON public.self_hosted_agents;
DROP POLICY IF EXISTS "Project members can delete agents" ON public.self_hosted_agents;

-- 2. CREATE new, inclusive policies

-- VIEW: Members OR Owners
CREATE POLICY "Project members and owners can view agents"
  ON public.self_hosted_agents FOR SELECT
  USING (
    is_project_member(project_id, auth.uid()) OR 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
  );

-- CREATE: Members OR Owners (matches created_by check)
CREATE POLICY "Project members and owners can create agents"
  ON public.self_hosted_agents FOR INSERT
  WITH CHECK (
    (is_project_member(project_id, auth.uid()) OR 
     EXISTS (SELECT 1 FROM projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid()))
    AND auth.uid() = created_by
  );

-- UPDATE: Members OR Owners
CREATE POLICY "Project members and owners can update agents"
  ON public.self_hosted_agents FOR UPDATE
  USING (
    is_project_member(project_id, auth.uid()) OR 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
  );

-- DELETE: Members OR Owners
CREATE POLICY "Project members and owners can delete agents"
  ON public.self_hosted_agents FOR DELETE
  USING (
    is_project_member(project_id, auth.uid()) OR 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = self_hosted_agents.project_id AND projects.created_by = auth.uid())
  );
