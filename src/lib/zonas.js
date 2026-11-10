// Hora y país de cada familiar (familias en varios países, nov 2026)
const PLACES = {
  'America/Puerto_Rico': 'Puerto Rico', 'America/Santo_Domingo': 'Rep. Dominicana', 'America/Havana': 'Cuba',
  'America/Mexico_City': 'México', 'America/Monterrey': 'México', 'America/Merida': 'México', 'America/Cancun': 'México',
  'America/Tijuana': 'México (Tijuana)', 'America/Hermosillo': 'México', 'America/Chihuahua': 'México', 'America/Mazatlan': 'México',
  'America/Guatemala': 'Guatemala', 'America/El_Salvador': 'El Salvador', 'America/Tegucigalpa': 'Honduras',
  'America/Managua': 'Nicaragua', 'America/Costa_Rica': 'Costa Rica', 'America/Panama': 'Panamá',
  'America/Bogota': 'Colombia', 'America/Caracas': 'Venezuela', 'America/Guayaquil': 'Ecuador', 'America/Lima': 'Perú',
  'America/La_Paz': 'Bolivia', 'America/Santiago': 'Chile', 'America/Asuncion': 'Paraguay', 'America/Montevideo': 'Uruguay',
  'America/Argentina/Buenos_Aires': 'Argentina', 'America/Buenos_Aires': 'Argentina', 'America/Sao_Paulo': 'Brasil',
  'America/New_York': 'EE. UU. (Este)', 'America/Detroit': 'EE. UU. (Este)', 'America/Chicago': 'EE. UU. (Centro)',
  'America/Denver': 'EE. UU. (Montaña)', 'America/Phoenix': 'EE. UU. (Arizona)', 'America/Los_Angeles': 'EE. UU. (Pacífico)',
  'America/Toronto': 'Canadá', 'Europe/Madrid': 'España', 'Atlantic/Canary': 'Canarias',
}

export function myTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { return null }
}

export function placeOf(tz) {
  if (!tz) return null
  return PLACES[tz] || tz.split('/').pop().replace(/_/g, ' ')
}

export function timeIn(tz, date = new Date()) {
  try { return date.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', timeZone: tz }) } catch { return null }
}

// Texto corto para mostrar junto a un familiar que vive en otra zona horaria.
// Devuelve null si está en la misma hora que yo.
export function otherTimeLabel(tz) {
  const mine = myTimezone()
  if (!tz || !mine || tz === mine) return null
  const now = new Date()
  const a = timeIn(tz, now), b = timeIn(mine, now)
  if (!a || a === b) return null
  return `${a} en ${placeOf(tz)}`
}
