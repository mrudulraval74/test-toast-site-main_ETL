-- Add column to store recorded steps from the agent during recording sessions
ALTER TABLE public.desktop_job_queue ADD COLUMN IF NOT EXISTS recorded_steps jsonb DEFAULT '[]'::jsonb;