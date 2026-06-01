-- Add attachments column to defects table (stores array of storage paths)
ALTER TABLE public.defects ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for defect attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('defect-attachments', 'defect-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for defect-attachments bucket
CREATE POLICY "Authenticated users can upload defect attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'defect-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view defect attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'defect-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete defect attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'defect-attachments' AND auth.role() = 'authenticated');