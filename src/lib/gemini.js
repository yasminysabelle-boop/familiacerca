const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export async function geminiGenerate() { return null }

export async function geminiChat(systemPrompt, history, text, maxTokens = 300) {
  try {
    const messages = [
      ...history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: text }
    ]

    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages
      })
    })

    const data = await res.json()
    console.log('[Claude] status:', res.status, '| response:', JSON.stringify(data, null, 2))
    if (!res.ok) return null
    return data.content?.[0]?.text?.trim() ?? null
  } catch (e) {
    console.error('[Claude] fetch error:', e)
    return null
  }
}
