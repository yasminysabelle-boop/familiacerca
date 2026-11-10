import { supabase } from './supabase'

// Inicio a la medida (nov 2026): cada persona escoge qué quiere tener a mano.
// Nada se borra: lo que no escoge sigue en "Todo el cuidado". Se guarda en
// user_metadata (sigue a la persona en todos sus teléfonos, sin tablas nuevas).

export const NEEDS = [
  { id: 'meds',    emoji: '💊', label: 'Medicinas',              sub: 'Recordar y marcar cada toma' },
  { id: 'rutina',  emoji: '🛁', label: 'Rutina del día',         sub: 'Baño, comidas, pañal, paseo' },
  { id: 'citas',   emoji: '📅', label: 'Citas del médico',       sub: 'Quién lleva y cuándo' },
  { id: 'diario',  emoji: '💙', label: '¿Cómo está hoy?',        sub: 'Contar cómo amaneció, notas' },
  { id: 'tareas',  emoji: '✅', label: 'Repartir tareas',        sub: 'Cada quien toma algo, también desde lejos' },
  { id: 'gastos',  emoji: '💵', label: 'Gastos entre hermanos',  sub: 'Quién pagó y cuánto le toca a cada uno' },
  { id: 'turnos',  emoji: '🕒', label: 'Cuidadora o turnos',     sub: 'Marca cuando llega y cuando se va' },
  { id: 'papeles', emoji: '📄', label: 'Papeles en inglés',      sub: 'Milo te explica cartas del médico o del seguro' },
  { id: 'video',   emoji: '📹', label: 'Videollamadas',          sub: 'Acompañar desde lejos' },
]

// Lo que tiene más sentido para cada quien si todavía no ha escogido
export function defaultNeeds(role, isOwner) {
  if (role === 'cuidador') return ['turnos', 'meds', 'rutina', 'diario']
  if (role === 'familiar' && !isOwner) return ['diario', 'tareas', 'gastos', 'video']
  return ['meds', 'rutina', 'citas', 'tareas']
}

export function storedNeeds(user) {
  const n = user?.user_metadata?.fc_needs
  return Array.isArray(n) ? n.filter(id => NEEDS.some(x => x.id === id)) : null
}

export function needsFor(user, role, isOwner) {
  return storedNeeds(user) ?? defaultNeeds(role, isOwner)
}

export async function saveNeeds(ids) {
  const { error } = await supabase.auth.updateUser({ data: { fc_needs: ids } })
  return !error
}
