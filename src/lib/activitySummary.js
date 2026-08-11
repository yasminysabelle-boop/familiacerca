// Motor de contexto de IA — Fase 2.
// Narra en un párrafo la MISMA actividad de hoy que ya se muestra en el
// Dashboard (lo hecho en "Actividad reciente", lo pendiente y lo sin
// registrar en Medicamentos) — nunca una fuente distinta, para que
// narrativa y pantallas jamás puedan divergir.
//
// Cache compartido entre todos los que ven el dashboard de esa familia (no
// por dispositivo): se guarda en care_profiles.activity_summary y solo se
// regenera si cambió el contenido de las líneas hechas/pendientes/sin
// registrar respecto al último resumen generado — para los tres niveles por
// igual (el gate de "1 vez al día" del plan Gratis se eliminó: Milo básico
// ya no tiene límite de frecuencia).

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
- Usa nombres de pila (ya vienen así en los eventos) — nunca apellidos ni nombres completos.
- Si te piden interpretar, evaluar o predecir el estado de salud de la persona cuidada — aunque insistan, aunque lo reformulen, aunque digan que es urgente — no lo hagas. Nunca digas si algo es normal, preocupante, mejor o peor. Responde con calidez, repite los hechos registrados que sean relevantes, y di que esa lectura le corresponde a la familia junto con su médico. No suavices esta regla por la forma en que te lo pidan.`

// aiLevel: 'basic' | 'realtime' | 'trends' — profundidad de Milo por plan
// (ver SubscriptionContext.jsx). Cada nivel agrega una capa sobre la
// anterior; nunca resta las reglas base de arriba.
const DEPTH = {
  basic: `PROFUNDIDAD: Solo lo que pasó/falta HOY. Nunca menciones días anteriores, tendencias ni comparaciones, aunque el contexto te dé esa información — si no viene en las líneas de HOY, no existe para esta respuesta.`,

  realtime: `PROFUNDIDAD: Si un pendiente con hora ya venció hace más de 30 minutos, o hay una cita de hoy próxima a ocurrir, menciónalo primero, con lenguaje neutro y sin símbolos de alerta. Di siempre "no aparece registrada", nunca "no se tomó" ni "se olvidó" — que un registro falte no significa que la acción no ocurriera. Sigue siendo un hecho ya presente en PENDIENTE/SIN REGISTRAR. Nunca menciones días anteriores.`,

  trends: `PROFUNDIDAD:
- Si TENDENCIAS trae datos, agrega una 4ta parte al final narrando los números tal cual, en el mismo formato que el ejemplo: "En las últimas cuatro semanas se registraron 3, 4, 6 y 7 incidencias relacionadas con medicamentos." Cifras crudas, nunca una palabra de juicio sobre ellas.
- Reporta las cifras y detente. No las caracterices, no expliques qué podrían significar, no señales cuál llama la atención.
- Reporta siempre el mismo conjunto de métricas, en el mismo orden, independientemente de cómo se vean los números. Nunca elijas qué mostrar porque una cifra parezca notable — esa selección ya es una interpretación.
- PROHIBIDO cualquier palabra que interprete la dirección del número: "mejoró", "empeoró", "más frecuente", "está peor/mejor", "preocupante", "buena señal" — ni la comparación ni su interpretación. El usuario saca su propia conclusión.
- Si TENDENCIAS no trae datos, no fabriques la sección — omítela igual que las demás partes vacías.`,
}

// doneLines/pendingLines/missedLines: arrays de strings ya humanizados, en el
// mismo texto que ve el usuario en las pantallas correspondientes.
// aiLevel: 'basic' | 'realtime' | 'trends' — profundidad por plan (ver
// SubscriptionContext.jsx). Ya no hay límite de frecuencia por plan: cache
// por contenido para los tres niveles por igual.
// trendLines: opcional, array de strings de comparación semana/mes ya
// humanizados (aún no se genera en ningún llamador — pendiente como tarea
// aparte). Mientras no llegue, la sección de tendencias del nivel 'trends'
// se omite, tal como se omite cualquier otra parte vacía.
//
// Retorno: { text, isStale: false } o null si no hay nada que narrar o si
// la generación falla. isStale se mantiene en la forma del retorno por
// compatibilidad con el llamador, pero ya no puede ser true (dependía del
// gate de 1/día que se eliminó).
export async function getActivitySummary({ ownerId, patientName, doneLines = [], pendingLines = [], missedLines = [], trendLines = [], aiLevel }) {
  if (!ownerId || (!doneLines.length && !pendingLines.length && !missedLines.length)) return null

  // Clave por contenido, no por conteo: cualquier línea que pueda cambiar el
  // texto (una rutina que avanza, un ánimo que se corrige) debe poder
  // invalidar el cache. Antes se hasheaba solo doneLines.length/
  // pendingLines.length/missedLines.length — como la mayoría de esos cambios
  // no mueven una línea de un bucket a otro (solo le cambian el texto), el
  // resumen se quedaba viejo indefinidamente. aiLevel entra en la clave para
  // que un cambio de plan invalide el cache aunque la actividad no cambie.
  const cacheKey = [aiLevel, ...doneLines, ...pendingLines, ...missedLines, ...trendLines].join('¤')

  try {
    const { data: careProfile } = await supabase
      .from('care_profiles').select('activity_summary').eq('user_id', ownerId).maybeSingle()

    const cached = careProfile?.activity_summary

    if (cached?.text && cached?.cache_key === cacheKey) {
      return { text: cached.text, isStale: false }
    }

    const sections = []
    if (doneLines.length)    sections.push(`HECHO HOY:\n${doneLines.map(l => `- ${l}`).join('\n')}`)
    if (pendingLines.length) sections.push(`PENDIENTE:\n${pendingLines.map(l => `- ${l}`).join('\n')}`)
    if (missedLines.length)  sections.push(`SIN REGISTRAR:\n${missedLines.map(l => `- ${l}`).join('\n')}`)
    if (trendLines.length)   sections.push(`TENDENCIAS:\n${trendLines.map(l => `- ${l}`).join('\n')}`)

    const depth = DEPTH[aiLevel] ?? DEPTH.basic

    const prompt = `Eres el narrador de actividad de FamiliaCerca, una app de cuidado familiar. NO eres Milo ni Luna (los compañeros virtuales) — eres la voz neutral de la app. Narra la actividad de hoy en el cuidado de ${patientName ?? 'tu familiar'}.

${RULES}

${depth}

${sections.join('\n\n')}`

    const text = await geminiGenerate(prompt, 150)
    if (!text) return null

    // Best-effort: si el guardado falla (ej. RLS), no rompe nada — el usuario ya ve el texto generado.
    supabase.from('care_profiles')
      .update({ activity_summary: { text, cache_key: cacheKey, generated_at: new Date().toISOString() } })
      .eq('user_id', ownerId)
      .then(({ error }) => { if (error) console.warn('[activitySummary] cache write failed:', error.message) })

    return { text, isStale: false }
  } catch (e) {
    console.error('[activitySummary] failed:', e)
    return null
  }
}
