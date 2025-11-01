-- Remove Rate Limit for Premium Users (@premium.de emails)
-- Run this in Supabase SQL Editor to ensure Premium users have unlimited access

-- Step 1: Create or update account_limits for premium users with very high limit
INSERT INTO account_limits (user_id, daily_ai_limit, created_at, updated_at)
SELECT id, 999999, NOW(), NOW()
FROM auth.users
WHERE email LIKE '%@premium.de'
ON CONFLICT (user_id) 
DO UPDATE SET 
  daily_ai_limit = 999999,
  updated_at = NOW();

-- Step 2: Delete all rate limit tracking entries for premium users (clean slate)
DELETE FROM daily_ai_usage 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%@premium.de'
);

-- Step 3: Verify the changes
SELECT 
  u.email,
  COALESCE(al.daily_ai_limit, 150) as daily_limit,
  COALESCE(du.count, 0) as today_usage,
  CASE 
    WHEN u.email LIKE '%@premium.de' THEN 'PREMIUM ⭐'
    ELSE 'Regular'
  END as user_type
FROM auth.users u
LEFT JOIN account_limits al ON u.id = al.user_id
LEFT JOIN daily_ai_usage du ON u.id = du.user_id AND du.usage_date = CURRENT_DATE
WHERE u.email LIKE '%@premium.de'
ORDER BY u.email;

