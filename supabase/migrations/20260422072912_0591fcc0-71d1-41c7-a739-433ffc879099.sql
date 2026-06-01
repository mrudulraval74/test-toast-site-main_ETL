ALTER TABLE public.desktop_job_queue
  ADD COLUMN IF NOT EXISTS pad_environment_id text,
  ADD COLUMN IF NOT EXISTS pad_workflow_id text,
  ADD COLUMN IF NOT EXISTS cloud_flow_trigger_url text;