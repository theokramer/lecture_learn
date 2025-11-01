# Rate Limiting Diagnostic Guide

## ⚠️ Why Rate Limiting Might Not Be Working

Let me help you diagnose the issue. Use this guide to check each component.

---

## 🔍 DIAGNOSTIC CHECKLIST

### Step 1: Verify Database Table Exists

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'daily_ai_usage';

-- If it exists, check the schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'daily_ai_usage';

-- Check if RLS is disabled (it should be!)
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'daily_ai_usage';
-- Should show: (daily_ai_usage, f) where f = false/disabled
```

**If table doesn't exist:**
Run this SQL in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS daily_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE daily_ai_usage DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_daily_ai_usage_user_date ON daily_ai_usage(user_id, usage_date);
```

---

### Step 2: Check Account Limits Table

```sql
-- Verify account_limits table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'account_limits';

-- Check if it has data
SELECT * FROM account_limits;

-- If empty, see if default limit should be set
SELECT * FROM account_limits 
WHERE user_id = 'YOUR_USER_ID';
```

**If table missing:**
```sql
CREATE TABLE IF NOT EXISTS account_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_ai_limit INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_limits DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_account_limits_user_id ON account_limits(user_id);
```

---

### Step 3: Check Edge Function Deployment

```bash
# List deployed functions
supabase functions list

# Should see: ai-generate

# If not deployed or outdated:
supabase functions deploy ai-generate
```

---

### Step 4: Monitor Edge Function Logs

1. Go to **Supabase Dashboard**
2. **Functions** → **ai-generate**
3. **Logs** tab
4. Try generating content in your app
5. Look for these log messages:

✅ Should see:
```
[AUTH] ✅ User authenticated: uuid-xxx
[RATE_LIMIT] Starting rate limit check...
[RATE_LIMIT_CHECK] 🔍 Starting Rate Limit Check
[RATE_LIMIT_CHECK] 📊 Daily Limit: 1 (default)
[RATE_LIMIT_CHECK] 📈 Current Usage: 0/1
[RATE_LIMIT_CHECK] ✅ ALLOW - User under limit
[INCREMENT_USAGE] 📝 Incrementing daily usage count
```

❌ If you see:
```
[RATE_LIMIT_CHECK] ❌ Error fetching usage: ...
```
**Problem**: Database connection or table missing

❌ If you DON'T see rate limit logs at all:
**Problem**: Function not deployed or request not reaching it

---

### Step 5: Test Rate Limit Manually

#### First, set a very low limit for testing

```sql
-- Set user to 0 generations per day (will always hit limit)
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('YOUR_USER_ID', 0)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 0;

-- Clear today's usage
DELETE FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND usage_date = CURRENT_DATE;
```

#### Now try to generate
- Click "Generate Summary" or any AI feature
- Should immediately get error: "Daily AI limit reached"

#### If it works:
```sql
-- Increase limit back to 1 (or whatever)
UPDATE account_limits 
SET daily_ai_limit = 1 
WHERE user_id = 'YOUR_USER_ID';
```

#### If it doesn't work:
Check browser console for errors. Should show error with code `DAILY_LIMIT_REACHED`.

---

### Step 6: Check Frontend Error Handling

#### In browser console, when you try to generate:

✅ Should see error object like:
```json
{
  "code": "DAILY_LIMIT_REACHED",
  "message": "You have reached your daily AI generation limit...",
  "limit": 1,
  "remaining": 0
}
```

❌ If you see success response instead:
**Problem**: Rate limit check not happening on backend

---

### Step 7: Verify Today's Date Format

The app uses **UTC dates** for the `usage_date` column. 

```sql
-- Check what today's date is in the database
SELECT CURRENT_DATE;
-- Should return: 2025-11-01 (YYYY-MM-DD in UTC)

-- Check if records exist for today
SELECT * FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND usage_date = CURRENT_DATE;

-- If empty, next generation should create a record with count=0
```

---

## Common Issues & Solutions

### ❌ Issue: "Table does not exist"

**Solution:**
```sql
-- Recreate the table
CREATE TABLE IF NOT EXISTS daily_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);
ALTER TABLE daily_ai_usage DISABLE ROW LEVEL SECURITY;
```

Then redeploy edge function:
```bash
supabase functions deploy ai-generate
```

---

### ❌ Issue: "Permission denied" error

**Solution:**
```sql
-- Ensure RLS is DISABLED on daily_ai_usage
ALTER TABLE daily_ai_usage DISABLE ROW LEVEL SECURITY;

-- Same for account_limits
ALTER TABLE account_limits DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('daily_ai_usage', 'account_limits');
-- Should show: f (false = RLS disabled)
```

---

### ❌ Issue: Always allows generation (never blocks)

**Check 1**: Is the counter incrementing?
```sql
SELECT * FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND usage_date = CURRENT_DATE;
-- Count should increase each generation: 0, 1, 2, 3...
```

**Check 2**: Is the limit too high?
```sql
SELECT daily_ai_limit FROM account_limits 
WHERE user_id = 'YOUR_USER_ID';
-- Should show 1 (or whatever limit you set)
```

**Check 3**: Is the edge function deployed?
```bash
supabase functions list
# Should show: ai-generate
```

**Check 4**: Look at edge function logs for errors

---

### ❌ Issue: Counter increments but limit never blocks

**Most likely**: Limit is too high or `account_limits` table has wrong value

```sql
-- Force limit to 1
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('YOUR_USER_ID', 1)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 1;

-- Clear count for today
DELETE FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND usage_date = CURRENT_DATE;

-- Try to generate - should fail on 2nd attempt
```

---

### ❌ Issue: Error shows but UI doesn't display it

**Check**: Look at the component error handling

**File**: `src/components/note/study-modes/SummaryView.tsx` (or other components)

Should have:
```typescript
catch (error: any) {
  if (error?.code === 'DAILY_LIMIT_REACHED') {
    toast.error('Daily AI limit reached. Please try again tomorrow.');
  }
}
```

---

## ✅ Quick Test: Full Flow

### 1. Set limit to 0 (for testing)
```sql
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('YOUR_USER_ID', 0)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 0;
```

### 2. Clear today's usage
```sql
DELETE FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' AND usage_date = CURRENT_DATE;
```

### 3. Try to generate
- Click any AI generation button
- Should see: "Daily AI limit reached"

### 4. Check logs
- Go to Supabase → Functions → ai-generate → Logs
- Should see `[RATE_LIMIT_CHECK] ⛔ LIMIT REACHED!`

### 5. Reset
```sql
UPDATE account_limits SET daily_ai_limit = 1 WHERE user_id = 'YOUR_USER_ID';
DELETE FROM daily_ai_usage WHERE user_id = 'YOUR_USER_ID' AND usage_date = CURRENT_DATE;
```

---

## Debug Commands

### See all your usage today
```sql
SELECT * FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND usage_date = CURRENT_DATE;
```

### See your limit
```sql
SELECT * FROM account_limits 
WHERE user_id = 'YOUR_USER_ID';
```

### See all limits set
```sql
SELECT user_id, daily_ai_limit FROM account_limits;
```

### See everyone's usage today
```sql
SELECT u.user_id, u.count, l.daily_ai_limit
FROM daily_ai_usage u
LEFT JOIN account_limits l ON u.user_id = l.user_id
WHERE u.usage_date = CURRENT_DATE;
```

### Reset everything for testing
```sql
-- Clear all usage for today
DELETE FROM daily_ai_usage WHERE usage_date = CURRENT_DATE;

-- Set all users to limit 1
UPDATE account_limits SET daily_ai_limit = 1;
```

---

## Still Not Working?

**Run this full diagnostic:**

```sql
-- Check table 1: daily_ai_usage
SELECT 'daily_ai_usage' as table_name, count(*) as row_count FROM daily_ai_usage;

-- Check table 2: account_limits  
SELECT 'account_limits' as table_name, count(*) as row_count FROM account_limits;

-- Check your user's data
SELECT 'Your Usage Today:' as label;
SELECT * FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND usage_date = CURRENT_DATE;

SELECT 'Your Limit:' as label;
SELECT * FROM account_limits 
WHERE user_id = 'YOUR_USER_ID';

-- Check if RLS is disabled
SELECT 'RLS Status:' as label;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('daily_ai_usage', 'account_limits');
```

**Then check:**
1. ✅ Both tables exist
2. ✅ RLS is disabled (false)
3. ✅ You can see your usage
4. ✅ You have a limit set
5. ✅ Edge function is deployed
6. ✅ Edge function logs show rate limit checks

If all above are ✅ but still not working → **Post the error from edge function logs**

---

## Need Help?

Check the logs in this order:
1. **Supabase Function Logs** - Look for `[RATE_LIMIT_CHECK]` messages
2. **Browser Console** - Look for error objects
3. **Database** - Verify tables and data exist
4. **Edge Function Code** - Ensure it's deployed

