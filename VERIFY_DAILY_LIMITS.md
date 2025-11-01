# Quick Verification: Daily Rate Limits

## 5-Minute Setup & Test

### Step 1: Deploy Code (1 minute)
```bash
git add .
git commit -m "Switch to daily rate limits (1 per day)"
git push  # Deploy to Supabase/Vercel
```

### Step 2: Verify Database Table (1 minute)
Open **Supabase Console** → **SQL Editor** → Run:
```sql
SELECT * FROM daily_ai_usage LIMIT 1;
```
Should show: `user_id`, `usage_date`, `count`

### Step 3: Test First Generation (1 minute)
1. Open app and log in
2. Click "Generate Summary" (or any AI feature)
3. Should see: **Success** ✅

### Step 4: Check Database (1 minute)
Run in Supabase:
```sql
SELECT * FROM daily_ai_usage 
WHERE usage_date = CURRENT_DATE AT TIME ZONE 'utc' 
ORDER BY created_at DESC LIMIT 1;
```

**Expected output:**
```
user_id: xxx-xxx-xxx
usage_date: 2025-11-01
count: 1
```

### Step 5: Test Second Generation (1 minute)
Click "Generate" again
Should see: **"You have already generated AI content today. Please try again tomorrow."** ❌

---

## Detailed Verification

### Check Edge Function Logs
1. Open **Supabase Console**
2. Go to **Functions** → **ai-generate**
3. Click **Logs** tab
4. Trigger a generation
5. Look for these logs:

✅ **First time:**
```
Checking daily AI usage limit...
Current daily usage count: 0
No limit reached...
Successfully incremented daily usage...
```

❌ **Second time:**
```
Checking daily AI usage limit...
Current daily usage count: 1
Daily limit reached...
```

### Check All Features Work
Test these AI features (each should work once per day):
- [ ] Summary generation
- [ ] Quiz generation
- [ ] Exercises generation
- [ ] Feynman explanation
- [ ] AI Chat
- [ ] Audio transcription

All should show same error message when limit reached.

### Check User Experience
- [ ] Error message appears in UI (not as console error)
- [ ] Error message is clear and helpful
- [ ] Can continue using app (not broken)
- [ ] After midnight UTC, counter resets

---

## SQL Queries for Verification

### View Today's Usage
```sql
SELECT user_id, count, created_at
FROM daily_ai_usage 
WHERE usage_date = CURRENT_DATE AT TIME ZONE 'utc'
ORDER BY created_at DESC;
```

### Find Users Who Hit Limit
```sql
SELECT user_id, usage_date, count
FROM daily_ai_usage
WHERE count >= 1
ORDER BY usage_date DESC
LIMIT 10;
```

### Check Historical Usage
```sql
SELECT 
  DATE(usage_date) as day,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(count) as total_generations,
  MAX(count) as max_per_user
FROM daily_ai_usage
GROUP BY DATE(usage_date)
ORDER BY day DESC;
```

### Reset User for Testing
```sql
DELETE FROM daily_ai_usage 
WHERE user_id = 'test-user-id' 
AND usage_date = CURRENT_DATE AT TIME ZONE 'utc';
```

---

## Expected Behavior

| Scenario | Expected Result |
|----------|-----------------|
| First generation of day | ✅ Success |
| Second generation same day | ❌ Error: "Please try again tomorrow" |
| Generation at 23:50 UTC | ✅ Works |
| Generation at 00:05 UTC next day | ✅ Works (resets) |
| Multiple users same day | ✅ Each gets 1 generation |
| Summary + Quiz same user same day | ❌ Second one blocked |

---

## Debugging

### "It's still not working!"

1. **Verify Edge Function deployed:**
   - Check Supabase Functions → ai-generate
   - Look at the source code
   - Should use `checkDailyLimitOrThrow` and `incrementDailyUsage`

2. **Check the logs:**
   - Functions → ai-generate → Logs tab
   - Do you see the rate limit logs?
   - Are there any errors?

3. **Verify table exists:**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'daily_ai_usage';
   ```
   Should return 1 row.

4. **Check RLS policies:**
   ```sql
   SELECT policyname FROM pg_policies 
   WHERE tablename = 'daily_ai_usage';
   ```
   Should show 3 policies (SELECT, INSERT, UPDATE)

5. **Hard refresh app:**
   - Close browser tab
   - Ctrl+Shift+Delete (clear cache)
   - Open fresh

---

## Before/After Comparison

### Before (Account-level - not working):
```
table: account_ai_usage
status: ❌ Table empty after generation
```

### After (Daily - working):
```
table: daily_ai_usage  
status: ✅ count: 1 after first generation
         ✅ count remains 1, blocks second generation
         ✅ resets next day
```

---

## Success Indicators

✅ **Everything working when:**
- [ ] First generation succeeds
- [ ] `daily_ai_usage.count` = 1 in database
- [ ] Second generation blocked with proper error
- [ ] Error message shows in UI
- [ ] Edge function logs show the rate limit checks
- [ ] All AI features affected consistently
- [ ] Resets after midnight UTC
