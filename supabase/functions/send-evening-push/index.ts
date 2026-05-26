// FamiliaCerca — Evening Push Notification
// At 9pm local time, if any medications or care tasks are incomplete, notify all
// subscribed family members with a push notification.
// Deploy: supabase functions deploy send-evening-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL
// Cron: see supabase/setup_cron.sql (fc-evening-push-utc5 / fc-evening-push-utc6)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mirrors CARE_ITEMS in Hoy.jsx: non-weekly, non-asneeded items expected every day
const DAILY_CARE_KEYS = [
  'morning_bath', 'morning_clothes', 'morning_dental', 'breakfast',
  'lunch', 'rest', 'exercise', 'dinner', 'night_dental',
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

  // utc_offset passed from cron body (-5 or -6); defaults to -5
  let utcOffset = -5
  try {
    const body = await req.json()
    if (typeof body?.utc_offset === 'number') utcOffset = body.utc_offset
  } catch { /* no body — use default */ }

  const today = localDateForOffset(utcOffset)
  console.log(`[send-evening-push] utc_offset=${utcOffset}, today=${today}`)

  // Fetch all medications and today's confirmed logs in parallel
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

  if (!medications?.length) {
    console.log('[send-evening-push] No medications configured — nothing to do')
    return new Response(JSON.stringify({ sent: 0, today }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Index confirmed medication IDs for O(1) lookup
  const confirmedMedIds = new Set((medLogs ?? []).map((l: { medication_id: string }) => l.medication_id))

  // Index care owners who use the checklist
  const activeCareOwners = new Set((careLogsRecent ?? []).map((l: { user_id: string }) => l.user_id))

  // Index care items logged today per owner
  const careLoggedToday = new Map<string, Set<string>>()
  for (const log of careLogsToday ?? []) {
    const entry = careLoggedToday.get(log.user_id) ?? new Set<string>()
    entry.add(log.item_key)
    careLoggedToday.set(log.user_id, entry)
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

  let sentCount = 0
  let failCount = 0

  for (const ownerId of ownersWithPending) {
    // Get all family members for this care group (same query as send-med-notifications)
    const { data: members } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', ownerId)

    const userIds = [
      ownerId,
      ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? []),
    ]

    // Get push subscriptions for all group members
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    if (subsError) {
      console.error(`[send-evening-push] Error fetching subscriptions for owner ${ownerId}:`, subsError)
      continue
    }

    console.log(`[send-evening-push] Notifying ${subs?.length ?? 0} subscriptions for owner ${ownerId}`)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: '⚠️ FamiliaCerca',
            body: 'Hay tareas pendientes de hoy sin completar',
            url: '/hoy',
            tag: `evening-push-${today}`,
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
