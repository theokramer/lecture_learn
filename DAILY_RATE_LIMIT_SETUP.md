# Daily Rate Limit Setup (1 Generation Per Day)

## Overview
Each user can generate AI content **once per day** (resets at midnight UTC).

- ✅ First generation of the day → Success
- ❌ Second generation same day → Error
- ✅ After midnight UTC → Can generate again

## How It Works

### Step 1: User Requests AI Content
User clicks "Generate Summary", "Generate Quiz", etc.

### Step 2: Rate Limit Check
Edge Function checks `daily_ai_usage` table:
```
SELECT count FROM daily_ai_usage 
WHERE user_id = 'USER_ID' AND usage_date = TODAY
```

### Step 3: Decision
- If `count >= 1` → Return **HTTP 429** error
- If `count == 0` → Allow generation to proceed

### Step 4: After Successful Generation
Update the counter:
```
UPDATE daily_ai_usage SET count = count + 1
WHERE user_id = 'USER_ID' AND usage_date = TODAY
```

## Database Table Structure

Using existing `daily_ai_usage` table:
```sql
CREATE TABLE daily_ai_usage (
  user_id UUID PRIMARY KEY,
  usage_date DATE,           -- UTC date (YYYY-MM-DD)
  count INT,                 -- Number of generations today
  PRIMARY KEY (user_id, usage_date)
);
```

## Testing

### Step 1: Check Current Status
```sql
-- Check today's usage
SELECT user_id, usage_date, count FROM daily_ai_usage 
WHERE usage_date = CURRENT_DATE AT TIME ZONE 'utc'
LIMIT 10;
```

### Step 2: Trigger Generation
1. Log in as test user
2. Click "Generate Summary" (or any AI feature)
3. Should succeed ✅

### Step 3: Verify Database Updated
```sql
-- Should show count = 1 for today
SELECT user_id, usage_date, count FROM daily_ai_usage 
WHERE user_id = '231217f7-d29d-4c91-a6e8-1e39d5b70b83' 
AND usage_date = CURRENT_DATE AT TIME ZONE 'utc';
```

### Step 4: Try Again
Click "Generate Summary" again
- Should fail with error: **"You have already generated AI content today. Please try again tomorrow."** ❌

### Step 5: Check Tomorrow
Wait until midnight UTC, or manually test:
```sql
-- Reset count for tomorrow's testing
UPDATE daily_ai_usage 
SET usage_date = CURRENT_DATE AT TIME ZONE 'utc' + INTERVAL '1 day'
WHERE user_id = 'YOUR_USER_ID';
```

## Admin: Manual Resets

### Reset a User's Today Quota
```sql
DELETE FROM daily_ai_usage 
WHERE user_id = 'USER_ID' 
AND usage_date = CURRENT_DATE AT TIME ZONE 'utc';
```

This allows them to generate again today.

### Reset All Users Today
```sql
-- WARNING: Allows all users to generate again today!
DELETE FROM daily_ai_usage 
WHERE usage_date = CURRENT_DATE AT TIME ZONE 'utc';
```

### View All Usage
```sql
SELECT 
  user_id,
  usage_date,
  count,
  CASE 
    WHEN count >= 1 THEN '❌ Limit reached'
    ELSE '✅ Can generate'
  END as status
FROM daily_ai_usage
ORDER BY usage_date DESC, count DESC
LIMIT 20;
```

## Edge Function Logs

Watch the logs to see what's happening:

**Supabase Console** → **Functions** → **ai-generate** → **Logs**

### Successful First Generation:
```
Checking daily AI usage limit for user: 123e4567...
Current daily usage count: 0
No limit reached for user: 123e4567, proceeding with generation
Incrementing daily usage for user: 123e4567
Successfully incremented daily usage for user: 123e4567
```

### Blocked Second Generation:
```
Checking daily AI usage limit for user: 123e4567...
Current daily usage count: 1
Daily limit reached for user: 123e4567
```

## Error Response

When limit is reached (HTTP 429):
```json
{
  "code": "DAILY_LIMIT_REACHED",
  "message": "You have already generated AI content today. Please try again tomorrow.",
  "limit": 1,
  "remaining": 0,
  "resetAt": "2025-11-02T00:00:00.000Z"
}
```

## User-Facing Messages

**First Generation:**
- Chat: "Generating response..." → Success with content
- Summary: "Generating summary..." → Success with summary
- Quiz: "Generating quiz..." → Success with questions

**Second Generation Same Day:**
- All features: **"You have already generated AI content today. Please try again tomorrow."**

## Deployment Checklist

- [ ] Push code changes to git
- [ ] Deploy Edge Function to Supabase (or automatic via GitHub)
- [ ] Verify `daily_ai_usage` table exists in Supabase
- [ ] Test first generation → should succeed
- [ ] Test second generation → should fail with limit error
- [ ] Check database: `count` should be 1
- [ ] Confirm error message displays in UI

## What Changed from Previous Versions

| Aspect | Old (Account-level) | New (Daily) |
|--------|-------------------|------------|
| Table | `account_ai_usage` | `daily_ai_usage` |
| Limit | 1 per account lifetime | 1 per day |
| Resets | Never | Daily at midnight UTC |
| Column | `has_used_ai_generation` | `count` |
| Status Code | `ACCOUNT_LIMIT_REACHED` | `DAILY_LIMIT_REACHED` |

## Monitoring

### Track Usage Over Time
```sql
SELECT 
  DATE(usage_date) as day,
  COUNT(DISTINCT user_id) as active_users,
  SUM(count) as total_generations
FROM daily_ai_usage
GROUP BY DATE(usage_date)
ORDER BY day DESC;
```

### Find Power Users (generated multiple times)
```sql
SELECT 
  user_id,
  usage_date,
  count
FROM daily_ai_usage
WHERE count > 1
ORDER BY count DESC;
```

## Troubleshooting

### Generations still work more than once?
1. Check Edge Function logs in Supabase
2. Verify `daily_ai_usage` table exists
3. Make sure code was deployed
4. Try hard refresh (Ctrl+Shift+R)

### Database shows `count = 0` after generation?
1. Check if `incrementDailyUsage()` is being called
2. Look for errors in Edge Function logs
3. Verify RLS policies on `daily_ai_usage` table

### Reset overnight but count persists?
```sql
-- Check what dates exist
SELECT DISTINCT usage_date FROM daily_ai_usage;

-- Clean old entries (keep only last 30 days)
DELETE FROM daily_ai_usage 
WHERE usage_date < (CURRENT_DATE AT TIME ZONE 'utc' - INTERVAL '30 days');
```

## Files Modified

- ✅ `supabase/functions/ai-generate/index.ts` - Uses `daily_ai_usage` with limit of 1
- ✅ Frontend components - Handle both `DAILY_LIMIT_REACHED` errors
- ✅ Existing `daily_ai_usage` table - Used as-is, no schema changes needed

## Future Enhancements

- Add per-tier limits (e.g., 5 for free, unlimited for paid)
- Track which feature was used (for analytics)
- Add whitelisting for specific users
- Export usage reports
