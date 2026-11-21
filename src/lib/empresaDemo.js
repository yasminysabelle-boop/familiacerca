// Empresas ficticias para presentaciones (nov 2026). Se usan en /empresa?demo=1
// y /consola?demo=1. Nombres inventados; no son clientes reales.

const DAY = 864e5
const iso = d => new Date(d).toISOString().slice(0, 10)
const addMonths = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setMonth(x.getMonth() + n); return iso(x) }

const BASE = [
  { id: 'demo-1', nombre: 'Grupo Brisamar', tipo: 'empresa', negocio: 'empresa', color: '#C2571A', plan: 'Empresa', licencias: 60, en_uso: 52, desde: '2026-03-01', precio: 4, ciclo: 'mensual', codigo: 'BRI482', crec: [18, 22, 27, 31, 34, 38, 41, 43], dominio: 'brisamar.example' },
  { id: 'demo-2', nombre: 'Hospital Vida Plena', tipo: 'agencia', negocio: 'hospital', color: '#1F5FA8', plan: 'Hospital', licencias: 150, en_uso: 64, desde: '2025-12-01', precio: 3.5, ciclo: 'anual', codigo: 'VPL913', crec: [70, 76, 81, 88, 94, 99, 104, 109], dominio: 'vidaplena.example' },
  { id: 'demo-3', nombre: 'Cooperativa Solaria', tipo: 'empresa', negocio: 'empresa', color: '#B07D00', plan: 'Empresa', licencias: 40, en_uso: 23, desde: '2026-07-01', precio: 4, ciclo: 'mensual', codigo: 'SOL207', crec: [6, 9, 11, 14, 16, 18, 20, 21], dominio: 'solaria.example' },
  { id: 'demo-4', nombre: 'Cuidadoras Manos Amigas', tipo: 'agencia', negocio: 'agencia', color: '#2E7D6B', plan: 'Agencia', licencias: 35, en_uso: 33, desde: '2026-05-01', precio: 6, ciclo: 'mensual', codigo: 'MAN655', crec: [24, 25, 27, 28, 29, 30, 31, 32], dominio: 'manosamigas.example' },
  { id: 'demo-5', nombre: 'Logística Altavista', tipo: 'empresa', negocio: 'empresa', color: '#3B5BA9', plan: 'Empresa', licencias: 80, en_uso: 18, desde: '2026-10-01', precio: 4, ciclo: 'mensual', codigo: 'ALT334', crec: [0, 0, 0, 0, 4, 9, 13, 16], dominio: 'altavista.example' },
  { id: 'demo-6', nombre: 'Plan de Salud Horizonte', tipo: 'empresa', negocio: 'aseguradora', color: '#0E7C7B', plan: 'Afiliados', licencias: 25, en_uso: 19, desde: '2026-01-15', precio: 4.5, ciclo: 'mensual', codigo: 'NOR780', crec: [12, 13, 13, 14, 15, 15, 16, 17], dominio: 'horizonte.example' },
  { id: 'demo-7', nombre: 'Hogar Los Almendros', tipo: 'agencia', negocio: 'hogar', color: '#7B4B94', plan: 'Hogar', licencias: 40, en_uso: 31, desde: '2026-04-01', precio: 5, ciclo: 'mensual', codigo: 'ALM518', crec: [20, 22, 24, 25, 27, 28, 30, 31], dominio: 'losalmendros.example' },
  { id: 'demo-8', nombre: 'Clínica Bienestar del Valle', tipo: 'agencia', negocio: 'clinica', color: '#B23A48', plan: 'Clínica', licencias: 80, en_uso: 45, desde: '2026-06-15', precio: 4.5, ciclo: 'mensual', codigo: 'BDV276', crec: [12, 18, 24, 29, 34, 38, 42, 45], dominio: 'bienestarvalle.example' },
]

function invoices(o, i) {
  const today = iso(Date.now())
  const out = []
  const step = o.ciclo === 'anual' ? 12 : 1
  let start = o.desde, k = 1
  while (start <= today) {
    const end = iso(new Date(addMonths(start, step) + 'T12:00:00').getTime() - DAY)
    const due = iso(new Date(start + 'T12:00:00').getTime() + 15 * DAY)
    const isLast = addMonths(start, step) > today
    // La última factura de algunas empresas queda pendiente o vencida (para que se vea en la demo)
    const estado = !isLast ? 'pagada' : i === 2 ? 'vencida' : (i === 4 || i === 5) ? 'pendiente' : 'pagada'
    const seats = o.licencias
    out.push({ id: `${o.id}-f${k}`, numero: `FC-${start.slice(0, 4)}-${String(100 + i * 20 + k).padStart(4, '0')}`, desde: start, hasta: end,
      licencias: seats, monto: +(seats * o.precio * step).toFixed(2), estado, emitida: start, vence: due, pagada: estado === 'pagada' ? due : null })
    start = addMonths(start, step); k++
  }
  return out.reverse()
}

export function demoOrgs() {
  return BASE.map((o, i) => ({
    ...o, moneda: 'USD', renueva: addMonths(o.desde, 12), correo_cobro: `facturas@${o.dominio}`,
    admins: [`rrhh@${o.dominio}`], invitados: [3, 8, 5, 0, 22, 2, 1, 4][i], facturas: invoices(o, i),
  }))
}

// Datos del panel de UNA empresa ficticia (lo que vería su Recursos Humanos)
export function demoDashboard(id) {
  const o = demoOrgs().find(x => x.id === id) || demoOrgs()[0]
  const today = new Date()
  const f = o.en_uso / 52
  const r = n => Math.round(n * f)
  return {
    org: { nombre: o.nombre, tipo: o.tipo, plan: o.plan, licencias: o.licencias, desde: o.desde, renueva: o.renueva, codigo: o.codigo },
    miembros: o.en_uso, familias: Math.round(o.en_uso * 0.9), grupo_minimo: 5, detalle_oculto: false,
    activas_7: o.crec[7], activas_30: Math.min(Math.round(o.en_uso * 0.9), o.crec[7] + 2), dias: 30,
    semanas: o.crec.map((v, i) => { const d = new Date(today); d.setDate(d.getDate() - (7 - i) * 7); return { semana: d.toISOString().slice(0, 10), familias: v } }),
    funciones: { medicinas: r(1240), rutina: r(2105), tareas: r(410), notas: r(286), gastos: r(173), milo: r(352), emergencias: Math.max(1, r(3)), horas_turno: o.tipo === 'agencia' ? 2310 : 0 },
    billing: { precio: o.precio, ciclo: o.ciclo, moneda: o.moneda, correo: o.correo_cobro, licencias: o.licencias, renueva: o.renueva, facturas: o.facturas },
  }
}

// Panel de pacientes de ejemplo (agencia, hospital, clínica u hogar)
const PACIENTES = ['Rosa Rivera', 'Pedro Gómez', 'Luz Torres', 'Julio Méndez', 'Carmen Castillo', 'Ana Ramos', 'José Figueroa', 'Ramón Colón']
const HIJOS = ['Carmen', 'Luis', 'Marta', 'Daniel', 'Sonia', 'Javier', 'Elena', 'Raúl']
const CUID = ['Marisol Ortiz', 'Yolanda Cruz', 'Luz Rodríguez', 'Rafael Santiago']
export function demoPatients(id) {
  const o = demoOrgs().find(x => x.id === id) || demoOrgs()[0]
  const mail = n => n.normalize('NFD').toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@' + o.dominio
  const familias = PACIENTES.map((p, i) => ({
    owner_id: `${o.id}-f${i}`, paciente: (i % 2 ? 'Don ' : 'Doña ') + p, familia: `${HIJOS[i]} ${p.split(' ')[1]}`,
    desde: new Date(Date.now() - (i + 3) * 9 * DAY).toISOString(), miembros: 2 + (i % 4),
    medicinas_7: 14 + ((i * 7) % 12), rutina_7: 20 + ((i * 5) % 18), notas_7: 3 + (i % 6), horas_7: [24, 18.5, 30, 12, 21, 16.5, 27, 9][i],
    en_casa: [CUID[0], null, CUID[1], null, CUID[2], null, null, CUID[3]][i],
    ultima: new Date(Date.now() - [1, 5, 2, 30, 3, 20, 8, 1][i] * 36e5).toISOString(),
    cuidadoras: [{ user_id: `${o.id}-c${i % 4}`, nombre: CUID[i % 4], email: mail(CUID[i % 4]) }],
  }))
  const inD = d => new Date(Date.now() + d * DAY).toISOString().slice(0, 10)
  const all = { penales: inD(220), ley300: inD(300), salud: inD(150), cpr: inD(400), licencia: inD(500), hipaa: null }
  const staff = [
    ['Marisol Ortiz', 'Asistente de salud en el hogar (HHA)', {}], ['Yolanda Cruz', 'Cuidadora / asistente de cuidado personal', { penales: inD(20) }],
    ['Luz Rodríguez', 'Asistente de salud en el hogar (HHA)', { salud: inD(32) }], ['Rafael Santiago', 'Cuidadora / asistente de cuidado personal', { cpr: undefined }],
    ['Carmen López', 'Enfermera práctica (LPN)', {}], ['Ana Vélez', 'Coordinadora', {}],
  ].map(([nombre, rol, ch], i) => ({
    id: `${o.id}-s${i}`, nombre, rol, telefono: `787-555-01${10 + i}`, correo: mail(nombre), jurisdiccion: 'pr',
    docs: Object.fromEntries(Object.entries({ ...all, ...ch }).filter(([k]) => !(k in ch) || ch[k] !== undefined).map(([k, v]) => [k, { ok: true, vence: v }])),
  }))
  return { negocio: o.negocio, brand: { nombre: o.nombre, color: o.color || '#0C6C9C', logo: null, codigo: o.codigo }, familias, staff }
}

export function demoPeopleFor(id) {
  const o = demoOrgs().find(x => x.id === id) || demoOrgs()[0]
  const names = ['Ana Rivera', 'Carlos Méndez', 'Lucía Torres', 'José Ramírez', 'María Gómez', 'Pedro Castillo', 'Sofía Herrera', 'Luis Navarro']
  const mail = n => n.normalize('NFD').toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@' + o.dominio
  return {
    miembros: names.map((n, i) => ({ user_id: 'd' + i, nombre: n, email: mail(n), desde: new Date(Date.now() - (i + 2) * 6 * DAY).toISOString() })),
    invitados: ['Laura Díaz', 'Miguel Santos'].slice(0, Math.min(2, o.invitados)).map((n, i) => ({ email: mail(n), desde: new Date(Date.now() - (i + 1) * 2 * DAY).toISOString() })),
    admins: [{ user_id: 'a0', nombre: 'Recursos Humanos', email: `rrhh@${o.dominio}` }],
  }
}

export const money = (n, cur = 'USD') => (Number(n) || 0).toLocaleString('es', { style: 'currency', currency: cur, minimumFractionDigits: 2 })
export const ESTADOS = {
  pagada: { label: 'Pagada', bg: '#E3F4EA', fg: '#1E6B3E' },
  pendiente: { label: 'Pendiente', bg: '#FDF3DF', fg: '#7A5410' },
  vencida: { label: 'Vencida', bg: '#FBEAE4', fg: '#A3452F' },
}
