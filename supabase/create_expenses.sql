-- ================================================================
-- FamiliaCerca — Care expenses (Cuentas Claras)
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================

drop table if exists public.care_expenses cascade;

create table public.care_expenses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  amount            numeric(10,2) not null check (amount > 0),
  category          text not null check (category in (
                      'Medicamentos', 'Citas médicas', 'Transporte',
                      'Cuidador', 'Equipos médicos', 'Otros'
                    )),
  description       text,
  paid_by           text not null,
  date              date not null default current_date,
  receipt_photo_url text,
  created_at        timestamptz not null default now()
);

alter table public.care_expenses enable row level security;

-- Owner can insert, update, delete and read their own expenses
create policy "care_expenses: owner manage"
  on public.care_expenses for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Family members (accepted invitations) can view but not modify
create policy "care_expenses: family member read"
  on public.care_expenses for select
  using (
    exists (
      select 1 from public.family_members fm
      where fm.user_id        = care_expenses.user_id
        and fm.member_user_id = auth.uid()
    )
  );
