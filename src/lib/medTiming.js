// Reglas de tiempo compartidas para medicamentos.
//
// Un medicamento agregado HOY después de su primera hora programada (ej. se
// agrega a las 11pm uno de las 8am) no debe aparecer como "atrasado" ni
// marcarse como "omitido" automáticamente: su primera dosis es mañana.
// Antes, en el primer minuto de uso, la app marcaba la dosis como omitida y el
// panel decía que el familiar "necesita atención" (auditoría nov 2026).

function firstTime(med) {
  const times = med?.scheduled_times?.length ? [...med.scheduled_times].sort() : (med?.time ? [med.time] : [])
  return times[0] ?? null
}

export function startsTomorrow(med, now = new Date()) {
  if (!med?.created_at) return false
  const created = new Date(med.created_at)
  if (created.toDateString() !== now.toDateString()) return false
  const t = firstTime(med)
  if (!t) return false
  const [h, m] = t.split(':').map(Number)
  const firstDose = new Date(now)
  firstDose.setHours(h || 0, m || 0, 0, 0)
  return created > firstDose
}
