-- ================================================================
-- FamiliaCerca — GPS columns, timeline reactions, care shifts
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ================================================================


-- ── Ensure medication_logs exists (base schema) ───────────────────
create table if not exists public.medication_logs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  medication_id   uuid,
  log_date        date        not null,
  status          text        not null default 'pending',
  confirmed_by_name text,
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique(medication_id, log_date, user_id)
);

-- ── GPS columns on medication_logs ───────────────────────────────
alter table public.medication_logs
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;


-- ── Ensure notes exists (base schema) ────────────────────────────
create table if not exists public.notes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  title      text,
  content    text,
  tags       text[]      default '{}',
  created_at timestamptz not null default now()
);

-- ── GPS columns on notes ─────────────────────────────────────────
alter table public.notes
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;


-- ── Ensure emergency_alerts exists (GPS columns included) ─────────
-- Creating with all columns so ALTER TABLE is never needed on a
-- potentially missing table.
create table if not exists public.emergency_alerts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  triggered_by_name text,
  relative_name     text,
  latitude          double precision,
  longitude         double precision,
  address           text,
  created_at        timestamptz not null default now()
);

-- Add GPS columns in case the table already existed without them
alter table public.emergency_alerts
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;

alter table public.emergency_alerts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'emergency_alerts'
      and policyname = 'emergency_alerts: insert own'
  ) then
    create policy "emergency_alerts: insert own"
      on public.emergency_alerts for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'emergency_alerts'
      and policyname = 'emergency_alerts: read family group'
  ) then
    create policy "emergency_alerts: read family group"
      on public.emergency_alerts for select
      using (
        auth.uid() = user_id or
        auth.uid() in (
          select member_user_id from public.family_members
          where user_id = emergency_alerts.user_id
        )
      );
  end if;
end $$;


-- ── Timeline reactions ────────────────────────────────────────────
create table if not exists public.timeline_reactions (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  event_key  text        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  emoji      text        not null check (emoji in ('❤️','👍','🙏','😢')),
  created_at timestamptz not null default now(),
  unique(event_key, user_id, emoji)
);

alter table public.timeline_reactions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'timeline_reactions'
      and policyname = 'timeline_reactions: read family group'
  ) then
    create policy "timeline_reactions: read family group"
      on public.timeline_reactions for select
      using (
        auth.uid() = owner_id or
        auth.uid() in (
          select member_user_id from public.family_members where user_id = owner_id
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'timeline_reactions'
      and policyname = 'timeline_reactions: write own'
  ) then
    create policy "timeline_reactions: write own"
      on public.timeline_reactions for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_timeline_reactions_owner
  on public.timeline_reactions(owner_id);
create index if not exists idx_timeline_reactions_event
  on public.timeline_reactions(event_key);


-- ── Care shifts ───────────────────────────────────────────────────
create table if not exists public.care_shifts (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  shift_date        date        not null,
  caregiver_user_id uuid        references auth.users(id) on delete set null,
  caregiver_name    text        not null,
  created_at        timestamptz not null default now(),
  unique(owner_id, shift_date)
);

alter table public.care_shifts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'care_shifts'
      and policyname = 'care_shifts: read family group'
  ) then
    create policy "care_shifts: read family group"
      on public.care_shifts for select
      using (
        auth.uid() = owner_id or
        auth.uid() in (
          select member_user_id from public.family_members where user_id = owner_id
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'care_shifts'
      and policyname = 'care_shifts: write family group'
  ) then
    create policy "care_shifts: write family group"
      on public.care_shifts for all
      using (
        auth.uid() = owner_id or
        auth.uid() in (
          select member_user_id from public.family_members where user_id = owner_id
        )
      )
      with check (
        auth.uid() = owner_id or
        auth.uid() in (
          select member_user_id from public.family_members where user_id = owner_id
        )
      );
  end if;
end $$;

create index if not exists idx_care_shifts_owner_date
  on public.care_shifts(owner_id, shift_date);
