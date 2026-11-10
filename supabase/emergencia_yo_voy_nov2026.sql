-- Emergencia completa (nov 2026): quién dice "Yo voy"
create table if not exists public.emergency_responses (
  id         uuid primary key default gen_random_uuid(),
  alert_id   uuid not null,
  owner_id   uuid not null,
  user_id    uuid not null default auth.uid(),
  name       text,
  created_at timestamptz not null default now(),
  unique (alert_id, user_id)
);
alter table public.emergency_responses enable row level security;
drop policy if exists "emergency_responses: family group" on public.emergency_responses;
create policy "emergency_responses: family group"
  on public.emergency_responses for all
  using  (auth.uid() = owner_id or public.fc_is_member_of(owner_id))
  with check (auth.uid() = owner_id or public.fc_is_member_of(owner_id));
