# Debugging Rate Limit Implementation

## Issue: `account_ai_usage` Table Not Being Updated

If your table isn't being updated after generating AI content, follow this debugging guide.

## Step 1: Verify the Table Exists

### In Supabase Console:
1. Go to **SQL Editor**
2. Run this query:
```sql
SELECT * FROM account_ai_usage;
```

**Expected**: Empty table or rows with `has_used_ai_generation = false`

If table doesn't exist, run the migration:
```sql
-- From: MIGRATE_TO_ACCOUNT_LIMITS.sql
```

## Step 2: Check Edge Function Logs

### Method 1: View Logs in Supabase Console
1. Go to **Functions** → **ai-generate**
2. Click **Logs** tab
3. Trigger a generation and watch the logs

**What to look for**:
```
Checking account AI usage limit for user: {user-id}
Current usage state: { has_used_ai_generation: false }
No limit reached for user: {user-id}, proceeding with generation
Marking AI generation as used for user: {user-id}
Upsert result: { data: [...], error: null }
Successfully marked AI generation as used for user: {user-id}
```

### Method 2: Check Browser Console
1. Open DevTools (F12)
2. Go to **Network** tab
3. Trigger a generation
4. Look for `ai-generate` request
5. In **Response**, you should see `{ content: "...", text: "..." }` (success)

## Step 3: Manual Database Check

### After Generating Content, Run:
```sql
-- Check your account usage
SELECT user_id, has_used_ai_generation, ai_generation_used_at, created_at 
FROM account_ai_usage 
WHERE user_id = '20039264-3526-43fc-911a-8a8624267dbc';
```

**Expected Results After First Generation**:
```
| user_id              | has_used_ai_generation | ai_generation_used_at              | created_at                 |
|----------------------|------------------------|-----------------------------------|----------------------------|
| 123e4567-e89b-12d3-a456-426614174000 | true           | 2025-11-01T15:30:45.123Z          | 2025-11-01T15:30:00.000Z   |
```

## Step 4: Test the Limit

### After Getting `has_used_ai_generation = true`:
1. Try to generate again
2. Should get error: **"You have already used your one-time AI generation quota"**

### Check Edge Function Logs:
```
Checking account AI usage limit for user: {user-id}
Current usage state: { has_used_ai_generation: true }
Account limit reached for user: {user-id}
```

## Step 5: Common Issues & Fixes

### Issue: Row not created automatically
**Symptom**: Query shows 0 rows
**Fix**: 
```sql
-- Manually create row
INSERT INTO account_ai_usage (user_id, has_used_ai_generation)
VALUES ('YOUR_USER_ID_HERE', false);
```

### Issue: Permission denied error in logs
**Symptom**: `Error marking account usage as used: permission denied`
**Cause**: Row Level Security (RLS) policy issue
**Fix**:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'account_ai_usage';

-- If policies missing, re-run migration:
-- MIGRATE_TO_ACCOUNT_LIMITS.sql
```

### Issue: `upsert` not updating existing rows
**Symptom**: `has_used_ai_generation` stays `false`
**Fix**: Check if there's an issue with the `onConflict` clause:
```sql
-- Try manual update
UPDATE account_ai_usage 
SET has_used_ai_generation = true, ai_generation_used_at = NOW()
WHERE user_id = 'YOUR_USER_ID_HERE';
```

## Step 6: Full Reset (if needed)

### Reset a User's Quota:
```sql
UPDATE account_ai_usage 
SET has_used_ai_generation = false, ai_generation_used_at = NULL
WHERE user_id = 'YOUR_USER_ID_HERE';
```

### Reset All Users:
```sql
-- WARNING: This allows all users to generate again!
UPDATE account_ai_usage 
SET has_used_ai_generation = false, ai_generation_used_at = NULL;
```

### Delete All Usage Records:
```sql
-- WARNING: This removes all tracking!
DELETE FROM account_ai_usage;
```

## Step 7: Check RLS Policies

```sql
-- View all RLS policies for account_ai_usage
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'account_ai_usage';
```

**Expected Policies**:
- `Users can view their own account ai usage` (SELECT)
- `Users can create their own account ai usage` (INSERT)
- `Users can update their own account ai usage` (UPDATE)

## Monitoring Query

Use this query to monitor usage across all users:
```sql
SELECT 
  user_id,
  has_used_ai_generation,
  ai_generation_used_at,
  created_at,
  NOW() - created_at as "Time Since Created",
  NOW() - ai_generation_used_at as "Time Since Used"
FROM account_ai_usage
ORDER BY created_at DESC;
```

## Expected Behavior Timeline

1. **First Generation Request** → Table row created with `has_used_ai_generation = false`
2. **Generation Completes Successfully** → `has_used_ai_generation` updated to `true`, `ai_generation_used_at` set to current time
3. **Second Generation Request** → Check finds `has_used_ai_generation = true`, returns HTTP 429 error
4. **User Sees Error**: "You have already used your one-time AI generation quota. No additional AI generations are available."

## Testing Checklist

- [ ] `account_ai_usage` table exists
- [ ] Edge function logs show "Checking account AI usage limit"
- [ ] First generation succeeds
- [ ] After first generation, `has_used_ai_generation = true` in database
- [ ] Second generation shows limit error
- [ ] Error message displays correctly in UI
- [ ] All study modes are affected (Summary, Quiz, Exercises, Feynman, Chat)
- [ ] Audio transcription is also affected

## Troubleshooting Flow

```
Generation attempted
    ↓
Check logs - do you see "Checking account AI usage limit"?
    ├─ NO → Edge function not being called (check client-side code)
    └─ YES ↓
Database row exists?
    ├─ NO → RLS policy issue (check policies)
    └─ YES ↓
See "Successfully marked AI generation as used"?
    ├─ NO → Upsert error (check logs for specific error)
    └─ YES ↓
Check database - is `has_used_ai_generation = true`?
    ├─ NO → Write permission issue (check RLS)
    └─ YES ✓ SUCCESS!
```
