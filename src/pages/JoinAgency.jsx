import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// La familia conecta su cuenta con su agencia de cuidado (nov 2026).
// /unirme-agencia?codigo=XXXXXX — la dueña de la familia da su permiso.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const INK = '#14303D', SUB = '#5E7480', LINE = '#E6E3DB'
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const onColor = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? INK : 'white' }

export default function JoinAgency() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const code = (params.get('codigo') || '').toUpperCase()
  const [ag, setAg] = useState(null)
  const [missing, setMissing] = useState(false)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!code) { setMissing(true); return }
    try { localStorage.setItem('fc_agency_code', code) } catch { /* */ }
    supabase.rpc('agency_info_by_code', { p_code: code }).then(({ data }) => data ? setAg(data) : setMissing(true))
  }, [code])

  async function link() {
    setBusy(true)
    const { data, error } = await supabase.rpc('agency_link_family', { p_code: code })
    setBusy(false)
    if (error || !data?.ok) {
      const errs = { ya_tiene_agencia: 'Tu familia ya está conectada a otra agencia. Quita ese acceso en tu Inicio y vuelve a intentarlo.', codigo_invalido: 'Ese código no es válido.' }
      setMsg({ ok: false, text: errs[data?.error] || 'No se pudo conectar. Intenta de nuevo.' }); return
    }
    try { localStorage.removeItem('fc_agency_code') } catch { /* */ }
    setMsg({ ok: true, text: data.ya ? `Tu familia ya estaba conectada a ${data.org}.` : `¡Listo! Tu familia quedó conectada a ${data.org}.` })
  }

  const color = ag?.color || '#0C6C9C', fg = onColor(color)
  const box = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 20, padding: 22 }
  const btn = { width: '100%', padding: 14, borderRadius: 14, border: 'none', background: color, color: fg, fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: SANS }
  if (missing) return <div style={{ fontFamily: SANS, padding: 40, textAlign: 'center', color: SUB }}>Este enlace no es válido. Pídele a tu agencia que te lo mande de nuevo.</div>
  if (!ag || loading) return <div style={{ fontFamily: SANS, padding: 40, textAlign: 'center', color: SUB }}>Cargando…</div>
  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: SANS, color: INK }}>
      <header style={{ background: color, color: fg, padding: '22px 20px', textAlign: 'center' }}>
        {ag.logo ? <img src={ag.logo} alt="" style={{ height: 56, background: 'white', borderRadius: 14, padding: 6 }} /> : <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 14, background: 'white', color, fontWeight: 800, fontSize: 22, alignItems: 'center', justifyContent: 'center' }}>{ag.nombre[0]}</span>}
        <p style={{ margin: '10px 0 0', fontSize: 21, fontWeight: 800 }}>{ag.nombre}</p>
        <p style={{ margin: '2px 0 0', fontSize: 14, opacity: 0.9 }}>con FamiliaCerca</p>
      </header>
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 48px' }}>
        <div style={box}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>Vea el cuidado de su ser querido en su teléfono</h1>
          <p style={{ margin: 0, fontSize: 16, color: SUB, lineHeight: 1.55 }}>Con FamiliaCerca usted y su familia ven cuándo llega la cuidadora de {ag.nombre}, las medicinas, la rutina y las notas del día.</p>
        </div>
        {msg?.ok ? (
          <div style={{ ...box, marginTop: 14, textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>{msg.text}</p>
            <button onClick={() => navigate('/dashboard')} style={btn}>Ir a mi app</button>
          </div>
        ) : !user ? (
          <div style={{ ...box, marginTop: 14 }}>
            <p style={{ margin: '0 0 12px', fontSize: 16, lineHeight: 1.5 }}>Primero cree su cuenta gratis (o entre si ya tiene una). Después vuelva a este enlace para conectarse.</p>
            <Link to="/register" style={{ ...btn, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Crear mi cuenta gratis</Link>
            <Link to={`/login?next=${encodeURIComponent('/unirme-agencia?codigo=' + code)}`} style={{ display: 'block', textAlign: 'center', marginTop: 12, color, fontWeight: 700, fontSize: 16 }}>Ya tengo cuenta</Link>
          </div>
        ) : (
          <div style={{ ...box, marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>🔒 Su permiso</p>
            <p style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.5 }}><strong>{ag.nombre} podrá ver</strong> el cuidado de su paciente en la app: visitas de sus cuidadoras, medicinas marcadas, rutina y notas. También podrá agregar a sus cuidadoras a su familia.</p>
            <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.5, color: SUB }}>Usted puede quitar este acceso cuando quiera desde su Inicio. Solo la persona que creó la familia en la app puede conectarla.</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ width: 22, height: 22, accentColor: color, flexShrink: 0 }} />
              Acepto que {ag.nombre} vea el cuidado de mi familiar en FamiliaCerca.
            </label>
            <button onClick={link} disabled={!agree || busy} style={{ ...btn, opacity: agree ? 1 : 0.5 }}>{busy ? 'Conectando…' : 'Conectar mi familia'}</button>
            {msg && <p style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 12, background: '#FBEAE4', fontSize: 15 }}>{msg.text}</p>}
          </div>
        )}
      </main>
    </div>
  )
}
