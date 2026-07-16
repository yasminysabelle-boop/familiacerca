export const INCIDENT_TYPES = [
  { value: 'caida',        emoji: '🤕', label: 'Caída' },
  { value: 'golpe',        emoji: '💥', label: 'Golpe' },
  { value: 'fiebre',       emoji: '🌡️', label: 'Fiebre' },
  { value: 'presion_alta', emoji: '🩺', label: 'Presión alta' },
  { value: 'desorientado', emoji: '😵', label: 'Desorientado' },
  { value: 'agresivo',     emoji: '😤', label: 'Agresivo' },
  { value: 'no_comio',     emoji: '🍽️', label: 'No quiso comer' },
  { value: 'otro',         emoji: '📝', label: 'Otro' },
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
  otro: 'un incidente',
}

export function incidentTypeInfo(value) {
  return INCIDENT_TYPES.find(t => t.value === value) ?? { emoji: '📝', label: value }
}

export function incidentPhrase(value) {
  return INCIDENT_PHRASES[value] ?? 'un incidente'
}
