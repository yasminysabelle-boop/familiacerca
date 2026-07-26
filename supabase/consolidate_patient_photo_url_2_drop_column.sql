-- ================================================================
-- FamiliaCerca — consolidar patient_profiles.foto_url -> photo_url (2/2)
-- Run in Supabase SQL Editor — SOLO después de confirmar que el código
-- que escribe foto_url (OnboardingFlow.jsx) ya está en producción
-- corregido y verificado. Dropear esta columna mientras producción
-- todavía escribe foto_url rompe el onboarding en vivo.
--
-- El backfill (paso 1) ya corrió en producción el 2026-07-26: las 3
-- filas que tenían foto_url ahora también tienen photo_url con el
-- mismo valor. Verificación (0 filas esperadas):
--   select id, owner_id, foto_url, photo_url from public.patient_profiles
--   where foto_url is not null and foto_url <> ''
--     and (photo_url is null or photo_url <> foto_url);
-- ================================================================

alter table public.patient_profiles drop column if exists foto_url;
