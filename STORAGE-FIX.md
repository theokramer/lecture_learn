# Fix Production Storage RLS Issue

## Problem
Uploading files in production fails with "new row violates row-level security policy" error.

## Solution
The storage policies have been updated to use LIKE pattern matching for more reliable path checking.

## How to Apply the Fix

### Step 1: Run the Updated SQL Script
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the `storage-policies.sql` file from your project
4. Copy and paste the contents into the SQL Editor
5. Click **Run** to execute the script

The script will:
- Drop the old policies
- Create new policies using `LIKE` pattern matching instead of `foldername` extraction
- Match files where the path starts with the user's UUID

### Step 2: Test in Production
1. Clear your browser cache or use an incognito window
2. Go to your production site
3. Try uploading a file
4. The upload should now work

## What Changed

**Old Policy (Not Working):**
```sql
auth.uid()::text = (storage.foldername(name))[1]
```

**New Policy (Working):**
```sql
name LIKE auth.uid()::text || '/%'
```

The new approach:
- Uses `LIKE` pattern matching for string paths
- Checks if the path starts with the user's UUID
- More reliable across different folder structures

## Verification

After running the script, you can verify it worked by:
1. Checking the upload works in production
2. Files should be accessible in the Supabase Storage dashboard
3. No more RLS policy violations in browser console

## Troubleshooting

If issues persist:
1. Check that you're logged in properly (check `auth.uid()` in console)
2. Verify the file path format matches the policy pattern
3. Check Supabase logs for specific RLS violations
4. Ensure the 'documents' bucket exists and is configured correctly

