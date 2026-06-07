const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY
const MODEL    = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export async function geminiGenerate() { return null }

export async function geminiChat(systemPrompt, history, text, maxTokens = 300) {
  if (!API_KEY) { console.error('[Gemini] VITE_GEMINI_API_KEY not set'); return null }

  try {
    const contents = history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }))
    contents.push({ role: 'user', parts: [{ text }] })

    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    })

    if (!res.ok) { console.error('[Gemini] API error:', res.status, await res.text()); return null }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (e) {
    console.error('[Gemini] fetch error:', e)
    return null
  }
}
