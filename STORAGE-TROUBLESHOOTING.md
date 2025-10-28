# Storage RLS Troubleshooting Guide

You're still getting RLS policy violations even after updating the policies. Let's debug this step by step.

## Step 1: Test with Simple Policies

1. **Run `storage-policies-simple.sql` first** in Supabase SQL Editor
   - This allows ALL authenticated users to access files
   - If this works, then the issue is with the path matching
   - If this still fails, the issue is elsewhere

2. **Test file upload** in production after running the simple policies

## Step 2: Check Bucket Configuration

The bucket might need specific settings. Check in Supabase Dashboard:

1. Go to **Storage** → **documents** bucket
2. Check **Settings** tab
3. Verify:
   - **Public bucket**: Should be **OFF** (private)
   - **File size limit**: Should be adequate for your files
   - **Allowed MIME types**: Should allow `application/pdf`

## Step 3: Check if RLS is the Problem

Run this query in Supabase SQL Editor to check if it's a different issue:

```sql
-- Check if there are existing policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'objects';

-- Check if RLS is enabled on storage objects
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';
```

## Step 4: Check Authentication

The error shows you're getting authenticated (user_id in path), but the policies still fail. 

Try this query to verify auth works in storage policies:

```sql
-- Test if auth.uid() returns correctly
SELECT auth.uid() as current_user_id;
```

## Step 5: Most Likely Issue - Storage Bucket Public Setting

Common fix: The bucket might need to allow authenticated access differently.

Go to Supabase Dashboard:
1. **Storage** → **documents** 
2. **Policies** tab
3. Make sure there are policies there
4. If none exist, run one of the SQL scripts

## Alternative: Disable RLS Temporarily

**WARNING: Only for testing!**

To test if RLS is the problem:

```sql
-- ONLY RUN THIS FOR TESTING
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

Then test file uploads. If they work, RLS policies are the issue.
Re-enable with: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`

## What to Check Next

After running `storage-policies-simple.sql`:

1. **If uploads work**: The issue is with user-specific path matching. We need to debug why `auth.uid()` doesn't match in the LIKE clause.

2. **If uploads still fail**: The issue is likely:
   - Bucket not properly configured
   - Authentication not working correctly in storage context
   - Need to check Supabase storage logs for more details

## Check Supabase Logs

1. Go to Supabase Dashboard
2. **Logs** → **Postgres Logs**
3. Look for error messages around the time you tried to upload
4. This will show the exact RLS policy that's failing

## Expected File Path Format

Your app creates paths like: `ffce73c0-ff2d-48ac-8180-73aa82a3f776/1761668390837.pdf`

The first part (`ffce73c0-ff2d-48ac-8180-73aa82a3f776`) should be the user_id returned by `auth.uid()::text`.

## Quick Fix to Try

If nothing else works, run this to allow all authenticated users:

```sql
-- Allow any authenticated user to do anything with documents bucket
CREATE POLICY "Allow all authenticated" ON storage.objects
FOR ALL USING (bucket_id = 'documents' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

Then gradually add restrictions back once you confirm it works.

