
CREATE POLICY "Admins can update agent jobs" ON public.agent_job_queue
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agent jobs" ON public.agent_job_queue
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update desktop jobs" ON public.desktop_job_queue
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete desktop jobs" ON public.desktop_job_queue
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
