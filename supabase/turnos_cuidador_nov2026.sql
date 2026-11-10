-- Turnos del cuidador (nov 2026): quien cuida (pagado o de la familia) marca
-- "Llegué" y "Me voy". La familia ve las horas de la semana sin preguntar.
create table if not exists public.caregiver_shifts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,                     -- dueño del grupo familiar
  caregiver_id    uuid not null default auth.uid(),
  caregiver_name  text,
  check_in_at     timestamptz not null default now(),
  check_out_at    timestamptz,
  in_lat          double precision,
  in_lng          double precision,
  in_address      text,
  out_note        text,
  created_at      timestamptz not null default now()
);
alter table public.caregiver_shifts enable row level security;
drop policy if exists "caregiver_shifts: family read" on public.caregiver_shifts;
create policy "caregiver_shifts: family read"
  on public.caregiver_shifts for select
  using (auth.uid() = user_id or public.fc_is_member_of(user_id));
drop policy if exists "caregiver_shifts: own insert" on public.caregiver_shifts;
create policy "caregiver_shifts: own insert"
  on public.caregiver_shifts for insert
  with check (caregiver_id = auth.uid() and (auth.uid() = user_id or public.fc_is_member_of(user_id)));
drop policy if exists "caregiver_shifts: own update" on public.caregiver_shifts;
create policy "caregiver_shifts: own update"
  on public.caregiver_shifts for update
  using (caregiver_id = auth.uid() or auth.uid() = user_id)
  with check (caregiver_id = auth.uid() or auth.uid() = user_id);
create index if not exists caregiver_shifts_user_idx on public.caregiver_shifts (user_id, check_in_at desc);
