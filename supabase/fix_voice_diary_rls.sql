-- Fix voice_diary RLS so all family members can read each other's recordings.
-- Safe to re-run.

-- fc_shares_family: true if other_id is the current user OR shares a family group.
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

GRANT EXECUTE ON FUNCTION public.fc_shares_family(uuid) TO authenticated;

-- Replace the old single-user policy with family-aware ones.
DROP POLICY IF EXISTS "Own voice diary: all"    ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: family read" ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own insert"  ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own update"  ON public.voice_diary;
DROP POLICY IF EXISTS "voice_diary: own delete"  ON public.voice_diary;

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
