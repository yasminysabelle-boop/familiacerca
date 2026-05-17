-- FamiliaCerca — Member roles for the family care group
-- Safe to re-run (uses ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE)
-- Run in Supabase SQL Editor after create_invitations.sql

-- Add role column — new members default to 'familiar' until admin promotes them
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'familiar'
  CHECK (role IN ('familiar', 'cuidador'));

-- RPC: only the family owner (admin) can assign or change member roles
CREATE OR REPLACE FUNCTION public.assign_member_role(
  p_member_user_id uuid,
  p_role           text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('familiar', 'cuidador') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  UPDATE public.family_members
  SET role = p_role
  WHERE user_id          = auth.uid()      -- caller must be the owner
    AND member_user_id   = p_member_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found or you are not authorized to change their role';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_member_role(uuid, text) TO authenticated;
