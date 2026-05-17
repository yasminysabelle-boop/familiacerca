-- Track who added each medication so caregivers can edit/delete their own entries.
-- Also tighten DELETE to admin or the specific cuidador who created it.

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

-- ── RLS: split the FOR ALL policy into granular policies ──────────────
-- The existing "medications: family group" FOR ALL let any family member
-- delete any medication. Replace it with separate SELECT/INSERT/UPDATE
-- (all family members) and DELETE (admin or creator only).

DROP POLICY IF EXISTS "medications: family group" ON public.medications;

CREATE POLICY "medications: select"
  ON public.medications FOR SELECT
  USING (auth.uid() = user_id OR public.fc_is_member_of(user_id));

CREATE POLICY "medications: insert"
  ON public.medications FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));

CREATE POLICY "medications: update"
  ON public.medications FOR UPDATE
  USING (
    auth.uid() = user_id                    -- admin/owner
    OR created_by_user_id = auth.uid()      -- cuidador who added it
  );

CREATE POLICY "medications: delete"
  ON public.medications FOR DELETE
  USING (
    auth.uid() = user_id                    -- admin/owner
    OR created_by_user_id = auth.uid()      -- cuidador who added it
  );
