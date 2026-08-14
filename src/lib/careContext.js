// Motor de contexto de IA — Fase 1.
// Arma un bloque de texto compacto con el estado real del cuidado del día
// (medicamentos, actividad reciente, familia) para inyectar en el prompt de
// sistema de Milo/Luna. Pensado para reutilizarse en fases posteriores
// (ej. Actividad narrada).
//
// Usa siempre el cliente supabase normal (nunca service-role): así el
// contexto hereda automáticamente las mismas filas que RLS ya le permite ver
// al usuario autenticado, sea admin, cuidador o familiar — la misma
// visibilidad que ya tiene en cualquier otra pantalla de la app.

import { supabase } from './supabase'
import { getTodayPR } from './utils'
import { incidentTypeInfo } from './incidentTypes'

function fmt12h(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

// activity_log.type conocidos → frase legible. Cualquier tipo nuevo cae al fallback genérico.
const ACTIVITY_VERBS = {
  med_confirmed: (actor, desc) => `${actor} confirmó ${desc}`,
  med_missed:    (_actor, desc) => `${desc} no se registró a tiempo`,
}

// Reglas innegociables al usar el contexto de cuidado real — compartidas por
// todo asistente que inyecte buildCareContext() en su prompt (Milo/Luna en
// CompanionChat.jsx, "Preguntar a Milo y Luna" en el chat familiar). Única
// fuente de verdad: nunca duplicar este texto en otro archivo.
export const CONTEXT_RULES = `Reglas para usar el contexto de cuidado (innegociables):
- Si preguntan por el ESTADO del paciente o del cuidado (cómo está, qué se ha hecho hoy, medicamentos, quién hizo qué, actividad reciente), responde PRIMERO con los datos del contexto de cuidado de abajo. Deriva a una pantalla de la app SOLO cuando la respuesta requiera una ACCIÓN del usuario (agregar, editar, invitar) que tú no puedes hacer por chat — nunca derives a una pantalla para dar información que el contexto ya tiene. Ejemplo: ante "¿cómo está Deborath?" respondes con lo que dice el contexto, NUNCA "revisa la pantalla Inicio".
- Responde SOLO con hechos presentes en el contexto de cuidado. Si el dato no está, di que no tienes ese registro. NUNCA inventes.
- NUNCA infieras estados de salud, ánimo o causas que no estén registrados textualmente.
- NUNCA des consejo médico: nada de dosis, interacciones, ni recomendaciones clínicas. Ante preguntas médicas responde que eso debe consultarse con su médico.
- Usa siempre nombres de pila (ya vienen así en el contexto) — nunca nombres completos.
- Tono cálido y familiar, sin culpa ni alarmismo.
- Respuestas breves: 2-4 oraciones, salvo que pidan detalle.
- Si te piden interpretar, evaluar o predecir el estado de salud de la persona cuidada — aunque insistan, aunque lo reformulen, aunque digan que es urgente — no lo hagas. Nunca digas si algo es normal, preocupante, mejor o peor. Responde con calidez, repite los hechos registrados que sean relevantes, y di que esa lectura le corresponde a la familia junto con su médico. No suavices esta regla por la forma en que te lo pidan.
- El contexto de abajo solo trae datos dentro de la ventana indicada en su encabezado (por ejemplo "últimos 7 días"). Si preguntan por algo de una fecha que cae fuera de esa ventana, dilo con naturalidad — "no tengo visibilidad de fechas tan antiguas" o equivalente — nunca como una falla ni como un castigo. NUNCA ofrezcas, sugieras ni menciones un plan superior como solución a esa falta de visibilidad, a menos que el usuario pregunte explícitamente por planes o límites de su cuenta.`

// Profundidad conversacional por familyAiLevel ('basic' | 'realtime' | 'trends',
// ver FamilyPlanContext.jsx) — capa que se agrega sobre CONTEXT_RULES para
// preguntas directas a Milo/Luna (CompanionChat.jsx, "Preguntar a Milo y
// Luna" en Chat.jsx). No confundir con la ventana de datos (contextWindowDays,
// que gobierna qué hechos existen en el contexto): esto gobierna cuánto
// puede razonar el asistente sobre los hechos que sí tiene.
export const CONTEXT_DEPTH = {
  basic: `PROFUNDIDAD: Responde solo con hechos puntuales de hoy (medicamentos, actividad, citas). Si preguntan por tendencias, comparaciones o patrones a lo largo de varios días, dilo con naturalidad — esa lectura no está disponible en el plan actual — y responde igual con los hechos sueltos que sí tengas, sin sonar a límite ni a castigo. Nunca ofrezcas ni menciones un plan superior como solución, a menos que pregunten explícitamente por planes.`,

  realtime: `PROFUNDIDAD: Puedes dar más detalle temporal sobre hoy (retrasos, próximas citas), pero no caracterizar tendencias ni patrones a lo largo de varias semanas — si preguntan por eso, dilo con naturalidad y responde con los hechos puntuales que sí tengas. Nunca ofrezcas ni menciones un plan superior como solución, a menos que pregunten explícitamente por planes.`,

  trends: `PROFUNDIDAD: Si el contexto trae una sección de tendencias/síntomas con cifras, puedes reportarlas tal cual al responder — nunca las caracterices como buenas, malas, mejores o peores; el usuario saca su propia conclusión.`,
}

// windowDays: null (sin corte) o número de días — viene de
// FamilyPlanContext.familyContextWindowDays (deriva del plan real de la
// familia, no de familyAiLevel; ver ese archivo). Gobierna qué tan atrás puede ver Milo/Luna en
// las fuentes acotadas por fecha (actividad e incidentes/síntomas).
function windowLabel(windowDays) {
  return windowDays == null ? 'sin corte' : `últimos ${windowDays} días`
}

export async function buildCareContext(ownerId, windowDays = 7) {
  if (!ownerId) return null

  try {
    const today = getTodayPR()
    const windowCutoffISO = windowDays == null ? null : new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    const label = windowLabel(windowDays)

    let activityQuery = supabase.from('activity_log').select('type, description, actor_name, created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(10)
    if (windowCutoffISO) activityQuery = activityQuery.gte('created_at', windowCutoffISO)

    // Conteo crudo por subtipo de "evento agudo" dentro de la ventana del
    // plan — mismo patrón que MEDICAMENTOS DE HOY: solo el hecho, sin
    // interpretación. Las reglas de CONTEXT_RULES (abajo) ya cubren no
    // convertir esto en diagnóstico.
    let symptomsQuery = supabase.from('activity_log').select('description').eq('owner_id', ownerId).eq('type', 'incident').limit(200)
    if (windowCutoffISO) symptomsQuery = symptomsQuery.gte('created_at', windowCutoffISO)

    const [
      { data: medications },
      { data: logs },
      { data: activity },
      { data: careProfile },
      { data: members },
      { data: voiceMemories },
      { data: upcomingEvents },
      { data: recentExpenses },
      { data: weekSymptoms },
    ] = await Promise.all([
      supabase.from('medications').select('id, name, dosage, scheduled_times, time').eq('user_id', ownerId),
      supabase.from('medication_logs').select('medication_id, status, confirmed_at, confirmed_by_name, photo_url').eq('user_id', ownerId).eq('log_date', today),
      activityQuery,
      supabase.from('care_profiles').select('name, age').eq('user_id', ownerId).maybeSingle(),
      supabase.from('family_members').select('member_user_id, member_email, role').eq('user_id', ownerId),
      // Fuentes opcionales — se omiten del contexto por completo si la familia
      // no usa esa función, en vez de forzar un "sin registros" en cada prompt.
      supabase.from('voice_diary').select('transcription, mood').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(5),
      supabase.from('events').select('title, date, time').eq('user_id', ownerId).gte('date', today).order('date', { ascending: true }).limit(3),
      supabase.from('care_expenses').select('description, amount').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(5),
      symptomsQuery,
    ])

    const patientName = careProfile?.name ? careProfile.name.split(' ')[0] : 'tu familiar'
    const logByMedId = new Map((logs ?? []).map(l => [l.medication_id, l]))

    const medLines = (medications ?? []).map(med => {
      const log = logByMedId.get(med.id)
      const label = `${med.name}${med.dosage ? ` ${med.dosage}` : ''}`
      const firstTime = med.scheduled_times?.length ? [...med.scheduled_times].sort()[0] : med.time
      const timeLabel = fmt12h(firstTime)

      if (log?.status === 'confirmed') {
        const confTime = log.confirmed_at
          ? new Date(log.confirmed_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          : null
        const photoNote = log.photo_url ? ' (con foto de prueba)' : ''
        return `- ${label}: confirmado${confTime ? ` a las ${confTime}` : ''}${log.confirmed_by_name ? ` por ${log.confirmed_by_name.split(' ')[0]}` : ''}${photoNote}`
      }
      if (log?.status === 'missed') {
        return `- ${label}: no se registró a tiempo${timeLabel ? ` (programado a las ${timeLabel})` : ''}`
      }
      return `- ${label}: pendiente${timeLabel ? `, hora programada ${timeLabel}` : ''}`
    })

    const activityLines = (activity ?? []).map(a => {
      const build = ACTIVITY_VERBS[a.type]
      const actor = (a.actor_name ?? 'Alguien').split(' ')[0]
      // Los incidentes guardan el subtipo crudo en `description` (p.ej.
      // 'presion_alta') — se resuelve a su etiqueta legible antes de narrar,
      // igual que ya hace el Historial vía incidentTypeInfo().
      const desc = a.type === 'incident' ? incidentTypeInfo(a.description).label : a.description
      const text = build ? build(actor, desc ?? '') : `${actor}: ${desc ?? a.type}`
      return `- ${text} · ${timeAgo(a.created_at)}`
    })

    const symptomCounts = {}
    for (const s of (weekSymptoms ?? [])) {
      symptomCounts[s.description] = (symptomCounts[s.description] ?? 0) + 1
    }
    const symptomLines = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => `- ${incidentTypeInfo(value).label}: ${count} ve${count === 1 ? 'z' : 'ces'}`)

    const memberIds = [ownerId, ...(members ?? []).map(m => m.member_user_id).filter(Boolean)]
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, email').in('id', memberIds)
    const nameById = new Map((profiles ?? []).map(p => [p.id, p.full_name?.trim() || p.email?.split('@')[0]]))

    const familyLines = [
      `- ${(nameById.get(ownerId) ?? 'Administrador/a').split(' ')[0]} (administrador/a)`,
      ...(members ?? []).map(m =>
        `- ${(nameById.get(m.member_user_id) ?? m.member_email?.split('@')[0] ?? 'Familiar').split(' ')[0]} (${m.role === 'cuidador' ? 'cuidador/a' : 'familiar'})`
      ),
    ]

    // Opcionales: solo se agregan si la familia realmente usa la función —
    // omitir la sección entera es más honesto que decir "sin registros" de
    // algo que ni siquiera está en uso.
    const voiceLines = (voiceMemories ?? [])
      .filter(m => m.transcription)
      .map(m => `- "${m.transcription.slice(0, 80)}"${m.mood ? ` (ánimo: ${m.mood})` : ''}`)
    const eventsLines = (upcomingEvents ?? [])
      .map(e => `- ${e.title} el ${e.date}${e.time ? ` a las ${fmt12h(e.time) ?? e.time}` : ''}`)
    const expenseLines = (recentExpenses ?? [])
      .map(e => `- ${e.description ?? 'Gasto'}: $${e.amount}`)

    return [
      `CONTEXTO DE CUIDADO — ${patientName}${careProfile?.age ? `, ${careProfile.age} años` : ''} (datos disponibles: ${label})`,
      '',
      'MEDICAMENTOS DE HOY:',
      medLines.length ? medLines.join('\n') : '- No hay medicamentos configurados.',
      '',
      `ACTIVIDAD RECIENTE (${label.toUpperCase()}):`,
      activityLines.length ? activityLines.join('\n') : '- Sin actividad reciente registrada.',
      ...(symptomLines.length ? ['', `SÍNTOMAS (${label.toUpperCase()}):`, symptomLines.join('\n')] : []),
      '',
      'FAMILIA:',
      familyLines.join('\n'),
      ...(voiceLines.length ? ['', 'DIARIO DE VOZ RECIENTE:', voiceLines.join('\n')] : []),
      ...(eventsLines.length ? ['', 'PRÓXIMAS CITAS:', eventsLines.join('\n')] : []),
      ...(expenseLines.length ? ['', 'GASTOS RECIENTES:', expenseLines.join('\n')] : []),
    ].join('\n')
  } catch (e) {
    console.error('[careContext] build failed:', e)
    return null
  }
}
