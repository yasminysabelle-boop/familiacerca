-- ================================================================
-- FamiliaCerca — Family invitations & members
-- Run this in the Supabase SQL Editor (safe to re-run)
-- Drops and recreates both tables to ensure a clean state
-- ================================================================

-- ----------------------------------------------------------------
-- Clean slate (drop in reverse dependency order)
-- ----------------------------------------------------------------
drop table if exists public.family_members    cascade;
drop table if exists public.family_invitations cascade;

-- ----------------------------------------------------------------
-- family_invitations
-- user_id  = auth.uid() of the person who sent the invitation
-- invited_by = display name of that person (shown on the join page)
-- ----------------------------------------------------------------
create table public.family_invitations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  invited_email text not null,
  invited_by    text not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'expired')),
  token         uuid not null unique default gen_random_uuid(),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);

alter table public.family_invitations enable row level security;

-- The inviting user can insert, update, and delete their own invitations
create policy "family_invitations: owner manage"
  on public.family_invitations for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone (including unauthenticated) can read an invitation to validate a token
create policy "family_invitations: public read"
  on public.family_invitations for select
  using (true);

-- ----------------------------------------------------------------
-- family_members
-- user_id        = auth.uid() of the family owner (same as family_invitations.user_id)
-- member_user_id = auth.uid() of the person who accepted the invite
-- ----------------------------------------------------------------
create table public.family_members (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  member_user_id uuid,
  member_email   text not null,
  joined_at      timestamptz not null default now(),
  unique (user_id, member_user_id)
);

alter table public.family_members enable row level security;

-- The family owner can see and manage all members of their group
create policy "family_members: owner manage"
  on public.family_members for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Each member can see their own row
create policy "family_members: member read own"
  on public.family_members for select
  using (auth.uid() = member_user_id);

-- Any authenticated user can insert themselves as a member (join via invite)
create policy "family_members: authenticated insert"
  on public.family_members for insert
  with check (auth.role() = 'authenticated' and auth.uid() = member_user_id);
