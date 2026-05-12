import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'
import imgHija from '../assets/images/splash-hija.png'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError('Correo o contraseña incorrectos.')
    } else {
      navigate('/permisos')
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

      {/* Gradient — fade to dark at bottom where the card sits */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.32) 38%, rgba(0,0,0,0.88) 75%, rgba(0,0,0,0.97) 100%)',
      }} />

      {/* Logo area — sits on the photo */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 72, paddingBottom: 32,
      }}>
        <Logo variant="light" showWordmark size={52} />
      </div>

      {/* Flex spacer — pushes card to bottom */}
      <div style={{ flex: 1 }} />

      {/* Login card — bottom sheet style */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'white',
        borderRadius: '28px 28px 0 0',
        padding: '32px 24px 40px',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
          color: '#1A1A1A', marginBottom: 6,
        }}>
          Bienvenida de nuevo
        </h2>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>
          Inicia sesión para continuar cuidando
        </p>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 12,
            background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700,
              color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              onFocus={onFocus}
              onBlur={onBlur}
              style={{ ...fieldBase, width: '100%', padding: '12px 16px', borderRadius: 12,
                fontSize: 14, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700,
              color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onFocus={onFocus}
              onBlur={onBlur}
              style={{ ...fieldBase, width: '100%', padding: '12px 16px', borderRadius: 12,
                fontSize: 14, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }}
            />
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
          <Link to="/terminos" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>
            Términos de Servicio
          </Link>
          {' · '}
          <Link to="/privacidad" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>
            Política de Privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}
