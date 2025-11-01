-- Reset Rate Limit for Testing
-- Run this in Supabase SQL Editor to reset your usage and set a proper limit

-- Step 1: Set daily limit to 150 per day
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('YOUR_USER_ID', 150)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 150;

-- Step 2: Reset today's count to 0
DELETE FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' AND usage_date = CURRENT_DATE;

-- Step 3: Verify the reset
SELECT 
  u.user_id,
  u.usage_date,
  u.count,
  COALESCE(l.daily_ai_limit, 1) as daily_limit,
  COALESCE(l.daily_ai_limit, 1) - u.count as remaining
FROM daily_ai_usage u
LEFT JOIN account_limits l ON u.user_id = l.user_id
WHERE u.user_id = 'YOUR_USER_ID' AND u.usage_date = CURRENT_DATE;

-- If the query above returns no rows, that's OK - it means count is 0
-- You can check what your limit is set to:
SELECT user_id, daily_ai_limit 
FROM account_limits 
WHERE user_id = 'YOUR_USER_ID';

-- If you want to reset ALL users (admin only):
-- DELETE FROM daily_ai_usage WHERE usage_date = CURRENT_DATE;
-- UPDATE account_limits SET daily_ai_limit = 150;

