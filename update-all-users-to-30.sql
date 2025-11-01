-- Update All Users to 150 Daily AI Limit
-- Run this in Supabase SQL Editor to set all existing users to 150/day

-- Option 1: Update existing users who already have a limit set
UPDATE account_limits 
SET daily_ai_limit = 150 
WHERE daily_ai_limit < 150 OR daily_ai_limit = 1;

-- Option 2: Set default for ALL users (creates entries for users without limits)
-- This creates a limit entry for every user in auth.users
INSERT INTO account_limits (user_id, daily_ai_limit)
SELECT id, 150
FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 150;

-- Verify: Check all limits
SELECT 
  user_id,
  daily_ai_limit,
  created_at
FROM account_limits
ORDER BY created_at DESC;

-- Reset all users' today's usage count (optional - only if you want to reset everyone)
-- DELETE FROM daily_ai_usage WHERE usage_date = CURRENT_DATE;

