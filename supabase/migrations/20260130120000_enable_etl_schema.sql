-- ============================================================================
-- ETL Workflow Database Schema
-- ============================================================================
-- Based on server/schema.sql
-- Run this script to create the tables required for:
-- 1. Database Connections (Source/Target)
-- 2. Saved Queries (Query Builder)
-- 3. Comparison Reports (ETL Results)
-- ============================================================================

-- 1. Connections table: stores database connection configurations
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  host text NOT NULL,
  port integer,
  instance text,
  database text,
  username text,
  password text,
  trusted boolean,
  ssl boolean,
  charset text,
  save_credentials boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Saved Queries table: stores user saved SQL queries
CREATE TABLE IF NOT EXISTS public.saved_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  query text NOT NULL,
  connection_id uuid REFERENCES public.connections(id),
  folder text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Reports table: stores comparison job results and metadata
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_id text NOT NULL,
  name text,
  note text,
  source_connection_id uuid,
  target_connection_id uuid,
  status text DEFAULT 'pending',
  progress integer DEFAULT 0,
  summary jsonb,
  column_stats jsonb,
  sample_mismatches jsonb,
  column_mismatches jsonb,
  storage_paths jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.connections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_compare_id ON public.reports(compare_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- ============================================================================
-- STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Create reports bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role full access to reports bucket
-- (Note: Service role bypasses RLS, but these are good for documentation/completeness)
DROP POLICY IF EXISTS "Service role can insert report files" ON storage.objects;
CREATE POLICY "Service role can insert report files"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'reports');

DROP POLICY IF EXISTS "Service role can select report files" ON storage.objects;
CREATE POLICY "Service role can select report files"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "Service role can delete report files" ON storage.objects;
CREATE POLICY "Service role can delete report files"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'reports');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('connections', 'saved_queries', 'reports');
