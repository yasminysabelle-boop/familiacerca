import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

// 'gemini-flash-latest' now resolves to a model generation that rejects
// thinkingBudget:0 outright (INVALID_ARGUMENT) and doesn't treat a low budget
// as a hard cap — thinking tokens count against maxOutputTokens, so we pad
// the ceiling well above what the caller asked for or replies get truncated
// empty (MAX_TOKENS with no text). Mismo patron que gemini-proxy/index.ts.
const THINKING = { thinkingConfig: { thinkingBudget: 256 } };
const THINKING_MARGIN = 700;

// Backstop, no filtro principal -- las imágenes ya llegan comprimidas del
// lado del cliente (Medications.jsx / DiarioMedicoEntryModal.jsx), así que
// una foto legítima queda lejos de este número. El modo voz del Diario
// Médico nunca manda image_base64 -- solo texto, muy por debajo del techo.
const MAX_BODY_BYTES = 6 * 1024 * 1024;

// Un solo endpoint, dos features con cupos totalmente independientes --
// gastar el de medicamentos no debe tocar el de diario ni viceversa. Cada
// feature tiene su propio function_name en check_and_increment_ai_usage
// (ver add_ai_usage_rate_limit.sql), así que los contadores diario/hora no
// se comparten.
const FEATURES = {
  // Acción deliberada (agregar/renovar medicamento con foto), no
  // conversacional. 20/día da margen generoso para reintentos por foto mala
  // en un día muy activo, sin dejar la puerta abierta a un loop de fotos.
  medications: { functionName: 'gemini-vision', dailyLimit: 20, hourlyLimit: 10 },
  // Diario Médico (voz o foto). Nadie carga más de un puñado de entradas
  // reales en un día -- mismo techo conservador que tenía claude-proxy
  // cuando esta feature corría sobre Claude, ahora sobre el mismo modelo
  // que medications pero con su propio contador.
  diario: { functionName: 'gemini-vision-diario', dailyLimit: 15, hourlyLimit: 5 },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const corsJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return corsJson({ error: 'Unauthorized' }, 401);
  }

  // Verify caller is an authenticated Supabase user
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return corsJson({ error: 'Unauthorized' }, 401);
  }

  if (!GEMINI_KEY) {
    return corsJson({ error: 'API not configured' }, 503);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return corsJson({
      error: 'payload_too_large',
      message: 'La imagen es demasiado pesada. Probá con una foto más liviana.',
    }, 413);
  }

  let parsedBody: { feature?: string; image_base64?: string; media_type?: string; prompt?: unknown };
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return corsJson({ error: 'invalid_json' }, 400);
  }

  const { feature, image_base64, media_type, prompt } = parsedBody;
  const featureConfig = feature ? FEATURES[feature as keyof typeof FEATURES] : undefined;
  if (!featureConfig) {
    return corsJson({ error: 'invalid_request', message: 'Falta identificar la función que hace el pedido.' }, 400);
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return corsJson({ error: 'invalid_request', message: 'Falta el contenido a analizar.' }, 400);
  }

  // Rate limit por usuario, día y hora, con contador propio por feature --
  // nunca confía en el cliente, se evalúa e incrementa server-side.
  // isAppAdmin (cuenta de administración, no un plan pago) bypasea el límite.
  if (user.app_metadata?.role !== 'admin') {
    const { data: allowed, error: rlErr } = await supabase.rpc('check_and_increment_ai_usage', {
      p_function_name: featureConfig.functionName,
      p_daily_limit: featureConfig.dailyLimit,
      p_hourly_limit: featureConfig.hourlyLimit,
    });
    if (rlErr) {
      console.error(`[gemini-vision:${feature}] rate limit check failed:`, rlErr);
    } else if (!allowed) {
      return corsJson({
        error: 'rate_limited',
        message: 'Ya usaste esta función varias veces hoy. Podés volver a intentarlo mañana, o cargar los datos a mano por ahora.',
      }, 429);
    }
  }

  // image_base64 es opcional -- el modo voz del Diario Médico manda solo
  // texto (la transcripción ya la hizo el navegador, no esta función).
  const parts = image_base64
    ? [{ inline_data: { mime_type: media_type ?? 'image/jpeg', data: image_base64 } }, { text: prompt }]
    : [{ text: prompt }];

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 + THINKING_MARGIN, ...THINKING },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return corsJson({ error: `Gemini API ${geminiRes.status}`, details: errText }, 502);
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    return corsJson(parsed);
  } catch {
    return corsJson({ error: 'parse_failed', raw_text: text });
  }
});
