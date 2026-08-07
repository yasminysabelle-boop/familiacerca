-- ================================================================
-- FamiliaCerca — fusiona appointment_proofs dentro de events
-- Ya ejecutado en producción el 2026-08-08 vía `supabase db query --linked`,
-- incluido el DROP final (paso 3) — se deja versionado como registro.
--
-- appointment_proofs vivía como tabla aparte (una fila por persona que
-- confirma asistencia a una cita, event_id+user_id único) pero en la
-- práctica Calendar.jsx siempre la trató como 1:1 con la cita (arma un
-- mapa {event_id: proof} que se pisa si hay más de una fila). Confirmado
-- 2026-08-08: 0 filas reales en producción — no hace falta backfill de
-- datos, pero se deja documentado el paso 1 por si algún otro ambiente
-- (staging, otro proyecto) sí tiene filas.
--
-- No confundir con events.attachments (array ya existente) — eso es para
-- adjuntos genéricos al crear/editar la cita (documentos del médico),
-- mecanismo totalmente separado que no se toca acá.
-- ================================================================

-- 1. Columnas nuevas en events
alter table public.events add column if not exists proof_photo_url text;
alter table public.events add column if not exists proof_notes     text;
alter table public.events add column if not exists attended        boolean not null default false;
alter table public.events add column if not exists proof_created_by uuid references auth.users(id) on delete set null;

-- 2. Backfill (no-op hoy — 0 filas en appointment_proofs, confirmado
--    2026-08-08). Si event_id tuviera más de una fila de prueba, se queda
--    con la más reciente (created_at desc) — mismo criterio "última gana"
--    que ya usaba el mapa de Calendar.jsx.
update public.events e
set
  proof_photo_url  = ap.photo_url,
  proof_notes       = ap.notes,
  attended          = ap.attended,
  proof_created_by  = ap.user_id
from (
  select distinct on (event_id)
    event_id, photo_url, notes, attended, user_id
  from public.appointment_proofs
  order by event_id, created_at desc
) ap
where e.id = ap.event_id;

-- Verificación manual — conteo de filas migradas (debe ser 0 hoy):
-- select count(*) from public.events where attended = true;

-- 3. Drop de la tabla vieja — confirmado 0 filas antes de correr esto.
drop table if exists public.appointment_proofs;
