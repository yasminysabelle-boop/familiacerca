// FamiliaCerca — Resumen semanal (nov 2026)
// Cada domingo: cómo fue la semana del cuidado y quién hizo qué, para la
// persona que administra la familia (la que paga). Sin datos médicos
// sensibles: solo conteos y nombres.
// Auth: X-Cron-Secret (pg_cron) o JWT de usuario (solo su propia familia).
// Deploy: supabase functions deploy send-weekly-summary

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Person = { name: string; meds: number; care: number; tasks: number; money: number; hours: number }
const SKIP = new Set(['', 'sistema automático', 'sistema automatico', 'sin nombre'])
const first = (n?: string | null) => (n ?? '').trim().split(' ')[0]
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function emailHtml(relative: string, people: Person[], t: { meds: number; care: number; tasks: number; money: number; hours: number; notes: number }) {
  const top = people[0]
  const total = (p: Person) => p.meds + p.care + p.tasks + (p.money > 0 ? 1 : 0) + (p.hours > 0 ? 1 : 0)
  const sum = people.reduce((a, p) => a + total(p), 0)
  const heavy = people.length > 1 && top && total(top) / sum >= 0.7
  const rows = people.map(p => {
    const bits = [
      p.meds && `${p.meds} medicina${p.meds === 1 ? '' : 's'}`,
      p.care && `${p.care} cuidado${p.care === 1 ? '' : 's'}`,
      p.tasks && `${p.tasks} tarea${p.tasks === 1 ? '' : 's'}`,
      p.hours > 0 && `${Math.round(p.hours)} h de turno`,
      p.money > 0 && `$${p.money.toFixed(2)} en gastos`,
    ].filter(Boolean).join(' · ')
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #EEEBE4;font-size:16px;color:#14303D;"><strong>${esc(p.name)}</strong><br><span style="font-size:14px;color:#4E6470;">${bits}</span></td></tr>`
  }).join('')
  const stat = (n: string | number, l: string) => `<td style="text-align:center;padding:8px;"><div style="font-size:24px;font-weight:800;color:#0C6C9C;">${n}</div><div style="font-size:13px;color:#4E6470;">${l}</div></td>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#F7F6F2;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #E6E3DB;">
  <div style="background:#0C6C9C;padding:26px 24px;text-align:center;">
    <img src="https://familiacerca.com/logo.png" width="52" height="52" alt="FamiliaCerca" style="display:block;margin:0 auto 10px;background:#fff;border-radius:50%;padding:8px;">
    <h1 style="color:white;margin:0;font-size:21px;">La semana de ${esc(relative)}</h1>
    <p style="color:#DCEFF8;margin:6px 0 0;font-size:15px;">Así se repartió el cuidado en los últimos 7 días</p>
  </div>
  <div style="padding:22px 24px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr>
      ${stat(t.meds, 'medicinas dadas')}${stat(t.care, 'cuidados')}${stat(t.tasks, 'tareas hechas')}
    </tr></table>
    ${t.money > 0 ? `<p style="margin:0 0 6px;font-size:15px;color:#14303D;">💵 Gastos de la semana: <strong>$${t.money.toFixed(2)}</strong></p>` : ''}
    ${t.hours > 0 ? `<p style="margin:0 0 6px;font-size:15px;color:#14303D;">🕒 Horas de turno registradas: <strong>${Math.round(t.hours)} h</strong></p>` : ''}
    ${t.notes > 0 ? `<p style="margin:0 0 6px;font-size:15px;color:#14303D;">📝 Notas nuevas en el historial: <strong>${t.notes}</strong></p>` : ''}
    ${people.length ? `<h2 style="font-size:17px;color:#14303D;margin:18px 0 4px;">Quién hizo qué</h2><table style="width:100%;border-collapse:collapse;">${rows}</table>` : '<p style="font-size:15px;color:#4E6470;">Esta semana no se registró nada en la app. ¿Todo bien en casa?</p>'}
    ${heavy ? `<p style="margin:16px 0 0;padding:12px 14px;border-radius:14px;background:#FBEAE4;font-size:15px;color:#8A3A2A;">${esc(top.name)} hizo la mayor parte esta semana. ¿Alguien puede tomar una tarea, aunque sea desde lejos?</p>` : ''}
    <div style="margin-top:22px;text-align:center;">
      <a href="https://familiacerca.com/familia" style="display:inline-block;padding:13px 28px;background:#0C6C9C;color:white;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;">Ver en la app</a>
    </div>
  </div>
  <div style="padding:14px 24px;border-top:1px solid #EEEBE4;text-align:center;">
    <p style="font-size:13px;color:#5E7480;margin:0;">FamiliaCerca · Cuidado familiar con amor<br>Te llega cada domingo porque administras esta familia. Puedes pedirnos dejar de recibirlo en hola@familiacerca.com</p>
  </div>
</div></body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const cronSecret = Deno.env.get('CRON_SECRET')
  let callerId: string | null = null
  if (!(cronSecret && req.headers.get('X-Cron-Secret') === cronSecret)) {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    callerId = user.id // un usuario solo puede pedir el de su propia familia
  }
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const sinceIso = since.toISOString()
  const sinceDate = sinceIso.split('T')[0]

  const pq = supabase.from('care_profiles').select('user_id, name')
  if (callerId) pq.eq('user_id', callerId)
  const { data: profiles, error } = await pq
  if (error) return json({ error: 'DB error' }, 500)

  let sent = 0, failed = 0
  for (const prof of profiles ?? []) {
    const ownerId = prof.user_id as string
    const relative = first(prof.name) || 'tu familiar'
    const [meds, care, tasks, exp, shifts, notes] = await Promise.all([
      supabase.from('medication_logs').select('confirmed_by_name').eq('user_id', ownerId).eq('status', 'confirmed').gte('confirmed_at', sinceIso),
      supabase.from('daily_care_logs').select('checked_by, status').eq('user_id', ownerId).gte('log_date', sinceDate),
      supabase.from('family_tasks').select('done_by_name').eq('user_id', ownerId).gte('done_at', sinceIso),
      supabase.from('care_expenses').select('paid_by, amount').eq('user_id', ownerId).gte('date', sinceDate),
      supabase.from('caregiver_shifts').select('caregiver_name, check_in_at, check_out_at').eq('user_id', ownerId).gte('check_in_at', sinceIso),
      supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).gte('created_at', sinceIso),
    ])
    const map: Record<string, Person> = {}
    const add = (n: string | null | undefined, f: keyof Omit<Person, 'name'>, v = 1) => {
      const name = first(n); const k = name.toLowerCase()
      if (SKIP.has(k)) return
      map[k] ??= { name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), meds: 0, care: 0, tasks: 0, money: 0, hours: 0 }
      map[k][f] += v
    }
    for (const r of meds.data ?? []) add(r.confirmed_by_name, 'meds')
    for (const r of care.data ?? []) if (r.status !== 'no_completado') add(r.checked_by, 'care')
    for (const r of tasks.data ?? []) add(r.done_by_name, 'tasks')
    for (const r of exp.data ?? []) add(r.paid_by, 'money', parseFloat(r.amount) || 0)
    for (const r of shifts.data ?? []) if (r.check_out_at) add(r.caregiver_name, 'hours', (new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime()) / 3600000)
    const people = Object.values(map).sort((a, b) => (b.meds + b.care + b.tasks) - (a.meds + a.care + a.tasks))
    const t = {
      meds: (meds.data ?? []).length,
      care: (care.data ?? []).filter(r => r.status !== 'no_completado').length,
      tasks: (tasks.data ?? []).length,
      money: (exp.data ?? []).reduce((a, r) => a + (parseFloat(r.amount) || 0), 0),
      hours: people.reduce((a, p) => a + p.hours, 0),
      notes: notes.count ?? 0,
    }

    const { data: { user: owner } } = await supabase.auth.admin.getUserById(ownerId)
    if (!owner?.email) continue
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'FamiliaCerca <noreply@familiacerca.com>',
          to: [owner.email],
          subject: `La semana de ${relative}: quién hizo qué`,
          html: emailHtml(relative, people, t),
        }),
      })
      if (res.ok) sent++; else failed++
    } catch { failed++ }
  }

  try {
    await supabase.rpc('log_notification_run', {
      p_function_name: 'send-weekly-summary', p_attempted: sent + failed, p_sent: sent, p_failed: failed,
      p_failure_reasons: null, p_fatal_error: null,
    })
  } catch { /* no rompe el envío */ }
  return json({ sent, failed, families: (profiles ?? []).length })
})
