// FamiliaCerca — Test Push Notification
// Authenticates the calling user from JWT, fetches their push subscriptions,
// and sends a test notification so the pipeline can be verified end-to-end.
// Deploy: supabase functions deploy send-test-notification

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidEmail      = Deno.env.get('VAPID_CONTACT_EMAIL')

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-test-notification] Missing VAPID secrets')
    return new Response(JSON.stringify({ error: 'Missing VAPID config' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  // Use caller's JWT to identify the requesting user
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    console.error('[send-test-notification] Auth error:', authError)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[send-test-notification] Sending test to user ${user.id}`)

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (subsError) {
    console.error('[send-test-notification] Error fetching subscriptions:', subsError)
    return new Response(JSON.stringify({ error: subsError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[send-test-notification] Found ${subs?.length ?? 0} subscriptions`)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, error: 'No subscriptions found for this user' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sentCount = 0
  let failCount = 0
  const errors: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: '✅ FamiliaCerca — Prueba exitosa',
          body: 'Las notificaciones push están funcionando correctamente.',
          url: '/ajustes',
          tag: 'test-notification',
        })
      )
      sentCount++
      console.log(`[send-test-notification] ✓ Sent to subscription ${sub.id}`)
    } catch (err: unknown) {
      failCount++
      const statusCode = (err as { statusCode?: number }).statusCode
      const message = (err as { message?: string }).message ?? 'Unknown error'
      console.error(`[send-test-notification] ✗ Failed for sub ${sub.id}, status=${statusCode}:`, err)
      errors.push(`sub ${sub.id}: ${statusCode ?? ''} ${message}`)
      if (statusCode === 410) {
        console.log(`[send-test-notification] Removing expired subscription ${sub.id}`)
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  console.log(`[send-test-notification] Done. sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, total: subs.length, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
