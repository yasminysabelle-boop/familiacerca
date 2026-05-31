-- Stock por medicamento y historial de renovaciones
-- Aplicado: 2026-05-31

CREATE TABLE IF NOT EXISTS medication_stock (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id          uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL,
  total_pills            integer NOT NULL DEFAULT 0,
  pills_remaining        integer NOT NULL DEFAULT 0,
  doses_per_day          numeric(6,3) NOT NULL DEFAULT 1,
  start_date             date NOT NULL DEFAULT CURRENT_DATE,
  estimated_end_date     date,
  renewal_method         text CHECK (renewal_method IN ('pharmacy','mail','prescription','manual')),
  pharmacy_name          text,
  refills_remaining      integer,
  last_mail_date         date,
  box_photo_url          text,
  prescription_photo_url text,
  alert_7_sent           boolean NOT NULL DEFAULT false,
  alert_3_sent           boolean NOT NULL DEFAULT false,
  alert_1_sent           boolean NOT NULL DEFAULT false,
  needs_renewal_ack      boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(medication_id, user_id)
);

CREATE TABLE IF NOT EXISTS medication_renewals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id   uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  renewed_at      timestamptz NOT NULL DEFAULT now(),
  pill_count      integer NOT NULL,
  renewed_by_name text,
  notes           text
);

ALTER TABLE medication_stock    ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_stock: family access"
  ON medication_stock FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR user_id IN (SELECT family_owner_ids_for_current_user())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IN (SELECT family_owner_ids_for_current_user())
  );

CREATE POLICY "medication_renewals: family access"
  ON medication_renewals FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR user_id IN (SELECT family_owner_ids_for_current_user())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IN (SELECT family_owner_ids_for_current_user())
  );
