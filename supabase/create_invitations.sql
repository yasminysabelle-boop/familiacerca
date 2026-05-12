-- ================================================================
-- FamiliaCerca — Family invitations & members
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================

-- ----------------------------------------------------------------
-- family_invitations
-- ----------------------------------------------------------------
create table if not exists public.family_invitations (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  invited_email text not null,
  invited_by    text not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'expired')),
  token         uuid not null unique default gen_random_uuid(),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);

alter table public.family_invitations enable row level security;

drop policy if exists "family_invitations: owner manage" on public.family_invitations;
drop policy if exists "family_invitations: public read"  on public.family_invitations;

-- The family owner (inviter) can insert, update, and delete their invitations
create policy "family_invitations: owner manage"
  on public.family_invitations for all
  using  (auth.uid() = family_id)
  with check (auth.uid() = family_id);

-- Anyone (including unauthenticated) can read an invitation to validate a token
create policy "family_invitations: public read"
  on public.family_invitations for select
  using (true);

-- ----------------------------------------------------------------
-- family_members
-- ----------------------------------------------------------------
create table if not exists public.family_members (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  member_user_id uuid,
  member_email   text not null,
  joined_at      timestamptz not null default now(),
  unique (family_id, member_user_id)
);

alter table public.family_members enable row level security;

drop policy if exists "family_members: owner manage"        on public.family_members;
drop policy if exists "family_members: member read own"     on public.family_members;
drop policy if exists "family_members: authenticated insert" on public.family_members;

-- The family owner can see and manage all members of their group
create policy "family_members: owner manage"
  on public.family_members for all
  using  (auth.uid() = family_id)
  with check (auth.uid() = family_id);

-- Each member can see their own row
create policy "family_members: member read own"
  on public.family_members for select
  using (auth.uid() = member_user_id);

-- Any authenticated user can insert themselves as a member (join via invite)
create policy "family_members: authenticated insert"
  on public.family_members for insert
  with check (auth.role() = 'authenticated' and auth.uid() = member_user_id);
