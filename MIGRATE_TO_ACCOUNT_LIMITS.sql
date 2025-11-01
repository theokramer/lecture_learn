-- Migration: Switch from daily AI limits to account-level (once per account) limits
-- Run this script in your Supabase SQL Editor

-- Step 1: Create the new account-level AI usage tracking table
CREATE TABLE IF NOT EXISTS account_ai_usage (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_used_ai_generation BOOLEAN NOT NULL DEFAULT FALSE,
  ai_generation_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Enable Row Level Security
ALTER TABLE account_ai_usage ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own account ai usage" ON account_ai_usage;
DROP POLICY IF EXISTS "Users can create their own account ai usage" ON account_ai_usage;
DROP POLICY IF EXISTS "Users can update their own account ai usage" ON account_ai_usage;

-- Step 4: Create new RLS policies
CREATE POLICY "Users can view their own account ai usage"
  ON account_ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own account ai usage"
  ON account_ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account ai usage"
  ON account_ai_usage FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The old daily_ai_usage table can be kept for backward compatibility or deleted
-- To delete it (optional):
-- DROP TABLE IF EXISTS daily_ai_usage;

COMMIT;
