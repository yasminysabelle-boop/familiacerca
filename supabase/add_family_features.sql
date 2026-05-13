-- ================================================================
-- FamiliaCerca — Family presence & member visibility
-- Run in Supabase SQL Editor after create_invitations.sql
-- ================================================================

-- Online presence: track when users were last active
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Allow family owners to see their invited members' profiles,
-- and allow invited members to see the owner's profile.
-- (The existing "Own profile: select" policy covers self-reads.)
CREATE POLICY "Profiles: visible to family group members"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE (fm.user_id = auth.uid() AND fm.member_user_id = user_profiles.id)
         OR (fm.member_user_id = auth.uid() AND fm.user_id = user_profiles.id)
    )
  );

-- Allow invited members to read the care profile of the family they joined.
-- The existing "Own care profile: all" policy still covers the owner's access.
CREATE POLICY "Care profiles: visible to invited members"
  ON public.care_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.user_id = care_profiles.user_id
        AND fm.member_user_id = auth.uid()
    )
  );
