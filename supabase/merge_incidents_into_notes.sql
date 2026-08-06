-- ================================================================
-- FamiliaCerca — fusiona Incidentes dentro de Notas
-- Run in Supabase SQL Editor (safe to re-run)
--
-- Incidentes vivía en su propia tabla/pantalla (/incidentes), sin enlace
-- en ningún menú y con 0 filas reales (confirmado 2026-08-06). Se fusiona
-- dentro de notes como un toggle "es un evento agudo" + subtipo, reusando
-- los mismos 8 valores de src/lib/incidentTypes.js. El trigger que
-- alimentaba activity_log (type='incident', ver add_incident_activity_trigger.sql)
-- se reapunta de incidents a notes, condicionado a is_incident=true, para
-- no tocar el estilo visual ya implementado en el Historial
-- (MedicationTimeline.jsx) ni la prioridad ALTA que le da activitySummary.js.
-- ================================================================

alter table public.notes add column if not exists is_incident  boolean not null default false;
alter table public.notes add column if not exists incident_type text;
alter table public.notes add column if not exists photo_url     text;

-- Defensa en profundidad: log_activity() traga cualquier excepción (nunca
-- rompe el insert principal), así que sin esto un is_incident=true sin
-- subtipo simplemente fallaría en silencio al loguear a activity_log.
alter table public.notes drop constraint if exists chk_notes_incident_type;
alter table public.notes add constraint chk_notes_incident_type
  check (not is_incident or incident_type is not null);

create or replace function public.trg_fn_notes_incident()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_incident then
    perform public.log_activity(
      'incident',
      new.incident_type,
      new.user_id,
      null,
      jsonb_build_object(
        'type',        new.incident_type,
        'description', new.content,
        'photo_url',   new.photo_url
      ),
      coalesce(new.created_at, now())
    );
  end if;
  return new;
end;
$$;

-- Solo en INSERT (igual que trg_incident original): una nota se loguea al
-- crearse, no si se edita después para marcarla como incidente.
drop trigger if exists trg_notes_incident on public.notes;
create trigger trg_notes_incident
  after insert on public.notes
  for each row execute function public.trg_fn_notes_incident();


-- ================================================================
-- Desmontaje de incidents — sin datos que migrar (0 filas confirmado).
-- "drop trigger ... on public.incidents" exige que la tabla exista aunque
-- el trigger tenga "if exists", así que el guard va sobre la tabla misma
-- para que este archivo siga siendo seguro de re-correr una vez borrada.
-- ================================================================
do $$
begin
  if to_regclass('public.incidents') is not null then
    drop trigger if exists trg_incident on public.incidents;
  end if;
end $$;
drop function if exists public.trg_fn_incident();
drop table if exists public.incidents;


-- ================================================================
-- trg_fn_note — DOCUMENTA estado que ya existía en producción sin
-- versionar en el repo (mismo patrón que add_care_routine_status_and_
-- activity_log.sql para activity_log/log_activity): todo insert en
-- notes ya logueaba a activity_log con type='doctor_note'. Verificado
-- en vivo durante la implementación de este merge (Playwright): una
-- nota marcada is_incident=true generaba DOS entradas (doctor_note +
-- incident) para el mismo evento, diluyendo el resaltado visual que
-- es justamente el punto de la fusión. Se agrega el guard
-- "and not new.is_incident" para que una nota-incidente solo produzca
-- la entrada 'incident'; una nota normal sigue logueando 'doctor_note'
-- exactamente igual que antes.
-- ================================================================
create or replace function public.trg_fn_note()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_incident then
    perform public.log_activity(
      'doctor_note',
      coalesce(new.title, left(coalesce(new.content,''), 60), 'Nota registrada'),
      new.user_id,
      null,
      jsonb_build_object(
        'note_id', new.id,
        'title',   new.title,
        'content', left(coalesce(new.content,''), 250)
      ),
      new.created_at
    );
  end if;
  return new;
end;
$$;
