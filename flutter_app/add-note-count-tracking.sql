-- Add field to track count of notes with study content (including deleted ones)
-- This ensures users can only create one free note with study content

ALTER TABLE account_limits ADD COLUMN IF NOT EXISTS notes_with_study_content_count INT NOT NULL DEFAULT 0;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_account_limits_notes_count ON account_limits(notes_with_study_content_count);

