import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 'gemini-flash-latest' now resolves to a model generation that rejects
// thinkingBudget:0 outright (INVALID_ARGUMENT) and doesn't treat a low budget
// as a hard cap — thinking tokens count against maxOutputTokens, so we pad
// the ceiling well above what the caller asked for or replies get truncated
// empty (MAX_TOKENS with no text).
const THINKING = { thinkingConfig: { thinkingBudget: 256 } };
const THINKING_MARGIN = 700;

// Uso normal esperado: Milo/Luna conversando (sin cache, 1 llamada/mensaje)
// + hasta 4 tarjetas emocionales del Dashboard (cacheadas 1x/día/usuario en
// localStorage) + resumen de actividad (cacheado por contenido). 20 preguntas
// reales en un día es un cuidador comprometido, no abuso -- 60 le da 3x de
// margen. El techo por hora existe para que nadie queme el cupo diario en
// minutos -- un uso humano real nunca se acerca a 20/hora.
const DAILY_LIMIT = 60;
const HOURLY_LIMIT = 20;

const RATE_LIMIT_MESSAGE = 'Hoy ya conversamos bastante — necesitamos un respiro y volvemos mañana con toda la energía. Si es algo urgente, comunícate directo con la familia o con el equipo médico.';

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

  // Rate limit por usuario, día y hora -- nunca confía en el cliente, se
  // evalúa e incrementa server-side. isAppAdmin (cuenta de administración,
  // no un plan pago) bypasea el límite.
  if (user.app_metadata?.role !== 'admin') {
    const { data: allowed, error: rlErr } = await supabase.rpc('check_and_increment_ai_usage', {
      p_function_name: 'gemini-proxy',
      p_daily_limit: DAILY_LIMIT,
      p_hourly_limit: HOURLY_LIMIT,
    });
    if (rlErr) {
      console.error('[gemini-proxy] rate limit check failed:', rlErr);
    } else if (!allowed) {
      return corsJson({ text: RATE_LIMIT_MESSAGE });
    }
  }

  const { action, prompt, maxTokens, systemPrompt, history, text } = await req.json();
  const outputCeiling = (maxTokens ?? 300) + THINKING_MARGIN;

  let body;
  if (action === 'chat') {
    const contents = (history ?? []).map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
    contents.push({ role: 'user', parts: [{ text }] });

    body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: outputCeiling, ...THINKING },
    };
  } else if (action === 'generate') {
    body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: outputCeiling, ...THINKING },
    };
  } else {
    return corsJson({ error: 'Unknown action' }, 400);
  }

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return corsJson({ error: `Gemini API ${geminiRes.status}`, details: errText }, 502);
  }

  const geminiData = await geminiRes.json();
  const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;

  return corsJson({ text: resultText });
});
