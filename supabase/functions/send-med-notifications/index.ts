// FamiliaCerca — Medication Reminder Push Notifications
// Deploy: supabase functions deploy send-med-notifications
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_CONTACT_EMAIL=...
// Cron: run every minute via pg_cron (see supabase/setup_cron.sql)
// Auth: Authorization: Bearer <anon key> (gateway) + X-Cron-Secret: <CRON_SECRET>
// — único caller legítimo es pg_cron, sin fallback de usuario (a diferencia de
// send-daily-summary). Remediación del hallazgo de seguridad 2026-08
// (verify_jwt estaba en false, sin ningún chequeo).
//
// Privacidad: los pushes nunca nombran el medicamento ni la dosis — se ven en
// pantallas bloqueadas. El detalle vive dentro de la app.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toHHMM(d: Date) {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
function shiftTZ(base: Date, offsetHours: number) {
  return new Date(base.getTime() + offsetHours * 60 * 60 * 1000)
}
function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
function fmt12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // El gateway (verify_jwt:true) exige que Authorization sea un JWT real — un
  // secreto random ahí lo rechaza antes de llegar aquí. El CRON_SECRET va en
  // un header aparte que el gateway no toca.
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
        p_function_name: 'send-med-notifications',
        p_attempted: opts.attempted ?? 0,
        p_sent: opts.sent ?? 0,
        p_failed: opts.failed ?? 0,
        p_failure_reasons: opts.failureReasons && Object.keys(opts.failureReasons).length ? opts.failureReasons : null,
        p_fatal_error: opts.fatalError ?? null,
      })
    } catch (logErr) {
      console.error('[send-med-notifications] Failed to log notification run (non-fatal):', logErr)
    }
  }

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidEmail      = Deno.env.get('VAPID_CONTACT_EMAIL')

  console.log('[send-med-notifications] Starting. VAPID configured:', !!(vapidPublicKey && vapidPrivateKey && vapidEmail))

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('[send-med-notifications] Missing VAPID secrets. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL via supabase secrets set.')
    await logRun({ fatalError: 'Missing VAPID configuration' })
    return new Response(
      JSON.stringify({ error: 'Missing VAPID configuration', sent: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const now = new Date()
  // Solo -4/-5/-6: no hay usuarios en UTC+0. Un candidato sin desplazar aquí coincide
  // en dígitos con "hora local + ventana" leído como si fuera UTC — dispara ~4h antes.
  const nowVariants = [toHHMM(shiftTZ(now, -4)), toHHMM(shiftTZ(now, -5)), toHHMM(shiftTZ(now, -6))]

  // Today in PR timezone (UTC-4) for log existence checks
  const todayPR = (() => {
    const d = shiftTZ(now, -4)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })()

  // La ventana clínica varía por medicamento (time_window_minutes), así que ambos
  // disparos se calculan en JS sobre el set completo en vez de filtrar por fecha en la query.
  const { data: allMeds, error: medsError } = await supabase
    .from('medications')
    .select('id, user_id, scheduled_times, time_window_minutes')

  if (medsError) {
    console.error('[send-med-notifications] Error querying medications:', medsError)
    await logRun({ fatalError: `Error querying medications: ${medsError.message}` })
    return new Response(
      JSON.stringify({ error: medsError.message, sent: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[send-med-notifications] ${allMeds?.length ?? 0} medications loaded`)

  const ownerIdSet = [...new Set((allMeds ?? []).map((m: { user_id: string }) => m.user_id))]
  const { data: careProfilesBatch } = await supabase
    .from('care_profiles').select('user_id, name').in('user_id', ownerIdSet)
  const patientNameMap = new Map<string, string>()
  ;(careProfilesBatch ?? []).forEach((p: { user_id: string; name: string }) => patientNameMap.set(p.user_id, p.name))

  // Enforcement de plan para los recordatorios de medicamentos (Tarea B) —
  // "10 min antes" (a) y "ventana por vencer" (b) son la promesa de Plan
  // Familiar. Free post-trial no los recibe; trial sí — misma regla que el
  // resto del enforcement del producto: se evalúa contra plan real + trial
  // vencido, nunca contra plan a secas. No toca autoMarkMissed(): ese es un
  // registro de datos, no un aviso, y corre siempre sin importar el plan.
  //
  // Fail-open a propósito: si un ownerId no aparece en subscriptions (no
  // debería pasar en producción), se le manda el recordatorio igual. Las
  // consecuencias son asimétricas — un push de más a alguien que no paga es
  // un costo trivial; silenciar la alerta de medicamentos de una familia por
  // una fila faltante o corrupta es el riesgo #1 de retención del producto.
  const { data: subscriptionRows } = await supabase
    .from('subscriptions').select('user_id, plan, status, trial_end_date').in('user_id', ownerIdSet)
  const subscriptionByOwner = new Map<string, { plan: string; status: string; trial_end_date: string | null }>()
  ;(subscriptionRows ?? []).forEach((s: { user_id: string; plan: string; status: string; trial_end_date: string | null }) =>
    subscriptionByOwner.set(s.user_id, s))

  function remindersGated(ownerId: string): boolean {
    const s = subscriptionByOwner.get(ownerId)
    if (!s) {
      console.warn(`[send-med-notifications] No subscription row for owner ${ownerId} — enviando recordatorio igual (fail-open)`)
      return false
    }
    if (s.plan !== 'free') return false
    const trialEndMs = s.trial_end_date ? new Date(s.trial_end_date).getTime() : 0
    const trialExpired = s.status === 'expired' || (s.status === 'trial' && trialEndMs <= Date.now())
    return trialExpired
  }

  let sentCount = 0
  let failCount = 0
  const failureReasons: Record<string, number> = {}

  async function sendToOwner(ownerId: string, payload: Record<string, unknown>) {
    const { data: members } = await supabase
      .from('family_members').select('member_user_id').eq('user_id', ownerId)
    const userIds = [ownerId, ...(members?.map((m: { member_user_id: string }) => m.member_user_id).filter(Boolean) ?? [])]
    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds)
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 86400 }
        )
        sentCount++
      } catch (err: unknown) {
        failCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        const reasonKey = statusCode ? String(statusCode) : 'unknown'
        failureReasons[reasonKey] = (failureReasons[reasonKey] ?? 0) + 1
        console.error(`[send-med-notifications] ✗ Push failed for sub ${sub.id}, status=${statusCode}`)
        if (statusCode && statusCode >= 400 && statusCode !== 429 && statusCode !== 413) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  async function autoMarkMissed(med: { id: string; user_id: string }, scheduledTime: string) {
    const [hh, mm] = scheduledTime.split(':').map(Number)
    const d = new Date(); d.setHours(hh, mm, 0, 0)
    await supabase.from('medication_logs').upsert({
      medication_id: med.id, user_id: med.user_id, status: 'missed',
      log_date: todayPR, confirmed_by_name: 'Sistema automático',
      confirmed_at: new Date().toISOString(), scheduled_at: d.toISOString(),
    }, { onConflict: 'medication_id,log_date,user_id', ignoreDuplicates: true })
  }

  // ── (a) 10 min antes de la hora programada ──────────────────────────────────
  const remind10 = new Date(now.getTime() + 10 * 60 * 1000)
  const remind10Variants = [toHHMM(shiftTZ(remind10, -4)), toHHMM(shiftTZ(remind10, -5)), toHHMM(shiftTZ(remind10, -6))]

  for (const med of allMeds ?? []) {
    for (const st of med.scheduled_times ?? []) {
      if (!remind10Variants.includes(st)) continue
      if (remindersGated(med.user_id)) continue
      const patientName = patientNameMap.get(med.user_id) ?? 'tu familiar'
      const timeLabel = fmt12h(st)
      console.log(`[send-med-notifications] (a) 10-min-antes: med ${med.id} @ ${st}`)
      await sendToOwner(med.user_id, {
        title: `Es hora del cuidado de las ${timeLabel} de ${patientName}`,
        body: 'Toca para ver los detalles en la app.',
        url: '/medications',
        tag: `med-reminder-${med.id}-${st}`,
        data: { family_id: med.user_id, patient_name: patientName, event_type: 'MED_REMINDER', target_screen: 'medications' },
      })
    }
  }

  // ── (b) 10 min antes de que venza la ventana clínica real, solo si no hay confirmación ──
  const windowClosingSoon: Array<{ medId: string; userId: string; scheduledTime: string }> = []
  const windowJustClosed: Array<{ med: { id: string; user_id: string }; scheduledTime: string }> = []

  for (const med of allMeds ?? []) {
    const win = med.time_window_minutes ?? 60
    for (const st of med.scheduled_times ?? []) {
      const warnAt   = addMinutes(st, win - 10)
      const closesAt = addMinutes(st, win)
      if (nowVariants.includes(warnAt))   windowClosingSoon.push({ medId: med.id, userId: med.user_id, scheduledTime: st })
      // Auto-marcado: la ventana real (no un valor fijo de 61 min) acaba de cerrar.
      if (nowVariants.includes(closesAt)) windowJustClosed.push({ med, scheduledTime: st })
    }
  }

  if (windowClosingSoon.length > 0) {
    const candidateIds = [...new Set(windowClosingSoon.map(w => w.medId))]
    const { data: confirmedLogs } = await supabase
      .from('medication_logs').select('medication_id')
      .eq('log_date', todayPR).eq('status', 'confirmed').in('medication_id', candidateIds)
    const confirmedSet = new Set((confirmedLogs ?? []).map((l: { medication_id: string }) => l.medication_id))

    for (const w of windowClosingSoon) {
      if (confirmedSet.has(w.medId)) continue
      if (remindersGated(w.userId)) continue
      const patientName = patientNameMap.get(w.userId) ?? 'tu familiar'
      const timeLabel = fmt12h(w.scheduledTime)
      console.log(`[send-med-notifications] (b) ventana-por-vencer: med ${w.medId} @ ${w.scheduledTime}`)
      await sendToOwner(w.userId, {
        title: `Quedan 10 minutos para registrar el cuidado de las ${timeLabel} de ${patientName}`,
        body: 'Toca para ver los detalles en la app.',
        url: '/medications',
        tag: `window-closing-${w.medId}-${w.scheduledTime}`,
        requireInteraction: true,
        data: { family_id: w.userId, patient_name: patientName, event_type: 'WINDOW_CLOSING', target_screen: 'medications' },
      })
    }
  }

  for (const j of windowJustClosed) {
    await autoMarkMissed(j.med, j.scheduledTime)
  }

  console.log(`[send-med-notifications] Done. sent=${sentCount}, failed=${failCount}`)

  await logRun({ attempted: sentCount + failCount, sent: sentCount, failed: failCount, failureReasons })

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, medications: allMeds?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
