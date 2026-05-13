-- ================================================================
-- FamiliaCerca — Complete family data sharing RLS fix
-- Run this entire file in the Supabase SQL Editor.
-- Safe to re-run multiple times.
-- ================================================================

-- ----------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — avoids RLS recursion)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fc_is_member_of(owner_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE user_id = owner_id
      AND member_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.fc_shares_family(other_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT other_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM family_members
    WHERE (user_id = auth.uid() AND member_user_id = other_id)
       OR (member_user_id = auth.uid() AND user_id = other_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.fc_is_member_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_shares_family(uuid)  TO authenticated;


-- ================================================================
-- user_profiles — family members can see each other
-- ================================================================
DROP POLICY IF EXISTS "Profiles: visible to family group members" ON public.user_profiles;

CREATE POLICY "Profiles: visible to family group members"
  ON public.user_profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE (fm.user_id = auth.uid() AND fm.member_user_id = user_profiles.id)
         OR (fm.member_user_id = auth.uid() AND fm.user_id = user_profiles.id)
    )
  );

DROP POLICY IF EXISTS "Own profile: update" ON public.user_profiles;
CREATE POLICY "Own profile: update"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);


-- ================================================================
-- care_profiles — invited members can read the care profile
-- ================================================================
DROP POLICY IF EXISTS "Care profiles: visible to invited members" ON public.care_profiles;

CREATE POLICY "Care profiles: visible to invited members"
  ON public.care_profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.user_id = care_profiles.user_id
        AND fm.member_user_id = auth.uid()
    )
  );


-- ================================================================
-- medications — family group can read and confirm
-- ================================================================
DROP POLICY IF EXISTS "Own medications: all" ON public.medications;
DROP POLICY IF EXISTS "medications: family group" ON public.medications;

CREATE POLICY "medications: family group"
  ON public.medications FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- medication_logs — shared under owner's user_id as group key
-- ================================================================
DROP POLICY IF EXISTS "Own medication logs: all" ON public.medication_logs;
DROP POLICY IF EXISTS "medication_logs: family group" ON public.medication_logs;

CREATE POLICY "medication_logs: family group"
  ON public.medication_logs FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- events (calendar) — family group
-- ================================================================
DROP POLICY IF EXISTS "Own events: all" ON public.events;
DROP POLICY IF EXISTS "events: family group" ON public.events;

CREATE POLICY "events: family group"
  ON public.events FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- appointment_proofs — family group can view; individual can insert
-- ================================================================
DROP POLICY IF EXISTS "Own appointment proofs: all" ON public.appointment_proofs;
DROP POLICY IF EXISTS "appointment_proofs: family group via event" ON public.appointment_proofs;
DROP POLICY IF EXISTS "appointment_proofs: family group insert" ON public.appointment_proofs;
DROP POLICY IF EXISTS "appointment_proofs: own update/delete" ON public.appointment_proofs;
DROP POLICY IF EXISTS "appointment_proofs: own delete" ON public.appointment_proofs;

CREATE POLICY "appointment_proofs: family group select"
  ON public.appointment_proofs FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = appointment_proofs.event_id
        AND (e.user_id = auth.uid() OR public.fc_is_member_of(e.user_id))
    )
  );

CREATE POLICY "appointment_proofs: family group insert"
  ON public.appointment_proofs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.fc_is_member_of(e.user_id)
    )
  );

CREATE POLICY "appointment_proofs: own update"
  ON public.appointment_proofs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "appointment_proofs: own delete"
  ON public.appointment_proofs FOR DELETE USING (auth.uid() = user_id);


-- ================================================================
-- notes — family group
-- ================================================================
DROP POLICY IF EXISTS "Own notes: all" ON public.notes;
DROP POLICY IF EXISTS "notes: family group" ON public.notes;

CREATE POLICY "notes: family group"
  ON public.notes FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- voice_diary — family members can read each other's recordings
-- ================================================================
DROP POLICY IF EXISTS "Own voice diary: all" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: family read" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own insert" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own update" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own delete" ON public.voice_diary;

CREATE POLICY "voice_diary: family read"
  ON public.voice_diary FOR SELECT
  USING (public.fc_shares_family(user_id));

CREATE POLICY "voice_diary: own insert"
  ON public.voice_diary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "voice_diary: own update"
  ON public.voice_diary FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "voice_diary: own delete"
  ON public.voice_diary FOR DELETE
  USING (auth.uid() = user_id);


-- ================================================================
-- care_expenses — shared under owner's user_id as group key
-- ================================================================
DROP POLICY IF EXISTS "care_expenses: owner manage" ON public.care_expenses;
DROP POLICY IF EXISTS "care_expenses: family member read" ON public.care_expenses;
DROP POLICY IF EXISTS "care_expenses: family group" ON public.care_expenses;

CREATE POLICY "care_expenses: family group"
  ON public.care_expenses FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- memories (photo album) — shared among family group
-- ================================================================
DROP POLICY IF EXISTS "Memories: authenticated can read" ON public.memories;
DROP POLICY IF EXISTS "Memories: authenticated can insert" ON public.memories;
DROP POLICY IF EXISTS "Memories: own can update (reactions)" ON public.memories;
DROP POLICY IF EXISTS "Memories: own can delete" ON public.memories;
DROP POLICY IF EXISTS "memories: family read" ON public.memories;
DROP POLICY IF EXISTS "memories: own insert" ON public.memories;
DROP POLICY IF EXISTS "memories: own update" ON public.memories;
DROP POLICY IF EXISTS "memories: own delete" ON public.memories;

CREATE POLICY "memories: family read"
  ON public.memories FOR SELECT
  USING (public.fc_shares_family(user_id));

CREATE POLICY "memories: own insert"
  ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "memories: own update"
  ON public.memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "memories: own delete"
  ON public.memories FOR DELETE
  USING (auth.uid() = user_id);
