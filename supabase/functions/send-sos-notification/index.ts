// FamiliaCerca — SOS Emergency Push Notification + Email
// Sends high-priority Web Push notifications AND email to every family member.
// Deploy: supabase functions deploy send-sos-notification
// Required secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL, RESEND_API_KEY

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sosEmailHtml(name: string, address: string | null, lat: number | null, lng: number | null): string {
  // Correo de emergencia con la marca (nov 2026): rojo solo para la alerta,
  // pasos claros de qué hacer y botones grandes.
  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null
  const locationBlock = address
    ? `<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#4E6470;text-transform:uppercase;letter-spacing:.06em;">Dónde</p><p style="margin:0 0 16px;font-size:16px;color:#14303D;">📍 ${address}</p>`
    : mapsUrl
    ? `<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#4E6470;text-transform:uppercase;letter-spacing:.06em;">Dónde</p><p style="margin:0 0 16px;font-size:16px;color:#14303D;">📍 ${lat?.toFixed(5)}, ${lng?.toFixed(5)}</p>`
    : ''
  const mapsButton = mapsUrl
    ? `<a href="${mapsUrl}" style="display:block;margin-top:10px;padding:14px 20px;background:#ffffff;color:#B42318;border:2px solid #B42318;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;text-align:center;">Ver dónde está en el mapa</a>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#F7F6F2;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#B42318;padding:26px 24px;text-align:center;">
    <img src="https://familiacerca.com/logo.png" width="48" height="48" alt="FamiliaCerca" style="display:block;margin:0 auto 12px;width:48px;height:48px;background:#ffffff;border-radius:50%;padding:7px;">
    <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:.12em;">🚨 EMERGENCIA</p>
    <h1 style="color:#ffffff;margin:8px 0 0;font-size:24px;line-height:1.25;">${name} necesita ayuda ahora</h1>
  </div>
  <div style="padding:24px;">
    ${locationBlock}
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#4E6470;text-transform:uppercase;letter-spacing:.06em;">Qué hacer ahora</p>
    <ol style="margin:0 0 18px;padding-left:20px;font-size:16px;line-height:1.6;color:#14303D;">
      <li>Llama a ${name} o a quien esté con su familiar.</li>
      <li>Si es grave, llama al <strong>911</strong> o al número de emergencias de tu país.</li>
      <li>Avisa en la app que vas en camino, para que la familia se organice.</li>
    </ol>
    <a href="https://familiacerca.com/dashboard" style="display:block;padding:15px 20px;background:#0C6C9C;color:#ffffff;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;text-align:center;">Abrir FamiliaCerca</a>
    ${mapsButton}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #E6E3DB;text-align:center;">
    <p style="font-size:13px;color:#5E7480;margin:0;">FamiliaCerca · Cuidado familiar con amor</p>
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

  console.log(`[send-sos-notification] Triggered by user=${user.id} (${triggeredByName}), payload ownerId=${ownerId}`)

  // Resolve the care group owner. FamilyContext on the client has an 8-second
  // timeout fallback that sets ownerId = sender's own user.id when the DB is slow.
  // A family member (e.g. Yasmin) would then pass her own id instead of the real
  // owner (e.g. Armando), causing the member lookup to return nothing.
  // Detect and correct that here before building the recipient list.
  let resolvedOwnerId = ownerId
  let { data: members } = await supabase
    .from('family_members')
    .select('member_user_id')
    .eq('user_id', resolvedOwnerId)

  console.log(`[send-sos-notification] Members for ownerId=${resolvedOwnerId}: ${members?.length ?? 0}`)

  if ((!members || members.length === 0) && user.id !== resolvedOwnerId) {
    // No members found for the declared owner AND sender is different — wrong ownerId.
    // Look up the sender's family membership to get the correct care group owner.
    const { data: senderMembership } = await supabase
      .from('family_members')
      .select('user_id')
      .eq('member_user_id', user.id)
      .maybeSingle()
    if (senderMembership?.user_id) {
      resolvedOwnerId = senderMembership.user_id
      const { data: resolvedMembers } = await supabase
        .from('family_members').select('member_user_id').eq('user_id', resolvedOwnerId)
      members = resolvedMembers
      console.log(`[send-sos-notification] Corrected owner via sender membership: ${resolvedOwnerId}, members: ${members?.length ?? 0}`)
    }
  }

  const allFamilyIds = [
    resolvedOwnerId,
    ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? []),
  ]
  const recipientIds = Array.from(new Set([resolvedOwnerId, ...allFamilyIds]))
  console.log(`[send-sos-notification] ${recipientIds.length} recipients: ${JSON.stringify(recipientIds)}`)

  const { data: careProfile } = await supabase
    .from('care_profiles').select('name').eq('user_id', resolvedOwnerId).maybeSingle()
  const patientName = careProfile?.name ?? 'tu familiar'

  // ── Push notifications ────────────────────────────────────────────────────
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', recipientIds)

  console.log(`[send-sos-notification] push_subscriptions found: ${subs?.length ?? 0}`)

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
          data: { family_id: resolvedOwnerId, patient_name: patientName, event_type: 'SOS', target_screen: 'dashboard' },
        }),
        { TTL: 3600 }
      )
      sentCount++
      console.log(`[send-sos-notification] ✓ Push sent to user ${sub.user_id}`)
    } catch (err: unknown) {
      failCount++
      const statusCode = (err as { statusCode?: number }).statusCode
      console.error(`[send-sos-notification] ✗ Push failed for user ${sub.user_id}, status=${statusCode}`)
      if (statusCode && statusCode >= 400 && statusCode !== 429 && statusCode !== 413) {
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

  console.log(`[send-sos-notification] Done. push sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, total: subs?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
