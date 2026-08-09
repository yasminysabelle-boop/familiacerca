// FamiliaCerca — Daily Medication Summary Email
// Runs at 8 pm via pg_cron or Supabase scheduled invocation.
// Sends each family a summary of how many medications were taken today.
// Auth: X-Cron-Secret: <CRON_SECRET> (pg_cron) OR Authorization: Bearer <JWT de
// usuario válido> — Authorization con verify_jwt:true exige un JWT real, así
// que el secreto de cron va en header aparte (ver X-Cron-Secret más abajo).
// Deploy: supabase functions deploy send-daily-summary

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function summaryEmailHtml(
  relativeName: string,
  taken: number,
  total: number,
  details: { name: string; taken: boolean; time: string | null }[]
): string {
  const allDone = taken === total && total > 0
  const headerBg = allDone ? '#16A34A' : '#C4623A'
  const headerIcon = allDone ? '✅' : '💊'
  const headerMsg = allDone
    ? `¡${relativeName} tomó todos sus medicamentos hoy!`
    : `${relativeName} tomó ${taken} de ${total} medicamentos hoy`

  const rows = details.map(d => {
    const icon = d.taken ? '✅' : '⏳'
    const timeStr = d.time ? ` <span style="color:#9CA3AF;font-size:12px;">· ${d.time}</span>` : ''
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #F3EEE8;font-size:14px;color:${d.taken ? '#6B7280' : '#1A1A1A'};${d.taken ? 'text-decoration:line-through;' : ''}">
        ${icon} ${d.name}${timeStr}
      </td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#F9F5F1;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:${headerBg};padding:28px 24px;text-align:center;">
    <p style="margin:0;font-size:32px;">${headerIcon}</p>
    <h1 style="color:white;font-family:Georgia,serif;margin:8px 0 0;font-size:20px;">${headerMsg}</h1>
  </div>
  <div style="padding:28px 24px;">
    <p style="margin:0 0 20px;font-size:13px;color:#6B7280;text-align:center;">
      Resumen del ${new Date().toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })}
    </p>
    ${total > 0 ? `
    <div style="background:#F9F5F1;border-radius:10px;padding:4px 16px;margin-bottom:8px;">
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>` : '<p style="color:#9CA3AF;text-align:center;font-size:14px;">No hay medicamentos configurados.</p>'}
    <div style="margin-top:20px;text-align:center;">
      <a href="https://app.familiacerca.com/medications" style="display:inline-block;padding:12px 28px;background:#C4623A;color:white;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">
        Ver detalles en la app
      </a>
    </div>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #F3EEE8;text-align:center;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">FamiliaCerca · Cuidado familiar con amor</p>
  </div>
</div>
</body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Accept either CRON_SECRET (scheduled invocations, en header propio — Authorization
  // con verify_jwt:true exige un JWT real, un secreto suelto ahí lo rechaza en el
  // gateway antes de llegar acá) o un JWT de usuario válido.
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')
  const cronHeader = req.headers.get('X-Cron-Secret') ?? ''
  const token = authHeader.replace('Bearer ', '')

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
        p_function_name: 'send-daily-summary',
        p_attempted: opts.attempted ?? 0,
        p_sent: opts.sent ?? 0,
        p_failed: opts.failed ?? 0,
        p_failure_reasons: opts.failureReasons && Object.keys(opts.failureReasons).length ? opts.failureReasons : null,
        p_fatal_error: opts.fatalError ?? null,
      })
    } catch (logErr) {
      console.error('[send-daily-summary] Failed to log notification run (non-fatal):', logErr)
    }
  }

  let authorized = false

  if (cronSecret && cronHeader === cronSecret) {
    authorized = true
  } else {
    const { data: { user } } = await supabase.auth.getUser(token)
    authorized = !!user
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    await logRun({ fatalError: 'Missing RESEND_API_KEY' })
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Optional: target a single family for testing
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const targetOwnerId: string | null = body.ownerId ?? null

  const today = new Date().toISOString().split('T')[0]
  console.log(`[send-daily-summary] Running for date ${today}${targetOwnerId ? `, family ${targetOwnerId}` : ', all families'}`)

  // Fetch all families (or a specific one)
  const profilesQuery = supabase.from('care_profiles').select('user_id, name')
  if (targetOwnerId) profilesQuery.eq('user_id', targetOwnerId)
  const { data: profiles, error: profilesErr } = await profilesQuery
  if (profilesErr) {
    console.error('[send-daily-summary] Error fetching profiles:', profilesErr)
    await logRun({ fatalError: `Error fetching profiles: ${profilesErr.message}` })
    return new Response(JSON.stringify({ error: 'DB error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!profiles || profiles.length === 0) {
    await logRun({})
    return new Response(JSON.stringify({ message: 'No families found', sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch all family_members at once
  const ownerIds = profiles.map((p: { user_id: string }) => p.user_id)
  const { data: allMembers } = await supabase
    .from('family_members')
    .select('user_id, member_user_id')
    .in('user_id', ownerIds)

  // Fetch all medications and today's logs at once
  const { data: allMeds } = await supabase
    .from('medications')
    .select('id, user_id, name, scheduled_times, time')
    .in('user_id', ownerIds)

  const { data: allLogs } = await supabase
    .from('medication_logs')
    .select('medication_id, user_id, status')
    .in('user_id', ownerIds)
    .eq('log_date', today)
    .eq('status', 'confirmed')

  const confirmedSet = new Set((allLogs ?? []).map((l: { medication_id: string }) => l.medication_id))

  // Build userId -> email map via admin API (batch)
  const allUserIds = Array.from(new Set([
    ...ownerIds,
    ...(allMembers ?? []).map((m: { member_user_id: string }) => m.member_user_id),
  ]))
  const userEmailMap = new Map<string, string>()
  await Promise.all(
    allUserIds.map(async id => {
      const { data: { user } } = await supabase.auth.admin.getUserById(id)
      if (user?.email) userEmailMap.set(id, user.email)
    })
  )

  let totalSent = 0
  let totalFailed = 0
  const failureReasons: Record<string, number> = {}

  for (const profile of profiles) {
    const ownerId: string = profile.user_id
    const relativeName: string = profile.name ?? 'tu familiar'

    // Family emails: owner + members
    const memberIds = (allMembers ?? [])
      .filter((m: { user_id: string }) => m.user_id === ownerId)
      .map((m: { member_user_id: string }) => m.member_user_id)
    const familyIds = Array.from(new Set([ownerId, ...memberIds]))
    const emails = familyIds.map(id => userEmailMap.get(id)).filter((e): e is string => !!e)

    if (emails.length === 0) {
      console.log(`[send-daily-summary] No emails for family ${ownerId}, skipping`)
      continue
    }

    // Build medication detail list
    const familyMeds = (allMeds ?? []).filter((m: { user_id: string }) => m.user_id === ownerId)
    const details = familyMeds.map((med: { id: string; name: string; scheduled_times?: string[]; time?: string }) => ({
      name: med.name,
      taken: confirmedSet.has(med.id),
      time: med.scheduled_times?.[0] ?? med.time ?? null,
    }))
    const taken = details.filter((d: { taken: boolean }) => d.taken).length
    const total = details.length

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'FamiliaCerca <noreply@familiacerca.com>',
          to: emails,
          subject: `💊 Resumen de hoy — ${relativeName} tomó ${taken} de ${total} medicamentos`,
          html: summaryEmailHtml(relativeName, taken, total, details),
        }),
      })
      console.log(`[send-daily-summary] Family ${ownerId}: sent to ${emails.length} recipients, status=${res.status}`)
      if (res.ok) {
        totalSent++
      } else {
        totalFailed++
        const reasonKey = String(res.status)
        failureReasons[reasonKey] = (failureReasons[reasonKey] ?? 0) + 1
        console.error(`[send-daily-summary] ✗ Resend non-ok status for family ${ownerId}: ${res.status}`)
      }
    } catch (err) {
      totalFailed++
      failureReasons['exception'] = (failureReasons['exception'] ?? 0) + 1
      console.error(`[send-daily-summary] Failed for family ${ownerId}:`, err)
    }
  }

  await logRun({ attempted: totalSent + totalFailed, sent: totalSent, failed: totalFailed, failureReasons })

  return new Response(
    JSON.stringify({ sent: totalSent, families: profiles.length, date: today }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
