-- ================================================================
-- FamiliaCerca — foto del paciente: RLS de cuidador + escritura atómica
-- Ya ejecutado en producción el 2026-08-07 vía `supabase db query --linked`.
-- Se deja versionado como registro — safe to re-run (idempotente).
--
-- Causa raíz del bug reportado ("no es inmediato" / "a veces no cambia" /
-- "a veces se ven dos fotos"): patient_profiles.photo_url y
-- care_profiles.photo_url son dos copias de la misma foto, escritas en dos
-- pasos separados por uploadPatientPhoto() (src/lib/patientPhoto.js). Si el
-- segundo paso fallaba, las tablas quedaban divergentes para siempre — sin
-- reintento ni forma de detectarlo. Confirmado en datos reales: un paciente
-- en producción tenía patient_profiles.photo_url con la foto correcta y
-- care_profiles.photo_url en null.
--
-- Causa concreta del fallo del segundo paso: care_profiles solo tenía UNA
-- política RLS ("care_profiles: owner all", auth.uid() = user_id) — ningún
-- cuidador podía escribir ahí, aunque la UI (PatientProfile.jsx,
-- Directory.jsx: canEdit = memberRole === null || memberRole === 'cuidador')
-- sí los deja subir la foto. patient_profiles sí tenía política para
-- cuidador (patient_profiles_update); care_profiles no.
-- ================================================================

-- 1. RLS: cuidador puede actualizar care_profiles (espejo exacto de
--    patient_profiles_update, mismo criterio de autorización que ya usa
--    el resto de la app). Solo UPDATE — el row de care_profiles siempre
--    existe antes de que un cuidador pueda hacer nada (se crea en el
--    onboarding del dueño).
drop policy if exists "care_profiles: cuidador update" on public.care_profiles;
create policy "care_profiles: cuidador update"
  on public.care_profiles for update
  using (
    exists (select 1 from family_members fm
            where fm.user_id = care_profiles.user_id
              and fm.member_user_id = auth.uid()
              and fm.role = 'cuidador')
  )
  with check (
    exists (select 1 from family_members fm
            where fm.user_id = care_profiles.user_id
              and fm.member_user_id = auth.uid()
              and fm.role = 'cuidador')
  );

-- 2. Escritura atómica de las dos tablas — antes eran dos update/upsert
--    separados desde el cliente (podían quedar a mitad de camino). Ahora
--    es una sola función, una sola transacción: las dos escrituras se
--    comitean juntas o ninguna. A propósito SIN `security definer` — corre
--    con los permisos del que llama, sigue respetando el RLS de ambas
--    tablas (incluida la política nueva de arriba). El valor de esto es
--    atomicidad, no saltarse permisos.
create or replace function public.update_patient_photo(p_owner_id uuid, p_photo_url text)
returns void language plpgsql as $$
begin
  update patient_profiles set photo_url = p_photo_url where owner_id = p_owner_id;
  update care_profiles     set photo_url = p_photo_url where user_id  = p_owner_id;
end;
$$;

grant execute on function public.update_patient_photo(uuid, text) to authenticated;
