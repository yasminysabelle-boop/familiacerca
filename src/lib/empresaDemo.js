// Empresas ficticias para presentaciones (nov 2026). Se usan en /empresa?demo=1
// y /consola?demo=1. Nombres inventados; no son clientes reales.

const DAY = 864e5
const iso = d => new Date(d).toISOString().slice(0, 10)
const addMonths = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setMonth(x.getMonth() + n); return iso(x) }

const BASE = [
  { id: 'demo-1', nombre: 'Grupo Brisamar', tipo: 'empresa', plan: 'Empresa', licencias: 60, en_uso: 52, desde: '2026-03-01', precio: 4, ciclo: 'mensual', codigo: 'BRI482', crec: [18, 22, 27, 31, 34, 38, 41, 43], dominio: 'brisamar.example' },
  { id: 'demo-2', nombre: 'Hospital Vida Plena', tipo: 'empresa', plan: 'Empresa Plus', licencias: 150, en_uso: 121, desde: '2025-12-01', precio: 3.5, ciclo: 'anual', codigo: 'VPL913', crec: [70, 76, 81, 88, 94, 99, 104, 109], dominio: 'vidaplena.example' },
  { id: 'demo-3', nombre: 'Cooperativa Solaria', tipo: 'empresa', plan: 'Empresa', licencias: 40, en_uso: 23, desde: '2026-07-01', precio: 4, ciclo: 'mensual', codigo: 'SOL207', crec: [6, 9, 11, 14, 16, 18, 20, 21], dominio: 'solaria.example' },
  { id: 'demo-4', nombre: 'Cuidadoras Manos Amigas', tipo: 'agencia', plan: 'Agencia', licencias: 35, en_uso: 33, desde: '2026-05-01', precio: 6, ciclo: 'mensual', codigo: 'MAN655', crec: [24, 25, 27, 28, 29, 30, 31, 32], dominio: 'manosamigas.example' },
  { id: 'demo-5', nombre: 'Logística Altavista', tipo: 'empresa', plan: 'Empresa', licencias: 80, en_uso: 18, desde: '2026-10-01', precio: 4, ciclo: 'mensual', codigo: 'ALT334', crec: [0, 0, 0, 0, 4, 9, 13, 16], dominio: 'altavista.example' },
  { id: 'demo-6', nombre: 'Tecnologías Norteño', tipo: 'empresa', plan: 'Empresa', licencias: 25, en_uso: 19, desde: '2026-01-15', precio: 4.5, ciclo: 'mensual', codigo: 'NOR780', crec: [12, 13, 13, 14, 15, 15, 16, 17], dominio: 'norteno.example' },
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
    admins: [`rrhh@${o.dominio}`], invitados: [3, 8, 5, 0, 22, 2][i], facturas: invoices(o, i),
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
