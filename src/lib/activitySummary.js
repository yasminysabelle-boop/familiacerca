// Motor de contexto de IA — Fase 2.
// Narra en un párrafo la MISMA actividad de hoy que ya se muestra en la lista
// de "Actividad reciente" del Dashboard — nunca una fuente distinta, para que
// narrativa y auditoría (la lista) jamás puedan divergir.
//
// Cache compartido entre todos los que ven el dashboard de esa familia (no
// por dispositivo): se guarda en care_profiles.activity_summary y solo se
// regenera si hay un evento de hoy más reciente que el último resumido.

import { supabase } from './supabase'
import { geminiGenerate } from './gemini'

const RULES = `Reglas (innegociables):
- Responde SOLO con los hechos presentes en los eventos de hoy listados abajo. Si algo no está ahí, no lo menciones. NUNCA inventes.
- NUNCA infieras estados de salud, ánimo o causas que no estén registrados textualmente.
- NUNCA des consejo médico.
- Tono cálido y familiar, sin culpa ni alarmismo.
- Máximo 2-3 oraciones.
- Usa nombres de pila (ya vienen así en los eventos) — nunca apellidos ni nombres completos.`

// lines: array de strings ya humanizados (ej. "Yasmin confirmó Losartan"),
// en el mismo orden y con el mismo texto que ve la lista debajo.
// latestEventAt: Date | string ISO del evento más reciente de hoy — clave de invalidación del cache.
export async function getActivitySummary({ ownerId, patientName, lines, latestEventAt }) {
  if (!ownerId || !lines?.length || !latestEventAt) return null

  try {
    const { data: careProfile } = await supabase
      .from('care_profiles').select('activity_summary').eq('user_id', ownerId).maybeSingle()

    const cached = careProfile?.activity_summary
    const latestMs = new Date(latestEventAt).getTime()
    if (cached?.text && cached?.last_event_at && new Date(cached.last_event_at).getTime() >= latestMs) {
      return cached.text
    }

    const prompt = `Eres el narrador de actividad de FamiliaCerca, una app de cuidado familiar. NO eres Milo ni Luna (los compañeros virtuales) — eres la voz neutral de la app. Narra en un párrafo breve y cálido la actividad de hoy en el cuidado de ${patientName ?? 'tu familiar'}.

${RULES}

EVENTOS DE HOY (más reciente primero):
${lines.map(l => `- ${l}`).join('\n')}`

    const text = await geminiGenerate(prompt, 150)
    if (!text) return null

    // Best-effort: si el guardado falla (ej. RLS), no rompe nada — el usuario ya ve el texto generado.
    supabase.from('care_profiles')
      .update({ activity_summary: { text, last_event_at: latestEventAt, generated_at: new Date().toISOString() } })
      .eq('user_id', ownerId)
      .then(({ error }) => { if (error) console.warn('[activitySummary] cache write failed:', error.message) })

    return text
  } catch (e) {
    console.error('[activitySummary] failed:', e)
    return null
  }
}
