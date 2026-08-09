// FamiliaCerca — Evening Push Notification
// At 9pm local time, if any medications or care tasks are incomplete, notify all
// subscribed family members with a push notification.
// Deploy: supabase functions deploy send-evening-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL
// Cron: see supabase/setup_cron.sql (fc-evening-push-utc4 / fc-evening-push-utc5 / fc-evening-push-utc6)
// Auth: Authorization: Bearer <anon key> (gateway) + X-Cron-Secret: <CRON_SECRET>
// (único caller es pg_cron). Remediación del hallazgo de seguridad 2026-08.

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

  const cronSecret = Deno.env.get('CRON_SECRET')
  const token = req.headers.get('X-Cron-Secret') ?? ''
  if (!cronSecret || token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Observabilidad mínima (ver add_notification_runs_log.sql) — una fila por
  // ejecución. Nunca debe poder romper el envío real: log_notification_run()
  // ya traga sus propias excepciones (SECURITY DEFINER), y este wrapper
  // agrega una segunda capa por si la llamada RPC en sí fallara en red.
  async function logRun(opts: { attempted?: number; sent?: number; failed?: number; failureReasons?: Record<string, number>; fatalError?: string }) {
    try {
      await supabase.rpc('log_notification_run', {
        p_function_name: 'send-evening-push',
        p_attempted: opts.attempted ?? 0,
        p_sent: opts.sent ?? 0,
        p_failed: opts.failed ?? 0,
        p_failure_reasons: opts.failureReasons && Object.keys(opts.failureReasons).length ? opts.failureReasons : null,
        p_fatal_error: opts.fatalError ?? null,
      })
    } catch (logErr) {
      console.error('[send-evening-push] Failed to log notification run (non-fatal):', logErr)
    }
  }

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidEmail      = Deno.env.get('VAPID_CONTACT_EMAIL')

  console.log('[send-evening-push] Starting. VAPID configured:', !!(vapidPublicKey && vapidPrivateKey && vapidEmail))

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-evening-push] Missing VAPID secrets.')
    await logRun({ fatalError: 'Missing VAPID configuration' })
    return new Response(
      JSON.stringify({ error: 'Missing VAPID configuration', sent: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

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
    await logRun({ fatalError: `Error fetching medications: ${medsError.message}` })
    return new Response(JSON.stringify({ error: medsError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Index care data (needed for both care_routine_missed logging and push logic)
  const confirmedMedIds = new Set((medLogs ?? []).map((l: { medication_id: string }) => l.medication_id))
  const activeCareOwners = new Set((careLogsRecent ?? []).map((l: { user_id: string }) => l.user_id))
  const careLoggedToday = new Map<string, Set<string>>()
  for (const log of careLogsToday ?? []) {
    const entry = careLoggedToday.get(log.user_id) ?? new Set<string>()
    entry.add(log.item_key)
    careLoggedToday.set(log.user_id, entry)
  }

  // ── Mark missed care items (care_routine_missed) ─────────────────────────────
  // For every owner who actively uses the checklist, log care_routine_missed
  // directly in activity_log for any daily item not yet logged today — via the
  // same log_activity() RPC that trg_fn_care_routine used to call.
  // daily_care_logs stays exclusively for real caregiver check-ins: it must
  // never receive placeholder rows again (those showed up as false "completed"
  // routines in /cuidado, since the UI treats any row there as done).
  if (activeCareOwners.size > 0) {
    // Dedup guard so a cron re-fire doesn't double-log the same miss (replaces
    // the old upsert's ignoreDuplicates:true, which relied on daily_care_logs'
    // unique constraint — activity_log has no such constraint).
    const { data: existingMissedLogs } = await supabase
      .from('activity_log')
      .select('owner_id, description')
      .eq('type', 'care_routine_missed')
      .eq('metadata->>log_date', today)
    const alreadyLogged = new Set(
      (existingMissedLogs ?? []).map((l: { owner_id: string; description: string }) => `${l.owner_id}:${l.description}`)
    )

    const nowIso = new Date().toISOString()
    let missedCount = 0
    for (const ownerId of activeCareOwners) {
      const loggedItems = careLoggedToday.get(ownerId) ?? new Set<string>()
      for (const item_key of DAILY_CARE_KEYS) {
        if (loggedItems.has(item_key)) continue
        if (alreadyLogged.has(`${ownerId}:${item_key}`)) continue
        const { error: rpcErr } = await supabase.rpc('log_activity', {
          p_type: 'care_routine_missed',
          p_description: item_key,
          p_owner_id: ownerId,
          p_actor_name: 'Sistema automático',
          p_metadata: { item_key, log_date: today },
          p_created_at: nowIso,
        })
        if (rpcErr) {
          console.error(`[send-evening-push] Error logging care_routine_missed for ${ownerId}/${item_key}:`, rpcErr)
        } else {
          missedCount++
        }
      }
    }
    console.log(`[send-evening-push] care_routine_missed: logged ${missedCount} entries`)
  }

  // ── Push notifications ───────────────────────────────────────────────────────
  if (!medications?.length) {
    console.log('[send-evening-push] No medications configured — skipping push notifications')
    await logRun({})
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
    await logRun({})
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
  const failureReasons: Record<string, number> = {}

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
      failCount++
      failureReasons['subs_query_error'] = (failureReasons['subs_query_error'] ?? 0) + 1
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
            url: '/medications',
            tag: `evening-push-${today}`,
            data: { family_id: ownerId, patient_name: patientName, event_type: 'EVENING_REMINDER', target_screen: 'medications' },
          })
        )
        sentCount++
        console.log(`[send-evening-push] ✓ Sent to user ${sub.user_id}`)
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        const reasonKey = statusCode ? String(statusCode) : 'unknown'
        failureReasons[reasonKey] = (failureReasons[reasonKey] ?? 0) + 1
        console.error(`[send-evening-push] ✗ Failed for user ${sub.user_id}, status=${statusCode}`)
        if (statusCode && statusCode >= 400 && statusCode !== 429 && statusCode !== 413) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  console.log(`[send-evening-push] Done. sent=${sentCount}, failed=${failCount}`)

  await logRun({ attempted: sentCount + failCount, sent: sentCount, failed: failCount, failureReasons })

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, today, pendingOwners: ownersWithPending.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
