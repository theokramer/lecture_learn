-- Create study_content table
CREATE TABLE IF NOT EXISTS study_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  summary TEXT,
  flashcards JSONB DEFAULT '[]',
  quiz_questions JSONB DEFAULT '[]',
  exercises JSONB DEFAULT '[]',
  feynman_topics JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add feynman_topics column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_content' 
    AND column_name = 'feynman_topics'
  ) THEN
    ALTER TABLE study_content ADD COLUMN feynman_topics JSONB DEFAULT '[]';
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE study_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own study content" ON study_content;
DROP POLICY IF EXISTS "Users can create their own study content" ON study_content;
DROP POLICY IF EXISTS "Users can update their own study content" ON study_content;
DROP POLICY IF EXISTS "Users can delete their own study content" ON study_content;

-- RLS Policies for study_content
CREATE POLICY "Users can view their own study content"
  ON study_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own study content"
  ON study_content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own study content"
  ON study_content FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own study content"
  ON study_content FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = study_content.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_study_content_updated_at ON study_content;

-- Create trigger for updated_at
CREATE TRIGGER update_study_content_updated_at
  BEFORE UPDATE ON study_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_study_content_note_id ON study_content(note_id);

