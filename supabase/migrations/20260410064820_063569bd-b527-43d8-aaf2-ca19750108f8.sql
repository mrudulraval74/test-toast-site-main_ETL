
-- Create test_case_versions table to store snapshots of test cases
CREATE TABLE public.test_case_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  steps TEXT,
  structured_steps JSONB DEFAULT '[]'::jsonb,
  test_data TEXT,
  expected_result TEXT,
  priority TEXT DEFAULT 'medium',
  automated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(test_case_id, version_number)
);

-- Add version column to test_cases to track current version
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version_id to test_run_cases to snapshot which version was used
ALTER TABLE public.test_run_cases ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.test_case_versions(id);

-- Enable RLS
ALTER TABLE public.test_case_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view test case versions" 
ON public.test_case_versions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.test_cases tc 
    JOIN public.projects p ON tc.project_id = p.id 
    WHERE tc.id = test_case_id AND (p.created_by = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

CREATE POLICY "Users can create test case versions" 
ON public.test_case_versions 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.test_cases tc 
    JOIN public.projects p ON tc.project_id = p.id 
    WHERE tc.id = test_case_id AND (p.created_by = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

-- Index for fast lookups
CREATE INDEX idx_test_case_versions_test_case_id ON public.test_case_versions(test_case_id);
CREATE INDEX idx_test_case_versions_lookup ON public.test_case_versions(test_case_id, version_number);
