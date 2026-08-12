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

// Acción deliberada (agregar/renovar medicamento con foto), no
// conversacional. 20/día da margen generoso para reintentos por foto mala
// en un día muy activo, sin dejar la puerta abierta a un loop de fotos.
const DAILY_LIMIT = 20;
const HOURLY_LIMIT = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify caller is an authenticated Supabase user
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: 'API not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Rate limit por usuario, día y hora -- nunca confía en el cliente, se
  // evalúa e incrementa server-side. isAppAdmin (cuenta de administración,
  // no un plan pago) bypasea el límite.
  if (user.app_metadata?.role !== 'admin') {
    const { data: allowed, error: rlErr } = await supabase.rpc('check_and_increment_ai_usage', {
      p_function_name: 'gemini-vision',
      p_daily_limit: DAILY_LIMIT,
      p_hourly_limit: HOURLY_LIMIT,
    });
    if (rlErr) {
      console.error('[gemini-vision] rate limit check failed:', rlErr);
    } else if (!allowed) {
      return new Response(JSON.stringify({
        error: 'rate_limited',
        message: 'Ya usaste esta función varias veces hoy. Podés volver a intentarlo mañana, o cargar los datos a mano por ahora.',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { image_base64, media_type, prompt } = await req.json();

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: media_type ?? 'image/jpeg', data: image_base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 + THINKING_MARGIN, ...THINKING },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return new Response(JSON.stringify({ error: `Gemini API ${geminiRes.status}`, details: errText }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'parse_failed', raw_text: text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
