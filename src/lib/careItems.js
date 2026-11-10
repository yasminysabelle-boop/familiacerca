export const CARE_CATEGORIES = [
  { id: 'daily',    label: 'Rutina diaria',  icon: '📋', color: '#0A5A82', bg: '#E3F1F8' },
  { id: 'optional', label: 'Otros cuidados', icon: '✨', color: '#4E6470', bg: '#F9FAFB' },
]

export const CARE_ITEMS = [
  { key: 'bath',             label: 'Baño',                     icon: '🛁', category: 'daily',    scheduledTime: '08:00' },
  { key: 'dental_morning',   label: 'Cepillado dientes mañana', icon: '🦷', category: 'daily',    scheduledTime: '08:30' },
  { key: 'dental_afternoon', label: 'Cepillado dientes tarde',  icon: '🦷', category: 'daily',    scheduledTime: '14:00' },
  { key: 'dental_night',     label: 'Cepillado dientes noche',  icon: '🦷', category: 'daily',    scheduledTime: '21:00' },
  { key: 'clothes',          label: 'Cambio de ropa',           icon: '👕', category: 'daily',    scheduledTime: '09:00' },
  { key: 'breakfast',        label: 'Desayuno',                 icon: '🍽️', category: 'daily',    scheduledTime: '08:00' },
  { key: 'lunch',            label: 'Almuerzo',                 icon: '🍽️', category: 'daily',    scheduledTime: '13:00' },
  { key: 'dinner',           label: 'Cena',                     icon: '🍽️', category: 'daily',    scheduledTime: '19:00' },
  { key: 'bed_sheets',       label: 'Cambio de sábanas',        icon: '🛏️', category: 'optional' },
  { key: 'nail_trim',        label: 'Corte de uñas',            icon: '💅', category: 'optional' },
  { key: 'exercise',         label: 'Ejercicio/caminata',       icon: '🚶', category: 'optional' },
  { key: 'haircut',          label: 'Corte de cabello',         icon: '✂️', category: 'optional' },
  { key: 'home_therapy',     label: 'Terapia en casa',          icon: '🧘', category: 'optional' },
]

// Rutinas propias (nov 2026): combina las rutinas sugeridas con lo que la familia
// guardó en care_item_schedules (hora, si se usa o no, y rutinas propias "custom_*").
export const CUSTOM_ICONS = ['🚶', '💧', '🩺', '🧘', '📖', '🌞', '🛌', '❤️']

export function buildCareItems(rows = []) {
  const byKey = Object.fromEntries((rows ?? []).map(r => [r.item_key, r]))
  const base = CARE_ITEMS
    .filter(i => byKey[i.key]?.active !== false)
    .map(i => ({ ...i, scheduledTime: byKey[i.key]?.scheduled_time ?? i.scheduledTime }))
  const custom = (rows ?? [])
    .filter(r => r.item_key?.startsWith('custom_') && r.active !== false && r.label)
    .map(r => ({ key: r.item_key, label: r.label, icon: r.icon || '✨', category: 'daily', scheduledTime: r.scheduled_time, custom: true }))
  return [...base, ...custom]
}
