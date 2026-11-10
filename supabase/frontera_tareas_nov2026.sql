-- Familias en varios países + tareas repartidas (nov 2026)
-- 1. La zona horaria de cada persona (se guarda sola desde el teléfono)
alter table public.user_profiles add column if not exists timezone text;

-- 2. Tareas de la familia (también las que se hacen a distancia)
create table if not exists public.family_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,                 -- dueño del grupo familiar
  title         text not null,
  remote_ok     boolean not null default false, -- se puede hacer desde otro país
  due_date      date,
  assigned_to   uuid,
  assigned_name text,
  done_at       timestamptz,
  done_by       uuid,
  done_by_name  text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
alter table public.family_tasks enable row level security;
drop policy if exists "family_tasks: family group" on public.family_tasks;
create policy "family_tasks: family group"
  on public.family_tasks for all
  using  (auth.uid() = user_id or public.fc_is_member_of(user_id))
  with check (auth.uid() = user_id or public.fc_is_member_of(user_id));
create index if not exists family_tasks_user_idx on public.family_tasks (user_id, done_at);
