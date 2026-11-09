import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'
import { Eye, EyeOff } from '../components/Icons'
import { track } from '../lib/analytics'

const BENEFITS = ['14 días gratis', 'Sin tarjeta de crédito', 'Cancela cuando quieras']

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setLoading(true)
    const { data, error: err } = await signUp(form.email, form.password, { full_name: form.name })
    setLoading(false)
    // Supabase no devuelve error cuando el correo ya existe (con confirmación
    // de email activa): devuelve un usuario "falso" sin identities. Se detecta
    // aquí para no dejar registrar dos veces el mismo correo.
    const alreadyRegistered =
      (err && /already registered|already been registered|already exists/i.test(err.message)) ||
      (!err && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
    if (alreadyRegistered) {
      setError('Este correo ya está registrado. Inicia sesión o usa "Olvidé mi contraseña".')
    } else if (err) {
      // Errores del servidor (ej. 504 por correo de Supabase) llegan sin
      // mensaje legible ("{}"): mostrar algo que la persona entienda.
      const msg = (err.message || '').trim()
      const serverError = !msg || msg === '{}' || (err.status && err.status >= 500)
      setError(serverError
        ? 'No pudimos crear tu cuenta en este momento. Intenta de nuevo en unos minutos.'
        : msg)
    } else {
      track('user_registered', { email: form.email })
      const pending = localStorage.getItem('pendingInviteToken')
      if (pending) {
        navigate('/join?token=' + pending, { replace: true })
        return
      }
      navigate('/permisos?next=/onboarding', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F6F2] px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <Logo showWordmark size={44} />
        </div>

        {/* Trial badge */}
        <div
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl mb-6 text-center"
          style={{ background: '#FDF8EE', border: '1px solid #E8D89A' }}
        >
          <span className="text-base">🎁</span>
          <p className="text-sm font-bold" style={{ color: '#A07830' }}>
            Prueba gratuita de 14 días — sin tarjeta
          </p>
        </div>

        {/* Form card */}
        <div
          className="bg-white rounded-3xl p-6"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.09)', border: '1px solid #E6E3DB' }}
        >
          <h2
            className="text-xl font-bold text-gray-900 mb-5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Crear tu cuenta
          </h2>

          {error && (
            <div
              className="mb-4 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                Tu nombre
              </label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="María García"
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                style={{ border: '1.5px solid #E6E3DB', background: '#FDFAF7' }}
                onFocus={e => { e.target.style.borderColor = '#0C6C9C'; e.target.style.boxShadow = '0 0 0 3px rgba(12,108,156,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E6E3DB'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                Correo electrónico
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="tu@correo.com"
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                style={{ border: '1.5px solid #E6E3DB', background: '#FDFAF7' }}
                onFocus={e => { e.target.style.borderColor = '#0C6C9C'; e.target.style.boxShadow = '0 0 0 3px rgba(12,108,156,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E6E3DB'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl text-sm focus:outline-none transition-all"
                  style={{ border: '1.5px solid #E6E3DB', background: '#FDFAF7', padding: '12px 44px 12px 16px', boxSizing: 'border-box', width: '100%' }}
                  onFocus={e => { e.target.style.borderColor = '#0C6C9C'; e.target.style.boxShadow = '0 0 0 3px rgba(12,108,156,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#E6E3DB'; e.target.style.boxShadow = 'none' }}
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
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.97] disabled:opacity-60 mt-2"
              style={{
                background: 'linear-gradient(135deg, #0A5A82, #0A4A6B)',
                boxShadow: '0 6px 20px rgba(12,108,156,0.35)',
              }}
            >
              {loading ? 'Creando cuenta...' : 'Comenzar prueba gratis →'}
            </button>
          </form>

          {/* Benefits row */}
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            {BENEFITS.map(b => (
              <span key={b} className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                <span style={{ color: '#0C6C9C' }}>✓</span> {b}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold hover:underline" style={{ color: '#0C6C9C' }}>
            Inicia sesión
          </Link>
        </p>

        <p className="mt-3 text-center text-[11px] text-gray-400 leading-relaxed">
          Al crear tu cuenta aceptas nuestros{' '}
          <Link to="/terminos" className="underline hover:text-gray-600 transition-colors">
            Términos de Servicio
          </Link>
          {' '}y{' '}
          <Link to="/privacidad" className="underline hover:text-gray-600 transition-colors">
            Política de Privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}
