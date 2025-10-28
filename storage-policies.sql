-- Supabase Storage Bucket RLS Policies for React Learning Notes App
-- Run this in your Supabase SQL Editor to configure storage bucket security

-- Create the 'documents' storage bucket if it doesn't exist
-- Note: This bucket will be created via Supabase Dashboard if it doesn't exist
-- Go to Storage > Create Bucket > Name: "documents" > Public: false

-- Storage Bucket Policies for 'documents' bucket
-- These policies ensure users can only access their own files

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to view/select files in their own folders
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to upload files to their own folders
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Instructions for creating the bucket manually:
-- 
-- If the 'documents' bucket doesn't exist:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: "documents"
-- 4. Public bucket: OFF (private)
-- 5. Click "Create bucket"
--
-- Then run this SQL script to add the RLS policies

