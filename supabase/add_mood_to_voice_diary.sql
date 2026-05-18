-- Add mood column to voice_diary
-- Values: 'good' | 'regular' | 'hard' | null
alter table voice_diary
  add column if not exists mood text
    check (mood in ('good', 'regular', 'hard'));
