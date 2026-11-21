import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { REQ, ROLES, BrandPanel, BillingPanel } from '../components/MarcaBlancaGestion'
import { Phone, AgencyPanel } from './MarcaBlancaDemo'
import { negocio } from '../lib/negocios'

// Panel REAL de una agencia de cuidado en casa (nov 2026).
// Familias conectadas (con su permiso), cuidadoras asignadas, personal con
// sus requisitos, y la marca que ven sus familias.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const INK = '#14303D', SUB = '#5E7480', LINE = '#E6E3DB'
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (c, w) => { const [r, g, b] = hex(c); const m = v => Math.round(v + (255 - v) * w).toString(16).padStart(2, '0'); return `#${m(r)}${m(g)}${m(b)}` }
const onColor = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? INK : 'white' }
const box = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 20, padding: 20 }
const field = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${LINE}`, fontSize: 15, fontFamily: SANS, color: INK, background: 'white' }
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: SUB, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const chip = (bg, fg) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, color: fg })
const OK = ['#E3F4EA', '#1E6B3E'], WARN = ['#FDF3DF', '#7A5410'], BAD = ['#FBEAE4', '#A3452F']
const soon = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10)
const fmt = d => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const ago = d => { if (!d) return 'sin actividad'; const h = (Date.now() - new Date(d)) / 36e5; return h < 1 ? 'hace un rato' : h < 24 ? `hace ${Math.round(h)} h` : `hace ${Math.round(h / 24)} días` }

function Families({ org, color }) {
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState(null)
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/unirme-agencia?codigo=${org.codigo}`
  const fg = onColor(color)
  async function load() {
    if (org.demo) { setList(l => l || org.demo.familias); return }
    const { data, error } = await supabase.rpc('agency_families_list', { p_org: org.id })
    setList(error ? [] : data)
  }
  useEffect(() => { load() }, [org.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function assign(f) {
    const e = email.trim().toLowerCase(); if (!e) return
    if (org.demo) { setList(l => l.map(x => x.owner_id === f.owner_id ? { ...x, cuidadoras: [...x.cuidadoras, { user_id: e, nombre: e.split('@')[0], email: e }] } : x)); setMsg({ ok: true, text: `Demo: ${e} quedó asignada a ${f.paciente}. En la real, ella ya vería a este paciente en su app.` }); setEmail(''); return }
    const { data } = await supabase.rpc('agency_assign_caregiver', { p_org: org.id, p_owner: f.owner_id, p_email: e })
    const errs = { sin_cuenta: `${e} no tiene cuenta. Que se registre gratis en familiacerca.com con ese correo y vuelva a intentarlo.`, familia_no_conectada: 'Esa familia ya no está conectada.', es_la_duena: 'Ese correo es de la dueña de la familia.' }
    setMsg(data?.ok ? { ok: true, text: `Listo: ${e} ya es cuidadora de ${f.paciente} y ve su información en la app.` } : { ok: false, text: errs[data?.error] || 'No se pudo asignar.' })
    setEmail(''); load()
  }
  async function unassign(f, c) {
    if (!window.confirm(`¿Quitar a ${c.nombre} de la familia de ${f.paciente}?`)) return
    if (org.demo) { setList(l => l.map(x => x.owner_id === f.owner_id ? { ...x, cuidadoras: x.cuidadoras.filter(y => y.user_id !== c.user_id) } : x)); return }
    await supabase.rpc('agency_unassign_caregiver', { p_org: org.id, p_owner: f.owner_id, p_user: c.user_id }); load()
  }
  const total = list?.length || 0
  const enCasa = (list || []).filter(f => f.en_casa).length
  const horas = (list || []).reduce((t, f) => t + Number(f.horas_7 || 0), 0)
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        {[['Familias conectadas', total, color], ['Cuidadora en casa ahora', enCasa, '#1E6B3E'], ['Horas de cuidado (7 días)', Math.round(horas), INK]].map(([l, v, c]) => (
          <div key={l} style={{ ...box, padding: '16px 18px' }}><p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>{l}</p><p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: c }}>{v}</p></div>
        ))}
      </div>
      <div style={{ ...box, marginBottom: 14, background: mix(color, 0.9), border: 'none' }}>
        <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>Conectar una familia</p>
        <p style={{ margin: '0 0 10px', fontSize: 15, color: SUB }}>Mándenle este enlace a la familia del paciente. Ella crea su cuenta gratis (o entra) y acepta que ustedes vean el cuidado. Código: <strong style={{ color: INK, letterSpacing: '0.1em' }}>{org.codigo}</strong></p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* */ } }} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>{copied ? '✓ Enlace copiado' : 'Copiar enlace'}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${org.nombre} usa FamiliaCerca para que la familia vea el cuidado de su ser querido: visitas, medicinas y rutina. Conéctese aquí: ${link}`)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 16px', borderRadius: 12, background: '#1E7E43', color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Enviar por WhatsApp</a>
        </div>
      </div>
      {msg && <p style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 12, background: msg.ok ? OK[0] : BAD[0], fontSize: 15 }}>{msg.text}</p>}
      <div style={box}>
        <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>Sus pacientes</p>
        {!list ? <p style={{ color: SUB }}>Cargando…</p> : list.length === 0 ? <p style={{ margin: 0, color: SUB }}>Todavía no hay familias conectadas. Mándeles el enlace de arriba.</p> : list.map(f => (
          <div key={f.owner_id} style={{ borderTop: `1px solid ${LINE}` }}>
            <button onClick={() => { setOpen(open === f.owner_id ? null : f.owner_id); setEmail(''); setMsg(null) }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer', fontFamily: SANS, color: INK, flexWrap: 'wrap' }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: mix(color, 0.85), color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{f.paciente[0]}</span>
              <span style={{ flex: 1, minWidth: 160 }}><strong style={{ display: 'block', fontSize: 16 }}>{f.paciente}</strong><span style={{ fontSize: 13, color: SUB }}>Familia de {f.familia} · {f.miembros} en la familia · última actividad {ago(f.ultima)}</span></span>
              {f.en_casa ? <span style={chip(...OK)}>🟢 {f.en_casa} en casa</span> : <span style={chip('#EEF1F3', SUB)}>Sin visita ahora</span>}
            </button>
            {open === f.owner_id && (
              <div style={{ padding: '0 0 14px 50px' }}>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 15, marginBottom: 10 }}>
                  <span>💊 <strong>{f.medicinas_7}</strong> medicinas marcadas</span>
                  <span>☀️ <strong>{f.rutina_7}</strong> cuidados de rutina</span>
                  <span>📝 <strong>{f.notas_7}</strong> notas</span>
                  <span>🕒 <strong>{f.horas_7}</strong> h de visitas</span>
                  <span style={{ color: SUB }}>(últimos 7 días)</span>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800 }}>Cuidadoras de la agencia en esta familia</p>
                {f.cuidadoras.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 14, color: SUB }}>Ninguna todavía.</p>}
                {f.cuidadoras.map(c => (
                  <p key={c.user_id} style={{ margin: '4px 0', fontSize: 15, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ flex: 1 }}>{c.nombre} <span style={{ color: SUB, fontSize: 13 }}>· {c.email}</span></span>
                    <button onClick={() => unassign(f, c)} style={{ background: 'none', border: 'none', color: '#A3452F', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Quitar</button>
                  </p>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <input style={{ ...field, flex: 1, minWidth: 220 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo de la cuidadora (su cuenta de FamiliaCerca)" />
                  <button onClick={() => assign(f)} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Asignar cuidadora</button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: SUB }}>La cuidadora entra a la app con su cuenta y ve a este paciente: marca medicinas, rutina, “Llegué / Me voy” y deja notas.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Staff({ org, color }) {
  const [list, setList] = useState(null)
  const [form, setForm] = useState(null)
  const [j, setJ] = useState('pr')
  const fg = onColor(color)
  async function load() { if (org.demo) { setList(l => l || org.demo.staff); return } const { data, error } = await supabase.rpc('agency_staff_list', { p_org: org.id }); setList(error ? [] : data) }
  useEffect(() => { load() }, [org.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!form.nombre.trim()) return
    const docs = Object.fromEntries(REQ[form.jurisdiccion].filter(r => form.docs[r.k]?.ok).map(r => [r.k, { ok: true, vence: form.docs[r.k].vence || null }]))
    if (org.demo) { const p = { ...form, id: form.id || 'n' + Date.now(), docs }; setList(l => form.id ? l.map(x => x.id === form.id ? p : x) : [p, ...l]); setForm(null); return }
    await supabase.rpc('agency_staff_save', { p_org: org.id, p_id: form.id || null, p_nombre: form.nombre, p_rol: form.rol, p_telefono: form.telefono || '', p_correo: form.correo || '', p_jur: form.jurisdiccion, p_docs: docs })
    setForm(null); load()
  }
  async function remove(p) { if (!window.confirm(`¿Borrar a ${p.nombre} del personal?`)) return; if (org.demo) { setList(l => l.filter(x => x.id !== p.id)); return } await supabase.rpc('agency_staff_delete', { p_org: org.id, p_id: p.id }); load() }
  const status = p => { const reqs = REQ[p.jurisdiccion || 'pr']; const falta = reqs.filter(r => !p.docs?.[r.k]); const pronto = reqs.filter(r => r.vence && p.docs?.[r.k]?.vence && p.docs[r.k].vence <= soon); return { falta, pronto } }
  const tog = k => ({ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${(form?.jurisdiccion || j) === k ? color : LINE}`, background: (form?.jurisdiccion || j) === k ? color : 'white', color: (form?.jurisdiccion || j) === k ? fg : INK, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS })
  const all = list || []
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: SUB }}>Requisitos de:</span>
          {[['pr', 'Puerto Rico'], ['us', 'Estados Unidos']].map(([k, l]) => <button key={k} onClick={() => form ? setForm({ ...form, jurisdiccion: k }) : setJ(k)} style={tog(k)}>{l}</button>)}
        </div>
        {!form && <button onClick={() => setForm({ nombre: '', rol: ROLES[0], telefono: '', correo: '', jurisdiccion: j, docs: {} })} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>+ Registrar personal</button>}
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        {[['Personal registrado', all.length, INK], ['Con todo al día', all.filter(p => status(p).falta.length === 0).length, '#1E6B3E'], ['Les falta algo', all.filter(p => status(p).falta.length > 0).length, '#A3452F'], ['Vence en 45 días', all.filter(p => status(p).pronto.length > 0).length, '#7A5410']].map(([l, v, c]) => (
          <div key={l} style={{ ...box, padding: '16px 18px' }}><p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>{l}</p><p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: c }}>{v}</p></div>
        ))}
      </div>
      {form && (
        <div style={{ ...box, marginBottom: 14, border: `1.5px solid ${color}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>{form.id ? 'Editar' : 'Registrar'} personal · {form.jurisdiccion === 'pr' ? 'Puerto Rico' : 'Estados Unidos'}</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div><label style={label}>Nombre completo</label><input style={field} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
            <div><label style={label}>Puesto</label><select style={field} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label style={label}>Teléfono</label><input style={field} type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
            <div><label style={label}>Correo</label><input style={field} type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} /></div>
          </div>
          <p style={{ margin: '16px 0 6px', fontSize: 15, fontWeight: 800 }}>Documentos y requisitos</p>
          {REQ[form.jurisdiccion].map(r => {
            const d = form.docs[r.k] || {}
            return (
              <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 0', borderTop: `1px solid ${LINE}` }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 240, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!d.ok} onChange={e => setForm({ ...form, docs: { ...form.docs, [r.k]: { ...d, ok: e.target.checked } } })} style={{ width: 20, height: 20, marginTop: 2, accentColor: color }} />
                  <span><strong style={{ display: 'block', fontSize: 15 }}>{r.l}</strong><span style={{ fontSize: 13, color: SUB }}>{r.d}</span></span>
                </label>
                {r.vence && d.ok && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: SUB }}>Vence <input type="date" value={d.vence || ''} onChange={e => setForm({ ...form, docs: { ...form.docs, [r.k]: { ...d, vence: e.target.value } } })} style={{ ...field, width: 160, padding: '7px 8px', fontSize: 14 }} /></span>}
              </div>
            )
          })}
          <p style={{ margin: '10px 0 0', fontSize: 13, color: SUB }}>No se guardan números de seguro social ni de identificación: solo si el documento está y cuándo vence. Guarden las copias en su archivo de personal.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => setForm(null)} style={{ padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${LINE}`, background: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            <button onClick={save} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Guardar</button>
          </div>
        </div>
      )}
      <div style={box}>
        <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>Su personal</p>
        {!list ? <p style={{ color: SUB }}>Cargando…</p> : all.length === 0 ? <p style={{ margin: 0, color: SUB }}>Todavía no hay personal registrado.</p> : all.map(p => {
          const st = status(p); const [bg, c] = st.falta.length ? BAD : st.pronto.length ? WARN : OK
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
              <span style={{ flex: 1, minWidth: 180 }}><strong style={{ display: 'block', fontSize: 15 }}>{p.nombre}</strong><span style={{ fontSize: 13, color: SUB }}>{p.rol}{p.telefono ? ` · ${p.telefono}` : ''} · {p.jurisdiccion === 'us' ? 'EE. UU.' : 'PR'}</span></span>
              <span style={chip(bg, c)}>{st.falta.length ? `Falta: ${st.falta.map(r => r.l.split(' (')[0]).join(', ')}` : st.pronto.length ? `Vence pronto: ${st.pronto.map(r => `${r.l.split(' (')[0]} (${fmt(p.docs[r.k].vence)})`).join(', ')}` : 'Todo al día'}</span>
              <button onClick={() => setForm({ ...p, telefono: p.telefono || '', correo: p.correo || '', docs: p.docs || {} })} style={{ background: 'none', border: 'none', color, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Editar</button>
              <button onClick={() => remove(p)} style={{ background: 'none', border: 'none', color: SUB, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Borrar</button>
            </div>
          )
        })}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 13, color: SUB, lineHeight: 1.5 }}>Requisitos comunes como referencia. Cada estado, Medicare, Medicaid y cada seguro pueden pedir otros. Verifíquelos con su asesor legal.</p>
    </div>
  )
}

export default function AgenciaPanel({ startOrgId, demo }) {
  const { user, loading } = useAuth()
  const [orgs, setOrgs] = useState(null)
  const [orgId, setOrgId] = useState(null)
  const [org, setOrg] = useState(null)
  const [tab, setTab] = useState(demo ? 'resumen' : 'familias')
  const [price, setPrice] = useState(19.99)
  const [families, setFamilies] = useState(120)
  const [brand, setBrand] = useState(null)
  const [saved, setSaved] = useState('')
  const [menu, setMenu] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    if (demo) { setOrgs(demo.orgs); setOrgId(demo.orgId); return }
    if (!user) return
    supabase.from('organization_admins').select('org_id, organizations(name, kind)').eq('user_id', user.id).then(({ data }) => {
      const l = (data || []).filter(r => r.organizations?.kind === 'agencia').map(r => ({ id: r.org_id, name: r.organizations.name }))
      setOrgs(l); if (l[0]) setOrgId(l.some(x => x.id === startOrgId) ? startOrgId : l[0].id)
    })
  }, [user])
  useEffect(() => {
    if (!orgId) return
    if (demo) { const d = demo.data; setOrg({ id: orgId, nombre: d.brand.nombre, codigo: d.brand.codigo, negocio: negocio(d.negocio, 'agencia'), demo: d }); setBrand({ ...d.brand }); return }
    supabase.rpc('agency_brand_get', { p_org: orgId }).then(({ data }) => {
      if (!data) return
      setOrg({ id: orgId, nombre: data.nombre, codigo: data.codigo, negocio: negocio(data.negocio, data.tipo) })
      setBrand({ nombre: data.nombre, color: data.color || '#0C6C9C', logo: data.logo })
    })
  }, [orgId])

  if (!demo && !loading && !user) return <Navigate to="/login?next=/empresa" replace />
  const page = { minHeight: '100vh', background: '#F7F6F2', fontFamily: SANS, color: INK }
  if (orgs && orgs.length === 0) return (
    <div style={page}><div style={{ maxWidth: 560, margin: '60px auto', padding: '0 16px' }}><div style={box}>
      <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Este panel es para agencias de cuidado</p>
      <p style={{ margin: 0, fontSize: 16, color: SUB, lineHeight: 1.5 }}>Tu cuenta no administra ninguna agencia. Si tu agencia contrató FamiliaCerca, escríbenos a hola@familiacerca.com. <Link to="/demo/ejemplo" style={{ color: '#0C6C9C', fontWeight: 700 }}>Ver la demo</Link></p>
    </div></div></div>
  )
  if (!org || !brand) return <div style={{ ...page, padding: 40, textAlign: 'center', color: SUB }}>Cargando…</div>
  const color = brand.color, fg = onColor(color)
  const pb = { ...brand, nombre: org.nombre, precio: price }
  async function saveBrand(nb = brand) {
    if (demo) { setSaved('Demo: en la versión real esto se guarda y sus familias ven su marca al instante.'); return }
    const { data } = await supabase.rpc('agency_brand_save', { p_org: org.id, p_color: nb.color, p_logo: nb.logo })
    setSaved(data?.ok ? 'Guardado. Sus familias ya ven su marca en la app.' : 'No se pudo guardar.')
  }
  const NAV = demo
    ? [['resumen', '📊', 'Dashboard'], ['familias', '🧑‍🦳', 'Pacientes'], ['app', '📱', 'App de las familias'], ['personal', '🪪', 'Personal'], ['facturacion', '🧾', 'Facturación'], ['precio', '💲', 'Precio'], ['marca', '🎨', 'Marca y colores']]
    : [['familias', '🧑‍🦳', 'Pacientes'], ['personal', '🪪', 'Personal'], ['marca', '🎨', 'Marca y colores'], ['cobros', '🧾', 'Cobros']]
  const title = NAV.find(n => n[0] === tab)?.[2]
  async function uploadLogo(file) {
    if (!file?.type?.startsWith('image/')) return
    const img = new Image()
    img.onload = async () => {
      const sc = Math.min(1, 256 / Math.max(img.width, img.height))
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc)
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
      URL.revokeObjectURL(img.src)
      const nb = { ...brand, logo: cv.toDataURL('image/png') }
      setBrand(nb); await saveBrand(nb)
    }
    img.src = URL.createObjectURL(file)
  }
  async function saveName() {
    const n = nameDraft.trim(); if (!n) return
    if (!demo) {
      const { data } = await supabase.rpc('agency_name_save', { p_org: org.id, p_name: n })
      if (!data?.ok) { setSaved('No se pudo cambiar el nombre.'); return }
    }
    setOrg(o => ({ ...o, nombre: n })); setEditName(false)
  }
  const navBtn = k => ({ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 12, border: 'none', background: tab === k ? mix(color, 0.86) : 'transparent', color: tab === k ? INK : SUB, fontWeight: tab === k ? 800 : 600, fontSize: 15, cursor: 'pointer', fontFamily: SANS, marginBottom: 2 })
  return (
    <div style={page} className="fc-shell">
      <style>{`.fc-shell{display:flex}.fc-side{width:264px;flex-shrink:0;background:white;border-right:1px solid ${LINE};position:sticky;top:0;height:100vh;overflow-y:auto;display:flex;flex-direction:column;box-sizing:border-box}.fc-main{flex:1;min-width:0}.fc-mob{display:none}@media(max-width:820px){.fc-shell{display:block}.fc-side{position:fixed;left:0;top:0;z-index:60;transform:translateX(-100%);transition:transform .2s}.fc-side.open{transform:none;box-shadow:0 0 40px rgba(0,0,0,.25)}.fc-mob{display:flex}}`}</style>
      <aside className={`fc-side${menu ? ' open' : ''}`}>
        <div style={{ background: color, color: fg, padding: '18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label title="Cambiar logo" style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              {brand.logo ? <img src={brand.logo} alt="" style={{ width: 48, height: 48, objectFit: 'contain', background: 'white', borderRadius: 12, padding: 4, boxSizing: 'border-box' }} /> : <span style={{ width: 48, height: 48, borderRadius: 12, background: 'white', color, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{org.nombre[0]}</span>}
              <span style={{ position: 'absolute', right: -6, bottom: -6, width: 22, height: 22, borderRadius: '50%', background: 'white', color: INK, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.25)' }}>📷</span>
              <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
            {editName ? (
              <span style={{ flex: 1, minWidth: 0 }}>
                <input autoFocus value={nameDraft} maxLength={80} onChange={e => setNameDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditName(false) }} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: 'none', fontSize: 15, fontFamily: SANS }} />
                <span style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button onClick={saveName} style={{ background: 'white', color: INK, border: 'none', borderRadius: 8, padding: '4px 10px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>Guardar</button>
                  <button onClick={() => setEditName(false)} style={{ background: 'none', color: fg, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
                </span>
              </span>
            ) : (
              <button onClick={() => { setNameDraft(org.nombre); setEditName(true) }} title="Cambiar nombre" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, color: fg, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>{org.nombre} <span style={{ fontSize: 13, opacity: 0.8 }}>✏️</span></span>
                <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>{org.negocio.label}</span>
              </button>
            )}
          </div>
          {saved && <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.9 }}>{saved}</p>}
        </div>
        <nav style={{ padding: 12, flex: 1 }}>
          {NAV.map(([k, ic, l]) => (
            <button key={k} onClick={() => { setTab(k); setMenu(false) }} style={navBtn(k)}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{ic}</span>{l}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: `1px solid ${LINE}` }}>
          {orgs?.length > 1 && (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{demo ? 'Cliente de ejemplo' : 'Cambiar de cliente'}</p>
              <select value={orgId} onChange={e => demo ? demo.onSwitch(e.target.value) : setOrgId(e.target.value)} style={{ ...field, padding: '9px 10px', fontSize: 14, marginBottom: 10 }}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            </>
          )}
          <p style={{ margin: 0, fontSize: 12, color: SUB }}>Con la tecnología de <strong>FamiliaCerca</strong></p>
        </div>
      </aside>
      {menu && <div className="fc-mob" onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 55 }} />}
      <div className="fc-main">
        <div className="fc-mob" style={{ alignItems: 'center', gap: 12, padding: '12px 16px', background: color, color: fg, position: 'sticky', top: 0, zIndex: 30 }}>
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 40, height: 40, color: fg, fontSize: 20, cursor: 'pointer' }}>☰</button>
          <span style={{ fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.nombre}</span>
        </div>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 48px' }}>
        {demo && <p style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 14, background: '#FDF3DF', color: '#7A5410', fontSize: 15, fontWeight: 600 }}>Datos de ejemplo con clientes ficticios: así ve su panel {org.negocio.corto}. Toque el logo o el nombre del menú para cambiarlos. Nada se guarda.</p>}
        <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800 }}>{title}</h1>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          {tab === 'resumen' && <AgencyPanel b={pb} families={families} price={price} />}
          {tab === 'facturacion' && <BillingPanel b={pb} families={families} price={price} />}
          {tab === 'app' && (
            <div style={box}>
              <p style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>Lo que reciben las familias de sus pacientes</p>
              {[['🟢', 'Ven la visita en vivo', 'Saben cuándo llegó y se fue la cuidadora, y leen sus notas del día.'], ['💊', 'Medicinas y rutina al día', 'Todos ven qué se dio y qué falta. La app avisa si algo se olvida.'], ['👨‍👩‍👧', 'Toda la familia conectada', 'Los hijos que viven lejos se reparten tareas y gastos.'], ['🚨', 'Emergencias', `Un botón avisa a la familia y a ${org.negocio.corto} al instante.`], ['⭐', 'Con su marca', `Su logo y su color. Las familias se suscriben a ${org.nombre}.`]].map(([i, t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
                  <span style={{ fontSize: 24 }}>{i}</span>
                  <span><strong style={{ display: 'block', fontSize: 16 }}>{t}</strong><span style={{ fontSize: 15, color: SUB, lineHeight: 1.5 }}>{d}</span></span>
                </div>
              ))}
              <p style={{ margin: '10px 0 0', fontSize: 14, color: SUB }}>Toque las pantallas del teléfono para probarla.</p>
            </div>
          )}
          {tab === 'precio' && (
            <div style={box}>
              <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Ustedes ponen el precio</p>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: SUB }}>Cambie el precio y vea al lado cómo lo ven las familias en la pantalla “Plan”.</p>
              <label style={label}>Precio por familia al mes (USD)</label>
              <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(Number(e.target.value) || 0)} style={{ ...field, fontSize: 22, fontWeight: 800, color }} />
              <label style={{ ...label, marginTop: 16 }}>Familias suscritas: <strong style={{ color: INK }}>{families}</strong></label>
              <input type="range" min="5" max="500" step="5" value={families} onChange={e => setFamilies(Number(e.target.value))} style={{ width: '100%', accentColor: color }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                {[['Ingreso al mes', families * price], ['Ingreso al año', families * price * 12]].map(([l, v]) => (
                  <div key={l} style={{ background: mix(color, 0.88), borderRadius: 16, padding: 16 }}>
                    <p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 600 }}>{l}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>{v.toLocaleString('es', { style: 'currency', currency: 'USD' })}</p>
                  </div>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 13, color: SUB }}>Cálculo de ejemplo: familias × precio. No incluye costos ni comisiones.</p>
            </div>
          )}
          {demo && ['app', 'precio', 'marca'].includes(tab) && <Phone key={tab} brand={pb} start={tab === 'precio' ? 'plan' : 'inicio'} />}
          {tab === 'familias' && <Families org={org} color={color} />}
          {tab === 'personal' && <Staff org={org} color={color} />}
          {tab === 'marca' && (
            <div>
              <BrandPanel real b={{ ...brand, nombre: org.nombre }} onChange={ch => { setSaved(''); setBrand(x => ({ ...x, ...ch, nombre: x.nombre })) }} />
              <button onClick={() => saveBrand()} style={{ marginTop: 12, padding: '12px 20px', borderRadius: 12, border: 'none', background: color, color: fg, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Guardar mi marca</button>
              {saved && <p style={{ margin: '10px 0 0', fontSize: 15 }}>{saved}</p>}
            </div>
          )}
          {tab === 'cobros' && (
            <div style={{ ...box, gridColumn: '1 / -1' }}>
              <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>Cobros a sus familias</p>
              <p style={{ margin: 0, fontSize: 15, color: SUB, lineHeight: 1.5 }}>Muy pronto: conecten su cuenta de pagos y cobren su suscripción mensual a cada familia, con facturas y recordatorios automáticos. <Link to="/demo/ejemplo" style={{ color, fontWeight: 700 }}>Vea cómo se verá</Link>.</p>
            </div>
          )}
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 13, color: SUB, lineHeight: 1.5 }}>🔒 Cada familia aceptó que su agencia vea el cuidado de su paciente y puede quitar el acceso cuando quiera. Esta información es de salud: úsela solo para dar el servicio.</p>
      </main>
      </div>
    </div>
  )
}
