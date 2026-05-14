-- ================================================================
-- FamiliaCerca — Directory tables
-- Safe to re-run (uses IF NOT EXISTS + OR REPLACE)
-- ================================================================

-- ── Doctors ───────────────────────────────────────────────────────
create table if not exists public.directory_doctors (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  specialty  text,
  phone      text,
  email      text,
  clinic     text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.directory_doctors enable row level security;

create policy "directory_doctors: read family group"
  on public.directory_doctors for select
  using (
    auth.uid() = owner_id or
    auth.uid() in (
      select member_user_id from public.family_members where user_id = owner_id
    )
  );
create policy "directory_doctors: write owner"
  on public.directory_doctors for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists idx_dir_doctors_owner on public.directory_doctors(owner_id);


-- ── Institutions ──────────────────────────────────────────────────
create table if not exists public.directory_institutions (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  type            text        check (type in ('Hospital','Clínica','Consultorio','Laboratorio','Farmacia','Otro')),
  address         text,
  phone           text,
  emergency_phone text,
  website         text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.directory_institutions enable row level security;

create policy "directory_institutions: read family group"
  on public.directory_institutions for select
  using (
    auth.uid() = owner_id or
    auth.uid() in (
      select member_user_id from public.family_members where user_id = owner_id
    )
  );
create policy "directory_institutions: write owner"
  on public.directory_institutions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists idx_dir_institutions_owner on public.directory_institutions(owner_id);


-- ── Family contacts ───────────────────────────────────────────────
create table if not exists public.directory_contacts (
  id                   uuid        primary key default gen_random_uuid(),
  owner_id             uuid        not null references auth.users(id) on delete cascade,
  name                 text        not null,
  relationship         text,
  phone                text,
  email                text,
  address              text,
  is_emergency_contact boolean     not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.directory_contacts enable row level security;

create policy "directory_contacts: read family group"
  on public.directory_contacts for select
  using (
    auth.uid() = owner_id or
    auth.uid() in (
      select member_user_id from public.family_members where user_id = owner_id
    )
  );
create policy "directory_contacts: write owner"
  on public.directory_contacts for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists idx_dir_contacts_owner on public.directory_contacts(owner_id);


-- ── Auto-touch updated_at ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'dir_doctors_updated_at') then
    create trigger dir_doctors_updated_at before update on public.directory_doctors
      for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'dir_institutions_updated_at') then
    create trigger dir_institutions_updated_at before update on public.directory_institutions
      for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'dir_contacts_updated_at') then
    create trigger dir_contacts_updated_at before update on public.directory_contacts
      for each row execute procedure public.touch_updated_at();
  end if;
end $$;
