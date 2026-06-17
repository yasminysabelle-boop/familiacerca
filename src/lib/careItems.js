export const CARE_CATEGORIES = [
  { id: 'daily',    label: 'Rutina diaria',  icon: '📋', color: '#0d6b63', bg: '#EBF3EE' },
  { id: 'optional', label: 'Otros cuidados', icon: '✨', color: '#6B7280', bg: '#F9FAFB' },
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
