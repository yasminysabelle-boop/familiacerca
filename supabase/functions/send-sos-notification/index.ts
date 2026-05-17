// FamiliaCerca — SOS Emergency Push Notification
// Called by the client immediately after an SOS is triggered.
// Sends a high-priority push notification to every family member
// (excluding the person who pressed SOS, who already knows).
// Deploy: supabase functions deploy send-sos-notification

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
    console.error('[send-sos-notification] Missing VAPID secrets')
    return new Response(JSON.stringify({ error: 'Missing VAPID config' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

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
    console.error('[send-sos-notification] Auth error:', authError)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { ownerId, triggeredByName, latitude, longitude, address } = await req.json()

  if (!ownerId) {
    return new Response(JSON.stringify({ error: 'ownerId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[send-sos-notification] SOS from user ${user.id} (${triggeredByName}), family owner: ${ownerId}`)

  // Collect all family members (owner + invited members)
  const { data: members } = await supabase
    .from('family_members')
    .select('member_user_id')
    .eq('user_id', ownerId)

  const allFamilyIds = [
    ownerId,
    ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? []),
  ]

  // Notify ALL family members including the person who pressed SOS.
  // Always ensure ownerId (admin) is in the list even if family_members query missed them.
  const recipientIds = Array.from(new Set([ownerId, ...allFamilyIds]))

  console.log(`[send-sos-notification] ${allFamilyIds.length} family members total, notifying all ${recipientIds.length}`)

  if (recipientIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0, noRecipients: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', recipientIds)

  console.log(`[send-sos-notification] Found ${subs?.length ?? 0} push subscriptions`)

  // Build notification body — include address if GPS was captured
  const locationStr = address
    ? ` · 📍 ${address}`
    : latitude && longitude
    ? ` · 📍 ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`
    : ''

  const mapsLink = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : '/dashboard'

  let sentCount = 0
  let failCount = 0

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `🚨 EMERGENCIA - ${triggeredByName}`,
          body: `Necesita ayuda ahora mismo${locationStr}`,
          url: mapsLink,
          tag: `sos-${Date.now()}`,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
        })
      )
      sentCount++
      console.log(`[send-sos-notification] ✓ Notified user ${sub.user_id}`)
    } catch (err: unknown) {
      failCount++
      const statusCode = (err as { statusCode?: number }).statusCode
      console.error(`[send-sos-notification] ✗ Failed for user ${sub.user_id}, status=${statusCode}:`, err)
      if (statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  console.log(`[send-sos-notification] Done. sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, total: subs?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
