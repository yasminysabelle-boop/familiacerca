// FamiliaCerca — Medication Reminder Push Notifications
// Deploy: supabase functions deploy send-med-notifications
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_CONTACT_EMAIL=...
// Cron: run every minute via pg_cron (see supabase/setup_cron.sql)
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

  let sentCount = 0
  let failCount = 0

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

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failCount, medications: allMeds?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
