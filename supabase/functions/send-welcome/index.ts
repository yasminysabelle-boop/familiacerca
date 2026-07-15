// FamiliaCerca — Welcome Email (sent after invitation is accepted)
// Called by the client after the new member joins a family.
// Deploy: supabase functions deploy send-welcome

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function welcomeEmailHtml(memberName: string, relativeName: string, role: string): string {
  const roleLabel = role === 'cuidador' ? 'cuidador/a' : 'familiar'
  const features = role === 'cuidador'
    ? [
        '💊 Registrar y confirmar medicamentos diarios',
        '📅 Ver y crear eventos en el calendario',
        '💰 Registrar gastos de cuidado',
        '📝 Escribir notas del cuidado',
        '🚨 Enviar alertas de emergencia',
      ]
    : [
        '💊 Ver los medicamentos diarios',
        '📅 Consultar el calendario de cuidados',
        '💰 Ver los gastos del mes',
        '🚨 Enviar alertas de emergencia',
      ]

  const featureRows = features.map(f =>
    `<li style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3EEE8;">${f}</li>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#F9F5F1;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#C4623A,#A85130);padding:28px 24px;text-align:center;">
    <p style="margin:0;font-size:36px;">🎉</p>
    <h1 style="color:white;font-family:Georgia,serif;margin:8px 0 0;font-size:22px;">¡Bienvenido/a a FamiliaCerca!</h1>
  </div>
  <div style="padding:28px 24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1A1A1A;line-height:1.6;">
      Hola <strong>${memberName}</strong>, ahora formas parte del equipo de cuidado de <strong>${relativeName}</strong> como <strong>${roleLabel}</strong>.
    </p>
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6B7280;letter-spacing:0.05em;text-transform:uppercase;">Lo que puedes hacer</p>
    <ul style="list-style:none;padding:0;margin:0 0 24px;border-top:1px solid #F3EEE8;">
      ${featureRows}
    </ul>
    <div style="text-align:center;">
      <a href="https://app.familiacerca.com/medications" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#C4623A,#A85130);color:white;font-weight:700;font-size:15px;border-radius:12px;text-decoration:none;">
        Abrir FamiliaCerca
      </a>
    </div>
    <div style="margin-top:24px;padding:14px;background:#F0FDF4;border-radius:10px;border:1px solid #BBF7D0;">
      <p style="margin:0;font-size:13px;color:#16A34A;font-weight:600;text-align:center;">
        💙 Gracias por ser parte del cuidado de ${relativeName}.
      </p>
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { ownerId } = await req.json()
  if (!ownerId) {
    return new Response(JSON.stringify({ error: 'ownerId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Resolve member's name and email from the authed user
  const memberName = user.user_metadata?.full_name ?? user.email ?? 'Nuevo miembro'
  const memberEmail = user.email

  if (!memberEmail) {
    return new Response(JSON.stringify({ error: 'User has no email' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get the family profile to find relative name
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('name')
    .eq('user_id', ownerId)
    .maybeSingle()

  const relativeName = profile?.name ?? 'tu familiar'

  // Get the role from family_members
  const { data: membership } = await supabase
    .from('family_members')
    .select('role')
    .eq('user_id', ownerId)
    .eq('member_user_id', user.id)
    .maybeSingle()

  const role = membership?.role ?? 'familiar'

  console.log(`[send-welcome] Sending welcome to ${memberEmail} (${memberName}), role=${role}, relative=${relativeName}`)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FamiliaCerca <noreply@familiacerca.com>',
      to: [memberEmail],
      subject: `💙 ¡Bienvenido/a a FamiliaCerca! Ya puedes cuidar a ${relativeName}`,
      html: welcomeEmailHtml(memberName, relativeName, role),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[send-welcome] Resend error ${res.status}:`, body)
    return new Response(JSON.stringify({ error: 'Email send failed', detail: body }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()
  console.log(`[send-welcome] ✓ Sent welcome to ${memberEmail}, id=${data.id}`)

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
