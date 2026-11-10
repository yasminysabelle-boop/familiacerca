// FamiliaCerca — Correo de bienvenida.
// Dos casos, misma función:
//   - Dueño de la familia (ownerId === usuario): se llama al terminar el
//     onboarding. Bienvenida + qué hacer primero + invitar a la familia.
//   - Miembro invitado: se llama al aceptar la invitación (JoinFamily).
// Deploy: supabase functions deploy send-welcome
// Auditoría nov 2026: antes nunca se llamaba desde la app y el botón llevaba a
// app.familiacerca.com, que no existe.

import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://familiacerca.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function shell(title: string, inner: string, ctaLabel: string, ctaUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#F7F6F2;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E6E3DB;">
  <div style="background:#0C6C9C;background:linear-gradient(135deg,#1677A6,#0A4A6B);padding:26px 24px;text-align:center;">
    <img src="https://familiacerca.com/logo.png" width="56" height="56" alt="FamiliaCerca" style="display:block;margin:0 auto 10px;width:56px;height:56px;background:#ffffff;border-radius:50%;padding:8px;">
    <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">FamiliaCerca</p>
    <p style="margin:4px 0 0;color:#A6E3EC;font-size:13px;letter-spacing:2px;">CUIDADO CON AMOR</p>
  </div>
  <div style="padding:28px 24px;">
    <h1 style="margin:0 0 12px;font-size:21px;color:#14303D;">${title}</h1>
    ${inner}
    <p style="margin:24px 0 0;text-align:center;">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:#E9826E;color:#ffffff;font-size:16px;font-weight:bold;border-radius:12px;text-decoration:none;">${ctaLabel}</a>
    </p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #F3EEE8;text-align:center;">
    <p style="margin:0;font-size:12px;color:#5E7480;">FamiliaCerca · hola@familiacerca.com</p>
  </div>
</div>
</body></html>`
}

function list(items: string[]): string {
  return `<ul style="list-style:none;padding:0;margin:0 0 8px;border-top:1px solid #F3EEE8;">${items.map(f =>
    `<li style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3EEE8;">${f}</li>`).join('')}</ul>`
}

function ownerEmailHtml(name: string, relativeName: string): string {
  const first = name.split(' ')[0]
  return shell(
    `¡Bienvenida/o, ${first}!`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">Ya tienes un solo lugar para organizar el cuidado de <strong>${relativeName}</strong> con tu familia. Tienes 14 días con todo incluido, sin tarjeta.</p>
     <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Para empezar</p>
     ${list([
       '👨‍👩‍👧 Invita a una persona de la familia: el cuidado pesa menos entre dos',
       '📲 Agrega FamiliaCerca a la pantalla de tu celular para abrirla como una app',
       '💊 Registra la primera dosis o el primer cuidado del día',
     ])}`,
    'Abrir FamiliaCerca',
    `${APP_URL}/dashboard`,
  )
}

function memberEmailHtml(name: string, relativeName: string, role: string): string {
  const roleLabel = role === 'cuidador' ? 'cuidador/a' : 'familiar'
  const features = role === 'cuidador'
    ? ['💊 Registrar medicamentos y cuidados del día', '📅 Ver y crear citas', '📝 Escribir notas', '💬 Hablar con la familia en el chat']
    : ['💊 Ver cómo van los medicamentos', '📅 Consultar las citas', '📝 Leer las notas del día', '💬 Hablar con la familia en el chat']
  return shell(
    '¡Bienvenida/o a FamiliaCerca!',
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">Hola <strong>${name.split(' ')[0]}</strong>, ya formas parte del equipo de cuidado de <strong>${relativeName}</strong> como <strong>${roleLabel}</strong>.</p>
     <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Lo que puedes hacer</p>
     ${list(features)}`,
    'Abrir FamiliaCerca',
    `${APP_URL}/dashboard`,
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

  const { ownerId } = await req.json()
  if (!ownerId) return json({ error: 'ownerId required' }, 400)

  const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Hola'
  const email = user.email
  if (!email) return json({ error: 'User has no email' }, 400)

  const isOwner = ownerId === user.id

  // Nombre del familiar: patient_profiles (onboarding) o care_profiles.
  const { data: pp } = await supabase.from('patient_profiles').select('nombre_completo').eq('owner_id', ownerId).maybeSingle()
  const { data: cp } = pp?.nombre_completo ? { data: null } : await supabase.from('care_profiles').select('name').eq('user_id', ownerId).maybeSingle()
  const relativeName = pp?.nombre_completo ?? cp?.name ?? 'tu familiar'

  let html: string
  let subject: string
  if (isOwner) {
    html = ownerEmailHtml(name, relativeName)
    subject = `Bienvenida/o a FamiliaCerca: así empiezas con ${relativeName}`
  } else {
    // Solo miembros reales de esa familia reciben el correo de miembro.
    const { data: membership } = await supabase.from('family_members').select('role')
      .eq('user_id', ownerId).eq('member_user_id', user.id).maybeSingle()
    if (!membership) return json({ error: 'Not a member of this family' }, 403)
    html = memberEmailHtml(name, relativeName, membership.role ?? 'familiar')
    subject = `Ya eres parte del cuidado de ${relativeName} en FamiliaCerca`
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'FamiliaCerca <noreply@familiacerca.com>', to: [email], subject, html }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[send-welcome] Resend error ${res.status}:`, body)
    return json({ error: 'Email send failed' }, 502)
  }
  const data = await res.json()
  console.log(`[send-welcome] sent (${isOwner ? 'owner' : 'member'}) id=${data.id}`)
  return json({ ok: true, id: data.id })
})
