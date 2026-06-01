-- First nullify the orphan references, then fix the FK
UPDATE public.desktop_job_queue SET agent_id = NULL WHERE agent_id NOT IN (SELECT id FROM public.self_hosted_agents);

-- Drop old FK and add new one pointing to self_hosted_agents
ALTER TABLE public.desktop_job_queue DROP CONSTRAINT IF EXISTS desktop_job_queue_agent_id_fkey;
ALTER TABLE public.desktop_job_queue ADD CONSTRAINT desktop_job_queue_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.self_hosted_agents(id);