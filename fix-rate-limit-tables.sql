-- Fix Rate Limit Tables - Run this in Supabase SQL Editor
-- This ensures the tables exist and have proper permissions

-- Create account_limits table if it doesn't exist
CREATE TABLE IF NOT EXISTS account_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_ai_limit INT NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create daily_ai_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS daily_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

-- IMPORTANT: Disable RLS for both tables (required for edge function access)
ALTER TABLE account_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_ai_usage DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_limits_user_id ON account_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_ai_usage_user_date ON daily_ai_usage(user_id, usage_date);

-- Verify RLS is disabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('account_limits', 'daily_ai_usage');
-- Should show: rowsecurity = false for both

