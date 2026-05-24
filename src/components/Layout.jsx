import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import Logo from './Logo'
import { Home, Pill, Mic, Users, User, Plus, XIcon, LogOut, Chat } from './Icons'
import Paywall from './Paywall'
import InstallBanner from './InstallBanner'
import OfflineBanner from './OfflineBanner'
import { useDarkMode } from '../contexts/DarkModeContext'

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
  '/mas':         'Más opciones',
}

const BOTTOM_TABS = [
  { to: '/dashboard', Icon: Home,  label: 'Inicio' },
  { to: '/hoy',       Icon: Pill,  label: 'Hoy' },
  { to: '/chat',      Icon: Chat,  label: 'Chat' },
  { to: '/memorias',  Icon: Mic,   label: 'Memorias' },
  { to: '/familia',   Icon: Users, label: 'Familia' },
]

const FAB_ITEMS = [
  { to: '/notes?add=1',      emoji: '📝', label: 'Nota rápida' },
  { to: '/gastos?add=1',     emoji: '💰', label: 'Gasto' },
  { to: '/medications?add=1',emoji: '💊', label: 'Medicamento' },
  { to: '/calendar',         emoji: '📅', label: 'Cita' },
]

// Pages that have their own add-button — hide the global FAB there
const HIDE_FAB_PATHS = new Set(['/gastos', '/medications', '/notes'])

export default function Layout({ children }) {
  const { inactivityWarning, signOut } = useAuth()
  const { profile, hasBoth, activeFamily, ownPatientName, memberPatientName, switchFamily } = useFamily()
  const { dark } = useDarkMode()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/dashboard'
  const fabHidden = HIDE_FAB_PATHS.has(location.pathname)
  const [fabOpen, setFabOpen] = useState(false)

  const bg      = dark ? '#0F1A12' : '#F7F3ED'
  const navBg   = dark ? 'rgba(28,18,8,0.97)' : 'rgba(255,255,255,0.97)'
  const hdrBg   = dark ? 'rgba(28,18,8,0.95)' : 'rgba(255,248,240,0.95)'
  const border  = dark ? '#1E3A28' : '#EDE5D8'

  function handleFabLink(to) {
    setFabOpen(false)
    navigate(to)
  }

  async function handleSignOut() {
    setFabOpen(false)
    try { await signOut() } catch { }
    finally {
      localStorage.removeItem('fc_active_family')
      localStorage.removeItem('fc_member_owner_id')
      window.location.href = '/login'
    }
  }

  return (
    <div style={{ background: bg }}>
      {/* Fixed header */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
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
              fontSize: 15, fontWeight: 700, color: '#1A1A1A',
              fontFamily: 'Georgia, serif', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {PAGE_TITLES[location.pathname] ?? 'FamiliaCerca'}
            </h1>
          </div>
        )}

        <Link to="/ajustes" aria-label="Ir a configuración" style={{ flexShrink: 0, lineHeight: 0 }}>
          {profile?.photo_url ? (
            <img
              src={profile.photo_url} alt={profile.name}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid #4A7C59', boxShadow: '0 0 0 2px #EBF3EE' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#EBF3EE', border: '2px solid #EDE5D8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={16} color="#4A7C59" strokeWidth={1.5} />
            </div>
          )}
        </Link>
      </header>

      {/* Scrollable main */}
      <main style={{ position: 'fixed', inset: 0, overflowY: 'auto', top: 'calc(56px + env(safe-area-inset-top))', bottom: 68 }}>
        <InstallBanner />
        <OfflineBanner />

        {/* Family switcher — only visible when user belongs to 2+ families */}
        {hasBoth && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px',
            background: activeFamily === 'member' ? '#EFF6FF' : '#FDF8F0',
            borderBottom: `1px solid ${activeFamily === 'member' ? '#BFDBFE' : '#EDE5D8'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{activeFamily === 'member' ? '👁' : '🏠'}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                {activeFamily === 'member'
                  ? `Viendo familia de ${memberPatientName ?? 'otro familiar'}`
                  : `Tu familia${ownPatientName ? ` · ${ownPatientName}` : ''}`}
              </span>
            </div>
            <button
              onClick={() => switchFamily(activeFamily === 'owner' ? 'member' : 'owner')}
              style={{
                fontSize: 12, fontWeight: 700,
                color: activeFamily === 'member' ? '#2D86A0' : '#4A7C59',
                background: activeFamily === 'member' ? '#DBEAFE' : '#EBF3EE',
                border: 'none', borderRadius: 8,
                padding: '5px 10px', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Cambiar ↔
            </button>
          </div>
        )}

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

      {/* Floating "+" button — hidden on pages with their own add button */}
      {!fabHidden && (
        <button
          onClick={() => setFabOpen(v => !v)}
          style={{
            position: 'fixed', bottom: 82, right: 20, zIndex: 41,
            width: 50, height: 50, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
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
      )}

      {/* FAB backdrop + sheet */}
      {!fabHidden && fabOpen && (
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
                aria-label="Cerrar menú rápido"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <XIcon size={18} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {FAB_ITEMS.map(({ to, emoji, label }) => (
                <button
                  key={to}
                  onClick={() => handleFabLink(to)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 6, padding: '14px 8px', borderRadius: 16,
                    background: '#F7F3ED', border: '1px solid #EDE5D8',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'center' }}>{label}</span>
                </button>
              ))}
            </div>

            {/* Ver todo — link to /mas hub */}
            <Link
              to="/mas"
              onClick={() => setFabOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', marginTop: 12, padding: '11px',
                border: '1px solid #EDE5D8', borderRadius: 12,
                background: '#FDFAF7', color: '#6B7280',
                fontWeight: 600, fontSize: 13, textDecoration: 'none',
              }}
            >
              ☰ Ver todas las funciones
            </Link>

            {/* Sign out — always visible at bottom of FAB sheet */}
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', marginTop: 16, padding: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: '1.5px solid #FFBABA', borderRadius: 14,
                background: '#FFF8F8', color: '#D63031',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              <LogOut size={16} color="#D63031" strokeWidth={1.75} />
              Cerrar sesión
            </button>
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

      {/* Bottom navigation — 4 tabs */}
      <nav
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          height: 68,
          background: navBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${border}`,
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
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, paddingTop: 4, textDecoration: 'none',
              }}
            >
              <div style={{
                width: 46, height: 32, borderRadius: 14,
                background: isActive ? '#EBF3EE' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}>
                <Icon size={22} color={isActive ? '#4A7C59' : '#BBBBBB'} strokeWidth={isActive ? 2 : 1.5} />
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.02em',
                color: isActive ? '#4A7C59' : '#BBBBBB', lineHeight: 1,
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
