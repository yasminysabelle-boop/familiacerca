-- ================================================================
-- Fix: allow invited members to read their family data.
--
-- Run this once in the Supabase SQL Editor.
-- ================================================================

-- 1. Let invited members read their own row in family_members
--    (without this the FamilyContext query returns null and they
--     see their own empty family instead of the invited one).
DROP POLICY IF EXISTS "family_members: member can read own" ON public.family_members;
CREATE POLICY "family_members: member can read own"
  ON public.family_members FOR SELECT
  USING (auth.uid() = member_user_id);

-- 2. Let members read the care profile they have been invited to help with.
--    Also keeps the existing owner-only access.
DROP POLICY IF EXISTS "care_profiles: member can read owner profile" ON public.care_profiles;
CREATE POLICY "care_profiles: member can read owner profile"
  ON public.care_profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.user_id = public.care_profiles.user_id
        AND fm.member_user_id = auth.uid()
    )
  );
