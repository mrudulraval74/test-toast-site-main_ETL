CREATE POLICY "Users can delete performance jobs"
ON public.performance_jobs
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_project_member(project_id, auth.uid())
);