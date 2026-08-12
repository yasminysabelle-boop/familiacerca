import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { FamilyProvider, useFamily } from './contexts/FamilyContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { DarkModeProvider } from './contexts/DarkModeContext'
import { PresenceProvider } from './contexts/PresenceContext'
import { HospitalModeProvider } from './contexts/HospitalModeContext'
import ProtectedRoute from './components/ProtectedRoute'
import WelcomeSlides from './components/WelcomeSlides'
import MemberOnboarding from './components/MemberOnboarding'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Medications from './pages/Medications'
import MedicationTimeline from './pages/MedicationTimeline'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'
import Chat from './pages/Chat'
import Memorias from './pages/Memorias'
import Familia from './pages/Familia'
import Reports from './pages/Reports'
import TodoElCuidado from './pages/TodoElCuidado'
import Expenses from './pages/Expenses'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import JoinFamily from './pages/JoinFamily'
import Permissions from './pages/Permissions'
import Directory from './pages/Directory'
import Settings from './pages/Settings'
import Cuidado from './pages/Cuidado'
import PatientProfile from './pages/PatientProfile'
import NotasFamilia from './pages/NotasFamilia'
import Landing from './pages/Landing'
import Upgrade from './pages/Upgrade'
import VideoCall from './pages/VideoCall'
import Admin from './pages/Admin'
import DiarioMedico from './pages/DiarioMedico'
import CareRecord from './pages/CareRecord'
import FamilyRoles from './pages/FamilyRoles'
import { supabase } from './lib/supabase'
import imgManos from './assets/images/splash-manos.png'

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>

function HomeRoute() {
  const { user, loading } = useAuth()
  const { loading: familyLoading } = useFamily()
  if (loading || (user && familyLoading)) return null
  if (!user) return <Landing />
  return <Navigate to="/dashboard" replace />
}

function AppShell() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { memberRole, loading: familyLoading } = useFamily()
  const isLanding = location.pathname === '/'

  const onboardingDone = !!localStorage.getItem('fc_onboarding_done')
  const [showSlides, setShowSlides] = useState(!onboardingDone)
  const [splashDone, setSplashDone] = useState(() => !!sessionStorage.getItem('fc_logo_splash_done'))

  // Member onboarding: shown once to family members who haven't completed it.
  // Auth metadata is the source of truth — clears stale localStorage for re-invited users.
  const [showMemberOnboarding, setShowMemberOnboarding] = useState(false)
  useEffect(() => {
    if (!user || familyLoading) return
    const isMember = memberRole !== null
    if (!isMember) { setShowMemberOnboarding(false); return }
    const metaDone = !!user?.user_metadata?.onboarding_completed
    if (!metaDone) {
      localStorage.removeItem('fc_member_onboarding_done')
    }
    setShowMemberOnboarding(!metaDone)
  }, [user, familyLoading, memberRole])

  function handleOnboardingDone() {
    localStorage.setItem('fc_onboarding_done', '1')
    setShowSlides(false)
  }

  function handleMemberOnboardingDone() {
    localStorage.setItem('fc_member_onboarding_done', '1')
    setShowMemberOnboarding(false)
  }

  // After login, verify token is still pending before redirecting — clear if already used/expired
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('pendingInviteToken')
    if (!token) return
    supabase
      .rpc('get_invitation_by_token', { p_token: token })
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.status !== 'pending') {
          localStorage.removeItem('pendingInviteToken')
        } else if (location.pathname !== '/join') {
          navigate('/join?token=' + token, { replace: true })
          localStorage.removeItem('pendingInviteToken')
        }
      })
  }, [user?.id])

  return (
    <>
      {showSlides && !isLanding && <WelcomeSlides onDone={handleOnboardingDone} />}
      {!showSlides && !splashDone && !isLanding && (
        <div style={{ position: 'relative', zIndex: 9999, width: '100%', height: '100vh', transform: 'translateZ(0)' }}>
          <Splash toLogin={!authLoading && !user} onDone={() => {
            sessionStorage.setItem('fc_logo_splash_done', '1')
            setSplashDone(true)
          }} />
        </div>
      )}
      {showMemberOnboarding && <MemberOnboarding onDone={handleMemberOnboardingDone} />}
      <Routes>
        <Route path="/"            element={<HomeRoute />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/register"    element={<Register />} />
        {/* Onboarding.jsx (flujo viejo de 3 pasos) fue reemplazado por OnboardingFlow.jsx,
            que ProtectedRoute muestra automáticamente en cualquier ruta protegida cuando
            no hay perfil. Login/Register/Dashboard siguen navegando a "/onboarding" —
            se redirige a /dashboard para que ese gate haga su trabajo. No quitar. */}
        <Route path="/onboarding"  element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"   element={<P><Dashboard /></P>} />
        <Route path="/medications" element={<P><Medications /></P>} />
        {/* Red de seguridad permanente: emails ya enviados (bienvenida, resúmenes) y
            notificaciones antiguas en dispositivos que no actualizaron el SW todavía
            siguen apuntando a /hoy. No quitar. */}
        <Route path="/hoy"         element={<Navigate to="/medications" replace />} />
        <Route path="/historial"   element={<P><MedicationTimeline /></P>} />
        <Route path="/calendar"    element={<P><Calendar /></P>} />
        <Route path="/notes"       element={<P><Notes /></P>} />
        <Route path="/chat"        element={<P><Chat /></P>} />
        <Route path="/diario-voz"  element={<P><Memorias /></P>} />
        <Route path="/memorias"    element={<P><Memorias /></P>} />
        <Route path="/cuidado"     element={<P><Cuidado /></P>} />
        <Route path="/cuidado/horarios" element={<Navigate to="/cuidado?tab=horarios" replace />} />

        <Route path="/familia"     element={<P><Familia /></P>} />
        <Route path="/reportes"    element={<P><Reports /></P>} />
        <Route path="/mas"         element={<P><TodoElCuidado /></P>} />
        <Route path="/gastos"      element={<P><Expenses /></P>} />
        <Route path="/directorio"  element={<P><Directory /></P>} />
        <Route path="/join"          element={<JoinFamily />} />
        <Route path="/permisos"    element={<P><Permissions /></P>} />
        <Route path="/roles"       element={<P><FamilyRoles /></P>} />
        <Route path="/upgrade"     element={<P><Upgrade /></P>} />
        <Route path="/ajustes"            element={<P><Settings /></P>} />
        <Route path="/paciente/perfil"      element={<P><PatientProfile /></P>} />
        <Route path="/paciente/notas-familia" element={<P><NotasFamilia /></P>} />
        <Route path="/videollamada"       element={<P><VideoCall /></P>} />
        <Route path="/admin"              element={<P><Admin /></P>} />
        <Route path="/diario-medico"      element={<P><DiarioMedico /></P>} />
        <Route path="/registros"          element={<P><CareRecord /></P>} />
        <Route path="/incidentes"         element={<Navigate to="/notes" replace />} />
        <Route path="/terminos"    element={<TermsOfService />} />
        <Route path="/privacidad"  element={<PrivacyPolicy />} />
        <Route path="*"            element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

// Splash de arranque.
// Entrada (siempre, salvo prefers-reduced-motion — ver index.css): el logo
// entra con scale+rotate y un rebote elástico real (overshoot), mientras un
// degradado de marca saturado se aclara a crema detrás — animate-splash-in /
// animate-splash-word / animate-splash-tag / animate-splash-bg-teal en
// index.css. La entrada elaborada termina de asentarse ~1.8s in (el fondo es
// lo último en aclararse); el hold se corrió de 2.2s a 2.6s para darle un
// respiro real antes de decidir la salida.
// Dos coreografías de salida a los 2.6s:
//  - "elaborada": crossfade hacia la foto+degradado de Login (mismo encuadre
//    que Login.jsx) con el card blanco subiendo desde abajo — solo cuando
//    vamos a aterrizar en Login (toLogin) y el usuario no pidió menos
//    movimiento.
//  - "simple": el fundido de siempre (opacity a 0.5s) — con sesión activa,
//    con loading de auth aún sin resolver a los 2.6s, o con
//    prefers-reduced-motion activo. Nunca asume toLogin de forma optimista.
// toLogin se relee en el momento de decidir (2.6s), no al montar, porque a
// montaje el loading de auth casi siempre sigue en true.
function Splash({ toLogin, onDone }) {
  const [phase, setPhase] = useState('enter') // 'enter' | 'crossfade' | 'card' | 'fade'
  const toLoginRef = useRef(toLogin)
  useEffect(() => { toLoginRef.current = toLogin }, [toLogin])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers = []
    timers.push(setTimeout(() => {
      const elaborate = toLoginRef.current && !reducedMotion
      if (elaborate) {
        setPhase('crossfade')
        timers.push(setTimeout(() => setPhase('card'), 150))
        timers.push(setTimeout(onDone, 850))
      } else {
        setPhase('fade')
        timers.push(setTimeout(onDone, 500))
      }
    }, 2600))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exiting = phase === 'crossfade' || phase === 'card'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
        background: '#F8F4ED',
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: phase === 'enter' ? 'all' : 'none',
      }}
    >
      {/* Entrada: momento de degradado de marca saturado que se aclara a
          crema, sincronizado con el logo asentándose (animate-splash-bg-teal
          en index.css se ocupa del timing y de prefers-reduced-motion) */}
      <div className="animate-splash-bg-teal" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(148deg, #12A18C 0%, #0A8072 46%, #055C51 100%)',
      }} />

      {/* Foto + degradado — mismo encuadre que Login.jsx (60vh, center 42%)
          para que el crossfade termine exactamente en lo que Login muestra */}
      <img
        src={imgManos}
        alt=""
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          width: '100%', height: '60vh',
          objectFit: 'cover', objectPosition: 'center 42%',
          opacity: exiting ? 1 : 0,
          transition: 'opacity 0.65s ease-in-out',
        }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.32) 38%, rgba(0,0,0,0.88) 75%, rgba(0,0,0,0.97) 100%)',
        opacity: exiting ? 1 : 0,
        transition: 'opacity 0.65s ease-in-out',
      }} />

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(0.88) translateY(-14px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.5s ease-in, transform 0.5s ease-in',
      }}>
        <div className="animate-splash-in" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <img src="/logo.png" alt="FamiliaCerca" style={{ width: 100, height: 100, objectFit: 'contain' }} />

          <div style={{ textAlign: 'center', marginTop: 22 }}>
            <p className="animate-splash-word" style={{
              color: '#143C32',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: 30, fontWeight: 800,
              letterSpacing: '-0.4px', lineHeight: 1,
              margin: 0,
            }}>
              FamiliaCerca
            </p>
            <p className="animate-splash-tag" style={{
              color: '#6B7280',
              fontSize: 16, fontWeight: 400,
              letterSpacing: '0.06em',
              margin: '12px 0 0',
            }}>
              Cuidado con amor
            </p>
          </div>
        </div>
      </div>

      {/* Card blanco — silueta del formulario de Login subiendo desde abajo */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
        background: 'white', borderRadius: '28px 28px 0 0',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.3)',
        transform: phase === 'card' ? 'translateY(0%)' : 'translateY(100%)',
        transition: 'transform 0.7s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DarkModeProvider>
          <FamilyProvider>
            <PresenceProvider>
              <SubscriptionProvider>
                <HospitalModeProvider>
                  <AppShell />
                </HospitalModeProvider>
              </SubscriptionProvider>
            </PresenceProvider>
          </FamilyProvider>
        </DarkModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
