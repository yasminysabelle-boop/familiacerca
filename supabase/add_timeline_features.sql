-- Add mood column to voice_diary for Memorias.jsx mood picker
ALTER TABLE public.voice_diary
  ADD COLUMN IF NOT EXISTS mood text;

-- Optional: constrain to known values
-- ALTER TABLE public.voice_diary
--   ADD CONSTRAINT voice_diary_mood_check CHECK (mood IN ('😊','😐','😔'));
