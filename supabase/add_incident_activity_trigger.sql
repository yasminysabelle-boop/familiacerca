-- ================================================================
-- FamiliaCerca — incidents → activity_log
-- Run in Supabase SQL Editor (safe to re-run)
--
-- Conecta la tabla incidents (caídas, fiebre, presión alta, agresividad,
-- desorientación...) al feed de actividad, siguiendo el mismo patrón que
-- trg_fn_care_routine / trg_fn_sos / trg_fn_expense (ver
-- add_care_routine_status_and_activity_log.sql). Antes de esto, un
-- incidente registrado en /incidentes no aparecía ni en el historial de
-- actividad ("Ver todo") ni en el contexto que usa el chat de Milo/Luna.
--
-- description guarda la clave cruda del tipo (p.ej. 'caida'), igual que
-- daily_care_logs guarda item_key: el cliente resuelve la etiqueta legible
-- con incidentTypeInfo() (src/lib/incidentTypes.js).
-- ================================================================

create or replace function public.trg_fn_incident()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(
    'incident',
    new.type,
    new.owner_id,
    null,
    jsonb_build_object(
      'type',        new.type,
      'description', new.description,
      'photo_url',   new.photo_url
    ),
    coalesce(new.recorded_at, now())
  );
  return new;
end;
$$;

drop trigger if exists trg_incident on public.incidents;
create trigger trg_incident
  after insert on public.incidents
  for each row execute function public.trg_fn_incident();
