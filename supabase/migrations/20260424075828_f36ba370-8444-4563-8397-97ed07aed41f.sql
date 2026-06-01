CREATE POLICY "Users can delete executions in their projects"
ON public.nocode_test_executions
FOR DELETE
USING (is_project_member(project_id));

CREATE POLICY "Users can delete suite executions in their projects"
ON public.nocode_suite_executions
FOR DELETE
USING (is_project_member(project_id));