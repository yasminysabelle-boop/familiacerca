// Motor de contexto de IA — Fase 2.
// Narra en un párrafo la MISMA actividad de hoy que ya se muestra en el
// Dashboard (lo hecho en "Actividad reciente", lo pendiente y lo sin
// registrar en Medicamentos) — nunca una fuente distinta, para que
// narrativa y pantallas jamás puedan divergir.
//
// Cache compartido entre todos los que ven el dashboard de esa familia (no
// por dispositivo): se guarda en care_profiles.activity_summary y solo se
// regenera si cambió el contenido de las líneas hechas/pendientes/sin
// registrar respecto al último resumen generado.

import { supabase } from './supabase'
import { geminiGenerate } from './gemini'

const RULES = `Reglas (innegociables):
- Responde SOLO con los hechos presentes en los eventos de hoy listados abajo. Si algo no está ahí, no lo menciones. NUNCA inventes.
- NUNCA infieras estados de salud, ánimo o causas que no estén registrados textualmente.
- NUNCA des consejo médico.
- Puedes nombrar medicamentos por su nombre — es información dentro de la app, tras iniciar sesión, y ya se muestra igual en la lista debajo.
- Prioridad de contenido cuando hay más hechos de los que caben en el límite de oraciones — en este orden:
  1. ALTA: incidentes (caídas, fiebre, presión alta, agresividad, desorientación), alertas SOS, citas médicas.
  2. AGREGADOS: medicamentos (confirmados/pendientes/sin registrar), rutina diaria (al día / cuántos cuidados faltan), ánimo del día. Nunca desgloses la rutina ítem por ítem (baño, cepillado, etc.) — siempre como progreso agregado.
  3. MEDIA: fotos o memorias de voz subidas.
  Si hay que recortar por espacio, recorta desde el final de esta lista, nunca desde el principio.
- Estructura la respuesta en hasta 3 partes, en este orden, incluyendo SOLO las que tengan eventos: (1) lo hecho hoy, (2) lo pendiente, (3) lo sin registrar. Si una parte no tiene eventos, omítela por completo — nunca digas "no hay pendientes" ni similar.
- Para lo sin registrar, usa un tono sin culpa: constata el hecho y deja abierta la posibilidad de que aún se registre (ej. "no se registró a tiempo — puede registrarse aún"). Nunca alarmismo ni reproche.
- Honestidad simétrica: si hubo algo pendiente o sin registrar, DEBE mencionarse. Un resumen que solo celebra lo hecho no es honesto ni útil.
- Máximo 3-4 oraciones en total, sumando las 3 partes.
- PROHIBIDO el relleno emocional decorativo (frases como "es un gusto ver cómo seguimos cuidando juntos" que no aportan ningún hecho). El cariño va en el tono de la redacción, nunca en frases sueltas sin contenido.
- Usa nombres de pila (ya vienen así en los eventos) — nunca apellidos ni nombres completos.`

// doneLines/pendingLines/missedLines: arrays de strings ya humanizados, en el
// mismo texto que ve el usuario en las pantallas correspondientes.
export async function getActivitySummary({ ownerId, patientName, doneLines = [], pendingLines = [], missedLines = [] }) {
  if (!ownerId || (!doneLines.length && !pendingLines.length && !missedLines.length)) return null

  // Clave por contenido, no por conteo: cualquier línea que pueda cambiar el
  // texto (una rutina que avanza, un ánimo que se corrige) debe poder
  // invalidar el cache. Antes se hasheaba solo doneLines.length/
  // pendingLines.length/missedLines.length — como la mayoría de esos cambios
  // no mueven una línea de un bucket a otro (solo le cambian el texto), el
  // resumen se quedaba viejo indefinidamente.
  const cacheKey = [...doneLines, ...pendingLines, ...missedLines].join('¤')

  try {
    const { data: careProfile } = await supabase
      .from('care_profiles').select('activity_summary').eq('user_id', ownerId).maybeSingle()

    const cached = careProfile?.activity_summary
    if (cached?.text && cached?.cache_key === cacheKey) {
      return cached.text
    }

    const sections = []
    if (doneLines.length)    sections.push(`HECHO HOY:\n${doneLines.map(l => `- ${l}`).join('\n')}`)
    if (pendingLines.length) sections.push(`PENDIENTE:\n${pendingLines.map(l => `- ${l}`).join('\n')}`)
    if (missedLines.length)  sections.push(`SIN REGISTRAR:\n${missedLines.map(l => `- ${l}`).join('\n')}`)

    const prompt = `Eres el narrador de actividad de FamiliaCerca, una app de cuidado familiar. NO eres Milo ni Luna (los compañeros virtuales) — eres la voz neutral de la app. Narra la actividad de hoy en el cuidado de ${patientName ?? 'tu familiar'}.

${RULES}

${sections.join('\n\n')}`

    const text = await geminiGenerate(prompt, 150)
    if (!text) return null

    // Best-effort: si el guardado falla (ej. RLS), no rompe nada — el usuario ya ve el texto generado.
    supabase.from('care_profiles')
      .update({ activity_summary: { text, cache_key: cacheKey, generated_at: new Date().toISOString() } })
      .eq('user_id', ownerId)
      .then(({ error }) => { if (error) console.warn('[activitySummary] cache write failed:', error.message) })

    return text
  } catch (e) {
    console.error('[activitySummary] failed:', e)
    return null
  }
}
