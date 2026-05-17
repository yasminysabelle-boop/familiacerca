-- Restrict DELETE on shared tables to the record's author or the family owner.
-- Current fix_all_family_rls.sql uses FOR ALL (USING fc_is_member_of(user_id))
-- which lets any family member delete any record. These policies override that
-- for the three tables that track created_by_user_id.

-- ── notes ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (
    -- author of the note
    created_by_user_id = auth.uid()
    OR
    -- family owner (admin)
    user_id = auth.uid()
  );

-- ── events ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_delete" ON public.events;

CREATE POLICY "events_delete" ON public.events
  FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR
    user_id = auth.uid()
  );

-- ── care_expenses ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "care_expenses_delete" ON public.care_expenses;

CREATE POLICY "care_expenses_delete" ON public.care_expenses
  FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR
    user_id = auth.uid()
  );
