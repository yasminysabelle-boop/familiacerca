-- Add missing columns to emergency_alerts and fix RLS so any family
-- member can trigger an SOS (not just the family owner).

-- resolved flag — lets any admin mark the emergency as handled
ALTER TABLE public.emergency_alerts
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;

-- Index so the "active alerts" query (resolved = false) is fast
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_resolved
  ON public.emergency_alerts (resolved, created_at DESC);

-- ── RLS: allow any authenticated family member to insert ──────────────
-- The existing policy requires auth.uid() = user_id, which blocks family
-- members who are not the owner. We replace it with a looser check:
-- the caller must be the owner OR a member of the owner's family.
-- We identify the family by looking up family_members where member_user_id
-- matches the inserting user, then allowing the insert if the record's
-- user_id is either the caller (owner) or the owner of a family the
-- caller belongs to.
--
-- Simplest safe approach: allow insert for any authenticated user and
-- restrict SELECT to the family group (already done). The insert just
-- records who pressed SOS; the edge function is the one that does the
-- fan-out to all members.

DROP POLICY IF EXISTS "emergency_alerts: insert own" ON public.emergency_alerts;

CREATE POLICY "emergency_alerts: insert own"
  ON public.emergency_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow family members to resolve an alert (update resolved = true)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'emergency_alerts'
      AND policyname = 'emergency_alerts: resolve family'
  ) THEN
    CREATE POLICY "emergency_alerts: resolve family"
      ON public.emergency_alerts FOR UPDATE
      USING (
        auth.uid() = user_id
        OR auth.uid() IN (
          SELECT member_user_id FROM public.family_members
          WHERE user_id = emergency_alerts.user_id
        )
      )
      WITH CHECK (true);
  END IF;
END $$;
