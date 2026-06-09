// FamiliaCerca — Evening Push Notification
// At 9pm local time, if any medications or care tasks are incomplete, notify all
// subscribed family members with a push notification.
// Deploy: supabase functions deploy send-evening-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL
// Cron: see supabase/setup_cron.sql (fc-evening-push-utc4 / fc-evening-push-utc5 / fc-evening-push-utc6)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mirrors CARE_ITEMS category:'daily' in src/lib/careItems.js — must match DB CHECK constraint
const DAILY_CARE_KEYS = [
  'bath', 'dental_morning', 'dental_afternoon', 'dental_night',
  'clothes', 'breakfast', 'lunch', 'dinner',
]

function localDateForOffset(utcOffsetHours: number): string {
  const local = new Date(Date.now() + utcOffsetHours * 60 * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidEmail      = Deno.env.get('VAPID_CONTACT_EMAIL')

  console.log('[send-evening-push] Starting. VAPID configured:', !!(vapidPublicKey && vapidPrivateKey && vapidEmail))

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-evening-push] Missing VAPID secrets.')
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

  // utc_offset passed from cron body (-4, -5, or -6); defaults to -5
  let utcOffset = -5
  try {
    const body = await req.json()
    if (typeof body?.utc_offset === 'number') utcOffset = body.utc_offset
  } catch { /* no body — use default */ }

  const today = localDateForOffset(utcOffset)
  console.log(`[send-evening-push] utc_offset=${utcOffset}, today=${today}`)

  // Fetch all medications and today's logs in parallel
  const [
    { data: medications, error: medsError },
    { data: medLogs },
    { data: careLogsToday },
    { data: careLogsRecent },
  ] = await Promise.all([
    supabase.from('medications').select('id, user_id'),
    supabase.from('medication_logs').select('medication_id').eq('log_date', today).eq('status', 'confirmed'),
    supabase.from('daily_care_logs').select('item_key, user_id').eq('log_date', today),
    // Detect which owners actively use the care checklist (any log in past 7 days)
    supabase.from('daily_care_logs').select('user_id').gte('log_date', sevenDaysAgo()),
  ])

  if (medsError) {
    console.error('[send-evening-push] Error fetching medications:', medsError)
    return new Response(JSON.stringify({ error: medsError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Index care data (needed for both no_completado inserts and push logic)
  const confirmedMedIds = new Set((medLogs ?? []).map((l: { medication_id: string }) => l.medication_id))
  const activeCareOwners = new Set((careLogsRecent ?? []).map((l: { user_id: string }) => l.user_id))
  const careLoggedToday = new Map<string, Set<string>>()
  for (const log of careLogsToday ?? []) {
    const entry = careLoggedToday.get(log.user_id) ?? new Set<string>()
    entry.add(log.item_key)
    careLoggedToday.set(log.user_id, entry)
  }

  // ── Mark missed care items (no_completado) ───────────────────────────────────
  // For every owner who actively uses the checklist, insert no_completado for
  // any daily item not yet logged today. The trigger trg_fn_care_routine fires
  // on each INSERT and logs care_routine_missed in activity_log.
  // ignoreDuplicates:true makes this idempotent if the cron fires multiple times.
  if (activeCareOwners.size > 0) {
    const missingCareRows: Array<{
      user_id: string; item_key: string; log_date: string;
      status: string; checked_by: string; checked_at: string;
    }> = []
    for (const ownerId of activeCareOwners) {
      const loggedItems = careLoggedToday.get(ownerId) ?? new Set<string>()
      for (const item_key of DAILY_CARE_KEYS) {
        if (!loggedItems.has(item_key)) {
          missingCareRows.push({
            user_id: ownerId,
            item_key,
            log_date: today,
            status: 'no_completado',
            checked_by: 'Sistema automático',
            checked_at: new Date().toISOString(),
          })
        }
      }
    }
    if (missingCareRows.length > 0) {
      const { error: insertErr } = await supabase
        .from('daily_care_logs')
        .upsert(missingCareRows, { onConflict: 'user_id,item_key,log_date', ignoreDuplicates: true })
      if (insertErr) {
        console.error('[send-evening-push] Error inserting no_completado rows:', insertErr)
      } else {
        console.log(`[send-evening-push] no_completado: attempted ${missingCareRows.length} rows`)
      }
    }
  }

  // ── Push notifications ───────────────────────────────────────────────────────
  if (!medications?.length) {
    console.log('[send-evening-push] No medications configured — skipping push notifications')
    return new Response(JSON.stringify({ sent: 0, today }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Group medications by owner
  const medsByOwner = new Map<string, string[]>()
  for (const med of medications) {
    const ids = medsByOwner.get(med.user_id) ?? []
    ids.push(med.id)
    medsByOwner.set(med.user_id, ids)
  }

  // Determine which owners have incomplete tasks
  const ownersWithPending: string[] = []
  for (const [ownerId, medIds] of medsByOwner) {
    const pendingMeds = medIds.filter(id => !confirmedMedIds.has(id)).length
    const pendingCare = activeCareOwners.has(ownerId)
      ? DAILY_CARE_KEYS.filter(k => !careLoggedToday.get(ownerId)?.has(k)).length
      : 0
    if (pendingMeds > 0 || pendingCare > 0) {
      console.log(`[send-evening-push] Owner ${ownerId}: ${pendingMeds} meds pending, ${pendingCare} care items pending`)
      ownersWithPending.push(ownerId)
    }
  }

  if (!ownersWithPending.length) {
    console.log('[send-evening-push] All tasks complete for today — no notifications needed')
    return new Response(JSON.stringify({ sent: 0, today, allDone: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch patient names for all pending owners
  const { data: careProfiles } = await supabase
    .from('care_profiles')
    .select('user_id, name')
    .in('user_id', ownersWithPending)
  const careNameMap = new Map<string, string>()
  ;(careProfiles ?? []).forEach((p: { user_id: string; name: string }) => careNameMap.set(p.user_id, p.name))

  let sentCount = 0
  let failCount = 0

  for (const ownerId of ownersWithPending) {
    const { data: members } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', ownerId)

    const userIds = [
      ownerId,
      ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? []),
    ]
    console.log(`[send-evening-push] Owner ${ownerId} — notifying ${userIds.length} users: ${JSON.stringify(userIds)}`)

    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    if (subsError) {
      console.error(`[send-evening-push] Error fetching subscriptions for owner ${ownerId}:`, subsError)
      continue
    }

    console.log(`[send-evening-push] Found ${subs?.length ?? 0} push subscriptions for ${userIds.length} users`)

    const patientName = careNameMap.get(ownerId) ?? 'tu familiar'

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `⚠️ ${patientName} — tareas pendientes`,
            body: 'Hay actividades de hoy sin completar',
            url: '/hoy',
            tag: `evening-push-${today}`,
            data: { family_id: ownerId, patient_name: patientName, event_type: 'EVENING_REMINDER', target_screen: 'hoy' },
          })
        )
        sentCount++
        console.log(`[send-evening-push] ✓ Sent to user ${sub.user_id}`)
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        console.error(`[send-evening-push] ✗ Failed for user ${sub.user_id}, status=${statusCode}`)
        if (statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  console.log(`[send-evening-push] Done. sent=${sentCount}, failed=${failCount}`)

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, today, pendingOwners: ownersWithPending.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
