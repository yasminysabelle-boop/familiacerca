const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function geminiGenerate(prompt, maxTokens = 150) {
  if (!API_KEY) return null
  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

// Structured chat using systemInstruction + turn-by-turn contents.
// history: array of { role: 'user'|'companion', text } prior messages.
export async function geminiChat(systemPrompt, history, userMessage, maxTokens = 300) {
  if (!API_KEY) return null
  try {
    // Build alternating user/model turns — Gemini requires strict alternation starting with user
    const turns = []
    for (const msg of history) {
      const role = msg.role === 'user' ? 'user' : 'model'
      // Skip consecutive same-role messages (e.g. greeting followed by another companion msg)
      if (turns.length > 0 && turns[turns.length - 1].role === role) continue
      turns.push({ role, parts: [{ text: msg.text }] })
    }
    // If the last prior turn is user, drop it — the current message takes that slot
    if (turns.length > 0 && turns[turns.length - 1].role === 'user') turns.pop()
    turns.push({ role: 'user', parts: [{ text: userMessage }] })

    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: turns,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
      }),
    })
    if (!res.ok) {
      if (import.meta.env.DEV) res.text().then(t => console.error('[Gemini]', res.status, t))
      return null
    }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (e) {
    if (import.meta.env.DEV) console.error('[Gemini]', e)
    return null
  }
}
