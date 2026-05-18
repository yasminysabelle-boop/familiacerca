-- Ensure owner_id column exists on chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- Index for efficient per-family queries and realtime filter
CREATE INDEX IF NOT EXISTS idx_chat_messages_owner_id
  ON public.chat_messages (owner_id, created_at DESC);

-- Backfill: rows without owner_id get their own user_id as owner
UPDATE public.chat_messages
  SET owner_id = user_id
  WHERE owner_id IS NULL;

-- Drop overly broad policies
DROP POLICY IF EXISTS "Chat: authenticated can read" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat: authenticated can insert" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat: own messages can delete" ON public.chat_messages;

-- Family-scoped SELECT: members can only read their family's messages
CREATE POLICY "Chat: family members can read"
  ON public.chat_messages FOR SELECT
  USING (fc_is_member_of(owner_id));

-- Family-scoped INSERT: sender must belong to the target family
CREATE POLICY "Chat: family members can insert"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND fc_is_member_of(owner_id)
  );

-- DELETE: only the message author
CREATE POLICY "Chat: own messages can delete"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Ensure realtime is enabled for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
