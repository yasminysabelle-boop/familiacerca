import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { track } from '../lib/analytics'

// Unirse al beneficio de la empresa (nov 2026). El empleado pone el código
// que le dio su empresa y acepta que la empresa vea SOLO su uso anónimo.

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"
const ERR = {
  codigo_invalido: 'Ese código no existe. Revisa que esté bien escrito.',
  sin_licencias: 'Tu empresa ya usó todas sus licencias. Avísale a Recursos Humanos.',
  sin_sesion: 'Primero entra a tu cuenta.',
}

export default function JoinCompany() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => {
    const c = (params.get('codigo') || '').toUpperCase()
    if (c) { try { localStorage.setItem('fc_org_code', c) } catch { /* */ } }
    try { return c || (localStorage.getItem('fc_org_code') || '') } catch { return c }
  })
  const [mine, setMine] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!user) return
    // Ya con sesión: el código queda en pantalla; no volver a redirigir desde Inicio
    try { localStorage.removeItem('fc_org_code') } catch { /* */ }
    supabase.from('organization_members').select('org_id, organizations(name)').limit(1)
      .then(({ data, error }) => setMine(error ? false : (data?.[0]?.organizations?.name ?? '')))
  }, [user])

  async function join() {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('join_organization', { p_code: code })
    setBusy(false)
    if (error || !data?.ok) { setMsg({ bad: true, text: ERR[data?.error] || 'No se pudo unir ahora. Intenta de nuevo en un rato.' }); return }
    track('org_joined')
    try { localStorage.removeItem('fc_org_code') } catch { /* */ }
    setMine(data.org)
    setMsg({ bad: false, text: data.ya ? `Ya eras parte del beneficio de ${data.org}.` : `¡Listo! Ya tienes FamiliaCerca como beneficio de ${data.org}.` })
  }

  async function leave() {
    if (!window.confirm('¿Seguro que quieres salir del beneficio de tu empresa?')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('organization_members').delete().eq('user_id', user.id)
    setMine(''); setMsg({ bad: false, text: 'Saliste del beneficio de tu empresa.' })
  }

  const box = { background: 'white', borderRadius: 20, border: '1px solid #E6E3DB', padding: 20, marginBottom: 14 }
  // Sin cuenta todavía: guardamos el código y después de entrar volvemos aquí
  if (!authLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: SANS, color: '#14303D', padding: '40px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <img src="/logo.png" alt="" width="64" height="64" />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 8px' }}>Tu empresa te regala FamiliaCerca</h1>
          <p style={{ fontSize: 16, color: '#4E6470', lineHeight: 1.5, margin: '0 0 22px' }}>Para organizar el cuidado de tu familiar entre todos. Primero crea tu cuenta gratis o entra, y te unimos al beneficio.</p>
          <button onClick={() => navigate('/register')} style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: '#BF513C', color: 'white', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: SANS, marginBottom: 10 }}>Crear mi cuenta</button>
          <button onClick={() => navigate('/login')} style={{ width: '100%', padding: 15, borderRadius: 14, border: '1.5px solid #0C6C9C', background: 'white', color: '#0C6C9C', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: SANS }}>Ya tengo cuenta</button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: SANS, color: '#14303D', padding: '20px 16px 40px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#0C6C9C', fontWeight: 700, padding: '8px 0', cursor: 'pointer' }}>‹ Volver</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 6px' }}>Beneficio de tu empresa</h1>
        <p style={{ fontSize: 16, color: '#4E6470', margin: '0 0 18px', lineHeight: 1.5 }}>
          Si tu empresa te da FamiliaCerca como beneficio, pon aquí el código que te dieron.
        </p>

        {mine ? (
          <div style={box}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>✓ Tienes el beneficio de {mine}</p>
            <button onClick={leave} style={{ marginTop: 12, background: 'none', border: 'none', color: '#A3452F', fontWeight: 700, fontSize: 15, padding: 0, cursor: 'pointer' }}>Salir del beneficio</button>
          </div>
        ) : (
          <div style={box}>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Código de tu empresa</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ej: A1B2C3" maxLength={12}
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 14, border: '1.5px solid #E6E3DB', fontSize: 20, fontWeight: 800, letterSpacing: '0.15em', fontFamily: SANS, color: '#14303D' }} />
            <button onClick={join} disabled={busy || code.trim().length < 4}
              style={{ marginTop: 14, width: '100%', padding: 15, borderRadius: 14, border: 'none', background: code.trim().length >= 4 ? '#0C6C9C' : '#C9D6DB', color: 'white', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: SANS }}>
              {busy ? 'Revisando…' : 'Unirme'}
            </button>
          </div>
        )}

        {msg && <p style={{ ...box, background: msg.bad ? '#FBEAE4' : '#EEF6FA', color: msg.bad ? '#8A3A2A' : '#14303D', fontSize: 15, fontWeight: 600 }}>{msg.text}</p>}

        <div style={{ ...box, background: '#EEF6FA', border: 'none' }}>
          <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>🔒 Lo que tu empresa ve y lo que no</p>
          <p style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.5 }}><strong>Ve:</strong> cuántas personas usan el beneficio y qué partes de la app se usan más, en totales.</p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}><strong>Nunca ve:</strong> tu nombre en el uso, el de tu familiar, sus medicinas, notas, gastos ni nada de su salud.</p>
        </div>
        {!mine && <p style={{ fontSize: 14, color: '#5E7480', lineHeight: 1.45, margin: 0 }}>Al tocar "Unirme" aceptas que tu empresa vea ese uso anónimo. Puedes salirte cuando quieras.</p>}
      </div>
    </div>
  )
}
