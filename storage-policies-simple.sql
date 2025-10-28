-- SIMPLE Storage Policies for Testing
-- Run this FIRST to test if storage uploads work
-- Then you can refine the permissions later

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;

-- Simple policies: Allow all authenticated users to access documents bucket
-- This is LESS secure but will help us test if the problem is with path matching

-- Policy: Allow authenticated users to view files
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to update files
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- After running this:
-- 1. Test if file uploads work now
-- 2. If they work, then the problem is with the user-specific path matching
-- 3. If they still don't work, the problem is likely with bucket configuration or auth

