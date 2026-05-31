import { supabase } from './supabase'

const CLAUDE_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`

export async function geminiGenerate() { return null }

export async function geminiChat(systemPrompt, history, text, maxTokens = 300) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const messages = [
      ...history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: text }
    ]

    const res = await fetch(CLAUDE_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages
      })
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text?.trim() ?? null
  } catch (e) {
    console.error('[Claude] fetch error:', e)
    return null
  }
}
