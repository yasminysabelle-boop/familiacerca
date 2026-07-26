-- ================================================================
-- FamiliaCerca — consolidar patient_profiles.foto_url -> photo_url (1/2)
-- Ya ejecutado en producción el 2026-07-26 vía `supabase db query --linked`.
-- Se deja versionado como registro — safe to re-run (idempotente).
--
-- foto_url y photo_url coexistían para la misma foto del paciente.
-- photo_url pasa a ser la única columna. Este paso solo copia datos,
-- no borra nada. Ver consolidate_patient_photo_url_2_drop_column.sql
-- para el paso irreversible (todavía sin correr).
-- ================================================================

update public.patient_profiles
set photo_url = foto_url
where (photo_url is null or photo_url = '')
  and foto_url is not null
  and foto_url <> '';

-- Verificación manual — debe devolver 0 filas antes de correr el paso 2:
select id, owner_id, foto_url, photo_url
from public.patient_profiles
where foto_url is not null and foto_url <> ''
  and (photo_url is null or photo_url <> foto_url);
