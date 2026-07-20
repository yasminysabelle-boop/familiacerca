import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PAYPAL_PLAN_IDS } from "../../../src/config/paypalPlans.js"

const PAYPAL_API = 'https://api-m.paypal.com'

async function getPayPalToken(): Promise<string> {
  const clientId = (Deno.env.get('PAYPAL_CLIENT_ID') ?? '').trim()
  const secret   = (Deno.env.get('PAYPAL_SECRET') ?? '').trim()
  const creds    = btoa(`${clientId}:${secret}`)

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`)
  const { access_token } = await res.json()
  return access_token
}

async function verifySignature(token: string, headers: Headers, webhookEvent: unknown): Promise<boolean> {
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? ''
  if (!webhookId) {
    console.error('PAYPAL_WEBHOOK_ID is not set — rejecting webhook')
    return false
  }

  const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo:         headers.get('paypal-auth-algo'),
      cert_url:          headers.get('paypal-cert-url'),
      transmission_id:   headers.get('paypal-transmission-id'),
      transmission_sig:  headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id:         webhookId,
      webhook_event:      webhookEvent,
    }),
  })
  if (!res.ok) return false
  const { verification_status } = await res.json()
  return verification_status === 'SUCCESS'
}

function planKeyFromPlanId(planId: string | undefined): string | null {
  if (!planId) return null
  for (const [key, id] of Object.entries(PAYPAL_PLAN_IDS)) {
    if (id === planId) return key
  }
  return null
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const rawBody = await req.text()
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    const token = await getPayPalToken()
    const verified = await verifySignature(token, req.headers, event)
    if (!verified) {
      console.error('PayPal webhook signature verification failed', event?.event_type)
      return new Response('Signature verification failed', { status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const eventType = event.event_type as string
    const resource   = event.resource ?? {}

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId = resource.id
        const planKey        = planKeyFromPlanId(resource.plan_id)
        const nextBilling    = resource.billing_info?.next_billing_time ?? null

        const updatePayload: Record<string, unknown> = {
          status: 'active',
          paypal_subscription_id: subscriptionId,
        }
        if (planKey)     updatePayload.plan = planKey
        if (nextBilling) updatePayload.current_period_end = nextBilling

        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .update(updatePayload)
          .eq('paypal_subscription_id', subscriptionId)
          .select('id')

        if (error) throw error
        if (!data || data.length === 0) {
          console.error('ACTIVATED webhook: no subscription row matched paypal_subscription_id', subscriptionId)
        }
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('paypal_subscription_id', resource.id)
        break
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'suspended' })
          .eq('paypal_subscription_id', resource.id)
        break
      }

      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('paypal_subscription_id', resource.id)
        break
      }

      case 'PAYMENT.SALE.COMPLETED': {
        // For subscription payments, PayPal reports the subscription id as billing_agreement_id
        const subscriptionId = resource.billing_agreement_id
        if (subscriptionId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('paypal_subscription_id', subscriptionId)
        }
        break
      }

      default:
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('paypal-webhook error', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
