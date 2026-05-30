import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import Logo from './Logo'
import { Home, Users, User, Menu, Settings } from './Icons'
import Paywall from './Paywall'
import InstallBanner from './InstallBanner'
import OfflineBanner from './OfflineBanner'
import { useDarkMode } from '../contexts/DarkModeContext'
import FamilySelector from './FamilySelector'
import FamilySwitcher from './FamilySwitcher'
import CompanionChat from './CompanionChat'
import { useHospitalMode } from '../contexts/HospitalModeContext'

const PAGE_TITLES = {
  '/dashboard':   'Inicio',
  '/hoy':         'Medicamentos de hoy',
  '/memorias':    'Memorias',
  '/diario-voz':  'Memorias',
  '/familia':     'Mi Familia',
  '/medications': 'Medicamentos',
  '/historial':   'Historial de cuidado',
  '/diario-medico': 'Diario Médico',
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
  '/mas':         'Más opciones',
}

const BOTTOM_TABS = [
  { to: '/dashboard', Icon: Home,     label: 'Inicio' },
  { to: '/familia',   Icon: Users,    label: 'Familia' },
  { to: '/mas',       Icon: Menu,     label: 'Más' },
  { to: '/ajustes',   Icon: Settings, label: 'Ajustes' },
]

export default function Layout({ children }) {
  const { inactivityWarning } = useAuth()
  const { profile } = useFamily()
  const { dark } = useDarkMode()
  const { isHospitalMode, hospitalMode } = useHospitalMode() ?? {}
  const location = useLocation()
  const isHome = location.pathname === '/dashboard'

  const bg      = dark ? '#0F1A12' : '#F0EDE6'
  const navBg   = dark ? 'rgba(28,18,8,0.97)' : '#2D4A1E'
  const hdrBg   = dark ? 'rgba(28,18,8,0.95)' : '#2D4A1E'
  const border  = dark ? '#1E3A28' : 'rgba(255,255,255,0.08)'

  const hospitalBarHeight = isHospitalMode ? 28 : 0

  return (
    <div style={{ background: bg }}>
      {/* Hospital mode alert bar — fixed, above the main header */}
      {isHospitalMode && (
        <Link
          to="/dashboard"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 41,
            height: hospitalBarHeight,
            background: '#B91C1C',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 13 }}>🏥</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>
            MODO HOSPITAL ACTIVO
            {hospitalMode?.hospital_name ? ` · ${hospitalMode.hospital_name}` : ''}
          </span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'white',
            animation: 'hbPulse 2s ease-in-out infinite',
          }} />
        </Link>
      )}

      {/* Fixed header */}
      <header
        style={{
          position: 'fixed', top: hospitalBarHeight, left: 0, right: 0, zIndex: 40,
          height: 'calc(56px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: hdrBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${border}`,
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
              fontSize: 15, fontWeight: 700, color: 'white',
              fontFamily: 'Georgia, serif', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {PAGE_TITLES[location.pathname] ?? 'FamiliaCerca'}
            </h1>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <FamilySwitcher />
          <Link to="/ajustes" aria-label="Ir a configuración" style={{ flexShrink: 0, lineHeight: 0 }}>
            {profile?.photo_url ? (
              <img
                src={profile.photo_url} alt={profile.name}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.3)' }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={16} color="white" strokeWidth={1.5} />
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Scrollable main */}
      <main style={{ position: 'fixed', inset: 0, overflowY: 'auto', top: `calc(${hospitalBarHeight}px + 56px + env(safe-area-inset-top))`, bottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
        <InstallBanner />
        <OfflineBanner />

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
          <p style={{ fontSize: 10, color: '#D1D5DB', margin: 0 }}>© 2026 FamiliaCerca LLC</p>
        </footer>
      </main>

      <CompanionChat />

      <FamilySelector />
      <Paywall />

      {/* Inactivity warning banner */}
      {inactivityWarning && (
        <div style={{
          position: 'fixed', bottom: 'calc(68px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 50,
          background: '#1F2937',
          padding: '14px 20px 16px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <p style={{ fontSize: 13, color: 'white', lineHeight: 1.5, margin: 0 }}>
            ¿Sigues ahí? La sesión se cerrará en 1 minuto por seguridad.
          </p>
          <button
            onClick={() => window.dispatchEvent(new MouseEvent('mousemove'))}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: '#4A7C59', color: 'white', fontWeight: 700,
              fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            Sí, continuar →
          </button>
        </div>
      )}

      <style>{`
        @keyframes hbPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* Bottom navigation — 4 tabs */}
      <nav
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          height: 'calc(68px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: navBg,
          borderTop: `1px solid ${border}`,
          boxShadow: '0 -2px 16px rgba(0,0,0,0.25)',
          display: 'flex',
        }}
      >
        {BOTTOM_TABS.map(({ to, Icon, label }) => {
          const isActive = location.pathname === to ||
            (to === '/mas' && location.pathname.startsWith('/mas'))
          return (
            <Link
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, paddingTop: 4, textDecoration: 'none',
              }}
            >
              <Icon
                size={22}
                color={isActive ? 'white' : 'rgba(255,255,255,0.4)'}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.02em',
                color: isActive ? 'white' : 'rgba(255,255,255,0.4)', lineHeight: 1,
              }}>
                {label}
              </span>
              {isActive && (
                <span style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#C9894A', marginTop: 2,
                }} />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
