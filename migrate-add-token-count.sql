-- Migration: Add token_count column to daily_ai_usage table
-- Run this in your Supabase SQL Editor

-- Add token_count column to daily_ai_usage for tracking token usage
ALTER TABLE daily_ai_usage ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;

-- Add file_hash column to documents table for caching
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for file_hash lookups
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);

-- Model cache table for storing AI generation responses
CREATE TABLE IF NOT EXISTS model_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT NOT NULL UNIQUE, -- SHA256(file_hash + prompt + model)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- Create indexes for model_cache
CREATE INDEX IF NOT EXISTS idx_model_cache_key ON model_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_model_cache_user ON model_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_model_cache_expires ON model_cache(expires_at);

-- Enable RLS for model_cache
ALTER TABLE model_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for model_cache
DROP POLICY IF EXISTS "Users can view their own cache entries" ON model_cache;
CREATE POLICY "Users can view their own cache entries"
  ON model_cache FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own cache entries" ON model_cache;
CREATE POLICY "Users can create their own cache entries"
  ON model_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cache entries" ON model_cache;
CREATE POLICY "Users can delete their own cache entries"
  ON model_cache FOR DELETE
  USING (auth.uid() = user_id);


