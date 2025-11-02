-- Supabase Storage Bucket RLS Policies for Nano AI App
-- Run this in your Supabase SQL Editor to configure storage bucket security
--
-- UPDATED: Uses LIKE pattern matching for more reliable path checking
-- This matches files where the path starts with the user's UUID (e.g., "user-uuid/filename.ext")
--
-- IMPORTANT: 
-- 1. Make sure the 'documents' bucket exists (create via Dashboard > Storage)
-- 2. Run this script in SQL Editor to update the policies
-- 3. Clear browser cache after running to test changes

-- Create the 'documents' storage bucket if it doesn't exist
-- Note: Create this via Supabase Dashboard if it doesn't exist
-- Go to Storage > Create Bucket > Name: "documents" > Public: false

-- Storage Bucket Policies for 'documents' bucket
-- These policies ensure users can only access their own files

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- IMPORTANT: Enable RLS on storage.objects if not already enabled
-- Check if RLS is enabled first (this command will error if already enabled, which is fine)
-- If you get an error, RLS is already enabled and that's good

-- Alternative simpler policies for testing (uncomment if LIKE doesn't work)
-- These allow all authenticated users to access the documents bucket
-- You can use these temporarily to test, then narrow down the permissions
/*
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);
*/

-- Policy: Allow authenticated users to view/select files in their own folders
-- Using LIKE pattern matching for more reliable path checking
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND name LIKE auth.uid()::text || '/%'
);

-- Policy: Allow authenticated users to upload files to their own folders
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND name LIKE auth.uid()::text || '/%'
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND name LIKE auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'documents' 
  AND name LIKE auth.uid()::text || '/%'
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND name LIKE auth.uid()::text || '/%'
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

