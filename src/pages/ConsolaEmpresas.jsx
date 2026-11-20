import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Consola de FamiliaCerca (nov 2026): solo para el equipo de FamiliaCerca
// (cuentas con rol "admin"). Crear empresas clientes, sus licencias, fechas y
// administradores, sin tocar SQL.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const C = { blue: '#0C6C9C', dark: '#0A4A6B', ink: '#14303D', sub: '#4E6470', line: '#E6E3DB', cream: '#F7F6F2', soft: '#EEF6FA', coral: '#BF513C' }
const empty = { id: null, nombre: '', tipo: 'empresa', plan: 'Empresa', licencias: 25, desde: new Date().toISOString().slice(0, 10), renueva: '' }
const field = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 15, fontFamily: SANS, color: C.ink, background: 'white' }
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: C.sub, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function ConsolaEmpresas() {
  const { user, loading } = useAuth()
  const isAppAdmin = user?.app_metadata?.role === 'admin'
  const [orgs, setOrgs] = useState(null)
  const [form, setForm] = useState(null)
  const [adminFor, setAdminFor] = useState(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.rpc('admin_orgs')
    setOrgs(error ? [] : data)
    if (error) setMsg({ ok: false, text: 'No se pudo cargar. ¿Ya corriste el SQL de empresas v2?' })
  }
  useEffect(() => { if (isAppAdmin) load() }, [isAppAdmin])

  if (!loading && !user) return <Navigate to="/login?next=/consola" replace />
  if (!loading && user && !isAppAdmin) {
    return <div style={{ fontFamily: SANS, padding: 40, textAlign: 'center', color: C.sub }}>Esta consola es solo para el equipo de FamiliaCerca. <Link to="/dashboard" style={{ color: C.blue }}>Volver</Link></div>
  }

  async function save() {
    if (!form.nombre.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_org_save', {
      p_id: form.id, p_name: form.nombre.trim(), p_kind: form.tipo, p_plan: form.plan, p_seats: Number(form.licencias) || 0,
      p_started: form.desde || null, p_renews: form.renueva || null,
    })
    setBusy(false)
    if (error || !data?.ok) { setMsg({ ok: false, text: 'No se pudo guardar.' }); return }
    setMsg({ ok: true, text: form.id ? 'Empresa actualizada.' : 'Empresa creada. Ahora agrégale un administrador.' })
    if (!form.id) setAdminFor(data.id)
    setForm(null); load()
  }

  async function addAdmin(orgId) {
    const e = adminEmail.trim().toLowerCase(); if (!e) return
    const { data, error } = await supabase.rpc('org_add_admin', { p_org: orgId, p_email: e })
    if (error || !data?.ok) { setMsg({ ok: false, text: data?.error === 'sin_cuenta' ? `${e} no tiene cuenta todavía. Pídele que se registre gratis en familiacerca.com y vuelve a agregarlo.` : 'No se pudo agregar.' }); return }
    setMsg({ ok: true, text: `${e} ya administra esa empresa. Entra en familiacerca.com/empresa.` })
    setAdminEmail(''); setAdminFor(null); load()
  }

  const card = { background: 'white', border: `1px solid ${C.line}`, borderRadius: 18, padding: 18 }
  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: SANS, color: C.ink }}>
      <header style={{ background: `linear-gradient(135deg, ${C.dark}, #08303F)`, color: 'white', padding: '18px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Consola de FamiliaCerca</p>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>Empresas clientes · solo equipo interno</p>
          </div>
          <button onClick={() => setForm({ ...empty })} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: C.coral, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>+ Nueva empresa</button>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 48px' }}>
        {msg && <p style={{ margin: '0 0 14px', padding: '12px 16px', borderRadius: 14, background: msg.ok ? C.soft : '#FBEAE4', fontSize: 15, fontWeight: 600 }}>{msg.text}</p>}

        {form && (
          <div style={{ ...card, marginBottom: 16, border: `1.5px solid ${C.blue}` }}>
            <p style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>{form.id ? 'Editar empresa' : 'Nueva empresa'}</p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={label}>Nombre</label><input style={field} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Banco del Caribe" /></div>
              <div><label style={label}>Tipo</label><select style={field} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="empresa">Empresa (beneficio a empleados)</option><option value="agencia">Agencia de cuidadoras</option></select></div>
              <div><label style={label}>Plan</label><input style={field} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} /></div>
              <div><label style={label}>Licencias</label><input style={field} type="number" min="0" value={form.licencias} onChange={e => setForm({ ...form, licencias: e.target.value })} /></div>
              <div><label style={label}>Cliente desde</label><input style={field} type="date" value={form.desde || ''} onChange={e => setForm({ ...form, desde: e.target.value })} /></div>
              <div><label style={label}>Renovación</label><input style={field} type="date" value={form.renueva || ''} onChange={e => setForm({ ...form, renueva: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setForm(null)} style={{ padding: '11px 18px', borderRadius: 12, border: `1.5px solid ${C.line}`, background: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={save} disabled={busy} style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: C.blue, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        )}

        {!orgs ? <p style={{ color: C.sub }}>Cargando…</p> : orgs.length === 0 ? <p style={{ color: C.sub }}>Todavía no hay empresas.</p> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {orgs.map(o => (
              <div key={o.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{o.nombre} <span style={{ fontSize: 13, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>· {o.tipo}</span></p>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: C.sub }}>Plan {o.plan} · desde {fmt(o.desde)} · renueva {fmt(o.renueva)} · código <strong style={{ color: C.blue, letterSpacing: '0.08em' }}>{o.codigo}</strong></p>
                  </div>
                  <button onClick={() => setForm({ id: o.id, nombre: o.nombre, tipo: o.tipo, plan: o.plan, licencias: o.licencias, desde: o.desde, renueva: o.renueva || '' })}
                    style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${C.line}`, background: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Editar</button>
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '12px 0 0', fontSize: 15 }}>
                  <span><strong>{o.en_uso}</strong> de {o.licencias} licencias en uso</span>
                  <span><strong>{o.invitados}</strong> invitados sin activar</span>
                  <span>Administradores: {o.admins?.length ? o.admins.join(', ') : <em style={{ color: C.coral }}>ninguno todavía</em>}</span>
                </div>
                {adminFor === o.id ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <input style={{ ...field, flex: 1, minWidth: 220 }} type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="correo del administrador de la empresa" />
                    <button onClick={() => addAdmin(o.id)} style={{ padding: '11px 16px', borderRadius: 12, border: 'none', background: C.blue, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Agregar</button>
                  </div>
                ) : (
                  <button onClick={() => { setAdminFor(o.id); setAdminEmail('') }} style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, color: C.blue, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>+ Agregar administrador</button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
