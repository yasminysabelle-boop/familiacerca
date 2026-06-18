import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPayPalToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
  const secret   = Deno.env.get('PAYPAL_SECRET')    ?? ''
  const creds    = btoa(`${clientId}:${secret}`)

  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing auth')

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')      ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')               ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  ?? ''
    )

    const { cancel_reason } = await req.json().catch(() => ({}))

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('paypal_subscription_id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subErr) throw subErr

    // Only call PayPal if there is an active PayPal subscription ID
    if (sub?.paypal_subscription_id) {
      const token = await getPayPalToken()

      const cancelRes = await fetch(
        `https://api-m.paypal.com/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ reason: 'Customer requested cancellation' }),
        }
      )

      // PayPal returns 204 No Content on success
      if (!cancelRes.ok && cancelRes.status !== 204) {
        throw new Error(`PayPal cancel failed (${cancelRes.status}): ${await cancelRes.text()}`)
      }
    }

    const updatePayload: Record<string, unknown> = { status: 'cancelled' }
    if (cancel_reason) updatePayload.cancel_reason = cancel_reason

    const { error: updateErr } = await supabaseAdmin
      .from('subscriptions')
      .update(updatePayload)
      .eq('user_id', user.id)

    if (updateErr) throw updateErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
