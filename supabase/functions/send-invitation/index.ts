// FamiliaCerca — Family Invitation Email
// Called by the client when an admin invites a new member.
// Deploy: supabase functions deploy send-invitation

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function invitationEmailHtml(
  inviterName: string,
  relativeName: string,
  role: string,
  invitationLink: string
): string {
  const roleLabel = role === 'cuidador' ? 'cuidador/a' : 'familiar'
  const roleDesc = role === 'cuidador'
    ? 'Podrás registrar medicamentos, gastos y eventos del cuidado.'
    : 'Podrás ver el estado de salud y el cuidado diario.'

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#F7F6F2;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#0C6C9C;background:linear-gradient(135deg,#1677A6,#0A4A6B);padding:28px 24px;text-align:center;">
    <img src="https://familiacerca.com/logo.png" width="56" height="56" alt="FamiliaCerca" style="display:block;margin:0 auto 10px;width:56px;height:56px;background:#ffffff;border-radius:50%;padding:8px;">
    <h1 style="color:white;font-family:Arial,sans-serif;margin:0;font-size:22px;">FamiliaCerca</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Te han invitado a unirte</p>
  </div>
  <div style="padding:28px 24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#14303D;line-height:1.6;">
      <strong>${inviterName}</strong> te ha invitado a unirte al cuidado de <strong>${relativeName}</strong> en FamiliaCerca como <strong>${roleLabel}</strong>.
    </p>
    <div style="background:#E3F1F8;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#0A4A6B;font-weight:600;">¿Qué podrás hacer?</p>
      <p style="margin:6px 0 0;font-size:13px;color:#374151;">${roleDesc}</p>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${invitationLink}" style="display:inline-block;padding:14px 32px;background:#E9826E;color:white;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;">
        Aceptar invitación
      </a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#5E7480;text-align:center;line-height:1.6;">
      Si no esperabas esta invitación, puedes ignorar este correo.<br>
      El enlace expirará en 7 días.
    </p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #E6E3DB;text-align:center;">
    <p style="font-size:13px;color:#5E7480;margin:0;">FamiliaCerca · Cuidado familiar con amor</p>
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

  // Límite server-side (nov 2026): una cuenta no puede usar este correo para
  // mandar invitaciones sin fin (spam). 20 por día, 8 por hora alcanza de
  // sobra para invitar a toda una familia. Reusa el contador de IA.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: allowed, error: rlErr } = await userClient.rpc('check_and_increment_ai_usage', {
    p_function_name: 'send-invitation', p_daily_limit: 20, p_hourly_limit: 8,
  })
  if (rlErr) console.error('[send-invitation] rate limit check failed:', rlErr)
  else if (!allowed) {
    return new Response(JSON.stringify({
      error: 'rate_limited',
      message: 'Ya mandaste muchas invitaciones hoy. Puedes compartir el enlace por WhatsApp o intentarlo mañana.',
    }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { inviteeEmail, inviterName, relativeName, invitationLink, role } = await req.json()

  if (!inviteeEmail || !inviterName || !relativeName || !invitationLink) {
    return new Response(
      JSON.stringify({ error: 'inviteeEmail, inviterName, relativeName, and invitationLink are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[send-invitation] Sending invite to ${inviteeEmail} from ${inviterName} (family: ${relativeName})`)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FamiliaCerca <noreply@familiacerca.com>',
      to: [inviteeEmail],
      subject: `💙 ${inviterName} te invita a cuidar a ${relativeName} juntos`,
      html: invitationEmailHtml(inviterName, relativeName, role ?? 'familiar', invitationLink),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[send-invitation] Resend error ${res.status}:`, body)
    return new Response(JSON.stringify({ error: 'Email send failed', detail: body }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()
  console.log(`[send-invitation] ✓ Sent, id=${data.id}`)

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
