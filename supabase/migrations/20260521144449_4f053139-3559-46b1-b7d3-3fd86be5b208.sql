
CREATE POLICY "Creators can update agent jobs" ON public.agent_job_queue
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete agent jobs" ON public.agent_job_queue
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creators can update desktop jobs" ON public.desktop_job_queue
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete desktop jobs" ON public.desktop_job_queue
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
