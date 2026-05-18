import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')    ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET env vars')
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Map Stripe subscription statuses → our DB statuses
// Default to 'cancelled' for unknown/incomplete statuses — never grant access speculatively
function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':    return 'active'
    case 'trialing':  return 'trialing'
    case 'past_due':  return 'past_due'
    case 'canceled':  return 'cancelled'
    default:          return 'cancelled'
  }
}

serve(async (req) => {
  const sig  = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan   = session.metadata?.plan  // 'familiar' | 'care_plus'
        if (!userId || !plan) break

        // Fetch the actual subscription to get the real period end — never estimate
        const subscriptionId = session.subscription as string
        const sub = await stripe.subscriptions.retrieve(subscriptionId)

        await supabase.from('subscriptions').upsert({
          user_id:                userId,
          plan,
          status:                 'active',
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: subscriptionId,
          current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'user_id' })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const plan = sub.metadata?.plan ?? null

        const update: Record<string, unknown> = {
          status:             mapStatus(sub.status),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at:         new Date().toISOString(),
        }
        if (plan) update.plan = plan

        await supabase.from('subscriptions')
          .update(update)
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase.from('subscriptions').update({
          plan:                   'free',
          status:                 'cancelled',
          stripe_subscription_id: null,
          current_period_end:     null,
          updated_at:             new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
        break
      }

      case 'invoice.payment_succeeded': {
        // Subscription renewed — update period end so access doesn't lapse
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        await supabase.from('subscriptions').update({
          status:             'active',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at:         new Date().toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        await supabase.from('subscriptions').update({
          status:     'past_due',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription)
        break
      }
    }
  } catch (err) {
    console.error('Event handling error:', err)
    return new Response(JSON.stringify({ error: 'Handler error' }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
