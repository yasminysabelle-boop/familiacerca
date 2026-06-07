// FamiliaCerca — Video Call Push Notifications
// Runs every minute via pg_cron. Sends two reminders per scheduled call:
//   - 15-min warning  (notification_15_sent = false, scheduled_at in 13-17 min)
//   - At-time alert   (notification_0_sent  = false, scheduled_at in -1 to +1 min)
// Notifies all family members (owner + members) with the patient name in the title.
// Deploy: supabase functions deploy send-videocall-notifications

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

  console.log('[send-videocall-notifications] Starting. VAPID configured:', !!(vapidPublicKey && vapidPrivateKey && vapidEmail))

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-videocall-notifications] Missing VAPID secrets')
    return new Response(JSON.stringify({ error: 'Missing VAPID config', sent: 0 }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let sentCount = 0
  let failCount = 0

  // Direct invocation: ?callId=<uuid>&immediate=true bypasses the cron time
  // windows and notifies a specific call right now. Used by create-daily-room
  // to push instant notifications without waiting up to 60s for the cron.
  const reqUrl    = new URL(req.url)
  const targetId  = reqUrl.searchParams.get('callId')
  const immediate = reqUrl.searchParams.get('immediate') === 'true'

  if (targetId) {
    console.log(`[send-videocall-notifications] Direct invocation for call ${targetId}`)
    const { data: directCall } = await supabase
      .from('video_calls')
      .select('id, owner_id, title, room_url, scheduled_at, created_by_name')
      .eq('id', targetId)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (directCall) {
      await notifyCall(directCall, immediate)
    } else {
      console.warn(`[send-videocall-notifications] Call ${targetId} not found or cancelled`)
    }

    return new Response(JSON.stringify({ sent: sentCount, failed: failCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()

  // 15-minute reminder window: calls scheduled 13–17 min from now
  const w15Start = new Date(now.getTime() + 13 * 60 * 1000).toISOString()
  const w15End   = new Date(now.getTime() + 17 * 60 * 1000).toISOString()

  // At-time window: calls scheduled ±1 min from now
  const w0Start  = new Date(now.getTime() -  1 * 60 * 1000).toISOString()
  const w0End    = new Date(now.getTime() +  1 * 60 * 1000).toISOString()

  const [{ data: calls15 }, { data: calls0 }] = await Promise.all([
    supabase.from('video_calls')
      .select('id, owner_id, title, room_url, scheduled_at, created_by_name')
      .eq('notification_15_sent', false)
      .neq('status', 'cancelled')
      .gte('scheduled_at', w15Start)
      .lte('scheduled_at', w15End),
    supabase.from('video_calls')
      .select('id, owner_id, title, room_url, scheduled_at, created_by_name')
      .eq('notification_0_sent', false)
      .neq('status', 'cancelled')
      .gte('scheduled_at', w0Start)
      .lte('scheduled_at', w0End),
  ])

  console.log(`[send-videocall-notifications] 15-min calls: ${calls15?.length ?? 0}, at-time calls: ${calls0?.length ?? 0}`)

  if ((!calls15 || calls15.length === 0) && (!calls0 || calls0.length === 0)) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  async function notifyCall(
    call: { id: string; owner_id: string; title: string | null; room_url: string | null; created_by_name: string | null },
    isImmediate: boolean
  ) {
    // Patient name from care_profiles
    const { data: careProfile } = await supabase
      .from('care_profiles').select('name').eq('user_id', call.owner_id).maybeSingle()
    const patientName = careProfile?.name ?? 'tu familiar'

    // All family members (owner + invited members)
    const { data: members } = await supabase
      .from('family_members').select('member_user_id').eq('user_id', call.owner_id)
    const userIds = [
      call.owner_id,
      ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? []),
    ]
    console.log(`[send-videocall-notifications] Call ${call.id} (${isImmediate ? 'now' : '15min'}) — notifying ${userIds.length} users for ${patientName}`)

    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').in('user_id', userIds)

    console.log(`[send-videocall-notifications] Found ${subs?.length ?? 0} push subscriptions`)

    const title = isImmediate
      ? `📞 ${patientName} — Videollamada ahora`
      : `📞 ${patientName} — Videollamada en 15 minutos`
    const body = call.created_by_name
      ? `${call.created_by_name} inició una videollamada`
      : call.title ?? 'Videollamada familiar'

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title,
            body,
            url: call.room_url ?? '/videollamada',
            tag: `videocall-${call.id}-${isImmediate ? 'now' : '15'}`,
            requireInteraction: isImmediate,
            data: { family_id: call.owner_id, patient_name: patientName, event_type: isImmediate ? 'VIDEOCALL_NOW' : 'VIDEOCALL_15MIN', target_screen: 'videollamada' },
          })
        )
        sentCount++
        console.log(`[send-videocall-notifications] ✓ Sent to user ${sub.user_id}`)
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        console.error(`[send-videocall-notifications] ✗ Failed for user ${sub.user_id}, status=${statusCode}`)
        if (statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    // Mark notification as sent
    const flagField = isImmediate ? 'notification_0_sent' : 'notification_15_sent'
    await supabase.from('video_calls').update({ [flagField]: true }).eq('id', call.id)
  }

  for (const call of calls15 ?? []) await notifyCall(call, false)
  for (const call of calls0  ?? []) await notifyCall(call, true)

  console.log(`[send-videocall-notifications] Done. sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
