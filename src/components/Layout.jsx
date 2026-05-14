import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import Logo from './Logo'
import { Home, Pill, Mic, Users, User, Plus, XIcon } from './Icons'
import Paywall from './Paywall'

const PAGE_TITLES = {
  '/dashboard':   'Inicio',
  '/hoy':         'Medicamentos de hoy',
  '/memorias':    'Memorias',
  '/diario-voz':  'Memorias',
  '/familia':     'Mi Familia',
  '/medications': 'Medicamentos',
  '/historial':   'Control de dosis',
  '/calendar':    'Calendario',
  '/notes':       'Notas',
  '/chat':        'Chat familiar',
  '/album':       'Álbum familiar',
  '/reportes':    'Reportes',
  '/perfil':      'Perfil familiar',
  '/mas':         'Más opciones',
  '/gastos':      'Cuentas Claras',
  '/directorio':  'Directorio',
  '/permisos':    'Permisos',
  '/ajustes':     'Mi cuenta',
  '/pricing':     'Planes',
}

const BOTTOM_TABS = [
  { to: '/dashboard', Icon: Home,  label: 'Inicio' },
  { to: '/hoy',       Icon: Pill,  label: 'Hoy' },
  { to: '/memorias',  Icon: Mic,   label: 'Memorias' },
  { to: '/familia',   Icon: Users, label: 'Familia' },
]

const FAB_ITEMS = [
  { to: '/chat',       emoji: '💬', label: 'Chat' },
  { to: '/calendar',   emoji: '📅', label: 'Calendario' },
  { to: '/notes',      emoji: '📝', label: 'Notas' },
  { to: '/album',      emoji: '📸', label: 'Álbum' },
  { to: '/gastos',     emoji: '💰', label: 'Gastos' },
  { to: '/historial',  emoji: '📋', label: 'Historial' },
  { to: '/directorio', emoji: '🏥', label: 'Directorio' },
]

export default function Layout({ children }) {
  const { inactivityWarning } = useAuth()
  const { profile } = useFamily()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/dashboard'
  const [fabOpen, setFabOpen] = useState(false)

  function handleFabLink(to) {
    setFabOpen(false)
    navigate(to)
  }

  return (
    <div style={{ background: '#FFF8F0' }}>
      {/* Fixed header */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
          height: 56,
          background: 'rgba(255,248,240,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #EDE5D8',
          boxShadow: '0 1px 12px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {isHome ? (
          <Logo showWordmark size={32} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={28} />
            <h1 style={{
              fontSize: 15, fontWeight: 700, color: '#1A1A1A',
              fontFamily: 'Georgia, serif', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {PAGE_TITLES[location.pathname] ?? 'FamiliaCerca'}
            </h1>
          </div>
        )}

        {profile?.photo_url ? (
          <img
            src={profile.photo_url} alt={profile.name}
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
              border: '2px solid #C4623A', boxShadow: '0 0 0 2px #FDF0EB', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: '#FDF0EB', border: '2px solid #EDE5D8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={16} color="#C4623A" strokeWidth={1.5} />
          </div>
        )}
      </header>

      {/* Scrollable main */}
      <main style={{ position: 'fixed', inset: 0, overflowY: 'auto', top: 56, bottom: 68 }}>
        {children}
        <footer style={{ padding: '24px 16px', textAlign: 'center', borderTop: '1px solid #EDE5D8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
            <Link to="/terminos" style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'none' }}>
              Términos de servicio
            </Link>
            <span style={{ color: '#D1D5DB', fontSize: 11 }}>·</span>
            <Link to="/privacidad" style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'none' }}>
              Política de privacidad
            </Link>
          </div>
          <p style={{ fontSize: 10, color: '#D1D5DB', margin: 0 }}>© 2025 FamiliaCerca LLC</p>
        </footer>
      </main>

      {/* Floating "+" button */}
      <button
        onClick={() => setFabOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 82, right: 20, zIndex: 41,
          width: 50, height: 50, borderRadius: '50%',
          background: 'linear-gradient(135deg, #C4623A, #A85130)',
          boxShadow: '0 4px 20px rgba(196,98,58,0.45)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
          transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        aria-label="Más opciones"
      >
        <Plus size={22} color="white" strokeWidth={2.5} />
      </button>

      {/* FAB backdrop + sheet */}
      {fabOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={() => setFabOpen(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 68, left: 0, right: 0,
              background: 'white',
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px 28px',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                Acciones rápidas
              </p>
              <button
                onClick={() => setFabOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <XIcon size={18} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {FAB_ITEMS.map(({ to, emoji, label }) => (
                <button
                  key={to}
                  onClick={() => handleFabLink(to)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 6, padding: '14px 8px', borderRadius: 16,
                    background: '#FFF8F0', border: '1px solid #EDE5D8',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'center' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Paywall />

      {/* Inactivity warning banner */}
      {inactivityWarning && (
        <div style={{
          position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 50,
          background: '#1F2937',
          padding: '14px 20px 16px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <p style={{ fontSize: 13, color: 'white', lineHeight: 1.5, margin: 0 }}>
            ¿Sigues ahí? La sesión se cerrará en 1 minuto por seguridad.
          </p>
          <button
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: '#C4623A', color: 'white', fontWeight: 700,
              fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            Sí, continuar →
          </button>
        </div>
      )}

      {/* Bottom navigation — 4 tabs */}
      <nav
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          height: 68,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid #EDE5D8',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
          display: 'flex',
        }}
      >
        {BOTTOM_TABS.map(({ to, Icon, label }) => {
          const isActive = location.pathname === to ||
            (to === '/memorias' && location.pathname === '/diario-voz')
          return (
            <Link
              key={to}
              to={to}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, paddingTop: 4, textDecoration: 'none',
              }}
            >
              <div style={{
                width: 46, height: 32, borderRadius: 14,
                background: isActive ? '#FDF0EB' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}>
                <Icon size={22} color={isActive ? '#C4623A' : '#BBBBBB'} strokeWidth={isActive ? 2 : 1.5} />
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.02em',
                color: isActive ? '#C4623A' : '#BBBBBB', lineHeight: 1,
              }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
