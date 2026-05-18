const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function geminiGenerate(prompt, maxTokens = 150) {
  if (!API_KEY) return '__ERROR__: VITE_GEMINI_API_KEY no está configurada'
  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return `__ERROR__: HTTP ${res.status} — ${errBody?.error?.message ?? res.statusText}`
    }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (err) {
    return `__ERROR__: ${err.message}`
  }
}
