import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Eye, EyeOff } from '../components/Icons'
import imgFamilia from '../assets/images/familia-inicio.webp'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // mode: 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login')
  const [resetSent, setResetSent] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  // Detect Supabase recovery link — parse hash as query string for exact key match
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    if (params.get('type') === 'recovery') {
      setMode('reset')
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err, data } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError('Correo o contraseña incorrectos.')
    } else {
      const pending = localStorage.getItem('pendingInviteToken')
      if (pending) {
        navigate('/join?token=' + pending, { replace: true })
        return
      }
      const completed = data?.user?.user_metadata?.onboarding_completed
      navigate(completed ? '/permisos' : '/onboarding')
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      // El enlace vuelve al mismo dominio desde el que se pidió (familiacerca.com).
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (err) {
      setError('No se pudo enviar el enlace. Verifica el correo.')
    } else {
      setResetSent(true)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (err) {
      setError('No se pudo actualizar la contraseña.')
    } else {
      setResetDone(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    }
  }

  const fieldBase = { border: '1.5px solid #E6E3DB', background: '#FDFAF7' }
  function onFocus(e) {
    e.target.style.borderColor = '#0C6C9C'
    e.target.style.boxShadow = '0 0 0 3px rgba(12,108,156,0.1)'
  }
  function onBlur(e) {
    e.target.style.borderColor = '#E6E3DB'
    e.target.style.boxShadow = 'none'
  }

  const inputStyle = {
    ...fieldBase,
    width: '100%',
    padding: '12px 44px 12px 16px',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    transition: 'all 0.15s',
    boxSizing: 'border-box',
  }

  function PwToggle({ show, onToggle }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center',
        }}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show
          ? <EyeOff size={18} color="#5E7480" strokeWidth={1.5} />
          : <Eye    size={18} color="#5E7480" strokeWidth={1.5} />
        }
      </button>
    )
  }

  return (
    <div style={{
      position: 'relative',
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      background: '#F7F6F2',
      overflow: 'hidden',
    }}>
      {/* Hero photo — caja limitada al 60% superior de la pantalla (no a
          inset:0) para que quede margen vertical real donde recortar. La
          proporción de esta foto (941x1672) es casi idéntica a la de un
          teléfono en vertical, así que a pantalla completa object-position
          no tiene margen para reposicionar — de ahí el corte al 60vh. */}
      <img
        src={imgFamilia}
        alt="Familia"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          width: '100%', height: '72vh',
          objectFit: 'cover', objectPosition: 'center top',
        }}
      />

      {/* Foto completa y limpia, sin sombra ni logo encima (pedido de Yasmin,
          nov 2026). El logo va dentro de la tarjeta blanca. */}

      <div style={{ flex: 1 }} />

      {/* Forma orgánica decorativa — coral suave, esquina inferior derecha, detrás de la card */}
      <div style={{
        position: 'absolute', bottom: -50, right: -50,
        width: 240, height: 240,
        background: '#FBEAE4',
        borderRadius: '55% 45% 0 60%',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'white',
        borderRadius: '28px 28px 0 0',
        padding: '32px 24px 40px',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo showWordmark size={34} />
        </div>

        {/* ── RESET PASSWORD MODE ── */}
        {mode === 'reset' && (
          <>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#14303D', marginBottom: 6 }}>
              Nueva contraseña
            </h2>
            <p style={{ fontSize: 13, color: '#5E7480', marginBottom: 24 }}>
              Elige una contraseña segura para tu cuenta.
            </p>

            {resetDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#14303D' }}>¡Contraseña actualizada!</p>
                <p style={{ fontSize: 13, color: '#5E7480', marginTop: 6 }}>Redirigiendo al panel...</p>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#4E6470', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Nueva contraseña
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        onFocus={onFocus} onBlur={onBlur}
                        style={inputStyle}
                      />
                      <PwToggle show={showNewPw} onToggle={() => setShowNewPw(v => !v)} />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: 4, width: '100%', padding: '14px',
                      background: loading ? '#C9D6DB' : '#0C6C9C',
                      color: 'white', fontWeight: 700, fontSize: 14, borderRadius: 999,
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 6px 20px rgba(12,108,156,0.35)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {loading ? 'Guardando...' : 'Guardar contraseña →'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* ── FORGOT PASSWORD MODE ── */}
        {mode === 'forgot' && (
          <>
            <button
              onClick={() => { setMode('login'); setError(''); setResetSent(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0C6C9C', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 }}
            >
              ← Volver
            </button>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#14303D', marginBottom: 6 }}>
              Recuperar acceso
            </h2>

            {resetSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#14303D', marginBottom: 8 }}>¡Revisa tu correo!</p>
                <p style={{ fontSize: 13, color: '#4E6470', lineHeight: 1.6 }}>
                  Te enviamos un enlace a <strong>{email}</strong> para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setMode('login'); setResetSent(false) }}
                  style={{
                    marginTop: 20, padding: '12px 28px', borderRadius: 999,
                    background: '#0C6C9C',
                    color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                  }}
                >
                  Volver al inicio
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#5E7480', marginBottom: 24 }}>
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                {error && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#4E6470', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Correo electrónico
                    </label>
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      onFocus={onFocus} onBlur={onBlur}
                      style={{ ...fieldBase, width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="submit" disabled={loading}
                    style={{
                      marginTop: 4, width: '100%', padding: '14px',
                      background: loading ? '#C9D6DB' : '#0C6C9C',
                      color: 'white', fontWeight: 700, fontSize: 14, borderRadius: 999,
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 6px 20px rgba(12,108,156,0.35)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {loading ? 'Enviando...' : 'Enviar enlace →'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* ── LOGIN MODE ── */}
        {mode === 'login' && (
          <>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#14303D', marginBottom: 6 }}>
              Bienvenida de nuevo
            </h2>
            <p style={{ fontSize: 13, color: '#5E7480', marginBottom: 24 }}>
              Inicia sesión para continuar cuidando
            </p>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#4E6470', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Correo electrónico
                </label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...fieldBase, width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#4E6470', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0C6C9C', fontSize: 14, fontWeight: 600, padding: 0 }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    onFocus={onFocus} onBlur={onBlur}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, display: 'flex', alignItems: 'center',
                    }}
                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPw
                      ? <EyeOff size={18} color="#5E7480" strokeWidth={1.5} />
                      : <Eye    size={18} color="#5E7480" strokeWidth={1.5} />
                    }
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  marginTop: 4, width: '100%', padding: '14px',
                  background: loading ? '#C9D6DB' : '#0C6C9C',
                  color: 'white', fontWeight: 700, fontSize: 14, borderRadius: 999,
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(12,108,156,0.35)',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Ingresando...' : 'Ingresar →'}
              </button>
            </form>

            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#4E6470' }}>
              ¿No tienes cuenta?{' '}
              <Link to="/register" style={{ color: '#E9826E', fontWeight: 600, textDecoration: 'none' }}>
                Regístrate gratis
              </Link>
            </p>

            <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: '#5E7480' }}>
              <Link to="/terminos" style={{ color: '#5E7480', textDecoration: 'underline' }}>Términos de Servicio</Link>
              {' · '}
              <Link to="/privacidad" style={{ color: '#5E7480', textDecoration: 'underline' }}>Política de Privacidad</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
