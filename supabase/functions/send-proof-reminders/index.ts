// FamiliaCerca — Proof Photo Reminder Notifications
// Runs every minute. Finds confirmed medication logs where:
//   - photo_url IS NULL (no proof uploaded)
//   - confirmed_at is between 28-32 minutes ago (30-min window)
// Sends push notification to all family members.
// Deploy: supabase functions deploy send-proof-reminders

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

  console.log('[send-proof-reminders] Starting. VAPID configured:', !!(vapidPublicKey && vapidPrivateKey && vapidEmail))

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-proof-reminders] Missing VAPID secrets')
    return new Response(JSON.stringify({ error: 'Missing VAPID config', sent: 0 }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  // Find logs confirmed 28-32 minutes ago (straddle the 30-min mark, run every minute)
  const windowStart = new Date(now.getTime() - 32 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() - 28 * 60 * 1000).toISOString()

  console.log(`[send-proof-reminders] Checking logs confirmed between ${windowStart} and ${windowEnd}`)

  const { data: logs, error: logsError } = await supabase
    .from('medication_logs')
    .select('id, medication_id, user_id, confirmed_at, medications(name)')
    .eq('status', 'confirmed')
    .is('photo_url', null)
    .gte('confirmed_at', windowStart)
    .lte('confirmed_at', windowEnd)

  if (logsError) {
    console.error('[send-proof-reminders] Error querying logs:', logsError)
    return new Response(JSON.stringify({ error: logsError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[send-proof-reminders] Found ${logs?.length ?? 0} logs missing proof photo`)

  if (!logs || logs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sentCount = 0

  for (const log of logs) {
    const medName = (log.medications as { name: string } | null)?.name ?? 'Medicamento'
    console.log(`[send-proof-reminders] Missing proof for: ${medName}`)

    // Fetch patient name for this care group
    const { data: careProfile } = await supabase
      .from('care_profiles').select('name').eq('user_id', log.user_id).maybeSingle()
    const patientName = careProfile?.name ?? 'tu familiar'

    // Collect owner + family members
    const { data: members } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', log.user_id)

    const userIds = [log.user_id, ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? [])]
    console.log(`[send-proof-reminders] Owner ${log.user_id} — notifying ${userIds.length} users: ${JSON.stringify(userIds)}`)

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    console.log(`[send-proof-reminders] Found ${subs?.length ?? 0} push subscriptions for ${medName}`)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `📷 ${patientName} — falta foto de prueba`,
            body: `${medName} fue dado hace 30 min — agrega la foto de prueba`,
            url: '/medications',
            tag: `proof-missing-${log.id}`,
            data: { family_id: log.user_id, patient_name: patientName, event_type: 'PROOF_REMINDER', target_screen: 'medications' },
          })
        )
        sentCount++
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  console.log(`[send-proof-reminders] Done. sent=${sentCount}`)
  return new Response(JSON.stringify({ sent: sentCount, checked: logs.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
