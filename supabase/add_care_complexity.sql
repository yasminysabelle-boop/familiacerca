-- ================================================================
-- FamiliaCerca — Care Complexity Score (Paso 3 de onboarding)
-- Run in Supabase SQL Editor
-- ================================================================

create table if not exists public.care_complexity (
  id                      uuid        primary key references auth.users(id) on delete cascade,
  caregiver_count         text        check (caregiver_count in ('1','2','3-5','6+')),
  focus_areas             text[]      check (focus_areas <@ array['medicamentos','citas','tareas','gastos','todo']::text[]),
  frequency               text        check (frequency in ('ocasional','regular','diaria')),
  complexity_score_value  smallint    check (complexity_score_value between 0 and 95),
  complexity_score        text        check (complexity_score in ('low','medium','high')),
  recommended_plan        text        check (recommended_plan in ('free','familiar','care_plus')),
  skipped                 boolean     not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- RLS
alter table public.care_complexity enable row level security;

create policy "Users can read own complexity"
  on public.care_complexity for select
  using (auth.uid() = id);

create policy "Users can insert own complexity"
  on public.care_complexity for insert
  with check (auth.uid() = id);

create policy "Users can update own complexity"
  on public.care_complexity for update
  using (auth.uid() = id);

-- Auto-update updated_at
create or replace function public.touch_care_complexity_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists care_complexity_updated_at on public.care_complexity;
create trigger care_complexity_updated_at
  before update on public.care_complexity
  for each row execute procedure public.touch_care_complexity_updated_at();
