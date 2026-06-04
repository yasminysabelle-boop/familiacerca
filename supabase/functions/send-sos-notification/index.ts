// FamiliaCerca — SOS Emergency Push Notification + Email
// Sends high-priority push notifications (Web Push + Firebase FCM) AND email
// to every family member.
// Deploy: supabase functions deploy send-sos-notification
// Required secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL,
//                   FIREBASE_SERVER_KEY (Firebase Console → Project Settings → Cloud Messaging → Server key)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sosEmailHtml(name: string, address: string | null, lat: number | null, lng: number | null): string {
  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null
  const locationBlock = address
    ? `<p style="margin:0 0 8px;font-size:14px;color:#374151;">📍 ${address}</p>`
    : mapsUrl
    ? `<p style="margin:0 0 8px;font-size:14px;color:#374151;">📍 Coordenadas: ${lat?.toFixed(5)}, ${lng?.toFixed(5)}</p>`
    : ''
  const mapsButton = mapsUrl
    ? `<a href="${mapsUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#C4623A;color:white;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">Ver ubicación en mapa</a>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#F9F5F1;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#D63031;padding:28px 24px;text-align:center;">
    <p style="margin:0;font-size:36px;">🚨</p>
    <h1 style="color:white;font-family:Georgia,serif;margin:8px 0 0;font-size:22px;">EMERGENCIA</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:15px;">${name} necesita ayuda ahora mismo</p>
  </div>
  <div style="padding:28px 24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1A1A1A;font-weight:600;">Se ha activado una alerta de emergencia.</p>
    ${locationBlock}
    ${mapsButton}
    <div style="margin-top:24px;padding:14px;background:#FFF0F0;border-radius:10px;border:1px solid #FFBABA;">
      <p style="margin:0;font-size:13px;color:#D63031;font-weight:600;">Abre la app para más detalles y para marcar la emergencia como resuelta.</p>
    </div>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #F3EEE8;text-align:center;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">FamiliaCerca · Cuidado familiar con amor</p>
  </div>
</div>
</body></html>`
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
  const recipientIds = Array.from(new Set([ownerId, ...allFamilyIds]))

  console.log(`[send-sos-notification] ${recipientIds.length} recipients`)

  // ── Push notifications ────────────────────────────────────────────────────
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', recipientIds)

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
      console.log(`[send-sos-notification] ✓ Push sent to user ${sub.user_id}`)
    } catch (err: unknown) {
      failCount++
      const statusCode = (err as { statusCode?: number }).statusCode
      console.error(`[send-sos-notification] ✗ Push failed for user ${sub.user_id}, status=${statusCode}`)
      if (statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  // ── Email notifications via Resend ────────────────────────────────────────
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (resendApiKey) {
    try {
      const userFetches = await Promise.all(
        recipientIds.map(id => supabase.auth.admin.getUserById(id))
      )
      const emails = userFetches
        .map(r => r.data?.user?.email)
        .filter((e): e is string => !!e)

      if (emails.length > 0) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'FamiliaCerca <noreply@familiacerca.com>',
            to: emails,
            subject: `🚨 EMERGENCIA - ${triggeredByName} necesita ayuda`,
            html: sosEmailHtml(triggeredByName, address ?? null, latitude ?? null, longitude ?? null),
          }),
        })
        console.log(`[send-sos-notification] Email sent to ${emails.length} recipients, status=${emailRes.status}`)
      }
    } catch (err) {
      console.error('[send-sos-notification] Email send failed:', err)
    }
  } else {
    console.warn('[send-sos-notification] RESEND_API_KEY not set, skipping email')
  }

  // ── Firebase FCM push ────────────────────────────────────────────────────
  const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY')
  if (firebaseServerKey) {
    try {
      const { data: fcmProfiles } = await supabase
        .from('user_profiles')
        .select('fcm_token')
        .in('id', recipientIds)
        .not('fcm_token', 'is', null)

      const fcmTokens: string[] = (fcmProfiles ?? [])
        .map((p: { fcm_token: string | null }) => p.fcm_token)
        .filter(Boolean)

      if (fcmTokens.length > 0) {
        const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${firebaseServerKey}`,
          },
          body: JSON.stringify({
            registration_ids: fcmTokens,
            notification: {
              title: `🚨 EMERGENCIA — ${triggeredByName}`,
              body: address ? `📍 ${address} — Toca para ver los detalles` : 'Toca para ver los detalles',
              icon: '/icon-192.png',
              badge: '/icon-72.png',
              tag: 'sos-alert',
            },
            data: {
              type: 'SOS',
              url: '/dashboard',
              triggeredByName: triggeredByName ?? '',
              latitude: String(latitude ?? ''),
              longitude: String(longitude ?? ''),
              address: address ?? '',
            },
            priority: 'high',
            content_available: true,
          }),
        })
        const fcmResult = await fcmRes.json()
        sentCount += fcmResult.success ?? 0
        console.log(`[send-sos-notification] FCM sent=${fcmResult.success} failed=${fcmResult.failure}`)
      }
    } catch (err) {
      console.error('[send-sos-notification] FCM send failed:', err)
    }
  } else {
    console.warn('[send-sos-notification] FIREBASE_SERVER_KEY not set, skipping FCM')
  }

  console.log(`[send-sos-notification] Done. push sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, total: subs?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
