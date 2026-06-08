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

  const now = new Date()
  function toHHMM(d: Date) {
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }
  function shiftTZ(base: Date, offsetHours: number) {
    return new Date(base.getTime() + offsetHours * 60 * 60 * 1000)
  }

  // Reminder fires 10 minutes BEFORE the scheduled dose time
  const in10 = new Date(now.getTime() + 10 * 60 * 1000)
  const timesToCheck = Array.from(new Set([
    toHHMM(in10),
    toHHMM(shiftTZ(in10, -4)),  // UTC-4 Puerto Rico / Atlantic
    toHHMM(shiftTZ(in10, -5)),  // UTC-5 Colombia / Peru
    toHHMM(shiftTZ(in10, -6)),  // UTC-6 Mexico / Central
  ]))
  console.log(`[send-med-notifications] 10-min-before check: ${timesToCheck.join(', ')}`)

  // Missed-dose check: fire once, 61 minutes AFTER scheduled time (window just closed)
  const was61 = new Date(now.getTime() - 61 * 60 * 1000)
  const missedTimesToCheck = Array.from(new Set([
    toHHMM(was61),
    toHHMM(shiftTZ(was61, -4)),
    toHHMM(shiftTZ(was61, -5)),
    toHHMM(shiftTZ(was61, -6)),
  ]))

  // Today in PR timezone (UTC-4) for log existence checks
  const todayPR = (() => {
    const d = shiftTZ(now, -4)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })()

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
      JSON.stringify({ sent: 0, time: toHHMM(now), checked: timesToCheck }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Batch-fetch patient names for all care group owners
  const ownerIdSet = [...new Set(meds.map((m: { user_id: string }) => m.user_id))]
  const { data: careProfilesBatch } = await supabase
    .from('care_profiles').select('user_id, name').in('user_id', ownerIdSet)
  const patientNameMap = new Map<string, string>()
  ;(careProfilesBatch ?? []).forEach((p: { user_id: string; name: string }) => patientNameMap.set(p.user_id, p.name))

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
    console.log(`[send-med-notifications] Notifying ${userIds.length} users for ${med.name}: ${JSON.stringify(userIds)}`)

    // Get push subscriptions for all group members
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    if (subsError) {
      console.error(`[send-med-notifications] Error fetching subscriptions:`, subsError)
      continue
    }

    console.log(`[send-med-notifications] Found ${subs?.length ?? 0} push subscriptions for ${userIds.length} users`)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `💊 ${med.name} en 10 minutos`,
            body: med.dosage ? `Dosis: ${med.dosage} — prepara la dosis ahora` : 'Prepara la dosis ahora',
            url: '/hoy',
            tag: `med-reminder-${med.id}`,
            data: { family_id: med.user_id, patient_name: patientNameMap.get(med.user_id) ?? 'tu familiar', event_type: 'MED_REMINDER', target_screen: 'hoy' },
          }),
          { TTL: 86400 }
        )
        sentCount++
        console.log(`[send-med-notifications] ✓ Sent to user ${sub.user_id}`)
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        console.error(`[send-med-notifications] ✗ Failed for user ${sub.user_id}, status=${statusCode}:`, err)
        // Remove invalid subscriptions (4xx = no longer valid; skip 429 rate-limit and 413 payload-too-large)
        if (statusCode && statusCode >= 400 && statusCode !== 429 && statusCode !== 413) {
          console.log(`[send-med-notifications] Removing invalid subscription ${sub.id} (status ${statusCode})`)
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  // ── Missed-dose alerts ───────────────────────────────────────────────────────
  // Fire 61 minutes after scheduled time if no confirmed/missed log exists for today
  const { data: overdueMeds } = await supabase
    .from('medications')
    .select('id, name, dosage, user_id, scheduled_times')
    .overlaps('scheduled_times', missedTimesToCheck)

  for (const med of overdueMeds ?? []) {
    // Deduplication guard: atomically claim the missed slot by upserting a 'missed' log.
    // ignoreDuplicates:true returns null data on conflict → means we already sent this alert.
    const { data: claimed } = await supabase
      .from('medication_logs')
      .upsert({
        medication_id: med.id,
        user_id: med.user_id,
        status: 'missed',
        log_date: todayPR,
        confirmed_by_name: 'Sistema automático',
        confirmed_at: new Date().toISOString(),
      }, { onConflict: 'medication_id,log_date,user_id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle()
    // If row already existed (duplicate) or insert failed, skip notification
    if (!claimed) continue

    const { data: members2 } = await supabase
      .from('family_members').select('member_user_id').eq('user_id', med.user_id)
    const userIds2 = [med.user_id, ...(members2?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? [])]

    const { data: subs2 } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').in('user_id', userIds2)

    const missedBody = med.dosage
      ? `${med.dosage} — la dosis no fue administrada en el horario establecido`
      : 'La dosis no fue administrada en el horario establecido'

    for (const sub of subs2 ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `❌ Dosis olvidada — ${med.name}`,
            body: missedBody,
            url: '/hoy',
            tag: `missed-${med.id}-${todayPR}`,
            requireInteraction: true,
            data: { family_id: med.user_id, patient_name: patientNameMap.get(med.user_id) ?? 'tu familiar', event_type: 'MISSED_DOSE', target_screen: 'hoy' },
          }),
          { TTL: 86400 }
        )
        sentCount++
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode && statusCode >= 400 && statusCode !== 429 && statusCode !== 413) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

  }

  console.log(`[send-med-notifications] Done. sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, checked: timesToCheck, medications: meds?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
