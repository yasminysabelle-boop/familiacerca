-- Add owner_id to chat_messages so messages are scoped per family
-- Required by Chat.jsx which filters/inserts by owner_id

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- Index for fast per-family queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_owner_id
  ON public.chat_messages (owner_id, created_at DESC);

-- Backfill existing rows using the sender's user_id as a best approximation
-- (messages without an owner will be orphaned; acceptable for legacy data)
UPDATE public.chat_messages
  SET owner_id = user_id
  WHERE owner_id IS NULL;
