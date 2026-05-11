import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

const BENEFITS = ['14 días gratis', 'Sin tarjeta de crédito', 'Cancela cuando quieras']

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
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
    const { error: err } = await signUp(form.email, form.password, { full_name: form.name })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      navigate('/onboarding', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF8F0] px-4 py-8">
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
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.09)', border: '1px solid #EDE5D8' }}
        >
          <h2
            className="text-xl font-bold text-gray-900 mb-5"
            style={{ fontFamily: 'Georgia, serif' }}
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
                style={{ border: '1.5px solid #EDE5D8', background: '#FDFAF7' }}
                onFocus={e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }}
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
                style={{ border: '1.5px solid #EDE5D8', background: '#FDFAF7' }}
                onFocus={e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                style={{ border: '1.5px solid #EDE5D8', background: '#FDFAF7' }}
                onFocus={e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.97] disabled:opacity-60 mt-2"
              style={{
                background: 'linear-gradient(135deg, #C4623A, #A85130)',
                boxShadow: '0 6px 20px rgba(196,98,58,0.35)',
              }}
            >
              {loading ? 'Creando cuenta...' : 'Comenzar prueba gratis →'}
            </button>
          </form>

          {/* Benefits row */}
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            {BENEFITS.map(b => (
              <span key={b} className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                <span style={{ color: '#4A7C59' }}>✓</span> {b}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold hover:underline" style={{ color: '#C4623A' }}>
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
