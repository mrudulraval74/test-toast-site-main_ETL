-- Add parent_id column to test_case_folders for unlimited sub-folder nesting
ALTER TABLE public.test_case_folders
ADD COLUMN parent_id UUID REFERENCES public.test_case_folders(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_test_case_folders_parent_id ON public.test_case_folders(parent_id);