import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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

function demoData() {
  const weeks = [18, 22, 27, 31, 34, 38, 41, 43]
  const today = new Date()
  return {
    org: { nombre: 'Empresa Ejemplo S.A.', tipo: 'empresa', plan: 'Empresa', licencias: 60, desde: '2026-09-01', renueva: '2027-09-01', codigo: 'DEMO24' },
    miembros: 52, familias: 47, grupo_minimo: 5, detalle_oculto: false, activas_7: 43, activas_30: 45, dias: 30,
    semanas: weeks.map((f, i) => { const d = new Date(today); d.setDate(d.getDate() - (7 - i) * 7); return { semana: d.toISOString().slice(0, 10), familias: f } }),
    funciones: { medicinas: 1240, rutina: 2105, tareas: 410, notas: 286, gastos: 173, milo: 352, emergencias: 3, horas_turno: 0 },
  }
}

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

  useEffect(() => {
    if (demo) { setData(demoData()); return }
    if (!user) return
    supabase.from('organization_admins').select('org_id, organizations(name)').eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) { setOrgs([]); return }
        const list = (data ?? []).map(r => ({ id: r.org_id, name: r.organizations?.name }))
        setOrgs(list); if (list[0]) setOrgId(list[0].id)
      })
  }, [user, demo])

  useEffect(() => {
    if (demo || !orgId) return
    setData(null); setError('')
    supabase.rpc('org_dashboard', { p_org: orgId, p_days: days })
      .then(({ data, error }) => error ? setError('No se pudo cargar el panel. Intenta de nuevo en un rato.') : setData(data))
  }, [orgId, days, demo])

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

  return (
    <div style={page}>
      {header}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 16px 48px' }}>
        {demo && (
          <p style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 14, background: '#FDF3DF', color: '#7A5410', fontSize: 15, fontWeight: 600 }}>
            Datos de ejemplo para presentaciones. Una empresa real ve aquí los totales de su propio uso.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Resumen</h1>
          {!demo && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)} style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${days === d ? C.blue : C.line}`, background: days === d ? C.blue : 'white', color: days === d ? 'white' : C.ink, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                  Últimos {d} días
                </button>
              ))}
            </div>
          )}
        </div>

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

        <Card title="Privacidad de sus empleados" style={{ marginTop: 14, background: C.soft, border: 'none' }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: C.ink }}>
            Este panel muestra solo totales. Nunca muestra nombres, ni de los empleados ni de sus familiares, ni medicinas, notas, gastos o datos de salud.
            El detalle por semana y por función aparece solo cuando al menos {data.grupo_minimo} personas usan el beneficio. Cada empleado lo acepta al unirse y puede salirse cuando quiera.
          </p>
        </Card>
      </main>
    </div>
  )
}
