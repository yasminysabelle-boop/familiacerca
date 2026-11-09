import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useBillingAccount } from '../contexts/BillingAccountContext'
import { useFamilyPlan } from '../contexts/FamilyPlanContext'
import Logo from './Logo'
import { User, ChevronLeft, Home, Chat, ClipboardList, Pill, Menu } from './Icons'
import TrialEndedNotice from './TrialEndedNotice'
import TrialEndingNotice from './TrialEndingNotice'
import TrialBanner from './TrialBanner'
import PWAInstallBanner from './PWAInstallBanner'
import OfflineBanner from './OfflineBanner'
import { useDarkMode } from '../contexts/DarkModeContext'
import FamilySwitcher from './FamilySwitcher'
import { useHospitalMode } from '../contexts/HospitalModeContext'
import { useBadgeCounts } from '../hooks/useBadgeCounts'
import { useGoBack } from '../hooks/useGoBack'

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

const PAGE_TITLES = {
  '/dashboard':      'Inicio',
  '/memorias':       'Memorias de voz',
  '/diario-voz':     'Memorias de voz',
  '/familia':        'Mi Familia',
  '/medications':    'Medicamentos',
  '/historial':      'Historial',
  '/diario-medico':  'Información médica',
  '/calendar':       'Calendario',
  '/notes':          'Notas',
  '/chat':           'Chat familiar',
  '/reportes':       'Reportes para el médico',
  '/mas':            'Todo el cuidado',
  '/gastos':         'Gastos del cuidado',
  '/directorio':     'Directorio',
  '/permisos':       'Permisos',
  '/cuidado':        'Rutina diaria',
  '/roles':          'Permisos de acceso',
  '/ajustes':        'Mi Cuenta',
  '/upgrade':        'Planes',
  '/paciente/perfil': 'Perfil del familiar',
  '/videollamada':   'Videollamada',
  '/registros':      'Estado de salud',
  '/incidentes':     'Incidentes',
}

const PRIMARY_PAGES = new Set(['/dashboard', '/familia', '/ajustes', '/upgrade', '/chat', '/diario-medico', '/medications', '/cuidado', '/mas'])

// Rutas que no dibujan su propio header (no están en hasOwnHeader) y deben
// ver el header claro de Layout en vez del bloque oscuro — mismo
// mecanismo usado para /familia. Ampliar esta lista es seguro: no afecta a
// las rutas con hasOwnHeader (Dashboard/Chat/Cuidado/Historial/Medicamentos/
// Todo el cuidado/Videollamada dibujan el suyo, Layout nunca les pinta nada).
const LIGHT_HEADER_PAGES = new Set([
  '/chat', '/historial', '/videollamada', '/medications', '/familia',
  '/calendar', '/notes', '/diario-voz', '/memorias', '/reportes',
  '/gastos', '/directorio', '/ajustes', '/paciente/perfil', '/upgrade',
  '/admin', '/diario-medico', '/registros', '/incidentes', '/roles',
])


export default function Layout({ children }) {
  const { inactivityWarning, user } = useAuth()
  const { activeFamilyLabel, activePatientName, memberRole } = useFamily()
  // sub/markTrialEndedSeen/markTrialEndingSeen se quedan en la cuenta PROPIA
  // a propósito -- "ya vi este aviso" (trial_ended_seen_at/
  // trial_ending_seen_at) es dato del usuario, no de la familia, y ni
  // siquiera existe en get_family_plan (nunca devuelve esas columnas). Qué
  // aviso corresponde mostrar (trialExpired/isTrialing/daysLeft) sí es del
  // plan de la familia -- ver FamilyPlanContext.
  const { sub, markTrialEndedSeen, markTrialEndingSeen } = useBillingAccount()
  const { familyTrialExpired, familyIsTrialing, familyDaysLeft } = useFamilyPlan()
  const isAdmin = memberRole === null
  const userAvatar = user?.user_metadata?.avatar_url ?? null
  const userInitial = (user?.user_metadata?.full_name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const { dark } = useDarkMode()
  const { isHospitalMode, hospitalMode } = useHospitalMode() ?? {}
  const { homeBadge, familyBadge } = useBadgeCounts()
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const isHome      = location.pathname === '/dashboard'
  const hasOwnHeader = isHome || location.pathname === '/mas' || location.pathname === '/medications' || location.pathname === '/chat' || location.pathname === '/cuidado' || location.pathname === '/historial' || location.pathname === '/videollamada'
  const isVideoCall = location.pathname === '/videollamada'
  const isSecondary = !PRIMARY_PAGES.has(location.pathname) && !isVideoCall

  const [showQuickActions, setShowQuickActions] = useState(false)

  const bg      = dark ? '#14303D' : '#F7F6F2'
  const navBg   = dark ? 'rgba(28,18,8,0.97)' : '#0C6C9C'
  const hdrBg   = dark ? 'rgba(28,18,8,0.95)' : '#0C6C9C'
  const border  = dark ? '#14303D' : 'rgba(255,255,255,0.08)'
  // Todas las pantallas usan ahora el encabezado claro (UX nov 2026).
  const isLightHeader = true || LIGHT_HEADER_PAGES.has(location.pathname)

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
          <span style={{ fontSize: 13, fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>
            MODO HOSPITAL ACTIVO
            {hospitalMode?.hospital_name ? ` · ${hospitalMode.hospital_name}` : ''}
          </span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'white',
            animation: 'hbPulse 2s ease-in-out infinite',
          }} />
        </Link>
      )}

      {/* Fixed header — hidden on dashboard and /mas (each renders its own compact header) */}
      {!hasOwnHeader && <header
        style={{
          position: 'fixed', top: hospitalBarHeight, left: 0, right: 0, zIndex: 40,
          height: 'calc(56px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: isLightHeader ? '#FAF7F1' : hdrBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: isLightHeader ? '1px solid rgba(12,108,156,0.08)' : `1px solid ${border}`,
          boxShadow: isLightHeader ? '0 1px 8px rgba(12,108,156,0.06)' : '0 1px 12px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {isHome ? (
          <Logo showWordmark size={32} />
        ) : (
          /* Un solo estilo para todas las pantallas: flecha + título (UX nov 2026) */
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              onClick={goBack}
              aria-label="Volver"
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <ChevronLeft size={18} color="#2A4350" strokeWidth={2.3} />
            </button>
            <h1 style={{
              fontSize: 18, fontWeight: 800, color: '#14303D', fontFamily: SANS, margin: 0, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {location.pathname === '/paciente/perfil' && (activePatientName || (activeFamilyLabel !== 'Mi familia' ? activeFamilyLabel : null))
                ? `Perfil de ${(activePatientName || activeFamilyLabel).split(' ')[0]}`
                : PAGE_TITLES[location.pathname] ?? ''}
            </h1>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <FamilySwitcher isLight={isLightHeader} />
          <Link to="/ajustes" aria-label="Ir a configuración" style={{ flexShrink: 0, lineHeight: 0 }}>
            {userAvatar ? (
              <img
                src={userAvatar} alt="Mi cuenta"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                  border: isLightHeader ? '2px solid rgba(12,108,156,0.18)' : '2px solid rgba(255,255,255,0.3)' }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: isLightHeader ? 'rgba(12,108,156,0.08)' : 'rgba(255,255,255,0.18)',
                border: isLightHeader ? '2px solid rgba(12,108,156,0.15)' : '2px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: isLightHeader ? '#2A4350' : 'white',
                fontFamily: 'Inter, system-ui, sans-serif',
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
        top:           hasOwnHeader ? `calc(${hospitalBarHeight}px + env(safe-area-inset-top))` : `calc(${hospitalBarHeight}px + 56px + env(safe-area-inset-top))`,
        bottom:        (isSecondary || isHospitalMode || isVideoCall) ? 'env(safe-area-inset-bottom)' : 'calc(64px + env(safe-area-inset-bottom))',
        paddingBottom: location.pathname === '/chat' ? 0 : 80,
      }}>
        <PWAInstallBanner />
        <OfflineBanner />
        <TrialBanner />

        {children}
        {/* Texto legal solo en Mi cuenta (antes salía en todas las pantallas, hasta en el chat) */}
        {location.pathname === '/ajustes' && <footer style={{ padding: '24px 16px', textAlign: 'center', borderTop: '1px solid #E6E3DB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
            <Link to="/terminos" style={{ fontSize: 13, color: '#5E7480', textDecoration: 'none' }}>
              Términos de servicio
            </Link>
            <span style={{ color: '#D1D5DB', fontSize: 13 }}>·</span>
            <Link to="/privacidad" style={{ fontSize: 13, color: '#5E7480', textDecoration: 'none' }}>
              Política de privacidad
            </Link>
          </div>
          <p style={{ fontSize: 12, color: '#5E7480', margin: 0 }}>© 2026 FamiliaCerca LLC</p>
        </footer>}
      </main>

      {familyTrialExpired && isAdmin && !sub?.trial_ended_seen_at && (
        <TrialEndedNotice onClose={markTrialEndedSeen} />
      )}

      {familyIsTrialing && isAdmin && familyDaysLeft <= 4 && !sub?.trial_ending_seen_at && (
        <TrialEndingNotice daysLeft={familyDaysLeft} onClose={markTrialEndingSeen} />
      )}

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
              background: '#0C6C9C', color: 'white', fontWeight: 700,
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
          <Link to="/dashboard" replace={location.pathname !== '/dashboard'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none' }}>
            <span style={{ width: location.pathname === '/dashboard' ? 52 : 36, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/dashboard' ? '#0C6C9C' : 'transparent', transition: 'width 0.15s ease' }}>
              <Home size={18} color={location.pathname === '/dashboard' ? 'white' : '#7C8698'} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/dashboard' ? '#0C6C9C' : '#7C8698' }}>Inicio</span>
          </Link>

          {/* Medicamentos */}
          <button onClick={() => navigate('/medications', { replace: location.pathname !== '/dashboard' })} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent' }}>
            <span style={{ width: location.pathname === '/medications' ? 52 : 36, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/medications' ? '#0C6C9C' : 'transparent', transition: 'width 0.15s ease' }}>
              <Pill size={18} color={location.pathname === '/medications' ? 'white' : '#7C8698'} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: location.pathname === '/medications' ? '#0C6C9C' : '#7C8698' }}>Medicamentos</span>
          </button>

          {/* Rutina */}
          <Link to="/cuidado" replace={location.pathname !== '/dashboard'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none' }}>
            <span style={{ width: location.pathname === '/cuidado' ? 52 : 36, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/cuidado' ? '#0C6C9C' : 'transparent', transition: 'width 0.15s ease' }}>
              <ClipboardList size={18} color={location.pathname === '/cuidado' ? 'white' : '#7C8698'} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/cuidado' ? '#0C6C9C' : '#7C8698' }}>Rutina</span>
          </Link>

          {/* Chat */}
          <Link to="/chat" replace={location.pathname !== '/dashboard'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none' }}>
            <span style={{ position: 'relative', width: location.pathname === '/chat' ? 52 : 36, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/chat' ? '#0C6C9C' : 'transparent', transition: 'width 0.15s ease' }}>
              <Chat size={18} color={location.pathname === '/chat' ? 'white' : '#7C8698'} strokeWidth={2} />
              {familyBadge > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: '#D99A18', display: 'block' }} />
              )}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/chat' ? '#0C6C9C' : '#7C8698' }}>Chat</span>
          </Link>

          {/* Más */}
          <Link to="/mas" replace={location.pathname !== '/dashboard'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none' }}>
            <span style={{ width: location.pathname === '/mas' ? 52 : 36, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/mas' ? '#0C6C9C' : 'transparent', transition: 'width 0.15s ease' }}>
              <Menu size={18} color={location.pathname === '/mas' ? 'white' : '#7C8698'} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: location.pathname === '/mas' ? '#0C6C9C' : '#7C8698' }}>Más</span>
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
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0A4A6B', textAlign: 'center' }}>Acción rápida</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { emoji: '💊', label: 'Registrar medicamento', path: '/medications' },
                { emoji: '✅', label: 'Registrar rutina',       path: '/cuidado' },
                { emoji: '📝', label: 'Notas de la familia',    path: '/paciente/notas-familia' },
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
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#0A4A6B' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
