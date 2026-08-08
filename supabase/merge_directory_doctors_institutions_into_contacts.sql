-- ================================================================
-- FamiliaCerca — fusiona directory_doctors + directory_institutions
-- dentro de directory_contacts (categoría `kind`, no tablas separadas)
--
-- directory_doctors y directory_institutions vivían aisladas de
-- directory_contacts (pestañas "Médicos"/"Lugares" vs. "Familia"), sin
-- uso real (0 filas confirmadas 2026-08-08 en las 3 tablas). Se
-- consolidan en una sola tabla con un campo `kind`, mismo criterio que
-- Incidentes→Notas y appointment_proofs→events.
--
-- De paso corrige el mismo hueco de RLS que ya encontramos en
-- care_profiles y events: ninguna de las 3 tablas tenía política de
-- escritura para `cuidador` (solo el dueño literal), a pesar de que
-- Directory.jsx no gateaba los botones "Agregar" por rol — cualquier
-- miembro veía el botón y el insert fallaba silencioso por RLS.
-- ================================================================

-- 1. Columnas nuevas en directory_contacts
alter table public.directory_contacts add column if not exists kind text not null default 'familiar';
alter table public.directory_contacts drop constraint if exists chk_directory_contacts_kind;
alter table public.directory_contacts add constraint chk_directory_contacts_kind
  check (kind in ('familiar', 'medico', 'institucion'));

-- de directory_doctors
alter table public.directory_contacts add column if not exists specialty  text;
alter table public.directory_contacts add column if not exists clinic     text;
alter table public.directory_contacts add column if not exists is_primary boolean;
alter table public.directory_contacts add column if not exists cellphone  text;

-- de directory_institutions
alter table public.directory_contacts add column if not exists type            text;
alter table public.directory_contacts add column if not exists hours           text;
alter table public.directory_contacts add column if not exists emergency_phone text;
alter table public.directory_contacts add column if not exists website         text;

-- 2. Backfill (no-op hoy — 0 filas en directory_doctors/directory_institutions,
--    confirmado 2026-08-08). Documentado por si algún otro ambiente tiene datos.
insert into public.directory_contacts
  (owner_id, name, kind, specialty, clinic, is_primary, cellphone, phone, email, notes, created_at, updated_at)
select owner_id, name, 'medico', specialty, clinic, is_primary, cellphone, phone, email, notes, created_at, updated_at
from public.directory_doctors;

insert into public.directory_contacts
  (owner_id, name, kind, type, hours, emergency_phone, website, address, phone, email, notes, created_at, updated_at)
select owner_id, name, 'institucion', type, hours, emergency_phone, website, address, phone, email, notes, created_at, updated_at
from public.directory_institutions;

-- Verificación manual — conteo de filas migradas (debe ser 0 hoy):
-- select kind, count(*) from public.directory_contacts where kind != 'familiar' group by kind;

-- 3. RLS: política de escritura para cuidador (espejo de events/care_profiles)
drop policy if exists "directory_contacts: cuidador write" on public.directory_contacts;
create policy "directory_contacts: cuidador write"
  on public.directory_contacts for all
  using (
    exists (select 1 from family_members fm
            where fm.user_id = directory_contacts.owner_id
              and fm.member_user_id = auth.uid()
              and fm.role = 'cuidador')
  )
  with check (
    exists (select 1 from family_members fm
            where fm.user_id = directory_contacts.owner_id
              and fm.member_user_id = auth.uid()
              and fm.role = 'cuidador')
  );

-- 4. events.contact_id — vincula una cita a un contacto médico ya guardado
alter table public.events add column if not exists contact_id uuid references public.directory_contacts(id) on delete set null;

-- ================================================================
-- Desmontaje de directory_doctors / directory_institutions — ejecutado
-- en producción 2026-08-08, confirmado 0 filas antes y después de las
-- pruebas de Playwright (ver commit fd29235).
-- ================================================================
drop table if exists public.directory_doctors;
drop table if exists public.directory_institutions;
