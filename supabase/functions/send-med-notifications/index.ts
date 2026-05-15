// FamiliaCerca — Medication Reminder Push Notifications
// Deploy: supabase functions deploy send-med-notifications
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_CONTACT_EMAIL=...
// Cron: run every minute via pg_cron (see supabase/setup_cron.sql)

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

  console.log('[send-med-notifications] Starting. VAPID configured:', !!(vapidPublicKey && vapidPrivateKey && vapidEmail))

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-med-notifications] Missing VAPID secrets. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL via supabase secrets set.')
    return new Response(
      JSON.stringify({ error: 'Missing VAPID configuration', sent: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Current time in both UTC and common Latin American offsets for debugging
  const now = new Date()
  const utcTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  // UTC-5 (e.g. Bogotá/Lima) and UTC-6 (e.g. Mexico City/Guatemala)
  const utcMinus5 = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const utcMinus6 = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  const localTime5 = `${String(utcMinus5.getUTCHours()).padStart(2, '0')}:${String(utcMinus5.getUTCMinutes()).padStart(2, '0')}`
  const localTime6 = `${String(utcMinus6.getUTCHours()).padStart(2, '0')}:${String(utcMinus6.getUTCMinutes()).padStart(2, '0')}`

  // Check all common local times against scheduled_times
  const timesToCheck = Array.from(new Set([utcTime, localTime5, localTime6]))
  console.log(`[send-med-notifications] Checking times: UTC=${utcTime}, UTC-5=${localTime5}, UTC-6=${localTime6}`)

  // Find all medications scheduled for any of the current minute variants
  const { data: meds, error: medsError } = await supabase
    .from('medications')
    .select('id, name, dosage, user_id, scheduled_times')
    .overlaps('scheduled_times', timesToCheck)

  if (medsError) {
    console.error('[send-med-notifications] Error querying medications:', medsError)
    return new Response(
      JSON.stringify({ error: medsError.message, sent: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[send-med-notifications] Found ${meds?.length ?? 0} medications due now`)

  if (!meds || meds.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, time: utcTime, checked: timesToCheck }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let sentCount = 0
  let failCount = 0

  for (const med of meds) {
    console.log(`[send-med-notifications] Processing med: ${med.name} (owner: ${med.user_id})`)

    // Collect all users in this care group (owner + family members)
    const { data: members, error: membersError } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', med.user_id)

    if (membersError) {
      console.error(`[send-med-notifications] Error fetching family members for ${med.user_id}:`, membersError)
    }

    const userIds = [med.user_id, ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? [])]
    console.log(`[send-med-notifications] Notifying ${userIds.length} users for ${med.name}`)

    // Get push subscriptions for all group members
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    if (subsError) {
      console.error(`[send-med-notifications] Error fetching subscriptions:`, subsError)
      continue
    }

    console.log(`[send-med-notifications] Found ${subs?.length ?? 0} push subscriptions`)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `💊 Hora de ${med.name}`,
            body: med.dosage ? `${med.dosage} · ${utcTime}` : utcTime,
            url: '/hoy',
            tag: `med-${med.id}-${utcTime}`,
          })
        )
        sentCount++
        console.log(`[send-med-notifications] ✓ Sent to user ${sub.user_id}`)
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        console.error(`[send-med-notifications] ✗ Failed for user ${sub.user_id}, status=${statusCode}:`, err)
        // Remove expired subscriptions (HTTP 410 Gone)
        if (statusCode === 410) {
          console.log(`[send-med-notifications] Removing expired subscription ${sub.id}`)
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  console.log(`[send-med-notifications] Done. sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, time: utcTime, checked: timesToCheck, medications: meds.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
