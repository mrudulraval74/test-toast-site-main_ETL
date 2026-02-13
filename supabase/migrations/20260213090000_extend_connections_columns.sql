-- Persist all connection details used by the ETL Connections UI.
ALTER TABLE IF EXISTS public.connections
  ADD COLUMN IF NOT EXISTS schema_name text,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS http_path text,
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS catalog text,
  ADD COLUMN IF NOT EXISTS account text,
  ADD COLUMN IF NOT EXISTS warehouse text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS readonly boolean DEFAULT false;

