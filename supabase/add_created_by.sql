-- FamiliaCerca — Track who created each shared record
-- Safe to re-run (ADD COLUMN IF NOT EXISTS)
-- Enables "only author or admin can edit/delete" permission checks.

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.care_expenses
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);
