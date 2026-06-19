import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import Logo from './Logo'
import { User, ChevronLeft } from './Icons'
import Paywall from './Paywall'
import InstallBanner from './InstallBanner'
import OfflineBanner from './OfflineBanner'
import { useDarkMode } from '../contexts/DarkModeContext'
import FamilySwitcher from './FamilySwitcher'
import { useHospitalMode } from '../contexts/HospitalModeContext'
import { useBadgeCounts } from '../hooks/useBadgeCounts'

const PAGE_TITLES = {
  '/dashboard':      'Inicio',
  '/hoy':            'Medicamentos',
  '/memorias':       'Memorias de voz',
  '/diario-voz':     'Memorias de voz',
  '/familia':        'Mi Familia',
  '/medications':    'Medicamentos',
  '/historial':      'Registros de cuidado',
  '/diario-medico':  'Notas Médicas IA',
  '/calendar':       'Citas médicas',
  '/notes':          'Notas',
  '/chat':           'Mensajes',
  '/album':          'Fotos y videos',
  '/reportes':       'Reportes médicos',
  '/mas':            'Más opciones',
  '/gastos':         'Cuentas Claras',
  '/directorio':     'Directorio',
  '/permisos':       'Permisos',
  '/roles':          'Permisos de acceso',
  '/ajustes':        'Mi Cuenta',
  '/pricing':        'Planes',
  '/paciente/perfil': 'Perfil del paciente',
  '/videollamada':   'Videollamada',
  '/registros':      'Síntomas físicos',
  '/incidentes':     'Incidentes',
}

const PRIMARY_PAGES = new Set(['/dashboard', '/familia', '/ajustes', '/planes', '/pricing', '/chat', '/diario-medico'])


export default function Layout({ children }) {
  const { inactivityWarning, user } = useAuth()
  const { activeFamilyLabel, activePatientName } = useFamily()
  const userAvatar = user?.user_metadata?.avatar_url ?? null
  const userInitial = (user?.user_metadata?.full_name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const { dark } = useDarkMode()
  const { isHospitalMode, hospitalMode } = useHospitalMode() ?? {}
  const { homeBadge, familyBadge } = useBadgeCounts()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome      = location.pathname === '/dashboard'
  const isVideoCall = location.pathname === '/videollamada'
  const isSecondary = !PRIMARY_PAGES.has(location.pathname) && !isVideoCall

  const [showQuickActions, setShowQuickActions] = useState(false)

  const bg      = dark ? '#0F1A12' : '#F8F4ED'
  const navBg   = dark ? 'rgba(28,18,8,0.97)' : '#0B4F4A'
  const hdrBg   = dark ? 'rgba(28,18,8,0.95)' : '#0B4F4A'
  const border  = dark ? '#1E3A28' : 'rgba(255,255,255,0.08)'

  const hospitalBarHeight = isHospitalMode ? 40 : 0

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

      {/* Fixed header — hidden on dashboard (Dashboard renders its own compact header) */}
      {!isHome && <header
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
        ) : isSecondary ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 20, cursor: 'pointer',
                color: 'white', fontSize: 12, fontWeight: 700,
                padding: '5px 10px 5px 6px', flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label="Volver al inicio"
            >
              <ChevronLeft size={15} color="white" strokeWidth={2.5} />
              Regresar
            </button>
            <h1 style={{
              fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
              fontFamily: 'Georgia, serif', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {location.pathname === '/paciente/perfil' && (activePatientName || (activeFamilyLabel !== 'Mi familia' ? activeFamilyLabel : null))
                ? `Perfil de ${(activePatientName || activeFamilyLabel).split(' ')[0]}`
                : PAGE_TITLES[location.pathname] ?? ''}
            </h1>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/logo.png"
              width={32} height={32}
              alt="FC"
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
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
            {userAvatar ? (
              <img
                src={userAvatar} alt="Mi cuenta"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.3)' }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {userInitial}
              </div>
            )}
          </Link>
        </div>
      </header>}

      {/* Scrollable main — top offset excludes header height when on dashboard */}
      <main style={{
        position: 'fixed', inset: 0, overflowY: 'auto',
        background: bg,
        top:    isVideoCall ? 0 : isHome ? `calc(${hospitalBarHeight}px + env(safe-area-inset-top))` : `calc(${hospitalBarHeight}px + 56px + env(safe-area-inset-top))`,
        bottom: isVideoCall ? 0 : (isSecondary || isHospitalMode) ? 'env(safe-area-inset-bottom)' : 'calc(64px + env(safe-area-inset-bottom))',
      }}>
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

      <Paywall />

      {/* Inactivity warning banner */}
      {inactivityWarning && (
        <div style={{
          position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 50,
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
              background: '#0d6b63', color: 'white', fontWeight: 700,
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

      {/* Bottom navigation — 5-item white nav */}
      {isVideoCall || isSecondary || isHospitalMode ? null : (
        <>
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          backgroundColor: '#ffffff',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          paddingTop: 8,
          minHeight: 64,
        }}>
          {/* Inicio */}
          <Link to="/dashboard" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>🏠</span>
            <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/dashboard' ? '#3D6B54' : '#9FAF9A' }}>Inicio</span>
          </Link>

          {/* Chat */}
          <Link to="/chat" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none' }}>
            <div style={{ position: 'relative', lineHeight: 1 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              {familyBadge > 0 && (
                <span style={{ position: 'absolute', top: 0, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#D6A13B', display: 'block' }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/chat' ? '#3D6B54' : '#9FAF9A' }}>Chat</span>
          </Link>

          {/* Center + */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={() => setShowQuickActions(true)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52, borderRadius: '50%',
              background: '#0B4F4A', boxShadow: '0 2px 12px rgba(11,79,74,0.35)',
              marginTop: -20, border: 'none', cursor: 'pointer', flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ fontSize: 26, color: 'white', lineHeight: 1, fontWeight: 300 }}>+</span>
            </button>
          </div>

          {/* Notas médicas */}
          <Link to="/diario-medico" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>📓</span>
            <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/diario-medico' ? '#3D6B54' : '#9FAF9A' }}>Notas</span>
          </Link>

          {/* Mi cuenta */}
          <Link to="/ajustes" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>👤</span>
            <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/ajustes' ? '#3D6B54' : '#9FAF9A' }}>Mi cuenta</span>
          </Link>
        </nav>

        </>
      )}

      {/* Quick-actions bottom sheet — top-level so it renders regardless of nav state */}
      {showQuickActions && (
        <>
          <div
            onClick={() => setShowQuickActions(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.3)' }}
          />
          <div style={{
            position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 200,
            background: 'white', borderRadius: '20px 20px 0 0',
            padding: '16px 16px 24px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5E5', margin: '0 auto 14px' }} />
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1E2D26', textAlign: 'center' }}>Acción rápida</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { emoji: '💊', label: 'Registrar medicamento', path: '/medications' },
                { emoji: '✅', label: 'Registrar rutina',       path: '/cuidado' },
                { emoji: '📝', label: 'Notas de la familia',    path: '/paciente/notas-familia' },
                { emoji: '📸', label: 'Subir foto',             path: '/album' },
              ].map(({ emoji, label, path }) => (
                <button
                  key={path}
                  onClick={() => { setShowQuickActions(false); navigate(path) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', borderRadius: 12,
                    background: '#F8F6F2', border: 'none', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1E2D26' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
