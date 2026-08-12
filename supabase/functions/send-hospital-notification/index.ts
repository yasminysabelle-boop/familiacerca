// FamiliaCerca — Hospital Mode Push Notification
// Sends push notifications to all family members when Hospital Mode is activated/deactivated.

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
    console.error('[send-hospital-notification] Missing VAPID secrets')
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { ownerId, action, activatedByName, hospitalName, patientName } = await req.json()
  // action: 'activate' | 'deactivate'

  if (!ownerId || !action) {
    return new Response(JSON.stringify({ error: 'ownerId and action required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isActivating = action === 'activate'

  const title = isActivating
    ? `🏥 Modo Hospital activado`
    : `✅ Modo Hospital desactivado`

  const body = isActivating
    ? `${activatedByName} activó el modo hospital${hospitalName ? ` · ${hospitalName}` : ''}. El equipo está en alerta.`
    : `${activatedByName} desactivó el modo hospital. Todo se reanuda normalmente.`

  console.log(`[send-hospital-notification] action=${action} ownerId=${ownerId} by=${activatedByName}`)

  // Collect all family member IDs
  const { data: members } = await supabase
    .from('family_members')
    .select('member_user_id')
    .eq('user_id', ownerId)

  const allIds = [
    ownerId,
    ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? []),
  ]
  const recipientIds = Array.from(new Set(allIds))

  console.log(`[send-hospital-notification] ${recipientIds.length} recipients`)

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', recipientIds)

  let sentCount = 0
  let failCount = 0

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title,
          body,
          url: '/dashboard',
          tag: `hospital-mode-${Date.now()}`,
          requireInteraction: isActivating,
          vibrate: isActivating ? [200, 100, 200] : [100],
        })
      )
      sentCount++
    } catch (err: unknown) {
      failCount++
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
      console.error(`[send-hospital-notification] Push failed user=${sub.user_id} status=${statusCode}`)
    }
  }

  console.log(`[send-hospital-notification] done sent=${sentCount} failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, total: subs?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
