import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { demoOrgs, money, ESTADOS } from '../lib/empresaDemo'
import MarcaBlancaConsola from '../components/MarcaBlancaConsola'

// Consola de FamiliaCerca (nov 2026): solo para el equipo de FamiliaCerca
// (cuentas con rol "admin"). Empresas clientes, licencias, cobro y facturas,
// sin tocar SQL. Con ?demo=1 muestra empresas ficticias para presentaciones.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const C = { blue: '#0C6C9C', dark: '#0A4A6B', ink: '#14303D', sub: '#4E6470', line: '#E6E3DB', cream: '#F7F6F2', soft: '#EEF6FA', coral: '#BF513C', light: '#9CCBE0' }
const today = () => new Date().toISOString().slice(0, 10)
const empty = { id: null, nombre: '', tipo: 'empresa', plan: 'Empresa', licencias: 25, desde: today(), renueva: '', precio: 4, ciclo: 'mensual', moneda: 'USD', correo_cobro: '' }
const field = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 15, fontFamily: SANS, color: C.ink, background: 'white' }
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: C.sub, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const btn = (bg, fg = 'white') => ({ padding: '10px 16px', borderRadius: 12, border: bg === 'white' ? `1.5px solid ${C.line}` : 'none', background: bg, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS })
const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const num = n => (n ?? 0).toLocaleString('es')
const addMonths = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10) }
const minusDay = d => new Date(new Date(d + 'T12:00:00').getTime() - 864e5).toISOString().slice(0, 10)
const mrr = o => (o.licencias || 0) * (Number(o.precio) || 0)

function Tile({ label: l, value, sub, accent }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 18, padding: '16px 18px' }}>
      <p style={{ margin: 0, fontSize: 14, color: C.sub, fontWeight: 600 }}>{l}</p>
      <p style={{ margin: '6px 0 2px', fontSize: 28, fontWeight: 800, color: accent || C.ink, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 14, color: C.sub }}>{sub}</p>}
    </div>
  )
}

// Ingreso mensual recurrente de los últimos 12 meses (según la fecha de inicio de cada cliente)
function MrrChart({ orgs }) {
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return d.toISOString().slice(0, 7) })
  const vals = months.map(m => orgs.filter(o => (o.desde || '').slice(0, 7) <= m).reduce((t, o) => t + mrr(o), 0))
  const max = Math.max(1, ...vals), W = 600, H = 180, pad = 8, bw = (W - pad) / months.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Ingreso mensual por mes">
      <line x1={0} x2={W} y1={H} y2={H} stroke={C.line} />
      {vals.map((v, i) => {
        const h = (v / max) * (H - 24), x = pad + i * bw + bw * 0.15, last = i === vals.length - 1
        return (
          <g key={months[i]}>
            <rect x={x} y={H - h} width={bw * 0.7} height={Math.max(h, 1)} rx="5" fill={last ? C.blue : C.light} />
            {(last || i % 3 === 0) && <text x={x + bw * 0.35} y={H - h - 6} fontSize="11" fontWeight="700" textAnchor="middle" fill={C.ink}>{v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`}</text>}
            <text x={x + bw * 0.35} y={H + 18} fontSize="11" textAnchor="middle" fill={C.sub}>{new Date(months[i] + '-15').toLocaleDateString('es', { month: 'short' })}</text>
          </g>
        )
      })}
    </svg>
  )
}

function SeatsChart({ orgs }) {
  const max = Math.max(1, ...orgs.map(o => o.licencias))
  return orgs.map(o => (
    <div key={o.id} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 4, gap: 8 }}>
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombre}</span>
        <span style={{ color: C.sub, flexShrink: 0 }}><strong style={{ color: C.ink }}>{o.en_uso}</strong> / {o.licencias}</span>
      </div>
      <div style={{ height: 12, borderRadius: 6, background: C.soft, width: `${(o.licencias / max) * 100}%`, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (o.en_uso / Math.max(1, o.licencias)) * 100)}%`, height: '100%', background: o.en_uso / Math.max(1, o.licencias) < 0.4 ? C.coral : C.blue, borderRadius: 6 }} />
      </div>
    </div>
  ))
}

export default function ConsolaEmpresas() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const demo = params.get('demo') === '1'
  const isAppAdmin = user?.app_metadata?.role === 'admin'
  const [orgs, setOrgs] = useState(null)
  const [form, setForm] = useState(null)
  const [adminFor, setAdminFor] = useState(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [openInv, setOpenInv] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (demo) { setOrgs(o => o || demoOrgs()); return }
    const { data, error } = await supabase.rpc('admin_orgs')
    setOrgs(error ? [] : data)
    if (error) setMsg({ ok: false, text: 'No se pudo cargar. ¿Ya corriste el SQL de empresas?' })
  }
  useEffect(() => { if (demo || isAppAdmin) load() }, [isAppAdmin, demo]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const list = orgs || []
    const m = list.reduce((t, o) => t + mrr(o), 0)
    const facts = list.flatMap(o => o.facturas || [])
    const limit = addMonths(today(), 3)
    return {
      clientes: list.length, mrr: m,
      vendidas: list.reduce((t, o) => t + o.licencias, 0), usadas: list.reduce((t, o) => t + o.en_uso, 0),
      porCobrar: facts.filter(f => f.estado !== 'pagada').reduce((t, f) => t + Number(f.monto), 0),
      vencidas: facts.filter(f => f.estado === 'vencida').length,
      renuevan: list.filter(o => o.renueva && o.renueva >= today() && o.renueva <= limit),
    }
  }, [orgs])

  if (!demo && !loading && !user) return <Navigate to="/login?next=/consola" replace />
  if (!demo && !loading && user && !isAppAdmin) {
    return <div style={{ fontFamily: SANS, padding: 40, textAlign: 'center', color: C.sub }}>Esta consola es solo para el equipo de FamiliaCerca. <Link to="/dashboard" style={{ color: C.blue }}>Volver</Link></div>
  }

  async function save() {
    if (!form.nombre.trim()) return
    if (demo) {
      const o = { ...form, id: form.id || 'demo-' + Date.now(), codigo: form.codigo || 'NEW' + Math.floor(100 + Math.random() * 900), en_uso: form.en_uso || 0, invitados: form.invitados || 0, admins: form.admins || [], facturas: form.facturas || [], licencias: Number(form.licencias) || 0, precio: Number(form.precio) || 0 }
      setOrgs(l => form.id ? l.map(x => x.id === form.id ? o : x) : [o, ...l]); setForm(null)
      setMsg({ ok: true, text: form.id ? 'Empresa actualizada (demo).' : 'Empresa creada (demo).' }); return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_org_save', {
      p_id: form.id, p_name: form.nombre.trim(), p_kind: form.tipo, p_plan: form.plan, p_seats: Number(form.licencias) || 0,
      p_started: form.desde || null, p_renews: form.renueva || null,
    })
    if (!error && data?.ok) await supabase.rpc('admin_org_billing_save', { p_id: data.id, p_price: Number(form.precio) || 0, p_cycle: form.ciclo, p_currency: form.moneda, p_email: form.correo_cobro || '' })
    setBusy(false)
    if (error || !data?.ok) { setMsg({ ok: false, text: 'No se pudo guardar.' }); return }
    setMsg({ ok: true, text: form.id ? 'Empresa actualizada.' : 'Empresa creada. Ahora agrégale un administrador.' })
    if (!form.id) setAdminFor(data.id)
    setForm(null); load()
  }

  async function addAdmin(orgId) {
    const e = adminEmail.trim().toLowerCase(); if (!e) return
    if (demo) { setOrgs(l => l.map(x => x.id === orgId ? { ...x, admins: [...x.admins, e] } : x)); setAdminFor(null); setAdminEmail(''); return }
    const { data, error } = await supabase.rpc('org_add_admin', { p_org: orgId, p_email: e })
    if (error || !data?.ok) { setMsg({ ok: false, text: data?.error === 'sin_cuenta' ? `${e} no tiene cuenta todavía. Pídele que se registre gratis en familiacerca.com y vuelve a agregarlo.` : 'No se pudo agregar.' }); return }
    setMsg({ ok: true, text: `${e} ya administra esa empresa. Entra en familiacerca.com/empresa.` })
    setAdminEmail(''); setAdminFor(null); load()
  }

  // Nueva factura del siguiente período, con el monto según licencias × precio
  async function newInvoice(o) {
    const last = (o.facturas || [])[0]
    const start = last ? addMonths(last.desde, o.ciclo === 'anual' ? 12 : 1) : (o.desde || today())
    const months = o.ciclo === 'anual' ? 12 : 1
    const end = minusDay(addMonths(start, months))
    const amount = +(o.licencias * Number(o.precio) * months).toFixed(2)
    if (!window.confirm(`Crear factura para ${o.nombre}\n${fmt(start)} – ${fmt(end)}\n${o.licencias} licencias × ${money(o.precio, o.moneda)}${months > 1 ? ' × 12 meses' : ''} = ${money(amount, o.moneda)}`)) return
    const due = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10)
    if (demo) {
      const f = { id: 'f' + Date.now(), numero: `FC-${today().slice(0, 4)}-${String(900 + Math.floor(Math.random() * 99)).padStart(4, '0')}`, desde: start, hasta: end, licencias: o.licencias, monto: amount, estado: 'pendiente', emitida: today(), vence: due }
      setOrgs(l => l.map(x => x.id === o.id ? { ...x, facturas: [f, ...x.facturas] } : x)); return
    }
    const { data, error } = await supabase.rpc('admin_invoice_create', { p_org: o.id, p_start: start, p_end: end, p_seats: o.licencias, p_amount: amount, p_due: due })
    setMsg(error || !data?.ok ? { ok: false, text: 'No se pudo crear la factura.' } : { ok: true, text: `Factura ${data.numero} creada. La empresa ya la ve en su panel.` })
    load()
  }
  async function setStatus(o, f, estado) {
    if (estado === 'anulada' && !window.confirm(`¿Anular la factura ${f.numero}?`)) return
    if (demo) {
      setOrgs(l => l.map(x => x.id === o.id ? { ...x, facturas: x.facturas.filter(y => estado !== 'anulada' || y.id !== f.id).map(y => y.id === f.id ? { ...y, estado, pagada: estado === 'pagada' ? today() : null } : y) } : x)); return
    }
    await supabase.rpc('admin_invoice_set_status', { p_id: f.id, p_status: estado }); load()
  }

  const card = { background: 'white', border: `1px solid ${C.line}`, borderRadius: 18, padding: 18 }
  const grid = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }
  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: SANS, color: C.ink }}>
      <header style={{ background: `linear-gradient(135deg, ${C.dark}, #08303F)`, color: 'white', padding: '18px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Consola de FamiliaCerca</p>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>Empresas clientes, licencias y facturación · solo equipo interno</p>
          </div>
          <button onClick={() => setForm({ ...empty })} style={btn(C.coral)}>+ Nueva empresa</button>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 48px' }}>
        {demo && <p style={{ margin: '0 0 14px', padding: '12px 16px', borderRadius: 14, background: '#FDF3DF', color: '#7A5410', fontSize: 15, fontWeight: 600 }}>Datos de ejemplo con empresas ficticias, para presentaciones. Los cambios aquí no se guardan.</p>}
        {msg && <p style={{ margin: '0 0 14px', padding: '12px 16px', borderRadius: 14, background: msg.ok ? C.soft : '#FBEAE4', fontSize: 15, fontWeight: 600 }}>{msg.text}</p>}

        {orgs && orgs.length > 0 && (
          <>
            <div style={grid}>
              <Tile label="Empresas clientes" value={num(kpi.clientes)} />
              <Tile label="Ingreso mensual" value={money(kpi.mrr)} sub={`${money(kpi.mrr * 12)} al año`} accent={C.blue} />
              <Tile label="Licencias en uso" value={`${num(kpi.usadas)} / ${num(kpi.vendidas)}`} sub={`${kpi.vendidas ? Math.round((kpi.usadas / kpi.vendidas) * 100) : 0}% activadas`} />
              <Tile label="Por cobrar" value={money(kpi.porCobrar)} sub={kpi.vencidas ? `${kpi.vencidas} factura${kpi.vencidas > 1 ? 's' : ''} vencida${kpi.vencidas > 1 ? 's' : ''}` : 'Nada vencido ✓'} accent={kpi.vencidas ? C.coral : undefined} />
            </div>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', margin: '14px 0' }}>
              <div style={card}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Ingreso mensual recurrente</p>
                <p style={{ margin: '2px 0 12px', fontSize: 14, color: C.sub }}>Licencias × precio de todos los clientes, mes a mes</p>
                <MrrChart orgs={orgs} />
              </div>
              <div style={card}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Licencias activadas por cliente</p>
                <p style={{ margin: '2px 0 12px', fontSize: 14, color: C.sub }}>En rojo: menos del 40% activado (hay que ayudarles a invitar)</p>
                <SeatsChart orgs={orgs} />
              </div>
            </div>
            {kpi.renuevan.length > 0 && (
              <div style={{ ...card, marginBottom: 14, background: C.soft, border: 'none' }}>
                <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>🔔 Renuevan en los próximos 3 meses</p>
                {kpi.renuevan.map(o => <p key={o.id} style={{ margin: '4px 0 0', fontSize: 15 }}><strong>{o.nombre}</strong> · {fmt(o.renueva)} · {money(mrr(o) * 12, o.moneda)} al año</p>)}
              </div>
            )}
          </>
        )}

        <MarcaBlancaConsola demo={demo} />

        {form && (
          <div style={{ ...card, marginBottom: 16, border: `1.5px solid ${C.blue}` }}>
            <p style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>{form.id ? 'Editar empresa' : 'Nueva empresa'}</p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={label}>Nombre</label><input style={field} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la empresa" /></div>
              <div><label style={label}>Tipo</label><select style={field} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="empresa">Empresa (beneficio a empleados)</option><option value="agencia">Agencia de cuidadoras</option></select></div>
              <div><label style={label}>Plan</label><input style={field} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} /></div>
              <div><label style={label}>Licencias</label><input style={field} type="number" min="0" value={form.licencias} onChange={e => setForm({ ...form, licencias: e.target.value })} /></div>
              <div><label style={label}>Cliente desde</label><input style={field} type="date" value={form.desde || ''} onChange={e => setForm({ ...form, desde: e.target.value })} /></div>
              <div><label style={label}>Renovación</label><input style={field} type="date" value={form.renueva || ''} onChange={e => setForm({ ...form, renueva: e.target.value })} /></div>
              <div><label style={label}>Precio por licencia al mes</label><input style={field} type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} /></div>
              <div><label style={label}>Se cobra</label><select style={field} value={form.ciclo} onChange={e => setForm({ ...form, ciclo: e.target.value })}><option value="mensual">Cada mes</option><option value="anual">Una vez al año</option></select></div>
              <div><label style={label}>Moneda</label><input style={field} value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value.toUpperCase().slice(0, 3) })} /></div>
              <div><label style={label}>Correo de facturación</label><input style={field} type="email" value={form.correo_cobro || ''} onChange={e => setForm({ ...form, correo_cobro: e.target.value })} placeholder="facturas@empresa.com" /></div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 15, color: C.sub }}>Total: <strong style={{ color: C.ink }}>{money((Number(form.licencias) || 0) * (Number(form.precio) || 0), form.moneda || 'USD')} al mes</strong>{form.ciclo === 'anual' && <> · se factura {money((Number(form.licencias) || 0) * (Number(form.precio) || 0) * 12, form.moneda || 'USD')} al año</>}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setForm(null)} style={btn('white', C.ink)}>Cancelar</button>
              <button onClick={save} disabled={busy} style={btn(C.blue)}>{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        )}

        {!orgs ? <p style={{ color: C.sub }}>Cargando…</p> : orgs.length === 0 ? <p style={{ color: C.sub }}>Todavía no hay empresas. Mira cómo se ve con datos de ejemplo: <Link to="/consola?demo=1" style={{ color: C.blue, fontWeight: 700 }}>consola de ejemplo</Link></p> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {orgs.map(o => {
              const pend = (o.facturas || []).filter(f => f.estado !== 'pagada')
              return (
                <div key={o.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{o.nombre} <span style={{ fontSize: 13, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>· {o.tipo}</span></p>
                      <p style={{ margin: '4px 0 0', fontSize: 14, color: C.sub }}>Plan {o.plan} · desde {fmt(o.desde)} · renueva {fmt(o.renueva)} · código <strong style={{ color: C.blue, letterSpacing: '0.08em' }}>{o.codigo}</strong></p>
                    </div>
                    <button onClick={() => setForm({ ...o, renueva: o.renueva || '', correo_cobro: o.correo_cobro || '', moneda: o.moneda || 'USD', ciclo: o.ciclo || 'mensual', precio: o.precio ?? 0 })} style={{ ...btn('white', C.ink), padding: '8px 14px', fontSize: 14 }}>Editar</button>
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '12px 0 0', fontSize: 15 }}>
                    <span><strong>{o.en_uso}</strong> de {o.licencias} licencias en uso</span>
                    <span><strong>{o.invitados}</strong> invitados sin activar</span>
                    <span><strong>{money(mrr(o), o.moneda)}</strong> al mes ({money(o.precio, o.moneda)} × licencia, cobro {o.ciclo || 'mensual'})</span>
                    {pend.length > 0 && <span style={{ color: pend.some(f => f.estado === 'vencida') ? C.coral : '#7A5410', fontWeight: 700 }}>{money(pend.reduce((t, f) => t + Number(f.monto), 0), o.moneda)} por cobrar</span>}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 15 }}>Administradores: {o.admins?.length ? o.admins.join(', ') : <em style={{ color: C.coral }}>ninguno todavía</em>}</p>

                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
                    <button onClick={() => { setAdminFor(adminFor === o.id ? null : o.id); setAdminEmail('') }} style={{ background: 'none', border: 'none', padding: 0, color: C.blue, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>+ Agregar administrador</button>
                    <button onClick={() => setOpenInv(openInv === o.id ? null : o.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.blue, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>{openInv === o.id ? 'Ocultar facturas' : `Facturas (${(o.facturas || []).length})`}</button>
                    {demo && <Link to={`/empresa?demo=1&org=${o.id}`} style={{ color: C.sub, fontWeight: 700, fontSize: 15 }}>Ver su panel ›</Link>}
                  </div>
                  {adminFor === o.id && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <input style={{ ...field, flex: 1, minWidth: 220 }} type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="correo del administrador de la empresa" />
                      <button onClick={() => addAdmin(o.id)} style={btn(C.blue)}>Agregar</button>
                    </div>
                  )}
                  {openInv === o.id && (
                    <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                      {(o.facturas || []).length === 0 && <p style={{ margin: '0 0 10px', color: C.sub }}>Sin facturas todavía.</p>}
                      {(o.facturas || []).map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: `1px solid ${C.line}`, fontSize: 15 }}>
                          <strong style={{ minWidth: 110 }}>{f.numero}</strong>
                          <span style={{ color: C.sub, minWidth: 190 }}>{fmt(f.desde)} – {fmt(f.hasta)}</span>
                          <strong style={{ minWidth: 100 }}>{money(f.monto, o.moneda)}</strong>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: ESTADOS[f.estado]?.bg, color: ESTADOS[f.estado]?.fg }}>{ESTADOS[f.estado]?.label || f.estado}</span>
                          <span style={{ flex: 1 }} />
                          {f.estado !== 'pagada' && <button onClick={() => setStatus(o, f, 'pagada')} style={{ ...btn('#1E6B3E'), padding: '6px 12px', fontSize: 14 }}>Marcar pagada</button>}
                          <button onClick={() => setStatus(o, f, 'anulada')} style={{ background: 'none', border: 'none', color: C.sub, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Anular</button>
                        </div>
                      ))}
                      <button onClick={() => newInvoice(o)} disabled={!Number(o.precio)} style={{ ...btn(C.coral), marginTop: 12 }}>+ Nueva factura</button>
                      {!Number(o.precio) && <p style={{ margin: '6px 0 0', fontSize: 14, color: C.sub }}>Primero ponle un precio por licencia (Editar).</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
