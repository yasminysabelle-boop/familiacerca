import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Map Stripe subscription statuses → our DB statuses
function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':   return 'active'
    case 'canceled': return 'cancelled'
    case 'past_due': return 'active'   // still active, just payment issue — keep access
    default:         return 'active'
  }
}

serve(async (req) => {
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan   = session.metadata?.plan  // 'familiar' | 'care_plus'
        if (!userId || !plan) break

        await supabase.from('subscriptions').upsert({
          user_id:                userId,
          plan,
          status:                 'active',
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: session.subscription as string,
          current_period_end:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

      case 'invoice.payment_failed': {
        // Grace period — keep active but could notify user separately
        const invoice = event.data.object as Stripe.Invoice
        console.log('Payment failed for subscription:', invoice.subscription)
        break
      }
    }
  } catch (err) {
    console.error('Event handling error:', err)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
