import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// Fijados server-side -- el cliente nunca elige modelo ni techo de tokens,
// aunque los mande en el body. Mismo modelo que ya usa hoy el Diario Médico
// (DiarioMedicoEntryModal.jsx).
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CEILING = 1024;

// Techo del body crudo, medido en bytes reales (no en el header
// Content-Length, que lo controla el cliente). Con la compresión de imagen
// del lado del cliente (2048px de lado largo, calidad 0.85), una foto de
// documento legítima queda en unos pocos cientos de KB -- 6MB deja margen
// de sobra sin dejar pasar un payload inflado a propósito.
const MAX_BODY_BYTES = 6 * 1024 * 1024;

// Misma lógica que gemini-vision, techo más conservador -- modelo más caro
// (Sonnet, no Flash). Nadie carga más de un puñado de entradas de Diario
// Médico reales en un día.
const DAILY_LIMIT = 15;
const HOURLY_LIMIT = 5;

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

  if (!ANTHROPIC_KEY) {
    return corsJson({ error: 'API not configured' }, 503);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return corsJson({
      error: 'payload_too_large',
      message: 'La imagen es demasiado pesada. Probá con una foto más liviana.',
    }, 413);
  }

  let parsed: { messages?: unknown; max_tokens?: unknown };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return corsJson({ error: 'invalid_json' }, 400);
  }

  const { messages, max_tokens } = parsed;
  if (!Array.isArray(messages) || messages.length === 0) {
    return corsJson({ error: 'invalid_request', message: 'Falta el contenido a analizar.' }, 400);
  }

  // Rate limit por usuario, día y hora -- nunca confía en el cliente, se
  // evalúa e incrementa server-side. isAppAdmin (cuenta de administración,
  // no un plan pago) bypasea el límite.
  if (user.app_metadata?.role !== 'admin') {
    const { data: allowed, error: rlErr } = await supabase.rpc('check_and_increment_ai_usage', {
      p_function_name: 'claude-proxy',
      p_daily_limit: DAILY_LIMIT,
      p_hourly_limit: HOURLY_LIMIT,
    });
    if (rlErr) {
      console.error('[claude-proxy] rate limit check failed:', rlErr);
    } else if (!allowed) {
      return corsJson({
        error: 'rate_limited',
        message: 'Ya usaste esta función varias veces hoy. Podés volver a intentarlo mañana, o cargar los datos a mano por ahora.',
      }, 429);
    }
  }

  // El cliente puede pedir menos tokens de salida, nunca más del techo fijo.
  const requestedMaxTokens = typeof max_tokens === 'number' && Number.isFinite(max_tokens) ? max_tokens : MAX_TOKENS_CEILING;
  const maxTokens = Math.min(Math.max(1, requestedMaxTokens), MAX_TOKENS_CEILING);

  // La función arma el request -- nunca reenvía el body del cliente tal
  // cual. Modelo y max_tokens son los fijados arriba, solo el contenido
  // (messages) viene del caller.
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  });

  const data = await res.json();
  return corsJson(data, res.status);
});
