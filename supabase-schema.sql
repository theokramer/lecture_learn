-- Supabase Database Schema for React Learning Notes App
-- Run this in your Supabase SQL Editor to create the necessary tables
--
-- IMPORTANT: After running this schema, also run:
-- 1. storage-policies.sql (for storage bucket RLS policies)
-- 2. setup-study-content-table.sql (for study_content table with feynman_topics)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth, but we need a reference)
-- This is automatically created by Supabase Auth, we just need to reference it

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_folder_name_per_user UNIQUE (user_id, name, parent_id)
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents table (for file attachments)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'audio', 'video', 'pdf', 'doc', 'text'
  storage_path TEXT NOT NULL,
  size BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Study content table
CREATE TABLE IF NOT EXISTS study_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  summary TEXT,
  flashcards JSONB DEFAULT '[]',
  quiz_questions JSONB DEFAULT '[]',
  exercises JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
CREATE POLICY "Users can create their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for notes
DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own notes" ON notes;
CREATE POLICY "Users can create their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for documents
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = documents.note_id
      AND notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
CREATE POLICY "Users can create their own documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = documents.note_id
      AND notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = documents.note_id
      AND notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = documents.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- RLS Policies for study_content
DROP POLICY IF EXISTS "Users can view their own study content" ON study_content;
CREATE POLICY "Users can view their own study content"
  ON study_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create their own study content" ON study_content;
CREATE POLICY "Users can create their own study content"
  ON study_content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own study content" ON study_content;
CREATE POLICY "Users can update their own study content"
  ON study_content FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own study content" ON study_content;
CREATE POLICY "Users can delete their own study content"
  ON study_content FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_note_id ON documents(note_id);
CREATE INDEX IF NOT EXISTS idx_study_content_note_id ON study_content(note_id);

-- Create updated_at trigger for notes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_content_updated_at ON study_content;
CREATE TRIGGER update_study_content_updated_at
  BEFORE UPDATE ON study_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Account limits table (per-user custom limits)
CREATE TABLE IF NOT EXISTS account_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_ai_limit INT NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disable RLS for account_limits (needs to be reliably read by edge function)
ALTER TABLE account_limits DISABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_account_limits_user_id ON account_limits(user_id);

-- Daily AI usage table (rate limiting)
CREATE TABLE IF NOT EXISTS daily_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

-- Disable RLS for daily_ai_usage (needs reliable, fast checks)
ALTER TABLE daily_ai_usage DISABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_daily_ai_usage_user_date ON daily_ai_usage(user_id, usage_date);
