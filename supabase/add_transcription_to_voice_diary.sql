-- Add transcription column to voice_diary
ALTER TABLE public.voice_diary
  ADD COLUMN IF NOT EXISTS transcription text;
