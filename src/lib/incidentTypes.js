export const INCIDENT_TYPES = [
  { value: 'caida',           emoji: '🤕', label: 'Caída' },
  { value: 'golpe',           emoji: '💥', label: 'Golpe' },
  { value: 'fiebre',          emoji: '🌡️', label: 'Fiebre' },
  { value: 'presion_alta',    emoji: '🩺', label: 'Presión alta' },
  { value: 'desorientado',    emoji: '😵', label: 'Desorientado' },
  { value: 'agresivo',        emoji: '😤', label: 'Agresivo' },
  { value: 'no_comio',        emoji: '🍽️', label: 'No quiso comer' },
  { value: 'dolor_estomago',  emoji: '🤢', label: 'Dolor de estómago' },
  { value: 'tos',             emoji: '😷', label: 'Tos' },
  { value: 'mareo',           emoji: '💫', label: 'Mareo' },
  { value: 'dolor_cabeza',    emoji: '🤯', label: 'Dolor de cabeza' },
  { value: 'vomito',          emoji: '🤮', label: 'Vómito' },
  { value: 'diarrea',         emoji: '🚽', label: 'Diarrea' },
  { value: 'insomnio',        emoji: '🌙', label: 'Insomnio' },
  { value: 'otro',            emoji: '📝', label: 'Otro' },
]

// Frase natural para narración ("Se registró {frase} a las 3pm").
const INCIDENT_PHRASES = {
  caida: 'una caída',
  golpe: 'un golpe',
  fiebre: 'fiebre',
  presion_alta: 'presión alta',
  desorientado: 'un episodio de desorientación',
  agresivo: 'un episodio de agresividad',
  no_comio: 'que no quiso comer',
  dolor_estomago: 'dolor de estómago',
  tos: 'tos',
  mareo: 'un episodio de mareo',
  dolor_cabeza: 'dolor de cabeza',
  vomito: 'un episodio de vómito',
  diarrea: 'diarrea',
  insomnio: 'que no pudo dormir',
  otro: 'un incidente',
}

export function incidentTypeInfo(value) {
  return INCIDENT_TYPES.find(t => t.value === value) ?? { emoji: '📝', label: value }
}

export function incidentPhrase(value) {
  return INCIDENT_PHRASES[value] ?? 'un incidente'
}
