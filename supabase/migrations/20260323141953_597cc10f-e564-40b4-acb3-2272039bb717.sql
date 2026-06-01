ALTER TABLE public.test_runs
  ADD COLUMN IF NOT EXISTS payload_sent jsonb,
  ADD COLUMN IF NOT EXISTS webhook_response jsonb,
  ADD COLUMN IF NOT EXISTS step_results jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE test_runs;