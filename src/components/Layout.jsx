import { Link, useLocation } from 'react-router-dom'
import { useFamily } from '../contexts/FamilyContext'
import Logo from './Logo'
import { Home, Pill, Calendar, Chat, Menu, User, BookOpen } from './Icons'

const PAGE_TITLES = {
  '/dashboard':   'Inicio',
  '/medications': 'Medicamentos',
  '/historial':   'Control de dosis',
  '/calendar':    'Calendario',
  '/notes':       'Notas',
  '/chat':        'Chat familiar',
  '/album':       'Álbum familiar',
  '/diario-voz':  'Diario de voz',
  '/reportes':    'Reportes',
  '/perfil':      'Perfil familiar',
  '/mas':         'Más opciones',
  '/gastos':      'Cuentas Claras',
  '/directorio':  'Directorio',
}

const BOTTOM_TABS = [
  { to: '/dashboard',   Icon: Home,     label: 'Inicio' },
  { to: '/medications', Icon: Pill,     label: 'Medicinas' },
  { to: '/calendar',    Icon: Calendar, label: 'Citas' },
  { to: '/directorio',  Icon: BookOpen, label: 'Directorio' },
  { to: '/chat',        Icon: Chat,     label: 'Chat' },
  { to: '/mas',         Icon: Menu,     label: 'Más' },
]

export default function Layout({ children }) {
  const { profile } = useFamily()
  const location = useLocation()
  const isHome = location.pathname === '/dashboard'

  return (
    <div style={{ background: '#FFF8F0' }}>
      {/* ── Fixed header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          height: 56,
          background: 'rgba(255,248,240,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #EDE5D8',
          boxShadow: '0 1px 12px rgba(0,0,0,0.05)',
        }}
      >
        {isHome ? (
          <Logo showWordmark size={32} />
        ) : (
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <h1
              className="text-[15px] font-bold text-gray-900 truncate"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {PAGE_TITLES[location.pathname] ?? 'FamiliaCerca'}
            </h1>
          </div>
        )}

        {/* Relative avatar */}
        {profile?.photo_url ? (
          <img
            src={profile.photo_url}
            alt={profile.name}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            style={{ border: '2px solid #C4623A', boxShadow: '0 0 0 2px #FDF0EB' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#FDF0EB', border: '2px solid #EDE5D8' }}
          >
            <User size={16} color="#C4623A" strokeWidth={1.5} />
          </div>
        )}
      </header>

      {/* ── Scrollable main ── */}
      <main className="fixed inset-0 overflow-y-auto" style={{ top: 56, bottom: 68 }}>
        {children}
        <footer className="px-4 py-6 text-center" style={{ borderTop: '1px solid #EDE5D8' }}>
          <div className="flex items-center justify-center gap-4 mb-2">
            <Link to="/terminos" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Términos de servicio
            </Link>
            <span className="text-gray-300 text-xs">·</span>
            <Link to="/privacidad" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Política de privacidad
            </Link>
          </div>
          <p className="text-[10px] text-gray-300">© 2025 FamiliaCerca LLC</p>
        </footer>
      </main>

      {/* ── Premium bottom navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex"
        style={{
          height: 68,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid #EDE5D8',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {BOTTOM_TABS.map(({ to, Icon, label }) => {
          const isActive = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 transition-all active:opacity-60"
            >
              <div
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 46,
                  height: 32,
                  borderRadius: 14,
                  background: isActive ? '#FDF0EB' : 'transparent',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <Icon
                  size={22}
                  color={isActive ? '#C4623A' : '#BBBBBB'}
                  strokeWidth={isActive ? 2 : 1.5}
                />
              </div>
              <span
                className="text-[8px] font-bold leading-none tracking-wide"
                style={{ color: isActive ? '#C4623A' : '#BBBBBB' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
