-- ================================================================
-- FamiliaCerca — Chat: marca de última lectura por usuario
-- Run in Supabase SQL Editor (safe to re-run)
--
-- Guarda cuándo cada usuario visitó por última vez el chat de una familia
-- (owner_id = paciente/familia). Se usa para "Ponte al día": al montar el
-- chat se lee el valor viejo (límite de la consulta de mensajes nuevos) y
-- luego se hace upsert con now().
--
-- A diferencia de chat_messages (compartido, visible para toda la
-- familia), esta marca es estrictamente personal — no hay razón de
-- producto para que un familiar vea cuándo otro leyó el chat por última
-- vez — así que la RLS se limita a "cada quien ve y escribe solo su
-- propia fila", sin el patrón family-wide de chat_messages.
-- ================================================================

create table if not exists public.chat_reads (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, owner_id)
);

alter table public.chat_reads enable row level security;

drop policy if exists "chat_reads: own row only" on public.chat_reads;
create policy "chat_reads: own row only"
  on public.chat_reads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_chat_reads_owner on public.chat_reads(owner_id);
