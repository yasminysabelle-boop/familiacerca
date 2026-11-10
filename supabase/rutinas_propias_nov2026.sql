-- Rutinas propias (nov 2026)
-- Permite que cada familia apague rutinas sugeridas y agregue las suyas.
alter table public.care_item_schedules
  add column if not exists label  text,
  add column if not exists icon   text,
  add column if not exists active boolean not null default true;
