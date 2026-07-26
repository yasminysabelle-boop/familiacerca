import { useEffect, useState } from 'react'
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
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Medications from './pages/Medications'
import MedicationTimeline from './pages/MedicationTimeline'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'
import Chat from './pages/Chat'
import MemoryAlbum from './pages/MemoryAlbum'
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
import Incidents from './pages/Incidents'
import FamilyRoles from './pages/FamilyRoles'
import { supabase } from './lib/supabase'

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
  const { user }  = useAuth()
  const { memberRole, loading: familyLoading } = useFamily()
  const isLanding = location.pathname === '/'

  const onboardingDone = !!localStorage.getItem('fc_onboarding_done')
  const [showSlides, setShowSlides] = useState(!onboardingDone)
  const [splashDone, setSplashDone] = useState(() => !!sessionStorage.getItem('fc_logo_splash_done'))
  const [splashFading, setSplashFading] = useState(false)

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
      .from('family_invitations')
      .select('status')
      .eq('token', token)
      .single()
      .then(({ data }) => {
        if (!data || data.status !== 'pending') {
          localStorage.removeItem('pendingInviteToken')
        } else if (location.pathname !== '/join') {
          navigate('/join?token=' + token, { replace: true })
          localStorage.removeItem('pendingInviteToken')
        }
      })
  }, [user?.id])

  useEffect(() => {
    if (showSlides || splashDone) return
    sessionStorage.setItem('fc_logo_splash_done', '1')
    const t1 = setTimeout(() => setSplashFading(true), 2200)
    const t2 = setTimeout(() => setSplashDone(true), 2700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [showSlides])

  return (
    <>
      {showSlides && !isLanding && <WelcomeSlides onDone={handleOnboardingDone} />}
      {!showSlides && !splashDone && !isLanding && (
        <div style={{ position: 'relative', zIndex: 9999, width: '100%', height: '100vh', transform: 'translateZ(0)' }}>
          <Splash fading={splashFading} />
        </div>
      )}
      {showMemberOnboarding && <MemberOnboarding onDone={handleMemberOnboardingDone} />}
      <Routes>
        <Route path="/"            element={<HomeRoute />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/register"    element={<Register />} />
        <Route path="/onboarding"  element={<P><Onboarding /></P>} />
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
        <Route path="/album"       element={<P><MemoryAlbum /></P>} />
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
        <Route path="/incidentes"         element={<P><Incidents /></P>} />
        <Route path="/terminos"    element={<TermsOfService />} />
        <Route path="/privacidad"  element={<PrivacyPolicy />} />
        <Route path="*"            element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

function Splash({ fading }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#F8F4ED',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: fading ? 'none' : 'all',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="animate-splash-in" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <img src="/logo.png" alt="FamiliaCerca" style={{ width: 100, height: 100, objectFit: 'contain' }} />

        <div className="animate-splash-tag" style={{ textAlign: 'center', marginTop: 22 }}>
          <p style={{
            color: '#143C32',
            fontFamily: 'Georgia, serif',
            fontSize: 32, fontWeight: 700,
            letterSpacing: '-0.5px', lineHeight: 1,
            margin: 0,
          }}>
            FamiliaCerca
          </p>
          <p style={{
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
