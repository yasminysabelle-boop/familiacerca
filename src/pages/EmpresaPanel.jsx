import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { demoOrgs, demoDashboard, demoPeopleFor, demoPatients, money, ESTADOS } from '../lib/empresaDemo'
import AgenciaPanel from './AgenciaPanel'
import { negocio } from '../lib/negocios'

// Panel para empresas (nov 2026). Solo para administradores de una empresa
// cliente. Muestra TOTALES de uso (org_dashboard en Supabase), nunca datos de
// una familia. Con ?demo=1 muestra datos de ejemplo para presentaciones.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const C = { blue: '#0C6C9C', dark: '#0A4A6B', ink: '#14303D', sub: '#4E6470', line: '#E6E3DB', cream: '#F7F6F2', soft: '#EEF6FA', coral: '#BF513C', teal: '#2BB8CC' }

const FEATURES = [
  ['medicinas', 'Medicinas marcadas'],
  ['rutina', 'Cuidados de la rutina'],
  ['tareas', 'Tareas repartidas y hechas'],
  ['notas', 'Notas del día'],
  ['gastos', 'Gastos anotados'],
  ['milo', 'Preguntas a Milo y Luna'],
  ['emergencias', 'Alertas de emergencia'],
]

const fmtShort = d => d ? new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
const num = n => (n ?? 0).toLocaleString('es')

function Tile({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 18, padding: '18px 18px 16px' }}>
      <p style={{ margin: 0, fontSize: 14, color: C.sub, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '6px 0 2px', fontSize: 32, fontWeight: 800, color: accent || C.ink, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 14, color: C.sub }}>{sub}</p>}
    </div>
  )
}

function Card({ title, subtitle, children, style }) {
  return (
    <section style={{ background: 'white', border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, ...style }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.ink }}>{title}</h2>
      {subtitle && <p style={{ margin: '4px 0 0', fontSize: 14, color: C.sub }}>{subtitle}</p>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  )
}

function WeeklyChart({ weeks }) {
  const max = Math.max(1, ...weeks.map(w => w.familias))
  const W = 560, H = 190, pad = 28, bw = (W - pad) / weeks.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 34}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Familias activas por semana">
      {[0, 0.5, 1].map(t => (
        <g key={t}>
          <line x1={pad} x2={W} y1={H - t * (H - 16)} y2={H - t * (H - 16)} stroke={C.line} />
          <text x={pad - 6} y={H - t * (H - 16) + 4} fontSize="11" textAnchor="end" fill={C.sub}>{Math.round(t * max)}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const h = (w.familias / max) * (H - 16)
        const x = pad + i * bw + bw * 0.18
        const last = i === weeks.length - 1
        return (
          <g key={w.semana}>
            <rect x={x} y={H - h} width={bw * 0.64} height={Math.max(h, 1)} rx="6" fill={last ? C.blue : '#9CCBE0'} />
            <text x={x + bw * 0.32} y={H - h - 6} fontSize="12" fontWeight="700" textAnchor="middle" fill={C.ink}>{w.familias}</text>
            <text x={x + bw * 0.32} y={H + 18} fontSize="11" textAnchor="middle" fill={C.sub}>
              {new Date(w.semana + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function EmpresaPanel() {
  const { user, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const demo = params.get('demo') === '1'
  const [orgs, setOrgs] = useState(null)
  const [orgId, setOrgId] = useState(null)
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('resumen')
  const [people, setPeople] = useState(null)
  const [emailsText, setEmailsText] = useState('')
  const [inviteMsg, setInviteMsg] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminMsg, setAdminMsg] = useState(null)
  const [billing, setBilling] = useState(null)
  const [menu, setMenu] = useState(false)
  const [calcN, setCalcN] = useState(60)
  const [calcP, setCalcP] = useState(4)

  useEffect(() => {
    if (demo) { const l = demoOrgs(); setOrgs(l.map(x => ({ id: x.id, name: x.nombre, kind: x.tipo }))); setOrgId(id => id || (l.some(x => x.id === params.get('org')) ? params.get('org') : l[0].id)); return }
    if (!user) return
    supabase.from('organization_admins').select('org_id, organizations(name, kind)').eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) { setOrgs([]); return }
        const list = (data ?? []).map(r => ({ id: r.org_id, name: r.organizations?.name, kind: r.organizations?.kind }))
        setOrgs(list); if (list[0]) setOrgId(list[0].id)
      })
  }, [user, demo])

  useEffect(() => {
    if (!orgId) return
    setBilling(null); setPeople(null)
    if (demo) { setData(demoDashboard(orgId)); return }
    setData(null); setError('')
    supabase.rpc('org_dashboard', { p_org: orgId, p_days: days })
      .then(({ data, error }) => error ? setError('No se pudo cargar el panel. Intenta de nuevo en un rato.') : setData(data))
  }, [orgId, days, demo])

  async function loadPeople() {
    if (demo) { setPeople(demoPeopleFor(orgId)); return }
    if (!orgId) return
    const { data, error } = await supabase.rpc('org_people', { p_org: orgId })
    setPeople(error ? { miembros: [], invitados: [], admins: [], error: true } : data)
  }
  useEffect(() => { if (tab === 'empleados' || tab === 'admins') loadPeople() }, [tab, orgId, demo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== 'facturacion' || !orgId) return
    if (demo) { setBilling(demoDashboard(orgId).billing); return }
    supabase.rpc('org_billing', { p_org: orgId }).then(({ data, error }) => setBilling(error ? { error: true, facturas: [] } : data))
  }, [tab, orgId, demo])

  async function invite() {
    const list = [...new Set(emailsText.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean))]
    if (!list.length) return
    if (demo) { setInviteMsg({ ok: true, text: `En una empresa real se mandarían ${list.length} invitaciones por correo.` }); return }
    setInviting(true); setInviteMsg(null)
    const { data, error } = await supabase.rpc('org_invite', { p_org: orgId, p_emails: list })
    if (error) { setInviting(false); setInviteMsg({ ok: false, text: 'No se pudieron guardar las invitaciones. Revisa los correos e intenta de nuevo.' }); return }
    const valid = list.filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    let sentTxt = ''
    if (data.invitados > 0) {
      const { data: sent, error: sendErr } = await supabase.functions.invoke('send-org-invite', { body: { orgId, emails: valid.slice(0, 100) } })
      sentTxt = sendErr || !sent ? ' No se pudo mandar el correo: compartan el enlace de invitación.' : ` Se mandó el correo a ${sent.sent}.`
    }
    const parts = [`${data.invitados} invitados.`]
    if (data.ya_eran) parts.push(`${data.ya_eran} ya tenían el beneficio.`)
    if (data.invalidos) parts.push(`${data.invalidos} correos no eran válidos.`)
    setInviting(false); setEmailsText(''); setInviteMsg({ ok: true, text: parts.join(' ') + sentTxt }); loadPeople()
  }

  async function removeMember(m) {
    if (!window.confirm(`¿Quitar la licencia de ${m.nombre}? Su cuenta y su familia siguen igual; solo deja de tener el beneficio.`)) return
    if (demo) return
    await supabase.rpc('org_remove_member', { p_org: orgId, p_user: m.user_id }); loadPeople()
  }
  async function cancelInvite(i) {
    if (demo) return
    await supabase.rpc('org_cancel_invite', { p_org: orgId, p_email: i.email }); loadPeople()
  }
  async function addAdmin() {
    const e = adminEmail.trim().toLowerCase(); if (!e) return
    if (demo) { setAdminMsg({ ok: true, text: 'En una empresa real, esa persona ya podría entrar al panel.' }); return }
    const { data, error } = await supabase.rpc('org_add_admin', { p_org: orgId, p_email: e })
    if (error || !data?.ok) { setAdminMsg({ ok: false, text: data?.error === 'sin_cuenta' ? 'Esa persona todavía no tiene cuenta. Que se registre gratis en familiacerca.com con ese correo y luego la agregan.' : 'No se pudo agregar.' }); return }
    setAdminEmail(''); setAdminMsg({ ok: true, text: 'Listo. Ya puede entrar a familiacerca.com/empresa con su cuenta.' }); loadPeople()
  }
  async function removeAdmin(a) {
    if (demo || !window.confirm(`¿Quitar a ${a.nombre} como administrador?`)) return
    const { data } = await supabase.rpc('org_remove_admin', { p_org: orgId, p_user: a.user_id })
    if (data && !data.ok) setAdminMsg({ ok: false, text: 'Tiene que quedar al menos un administrador.' })
    loadPeople()
  }

  const feats = useMemo(() => {
    if (!data?.funciones) return []
    const list = FEATURES.map(([k, label]) => ({ k, label, n: data.funciones[k] ?? 0 }))
    if (data.funciones.horas_turno > 0) list.push({ k: 'horas_turno', label: 'Horas de turno de cuidadoras', n: data.funciones.horas_turno })
    return list.sort((a, b) => b.n - a.n)
  }, [data])
  const maxFeat = Math.max(1, ...feats.map(f => f.n))

  const page = { minHeight: '100vh', background: C.cream, fontFamily: SANS, color: C.ink }
  // La demo se ve sin cuenta (para presentaciones); el panel real pide entrar
  if (!demo && !authLoading && !user) return <Navigate to="/login?next=/empresa" replace />
  // Los que cuidan pacientes (agencia, hospital, clínica, hogar) ven su panel de pacientes
  if (!demo && orgs?.find(x => x.id === orgId)?.kind === 'agencia') return <AgenciaPanel startOrgId={orgId} />
  if (demo && orgs?.find(x => x.id === orgId)?.kind === 'agencia') return <AgenciaPanel key={orgId} demo={{ orgs, orgId, onSwitch: setOrgId, data: demoPatients(orgId) }} />
  const header = (
    <header style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.dark})`, color: 'white', padding: '18px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="" width="40" height="40" style={{ background: 'white', borderRadius: 12, padding: 4 }} />
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>FamiliaCerca para empresas</p>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{data?.org?.nombre || 'Panel de uso'}</p>
          </div>
        </div>
        {orgs?.length > 1 && (
          <select value={orgId || ''} onChange={e => setOrgId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', fontFamily: SANS, fontSize: 15 }}>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
    </header>
  )

  if (!demo && orgs && orgs.length === 0) {
    return (
      <div style={page}>{header}
        <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px' }}>
          <Card title="Este panel es para empresas clientes">
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: C.sub }}>
              Tu cuenta no administra ninguna empresa. Si tu empresa contrató FamiliaCerca y deberías tener acceso, escríbenos a hola@familiacerca.com.
            </p>
            <p style={{ margin: '14px 0 0' }}><Link to="/empresa?demo=1" style={{ color: C.blue, fontWeight: 700 }}>Ver el panel con datos de ejemplo ›</Link></p>
          </Card>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div style={page}>{header}<p style={{ textAlign: 'center', padding: 40, color: error ? C.coral : C.sub }}>{error || 'Cargando…'}</p></div>
  }

  const o = data.org
  const inUse = data.miembros
  const pct = o.licencias ? Math.round((inUse / o.licencias) * 100) : 0
  const joinUrl = `${window.location.origin}/unirme-empresa?codigo=${o.codigo}`
  const grid = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }

  const neg = negocio(demo ? demoOrgs().find(x => x.id === orgId)?.negocio : null, 'empresa')
  const NAV = [['resumen', '📊', 'Dashboard'], ['empleados', '👥', neg.k === 'aseguradora' ? 'Afiliados' : 'Empleados'], ['facturacion', '🧾', 'Facturación'], ['admins', '🔑', 'Administradores']]
  const navBtn = k => ({ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 12, border: 'none', background: tab === k ? C.soft : 'transparent', color: tab === k ? C.ink : C.sub, fontWeight: tab === k ? 800 : 600, fontSize: 15, cursor: 'pointer', fontFamily: SANS, marginBottom: 2 })
  return (
    <div style={page} className="fc-shell">
      <style>{`.fc-shell{display:flex}.fc-side{width:264px;flex-shrink:0;background:white;border-right:1px solid ${C.line};position:sticky;top:0;height:100vh;overflow-y:auto;display:flex;flex-direction:column;box-sizing:border-box}.fc-main{flex:1;min-width:0}.fc-mob{display:none}@media(max-width:820px){.fc-shell{display:block}.fc-side{position:fixed;left:0;top:0;z-index:60;transform:translateX(-100%);transition:transform .2s}.fc-side.open{transform:none;box-shadow:0 0 40px rgba(0,0,0,.25)}.fc-mob{display:flex}}`}</style>
      <aside className={`fc-side${menu ? ' open' : ''}`}>
        <div style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.dark})`, color: 'white', padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="" width="44" height="44" style={{ background: 'white', borderRadius: 12, padding: 4, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>{o.nombre}</span>
            <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>{neg.label}</span>
          </span>
        </div>
        <nav style={{ padding: 12, flex: 1 }}>
          {NAV.map(([k, ic, l]) => (
            <button key={k} onClick={() => { setTab(k); setMenu(false) }} style={navBtn(k)}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{ic}</span>{l}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: `1px solid ${C.line}` }}>
          {orgs?.length > 1 && (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{demo ? 'Cliente de ejemplo' : 'Cambiar de cliente'}</p>
              <select value={orgId || ''} onChange={e => setOrgId(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontFamily: SANS, fontSize: 14, marginBottom: 10 }}>
                {orgs.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </>
          )}
          <p style={{ margin: 0, fontSize: 12, color: C.sub }}>FamiliaCerca para empresas</p>
        </div>
      </aside>
      {menu && <div className="fc-mob" onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 55 }} />}
      <div className="fc-main">
        <div className="fc-mob" style={{ alignItems: 'center', gap: 12, padding: '12px 16px', background: C.blue, color: 'white', position: 'sticky', top: 0, zIndex: 30 }}>
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 40, height: 40, color: 'white', fontSize: 20, cursor: 'pointer' }}>☰</button>
          <span style={{ fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombre}</span>
        </div>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
        {demo && (
          <p style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 14, background: '#FDF3DF', color: '#7A5410', fontSize: 15, fontWeight: 600 }}>
            Datos de ejemplo con clientes ficticios, para presentaciones. Cambia de cliente abajo en el menú de la izquierda. Un cliente real solo ve lo suyo.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{NAV.find(n => n[0] === tab)?.[2]}</h1>
          {!demo && tab === 'resumen' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)} style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${days === d ? C.blue : C.line}`, background: days === d ? C.blue : 'white', color: days === d ? 'white' : C.ink, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                  Últimos {d} días
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === 'resumen' && (<>
        <div style={grid}>
          <Tile label="Licencias en uso" value={`${num(inUse)} de ${num(o.licencias)}`} sub={`${pct}% del plan · ${num(Math.max(0, o.licencias - inUse))} libres`} />
          <Tile label="Familias cuidando con la app" value={num(data.familias)} sub="Empleados y sus familiares" />
          <Tile label="Familias activas esta semana" value={data.detalle_oculto ? '—' : num(data.activas_7)} sub={data.detalle_oculto ? null : `${data.familias ? Math.round((data.activas_7 / data.familias) * 100) : 0}% de las familias`} accent={C.blue} />
          <Tile label="Familias activas en 30 días" value={data.detalle_oculto ? '—' : num(data.activas_30)} />
        </div>

        {data.detalle_oculto ? (
          <Card title="El detalle aparece desde 5 personas" style={{ marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: C.sub }}>
              Para proteger la privacidad de sus empleados, el uso por semana y por función se muestra cuando al menos {data.grupo_minimo} personas usan el beneficio. Hoy son {inUse}.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 14 }}>
            <Card title="Familias activas por semana" subtitle="Familias que registraron algo en la app cada semana">
              <WeeklyChart weeks={data.semanas || []} />
            </Card>
            <Card title="Lo que más usan" subtitle={`Veces que se usó cada parte, últimos ${data.dias} días`}>
              {feats.map(f => (
                <div key={f.k} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{f.label}</span><strong>{num(f.n)}</strong>
                  </div>
                  <div style={{ height: 10, borderRadius: 6, background: C.soft, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (f.n / maxFeat) * 100)}%`, height: '100%', borderRadius: 6, background: f.k === 'emergencias' ? C.coral : C.blue }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 14 }}>
          <Card title="Su contrato">
            {[['Plan', o.plan], ['Licencias contratadas', num(o.licencias)], ['Cliente desde', fmtDate(o.desde)], ['Renovación', fmtDate(o.renueva)]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 15 }}>
                <span style={{ color: C.sub }}>{k}</span><strong>{v}</strong>
              </div>
            ))}
          </Card>
          <Card title="Invitar a sus empleados" subtitle="Compartan este enlace o el código por correo o WhatsApp">
            <p style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 800, letterSpacing: '0.15em', color: C.blue }}>{o.codigo}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={async () => { try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* */ } }}
                style={{ padding: '11px 16px', borderRadius: 12, border: 'none', background: C.blue, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>
                {copied ? '✓ Enlace copiado' : 'Copiar enlace de invitación'}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Tu empresa te regala FamiliaCerca para organizar el cuidado de tu familiar. Únete aquí: ${joinUrl}`)}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: '11px 16px', borderRadius: 12, background: '#1E7E43', color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                Enviar por WhatsApp
              </a>
            </div>
          </Card>
        </div>

        </>)}

        {tab === 'empleados' && (
          <>
            <div style={grid}>
              <Tile label="Con el beneficio" value={num(inUse)} sub={`de ${num(o.licencias)} licencias`} accent={C.blue} />
              <Tile label="Invitados sin activar" value={people ? num(people.invitados.length) : '…'} sub="Recibieron la invitación" />
              <Tile label="Licencias libres" value={num(Math.max(0, o.licencias - inUse))} />
            </div>
            <Card title="Invitar empleados" subtitle="Peguen uno o varios correos (separados por coma o uno por línea). Les llega un correo para activar su beneficio." style={{ marginTop: 14 }}>
              <textarea value={emailsText} onChange={e => setEmailsText(e.target.value)} rows={4} placeholder={'ana@empresa.com\ncarlos@empresa.com'}
                style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 14, border: `1.5px solid ${C.line}`, fontSize: 15, fontFamily: SANS, color: C.ink, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <button onClick={invite} disabled={inviting || !emailsText.trim()} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: emailsText.trim() ? C.coral : '#C9D6DB', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>
                  {inviting ? 'Invitando…' : 'Mandar invitaciones'}
                </button>
                <span style={{ fontSize: 14, color: C.sub }}>También pueden compartir el código <strong style={{ color: C.blue, letterSpacing: '0.1em' }}>{o.codigo}</strong></span>
              </div>
              {inviteMsg && <p style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 12, background: inviteMsg.ok ? C.soft : '#FBEAE4', fontSize: 15 }}>{inviteMsg.text}</p>}
            </Card>
            <Card title="Quién tiene el beneficio" subtitle="Aquí ven quién lo tiene, no lo que hace en la app." style={{ marginTop: 14 }}>
              {demo && <p style={{ margin: '0 0 8px', fontSize: 14, color: C.sub }}>Ejemplo: aquí aparece la lista completa.</p>}
              {!people ? <p style={{ color: C.sub }}>Cargando…</p> : people.miembros.length === 0 ? <p style={{ margin: 0, color: C.sub }}>Todavía nadie lo activó.</p> : people.miembros.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: C.soft, color: C.blue, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(m.nombre || '?')[0].toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{m.nombre}</span>
                    <span style={{ display: 'block', fontSize: 14, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email} · desde {fmtShort(m.desde)}</span>
                  </span>
                  <button onClick={() => removeMember(m)} style={{ background: 'none', border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '7px 12px', color: '#A3452F', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Quitar licencia</button>
                </div>
              ))}
            </Card>
            {people?.invitados?.length > 0 && (
              <Card title="Invitados que no han activado" style={{ marginTop: 14 }}>
                {people.invitados.map(i => (
                  <div key={i.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{i.email} <span style={{ color: C.sub, fontSize: 14 }}>· invitado el {fmtShort(i.desde)}</span></span>
                    <button onClick={() => cancelInvite(i)} style={{ background: 'none', border: 'none', color: C.sub, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {tab === 'facturacion' && (
          !billing ? <p style={{ color: C.sub }}>Cargando…</p> : (() => {
            const cur = billing.moneda || 'USD'
            const mensual = (billing.licencias || 0) * (billing.precio || 0)
            const porCobrar = billing.facturas.filter(f => f.estado !== 'pagada').reduce((t, f) => t + Number(f.monto), 0)
            const pagado = billing.facturas.filter(f => f.estado === 'pagada').reduce((t, f) => t + Number(f.monto), 0)
            return (
              <>
                <div style={grid}>
                  <Tile label="Costo mensual" value={money(mensual, cur)} sub={`${num(billing.licencias)} licencias × ${money(billing.precio, cur)}`} accent={C.blue} />
                  <Tile label={billing.ciclo === 'anual' ? 'Se factura al año' : 'Se factura cada mes'} value={money(billing.ciclo === 'anual' ? mensual * 12 : mensual, cur)} sub={`Renovación: ${fmtDate(billing.renueva)}`} />
                  <Tile label="Saldo pendiente" value={money(porCobrar, cur)} sub={porCobrar ? 'Ver facturas abajo' : 'Están al día ✓'} accent={porCobrar ? C.coral : '#1E6B3E'} />
                  <Tile label="Pagado a la fecha" value={money(pagado, cur)} />
                </div>
                {demo && (
                  <Card title="Calcule su plan" subtitle="Escriba cuántos empleados quiere cubrir y el precio por licencia: el total sale solo." style={{ marginTop: 14 }}>
                    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
                      <label style={{ fontSize: 14, fontWeight: 700, color: C.sub }}>Empleados (licencias)
                        <input type="number" min="1" value={calcN} onChange={e => setCalcN(Math.max(0, Number(e.target.value) || 0))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 22, fontWeight: 800, fontFamily: SANS, color: C.ink }} />
                      </label>
                      <label style={{ fontSize: 14, fontWeight: 700, color: C.sub }}>Precio por licencia al mes (USD)
                        <input type="number" min="0" step="0.5" value={calcP} onChange={e => setCalcP(Math.max(0, Number(e.target.value) || 0))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 22, fontWeight: 800, fontFamily: SANS, color: C.blue }} />
                      </label>
                      <div style={{ background: C.soft, borderRadius: 16, padding: 16 }}>
                        <p style={{ margin: 0, fontSize: 14, color: C.sub, fontWeight: 600 }}>Total al mes</p>
                        <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: C.ink }}>{money(calcN * calcP)}</p>
                      </div>
                      <div style={{ background: C.soft, borderRadius: 16, padding: 16 }}>
                        <p style={{ margin: 0, fontSize: 14, color: C.sub, fontWeight: 600 }}>Total al año</p>
                        <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: C.ink }}>{money(calcN * calcP * 12)}</p>
                      </div>
                    </div>
                    <input type="range" min="5" max="1000" step="5" value={calcN} onChange={e => setCalcN(Number(e.target.value))} style={{ width: '100%', marginTop: 14, accentColor: C.blue }} aria-label="Cantidad de empleados" />
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: C.sub }}>Cálculo de ejemplo. El precio final se acuerda con cada empresa.</p>
                  </Card>
                )}
                <Card title="Facturas" subtitle={billing.correo ? `Se envían a ${billing.correo}` : 'Escríbannos a hola@familiacerca.com para recibirlas por correo'} style={{ marginTop: 14 }}>
                  {billing.facturas.length === 0 ? <p style={{ margin: 0, color: C.sub }}>Todavía no hay facturas.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: 520 }}>
                        <thead><tr style={{ textAlign: 'left', color: C.sub, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {['Factura', 'Período', 'Licencias', 'Monto', 'Estado'].map(h => <th key={h} style={{ padding: '8px 6px', fontWeight: 700 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {billing.facturas.map(f => (
                            <tr key={f.id} style={{ borderTop: `1px solid ${C.line}` }}>
                              <td style={{ padding: '10px 6px', fontWeight: 700 }}>{f.numero}</td>
                              <td style={{ padding: '10px 6px' }}>{fmtShort(f.desde + 'T12:00:00')} – {fmtShort(f.hasta + 'T12:00:00')}</td>
                              <td style={{ padding: '10px 6px' }}>{num(f.licencias)}</td>
                              <td style={{ padding: '10px 6px', fontWeight: 700 }}>{money(f.monto, cur)}</td>
                              <td style={{ padding: '10px 6px' }}>
                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: ESTADOS[f.estado]?.bg, color: ESTADOS[f.estado]?.fg }}>{ESTADOS[f.estado]?.label || f.estado}</span>
                                {f.estado !== 'pagada' && f.vence && <span style={{ display: 'block', fontSize: 13, color: C.sub, marginTop: 4 }}>vence {fmtShort(f.vence + 'T12:00:00')}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            )
          })()
        )}

        {tab === 'admins' && (
          <Card title="Administradores del panel" subtitle="Personas de su empresa que pueden ver este panel e invitar empleados.">
            {(people?.admins || []).map(a => (
              <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{a.nombre}{a.user_id === user?.id ? ' (tú)' : ''}</span>
                  <span style={{ display: 'block', fontSize: 14, color: C.sub }}>{a.email}</span>
                </span>
                {a.user_id !== user?.id && <button onClick={() => removeAdmin(a)} style={{ background: 'none', border: 'none', color: '#A3452F', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Quitar</button>}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="correo@empresa.com" type="email"
                style={{ flex: 1, minWidth: 220, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 15, fontFamily: SANS }} />
              <button onClick={addAdmin} style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: C.blue, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>Agregar administrador</button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 14, color: C.sub }}>La persona necesita una cuenta de FamiliaCerca con ese correo (registrarse es gratis).</p>
            {adminMsg && <p style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 12, background: adminMsg.ok ? C.soft : '#FBEAE4', fontSize: 15 }}>{adminMsg.text}</p>}
          </Card>
        )}

        <Card title="Privacidad de sus empleados" style={{ marginTop: 14, background: C.soft, border: 'none' }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: C.ink }}>
            El uso de la app se muestra solo en totales. En Empleados ven quién tiene el beneficio, pero nunca lo que hace cada uno, ni el nombre de sus familiares, medicinas, notas, gastos o datos de salud.
            El detalle por semana y por función aparece solo cuando al menos {data.grupo_minimo} personas usan el beneficio. Cada empleado lo acepta al unirse y puede salirse cuando quiera.
          </p>
        </Card>
      </main>
      </div>
    </div>
  )
}
