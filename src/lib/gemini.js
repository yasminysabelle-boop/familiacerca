import { supabase } from './supabase'

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`

async function callProxy(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { console.error('[Gemini] no active session'); return null }

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) { console.error('[Gemini] proxy error:', res.status, await res.text()); return null }
    const data = await res.json()
    return data.text ?? null
  } catch (e) {
    console.error('[Gemini] fetch error:', e)
    return null
  }
}

export async function geminiGenerate(prompt, maxTokens = 300) {
  return callProxy({ action: 'generate', prompt, maxTokens })
}

export async function geminiChat(systemPrompt, history, text, maxTokens = 300) {
  return callProxy({ action: 'chat', systemPrompt, history, text, maxTokens })
}
