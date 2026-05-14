-- ================================================================
-- FamiliaCerca — GPS columns, timeline reactions, care shifts
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ================================================================

-- ── GPS columns on medication_logs ───────────────────────────────
alter table public.medication_logs
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;

-- ── GPS columns on notes ─────────────────────────────────────────
alter table public.notes
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;

-- ── GPS columns on emergency_alerts ─────────────────────────────
alter table public.emergency_alerts
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;


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

create policy "timeline_reactions: read family group"
  on public.timeline_reactions for select
  using (
    auth.uid() = owner_id or
    auth.uid() in (
      select member_user_id from public.family_members where user_id = owner_id
    )
  );

create policy "timeline_reactions: write own"
  on public.timeline_reactions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

create policy "care_shifts: read family group"
  on public.care_shifts for select
  using (
    auth.uid() = owner_id or
    auth.uid() in (
      select member_user_id from public.family_members where user_id = owner_id
    )
  );

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

create index if not exists idx_care_shifts_owner_date
  on public.care_shifts(owner_id, shift_date);
