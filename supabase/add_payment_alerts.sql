-- ================================================================
-- FamiliaCerca — payment_alerts
-- Fila que escribe paypal-webhook (service role) cuando un evento de
-- PayPal no se puede correlacionar con ninguna fila de subscriptions --
-- pago que quedó "en el aire", nadie recibió su plan. Visible solo para
-- staff interno (isAppAdmin, user_metadata.app_metadata.role='admin'),
-- nunca para dueños de familia.
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================

create table if not exists public.payment_alerts (
  id                      uuid        primary key default gen_random_uuid(),
  event_id                text        not null unique, -- event.id de PayPal, dedup ante reintentos
  event_type              text        not null,        -- ej. BILLING.SUBSCRIPTION.ACTIVATED
  paypal_subscription_id  text,                          -- resource.id o resource.billing_agreement_id
  custom_id               text,                          -- resource.custom_id, si venía
  detail                  text        not null,          -- razón legible, ej. "sin fila con ese custom_id ni paypal_subscription_id"
  created_at              timestamptz not null default now()
);

alter table public.payment_alerts enable row level security;

-- Nadie del cliente escribe acá -- solo el webhook, con service role
-- (bypasea RLS). Sin policy de INSERT a propósito.

create policy "Staff interno puede leer alertas de pago"
  on public.payment_alerts for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
