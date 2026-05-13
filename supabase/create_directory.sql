-- ================================================================
-- FamiliaCerca — Directorio de Contactos
-- Run in the Supabase SQL Editor
-- ================================================================

-- Treating physicians
CREATE TABLE IF NOT EXISTS public.doctors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  specialty  text,
  phone      text,
  email      text,
  clinic     text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own doctors: all"
  ON public.doctors FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_doctors_user ON public.doctors(user_id);


-- Family and emergency contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  relationship         text,
  phone                text,
  email                text,
  address              text,
  is_emergency_contact boolean     NOT NULL DEFAULT false,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own contacts: all"
  ON public.contacts FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_user    ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_emergency ON public.contacts(user_id, is_emergency_contact);
