-- ================================================================
-- FamiliaCerca — activity_log + daily_care_logs.status/photo_url
-- Run in Supabase SQL Editor (safe to re-run)
--
-- This DOCUMENTS state that already exists in production but was never
-- versioned in this repo: the activity_log table, the log_activity() RPC,
-- daily_care_logs.status/photo_url, and the trg_care_routine trigger that
-- logs care_routine / care_routine_missed activity entries. It was applied
-- directly in the SQL Editor at some point after create_daily_care_logs.sql,
-- which is why Cuidado.jsx (written before it existed) never learned to
-- filter on `status` — see the /cuidado "false completadas" bug fix.
-- ================================================================


-- ================================================================
-- 1. ACTIVITY_LOG
-- Feed of family-visible events (medications, care routines, hospital
-- mode, SOS, expenses, etc). Written by log_activity() below, generally
-- from triggers or Edge Functions using the service role.
-- ================================================================
create table if not exists public.activity_log (
  id          uuid        primary key default gen_random_uuid(),
  type        text        not null,
  description text        not null,
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,
  actor_name  text,
  metadata    jsonb        not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "activity_log: owner reads own" on public.activity_log;
create policy "activity_log: owner reads own"
  on public.activity_log for select
  using (owner_id = auth.uid());

drop policy if exists "activity_log: members read family" on public.activity_log;
create policy "activity_log: members read family"
  on public.activity_log for select
  using (owner_id in (
    select user_id from public.family_members where member_user_id = auth.uid()
  ));

create index if not exists idx_activity_log_owner_created
  on public.activity_log(owner_id, created_at desc);
create index if not exists idx_activity_log_type
  on public.activity_log(type);


-- ================================================================
-- 2. LOG_ACTIVITY — single entry point for writing activity_log rows.
-- SECURITY DEFINER so triggers/Edge Functions (service role) can write
-- regardless of RLS. Never throws — a logging failure must never break
-- the primary operation that triggered it.
-- ================================================================
create or replace function public.log_activity(
  p_type        text,
  p_description text,
  p_owner_id    uuid,
  p_actor_name  text default null,
  p_metadata    jsonb default '{}'::jsonb,
  p_created_at  timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_id is null then return; end if;
  insert into public.activity_log
    (type, description, owner_id, user_id, actor_name, metadata, created_at)
  values
    (p_type, p_description, p_owner_id, auth.uid(), p_actor_name, p_metadata, p_created_at);
exception when others then null; -- never break the primary operation
end;
$$;

grant execute on function public.log_activity(text, text, uuid, text, jsonb, timestamptz) to anon, authenticated, service_role;


-- ================================================================
-- 3. DAILY_CARE_LOGS — status + photo_url
-- status distinguishes a real caregiver check-in ('completed', the
-- default) from an automated "missed" marker written by log_activity
-- directly (see supabase/functions/send-evening-push). IMPORTANT: no
-- process should ever insert a row into daily_care_logs with
-- status='no_completado' anymore — that placeholder pattern is what
-- caused routines to show as falsely "completed" in /cuidado, since the
-- UI (and Dashboard/useBadgeCounts) treated any row's mere existence as
-- done. send-evening-push now calls log_activity() directly for misses
-- instead of writing here. Any reader of this table must still filter
-- out status='no_completado' as defense in depth.
-- ================================================================
alter table public.daily_care_logs add column if not exists status text not null default 'completed';
alter table public.daily_care_logs add column if not exists photo_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_daily_care_logs_status'
  ) then
    alter table public.daily_care_logs
      add constraint chk_daily_care_logs_status check (status = any (array['completed', 'no_completado']));
  end if;
end $$;


-- ================================================================
-- 4. TRG_CARE_ROUTINE — logs care_routine / care_routine_missed on INSERT
-- Fires only on INSERT (not on UPDATE, e.g. attaching a photo afterwards)
-- so an item is logged exactly once. Kept as defense in depth in case
-- something ever inserts a status='no_completado' row directly again —
-- but send-evening-push no longer does this (see point 3 above).
-- ================================================================
create or replace function public.trg_fn_care_routine()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then return new; end if;

  if coalesce(new.status, 'completed') = 'no_completado' then
    perform public.log_activity(
      'care_routine_missed',
      new.item_key,
      new.user_id,
      'Sistema automático',
      jsonb_build_object('item_key', new.item_key, 'log_date', new.log_date),
      coalesce(new.checked_at, now())
    );
    return new;
  end if;

  perform public.log_activity(
    'care_routine',
    new.item_key,
    new.user_id,
    new.checked_by,
    jsonb_build_object('item_key', new.item_key, 'log_date', new.log_date, 'checked_by', new.checked_by),
    coalesce(new.checked_at, now())
  );
  return new;
end;
$$;

drop trigger if exists trg_care_routine on public.daily_care_logs;
create trigger trg_care_routine
  after insert on public.daily_care_logs
  for each row execute function public.trg_fn_care_routine();
