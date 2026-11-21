import { useState } from 'react'

// Demo de marca blanca → módulos de gestión de la agencia (nov 2026):
// su personal (con requisitos comunes de EE. UU. y Puerto Rico), la
// facturación a sus familias y el cambio de su marca. Todo con datos de
// ejemplo; nada se guarda.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const INK = '#14303D', SUB = '#5E7480', LINE = '#E6E3DB'
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (c, w) => { const [r, g, b] = hex(c); const m = v => Math.round(v + (255 - v) * w).toString(16).padStart(2, '0'); return `#${m(r)}${m(g)}${m(b)}` }
const onColor = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? INK : 'white' }
const money = n => (Number(n) || 0).toLocaleString('es', { style: 'currency', currency: 'USD' })
const box = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 20, padding: 20 }
const field = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${LINE}`, fontSize: 15, fontFamily: SANS, color: INK, background: 'white' }
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: SUB, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const chip = (bg, fg) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, color: fg })
const OK = ['#E3F4EA', '#1E6B3E'], WARN = ['#FDF3DF', '#7A5410'], BAD = ['#FBEAE4', '#A3452F']
const inDays = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ── Requisitos comunes del personal de cuidado en casa ─────────────────────
// Referencia general; cada estado y cada programa (Medicare, Medicaid, seguros) puede pedir más.
export const REQ = {
  pr: [
    { k: 'penales', l: 'Certificado de Antecedentes Penales', d: 'Policía de Puerto Rico. Se renueva periódicamente.', vence: true },
    { k: 'ley300', l: 'Verificación de historial delictivo (Ley 300-1999)', d: 'Para quienes cuidan a niños o personas de edad avanzada. Incluye el Registro de Ofensores Sexuales.', vence: true },
    { k: 'salud', l: 'Certificado de salud', d: 'Expedido por un médico autorizado.', vence: true },
    { k: 'cpr', l: 'CPR y Primeros Auxilios', d: 'Certificación vigente.', vence: true },
    { k: 'licencia', l: 'Licencia o certificación según su puesto', d: 'Enfermería (Junta de Licenciamiento), asistente de salud en el hogar u otra.', vence: true },
    { k: 'hipaa', l: 'Adiestramiento de privacidad (HIPAA)', d: 'Manejo de la información de salud de los pacientes.', vence: false },
  ],
  us: [
    { k: 'antecedentes', l: 'Verificación de antecedentes penales', d: 'Estatal y, según el estado, de huellas (FBI).', vence: true },
    { k: 'ofensores', l: 'Registro de ofensores sexuales', d: 'Búsqueda en el registro nacional y estatal.', vence: true },
    { k: 'tb', l: 'Prueba de tuberculosis (TB)', d: 'Al contratar y según la política del estado.', vence: true },
    { k: 'cpr', l: 'CPR y Primeros Auxilios', d: 'Certificación vigente.', vence: true },
    { k: 'hha', l: 'Adiestramiento de asistente de salud en el hogar', d: 'Agencias de Medicare: mínimo 75 horas (16 de práctica supervisada) y 12 horas de educación cada año (42 CFR 484.80).', vence: false },
    { k: 'licencia', l: 'Licencia o registro estatal (CNA, LPN, RN)', d: 'Si el puesto lo requiere.', vence: true },
    { k: 'i9', l: 'Formulario I-9', d: 'Elegibilidad de empleo, para todo empleado en EE. UU.', vence: false },
    { k: 'hipaa', l: 'Adiestramiento de privacidad (HIPAA)', d: 'Manejo de la información de salud de los pacientes.', vence: false },
  ],
}
export const ROLES = ['Cuidadora / asistente de cuidado personal', 'Asistente de salud en el hogar (HHA)', 'Asistente de enfermería (CNA)', 'Enfermera práctica (LPN)', 'Enfermera graduada (RN)', 'Coordinadora']

// Personal de ejemplo: qué documentos tiene y cuándo vencen
function demoStaff(j) {
  const all = REQ[j].map(r => r.k)
  const mk = (nombre, rol, falta = [], pronto = []) => ({
    id: nombre, nombre, rol, docs: Object.fromEntries(all.map((k, i) => [k, falta.includes(k) ? null : { vence: pronto.includes(k) ? inDays(18 + i) : inDays(200 + i * 40) }])),
  })
  return j === 'pr' ? [
    mk('Marisol Ortiz', ROLES[1]), mk('Yolanda Cruz', ROLES[0], [], ['penales']), mk('Carmen López', ROLES[3]),
    mk('Rafael Santiago', ROLES[0], ['cpr']), mk('Luz Rodríguez', ROLES[1], [], ['salud']), mk('Ana Vélez', ROLES[5]),
  ] : [
    mk('Marisol Ortiz', ROLES[1]), mk('Yolanda Cruz', ROLES[0], [], ['tb']), mk('Carmen López', ROLES[3]),
    mk('Rafael Santiago', ROLES[0], ['cpr']), mk('Luz Rodríguez', ROLES[2], [], ['licencia']), mk('Ana Vélez', ROLES[5], ['hha']),
  ]
}
const statusOf = (p, j) => {
  const reqs = REQ[j]
  const falta = reqs.filter(r => !p.docs[r.k])
  const pronto = reqs.filter(r => p.docs[r.k]?.vence && r.vence && p.docs[r.k].vence <= inDays(45))
  return { falta, pronto }
}

export function StaffPanel({ b }) {
  const [j, setJ] = useState('pr')
  const [staff, setStaff] = useState(() => ({ pr: demoStaff('pr'), us: demoStaff('us') }))
  const [form, setForm] = useState(null)
  const [open, setOpen] = useState(null)
  const list = staff[j]
  const completos = list.filter(p => statusOf(p, j).falta.length === 0).length
  const porVencer = list.filter(p => statusOf(p, j).pronto.length > 0).length
  const fg = onColor(b.color)
  const tog = k => ({ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${j === k ? b.color : LINE}`, background: j === k ? b.color : 'white', color: j === k ? fg : INK, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS })

  function save() {
    if (!form.nombre.trim()) return
    const docs = Object.fromEntries(REQ[j].map(r => [r.k, form.docs[r.k]?.ok ? { vence: form.docs[r.k].vence || null } : null]))
    setStaff(s => ({ ...s, [j]: [{ id: form.nombre + Date.now(), nombre: form.nombre.trim(), rol: form.rol, docs }, ...s[j]] }))
    setForm(null)
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: SUB }}>Requisitos de:</span>
          <button onClick={() => setJ('pr')} style={tog('pr')}>Puerto Rico</button>
          <button onClick={() => setJ('us')} style={tog('us')}>Estados Unidos</button>
        </div>
        {!form && <button onClick={() => setForm({ nombre: '', rol: ROLES[0], telefono: '', correo: '', docs: {} })} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: b.color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>+ Registrar personal</button>}
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        {[['Personal registrado', list.length, INK], ['Con todo al día', completos, '#1E6B3E'], ['Les falta algo', list.length - completos, '#A3452F'], ['Vence en 45 días', porVencer, '#7A5410']].map(([l, v, c]) => (
          <div key={l} style={{ ...box, padding: '16px 18px' }}><p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>{l}</p><p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: c }}>{v}</p></div>
        ))}
      </div>

      {form && (
        <div style={{ ...box, marginBottom: 14, border: `1.5px solid ${b.color}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>Registrar personal · {j === 'pr' ? 'Puerto Rico' : 'Estados Unidos'}</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div><label style={label}>Nombre completo</label><input style={field} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
            <div><label style={label}>Puesto</label><select style={field} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label style={label}>Teléfono</label><input style={field} type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
            <div><label style={label}>Correo</label><input style={field} type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} /></div>
          </div>
          <p style={{ margin: '16px 0 6px', fontSize: 15, fontWeight: 800 }}>Documentos y requisitos</p>
          {REQ[j].map(r => {
            const d = form.docs[r.k] || {}
            return (
              <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 0', borderTop: `1px solid ${LINE}` }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 240, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!d.ok} onChange={e => setForm({ ...form, docs: { ...form.docs, [r.k]: { ...d, ok: e.target.checked } } })} style={{ width: 20, height: 20, marginTop: 2, accentColor: b.color }} />
                  <span><strong style={{ display: 'block', fontSize: 15 }}>{r.l}</strong><span style={{ fontSize: 13, color: SUB }}>{r.d}</span></span>
                </label>
                {r.vence && d.ok && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: SUB }}>Vence <input type="date" value={d.vence || ''} onChange={e => setForm({ ...form, docs: { ...form.docs, [r.k]: { ...d, vence: e.target.value } } })} style={{ ...field, width: 160, padding: '7px 8px', fontSize: 14 }} /></span>}
                <span style={{ fontSize: 13, color: SUB }}>📎 Subir copia</span>
              </div>
            )
          })}
          <p style={{ margin: '10px 0 0', fontSize: 13, color: SUB }}>La app no pide números de seguro social ni de identificación: solo si el documento está y cuándo vence.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => setForm(null)} style={{ padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${LINE}`, background: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            <button onClick={save} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: b.color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Guardar (demo)</button>
          </div>
        </div>
      )}

      <div style={box}>
        <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>Su personal</p>
        {list.map(p => {
          const st = statusOf(p, j)
          const [bg, c] = st.falta.length ? BAD : st.pronto.length ? WARN : OK
          return (
            <div key={p.id} style={{ borderTop: `1px solid ${LINE}` }}>
              <button onClick={() => setOpen(open === p.id ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', fontFamily: SANS, color: INK }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: mix(b.color, 0.88), color: b.color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.nombre[0]}</span>
                <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 15 }}>{p.nombre}</strong><span style={{ fontSize: 13, color: SUB }}>{p.rol}</span></span>
                <span style={chip(bg, c)}>{st.falta.length ? `Falta: ${st.falta.map(r => r.l.split(' (')[0]).join(', ')}` : st.pronto.length ? `Vence pronto: ${st.pronto.map(r => r.l.split(' (')[0]).join(', ')}` : 'Todo al día'}</span>
              </button>
              {open === p.id && (
                <div style={{ padding: '0 0 12px 48px' }}>
                  {REQ[j].map(r => {
                    const d = p.docs[r.k]
                    const s = !d ? ['Falta', BAD] : r.vence && d.vence && d.vence <= inDays(45) ? [`Vence ${fmt(d.vence)}`, WARN] : [r.vence && d.vence ? `Vigente hasta ${fmt(d.vence)}` : 'Completado', OK]
                    return <p key={r.k} style={{ margin: '6px 0', fontSize: 14, display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{r.l}</span><span style={chip(s[1][0], s[1][1])}>{s[0]}</span></p>
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 13, color: SUB, lineHeight: 1.5 }}>
        Requisitos comunes como referencia. Cada estado, Medicare, Medicaid y cada seguro pueden pedir otros; la agencia los ajusta en la versión real. Verifíquelos con su asesor legal.
      </p>
    </div>
  )
}

// ── Facturación a las familias ─────────────────────────────────────────────
const FAM = ['Rivera', 'Gómez', 'Torres', 'Méndez', 'Castillo', 'Ramos', 'Figueroa', 'Colón', 'Morales', 'Vázquez']
export function BillingPanel({ b, families, price }) {
  const fg = onColor(b.color)
  const [metodos, setMetodos] = useState({ tarjeta: true, ach: true, ath: true })
  const [sent, setSent] = useState({})
  const atrasadas = Math.max(1, Math.round(families * 0.04))
  const pendientes = Math.max(1, Math.round(families * 0.1))
  const pagadas = families - atrasadas - pendientes
  const rows = FAM.map((f, i) => ({ fam: `Familia ${f}`, estado: i === 2 || i === 7 ? 'atrasada' : i === 4 || i === 8 ? 'pendiente' : 'pagada', fecha: inDays(-(i * 2 + 1)) }))
  const st = { pagada: ['Pagada', OK], pendiente: ['Pendiente', WARN], atrasada: ['Atrasada', BAD] }
  const tile = (l, v, s, c) => <div style={{ ...box, padding: '16px 18px' }}><p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>{l}</p><p style={{ margin: '6px 0 2px', fontSize: 26, fontWeight: 800, color: c || INK }}>{v}</p>{s && <p style={{ margin: 0, fontSize: 13, color: SUB }}>{s}</p>}</div>
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        {tile('Facturado este mes', money(families * price), `${families} familias × ${money(price)}`, b.color)}
        {tile('Cobrado', money(pagadas * price), `${pagadas} pagos`, '#1E6B3E')}
        {tile('Pendiente', money(pendientes * price), `${pendientes} por vencer`, '#7A5410')}
        {tile('Atrasado', money(atrasadas * price), `${atrasadas} familias`, '#A3452F')}
      </div>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div style={box}>
          <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>Facturas de este mes</p>
          {rows.map(r => (
            <div key={r.fam} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 0', borderTop: `1px solid ${LINE}` }}>
              <span style={{ flex: 1, minWidth: 140 }}><strong style={{ display: 'block', fontSize: 15 }}>{r.fam}</strong><span style={{ fontSize: 13, color: SUB }}>Plan Familia · {fmt(r.fecha)}</span></span>
              <strong style={{ fontSize: 15 }}>{money(price)}</strong>
              <span style={chip(...st[r.estado][1])}>{st[r.estado][0]}</span>
              {r.estado !== 'pagada' && <button onClick={() => setSent(s => ({ ...s, [r.fam]: true }))} style={{ background: 'none', border: 'none', color: b.color, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>{sent[r.fam] ? '✓ Recordatorio enviado' : 'Enviar recordatorio'}</button>}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div style={box}>
            <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>Cómo les pagan las familias</p>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: SUB }}>El dinero llega a la cuenta de {b.nombre}. Cobro automático cada mes.</p>
            {[['tarjeta', 'Tarjeta de crédito o débito'], ['ach', 'Cuenta de banco (ACH)'], ['ath', 'ATH Móvil (Puerto Rico)']].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${LINE}`, fontSize: 15, cursor: 'pointer' }}>
                <input type="checkbox" checked={metodos[k]} onChange={e => setMetodos(m => ({ ...m, [k]: e.target.checked }))} style={{ width: 20, height: 20, accentColor: b.color }} />{l}
              </label>
            ))}
          </div>
          <div style={box}>
            <p style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>Recordatorios automáticos</p>
            {['3 días antes del cobro', 'El día que falla un pago', 'A los 7 días si sigue atrasado'].map(t => <p key={t} style={{ margin: '6px 0', fontSize: 15 }}>✅ {t}</p>)}
            <button style={{ marginTop: 8, padding: '10px 16px', borderRadius: 12, border: 'none', background: b.color, color: fg, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Descargar reporte del mes</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Su marca: logo, nombre y color (la agencia lo cambia sola) ─────────────
export function BrandPanel({ b, onChange, real }) {
  const [err, setErr] = useState('')
  async function upload(file) {
    setErr('')
    if (!file?.type?.startsWith('image/')) { setErr('Ese archivo no es una imagen.'); return }
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, 256 / Math.max(img.width, img.height))
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s)
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
      URL.revokeObjectURL(img.src); onChange({ logo: cv.toDataURL('image/png') })
    }
    img.onerror = () => setErr('No se pudo leer esa imagen.')
    img.src = URL.createObjectURL(file)
  }
  return (
    <div style={box}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>Su marca</h1>
      <p style={{ margin: '0 0 18px', fontSize: 15, color: SUB }}>{real ? 'Suban su logo y escojan su color.' : 'Cambien el logo, el nombre y el color: la app de sus familias se actualiza al instante (vea el teléfono).'}</p>
      <label style={label}>Logo</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ width: 64, height: 64, borderRadius: 16, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {b.logo ? <img src={b.logo} alt="" style={{ maxWidth: 48, maxHeight: 48, background: 'white', borderRadius: 10, padding: 4 }} /> : <span style={{ color: onColor(b.color), fontWeight: 800, fontSize: 22 }}>{b.nombre[0]}</span>}
        </span>
        <label style={{ padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${LINE}`, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Subir logo<input type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
        {b.logo && <button onClick={() => onChange({ logo: null })} style={{ background: 'none', border: 'none', color: SUB, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Quitar</button>}
      </div>
      {err && <p style={{ margin: '-8px 0 12px', fontSize: 14, color: '#A3452F' }}>{err}</p>}
      {!real && <label style={label}>Nombre que ven las familias</label>}
      {!real && <input style={{ ...field, marginBottom: 16 }} value={b.nombre} maxLength={60} onChange={e => onChange({ nombre: e.target.value || ' ' })} />}
      <label style={label}>Color principal</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="color" value={b.color} onChange={e => onChange({ color: e.target.value })} style={{ width: 56, height: 44, border: 'none', background: 'none', cursor: 'pointer' }} />
        {['#2E7D6B', '#0C6C9C', '#6B3FA0', '#B23A48', '#C77700', '#1F3A5F'].map(c => (
          <button key={c} onClick={() => onChange({ color: c })} aria-label={`Color ${c}`} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: b.color === c ? '3px solid #14303D' : '2px solid white', boxShadow: '0 0 0 1px #E6E3DB', cursor: 'pointer' }} />
        ))}
      </div>
      <p style={{ margin: '18px 0 0', fontSize: 13, color: SUB }}>{real ? 'Sus familias ven este logo y este color dentro de la app. El logo y el nombre también se cambian tocándolos en el menú de la izquierda.' : 'En la demo los cambios solo se ven en esta pantalla. En la versión real se guardan y se aplican a la app de todas sus familias.'}</p>
    </div>
  )
}
