import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Eye, EyeOff } from '../components/Icons'
import imgHija from '../assets/images/splash-hija.png'

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
      const completed = data?.user?.user_metadata?.onboarding_completed
      navigate(completed ? '/permisos' : '/onboarding')
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
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

  const fieldBase = { border: '1.5px solid #EDE5D8', background: '#FDFAF7' }
  function onFocus(e) {
    e.target.style.borderColor = '#C4623A'
    e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)'
  }
  function onBlur(e) {
    e.target.style.borderColor = '#EDE5D8'
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
          ? <EyeOff size={18} color="#9CA3AF" strokeWidth={1.5} />
          : <Eye    size={18} color="#9CA3AF" strokeWidth={1.5} />
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
      background: '#0A0A0A',
    }}>
      {/* Hero photo */}
      <img
        src={imgHija}
        alt="Familia"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 15%',
        }}
      />

      {/* Gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.32) 38%, rgba(0,0,0,0.88) 75%, rgba(0,0,0,0.97) 100%)',
      }} />

      {/* Logo */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 72, paddingBottom: 32,
      }}>
        <Logo variant="light" showWordmark size={52} />
      </div>

      <div style={{ flex: 1 }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'white',
        borderRadius: '28px 28px 0 0',
        padding: '32px 24px 40px',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.3)',
      }}>

        {/* ── RESET PASSWORD MODE ── */}
        {mode === 'reset' && (
          <>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
              Nueva contraseña
            </h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>
              Elige una contraseña segura para tu cuenta.
            </p>

            {resetDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>¡Contraseña actualizada!</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>Redirigiendo al panel...</p>
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
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
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
                      background: loading ? '#D4C4B8' : 'linear-gradient(135deg, #C4623A, #A85130)',
                      color: 'white', fontWeight: 700, fontSize: 14, borderRadius: 16,
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 6px 20px rgba(196,98,58,0.35)',
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4623A', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 }}
            >
              ← Volver
            </button>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
              Recuperar acceso
            </h2>

            {resetSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>¡Revisa tu correo!</p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                  Te enviamos un enlace a <strong>{email}</strong> para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setMode('login'); setResetSent(false) }}
                  style={{
                    marginTop: 20, padding: '12px 28px', borderRadius: 14,
                    background: 'linear-gradient(135deg, #C4623A, #A85130)',
                    color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                  }}
                >
                  Volver al inicio
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                {error && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
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
                      background: loading ? '#D4C4B8' : 'linear-gradient(135deg, #C4623A, #A85130)',
                      color: 'white', fontWeight: 700, fontSize: 14, borderRadius: 16,
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 6px 20px rgba(196,98,58,0.35)',
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
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
              Bienvenida de nuevo
            </h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>
              Inicia sesión para continuar cuidando
            </p>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
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
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4623A', fontSize: 12, fontWeight: 600, padding: 0 }}
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
                      ? <EyeOff size={18} color="#9CA3AF" strokeWidth={1.5} />
                      : <Eye    size={18} color="#9CA3AF" strokeWidth={1.5} />
                    }
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  marginTop: 4, width: '100%', padding: '14px',
                  background: loading ? '#D4C4B8' : 'linear-gradient(135deg, #C4623A, #A85130)',
                  color: 'white', fontWeight: 700, fontSize: 14, borderRadius: 16,
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(196,98,58,0.35)',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Ingresando...' : 'Ingresar →'}
              </button>
            </form>

            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
              ¿No tienes cuenta?{' '}
              <Link to="/register" style={{ color: '#C4623A', fontWeight: 700, textDecoration: 'none' }}>
                Regístrate gratis
              </Link>
            </p>

            <p style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
              <Link to="/terminos" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Términos de Servicio</Link>
              {' · '}
              <Link to="/privacidad" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Política de Privacidad</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
