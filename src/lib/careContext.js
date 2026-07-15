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

export async function buildCareContext(ownerId) {
  if (!ownerId) return null

  try {
    const today = getTodayPR()

    const [
      { data: medications },
      { data: logs },
      { data: activity },
      { data: careProfile },
      { data: members },
    ] = await Promise.all([
      supabase.from('medications').select('id, name, dosage, scheduled_times, time').eq('user_id', ownerId),
      supabase.from('medication_logs').select('medication_id, status, confirmed_at, confirmed_by_name, photo_url').eq('user_id', ownerId).eq('log_date', today),
      supabase.from('activity_log').select('type, description, actor_name, created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(10),
      supabase.from('care_profiles').select('name, age').eq('user_id', ownerId).maybeSingle(),
      supabase.from('family_members').select('member_user_id, member_email, role').eq('user_id', ownerId),
    ])

    const patientName = careProfile?.name ?? 'tu familiar'
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
        return `- ${label}: confirmado${confTime ? ` a las ${confTime}` : ''}${log.confirmed_by_name ? ` por ${log.confirmed_by_name}` : ''}${photoNote}`
      }
      if (log?.status === 'missed') {
        return `- ${label}: no se registró a tiempo${timeLabel ? ` (programado a las ${timeLabel})` : ''}`
      }
      return `- ${label}: pendiente${timeLabel ? `, hora programada ${timeLabel}` : ''}`
    })

    const activityLines = (activity ?? []).map(a => {
      const build = ACTIVITY_VERBS[a.type]
      const actor = a.actor_name ?? 'Alguien'
      const text = build ? build(actor, a.description ?? '') : `${actor}: ${a.description ?? a.type}`
      return `- ${text} · ${timeAgo(a.created_at)}`
    })

    const memberIds = [ownerId, ...(members ?? []).map(m => m.member_user_id).filter(Boolean)]
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, email').in('id', memberIds)
    const nameById = new Map((profiles ?? []).map(p => [p.id, p.full_name?.trim() || p.email?.split('@')[0]]))

    const familyLines = [
      `- ${nameById.get(ownerId) ?? 'Administrador/a'} (administrador/a)`,
      ...(members ?? []).map(m =>
        `- ${nameById.get(m.member_user_id) ?? m.member_email?.split('@')[0] ?? 'Familiar'} (${m.role === 'cuidador' ? 'cuidador/a' : 'familiar'})`
      ),
    ]

    return [
      `CONTEXTO DE CUIDADO — ${patientName}${careProfile?.age ? `, ${careProfile.age} años` : ''}`,
      '',
      'MEDICAMENTOS DE HOY:',
      medLines.length ? medLines.join('\n') : '- No hay medicamentos configurados.',
      '',
      'ACTIVIDAD RECIENTE:',
      activityLines.length ? activityLines.join('\n') : '- Sin actividad reciente registrada.',
      '',
      'FAMILIA:',
      familyLines.join('\n'),
    ].join('\n')
  } catch (e) {
    console.error('[careContext] build failed:', e)
    return null
  }
}
