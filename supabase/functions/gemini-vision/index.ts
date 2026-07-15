import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

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
      // thinkingConfig:{thinkingBudget:0} — sin esto el modelo puede gastar el
      // budget de tokens "pensando" y devolver el JSON vacío o cortado.
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
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
