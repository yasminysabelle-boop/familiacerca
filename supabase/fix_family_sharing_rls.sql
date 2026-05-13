-- ================================================================
-- FamiliaCerca — Fix family data sharing
-- Replaces all "own user only" RLS policies with family-aware ones.
-- Safe to run multiple times (DROP IF EXISTS before each CREATE).
-- Run this in the Supabase SQL Editor.
-- ================================================================

-- ----------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids RLS recursion)
-- ----------------------------------------------------------------

-- True when the current user is a MEMBER of owner_id's family group.
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

-- True when the two users share the same family group (symmetric).
-- Used for tables where each row's user_id is the individual author,
-- not the family owner (voice_diary, memories).
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


-- ================================================================
-- medications
-- user_id = care-profile owner (family group key)
-- ================================================================
DROP POLICY IF EXISTS "Own medications: all" ON public.medications;
DROP POLICY IF EXISTS "medications: family group"  ON public.medications;

CREATE POLICY "medications: family group"
  ON public.medications FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- medication_logs
-- user_id = care-profile owner (one log per med per day per group)
-- ================================================================
DROP POLICY IF EXISTS "Own medication logs: all" ON public.medication_logs;
DROP POLICY IF EXISTS "medication_logs: family group" ON public.medication_logs;

CREATE POLICY "medication_logs: family group"
  ON public.medication_logs FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- notes
-- user_id = care-profile owner
-- ================================================================
DROP POLICY IF EXISTS "Own notes: all" ON public.notes;
DROP POLICY IF EXISTS "notes: family group" ON public.notes;

CREATE POLICY "notes: family group"
  ON public.notes FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- events
-- user_id = care-profile owner
-- ================================================================
DROP POLICY IF EXISTS "Own events: all" ON public.events;
DROP POLICY IF EXISTS "events: family group" ON public.events;

CREATE POLICY "events: family group"
  ON public.events FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- appointment_proofs
-- user_id = the person who uploaded the proof (any family member)
-- We grant full access to family members of the event's owner.
-- ================================================================
DROP POLICY IF EXISTS "Own appointment proofs: all" ON public.appointment_proofs;
DROP POLICY IF EXISTS "appointment_proofs: family group via event" ON public.appointment_proofs;

CREATE POLICY "appointment_proofs: family group via event"
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

CREATE POLICY "appointment_proofs: own update/delete"
  ON public.appointment_proofs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "appointment_proofs: own delete"
  ON public.appointment_proofs FOR DELETE USING (auth.uid() = user_id);


-- ================================================================
-- voice_diary
-- user_id = the individual recorder (each member stores under own ID)
-- Family members should be able to read each other's recordings.
-- ================================================================
DROP POLICY IF EXISTS "Own voice diary: all" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: family read"       ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own write"         ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own update/delete" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own delete"        ON public.voice_diary;

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
-- care_expenses
-- user_id = care-profile owner (family group key)
-- Members can view AND add expenses; paid_by tracks who paid.
-- ================================================================
DROP POLICY IF EXISTS "care_expenses: owner manage"       ON public.care_expenses;
DROP POLICY IF EXISTS "care_expenses: family member read" ON public.care_expenses;
DROP POLICY IF EXISTS "care_expenses: family group"       ON public.care_expenses;

CREATE POLICY "care_expenses: family group"
  ON public.care_expenses FOR ALL
  USING  (auth.uid() = user_id OR public.fc_is_member_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.fc_is_member_of(user_id));


-- ================================================================
-- user_profiles — extend existing policy to cover last_seen updates
-- (family members already readable via add_family_features.sql)
-- ================================================================
DROP POLICY IF EXISTS "Own profile: update" ON public.user_profiles;

CREATE POLICY "Own profile: update"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);


-- ================================================================
-- Verify: grant EXECUTE so client can call helpers if needed
-- (The functions are SECURITY DEFINER so they run as the owner,
--  but the client must have EXECUTE permission.)
-- ================================================================
GRANT EXECUTE ON FUNCTION public.fc_is_member_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_shares_family(uuid)  TO authenticated;
