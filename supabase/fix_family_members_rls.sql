-- ================================================================
-- Fix: allow invited members to read their own family_members row.
--
-- The base schema only allowed the family OWNER to read this table
-- (auth.uid() = user_id). Invited members (auth.uid() = member_user_id)
-- were blocked, so FamilyContext could never detect their membership
-- and always fell back to the "owner" view.
-- ================================================================

-- Allow invited members to read the rows where they are the member
DROP POLICY IF EXISTS "family_members: member can read own" ON public.family_members;
CREATE POLICY "family_members: member can read own"
  ON public.family_members FOR SELECT
  USING (auth.uid() = member_user_id);
