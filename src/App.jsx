import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { FamilyProvider } from './contexts/FamilyContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { DarkModeProvider } from './contexts/DarkModeContext'
import ProtectedRoute from './components/ProtectedRoute'
import WelcomeSlides from './components/WelcomeSlides'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Medications from './pages/Medications'
import MedicationTimeline from './pages/MedicationTimeline'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'
import FamilyProfile from './pages/FamilyProfile'
import Chat from './pages/Chat'
import MemoryAlbum from './pages/MemoryAlbum'
import Memorias from './pages/Memorias'
import Hoy from './pages/Hoy'
import Familia from './pages/Familia'
import Reports from './pages/Reports'
import More from './pages/More'
import Expenses from './pages/Expenses'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import JoinFamily from './pages/JoinFamily'
import Permissions from './pages/Permissions'
import Directory from './pages/Directory'
import Pricing from './pages/Pricing'
import Settings from './pages/Settings'

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>

function Splash({ fading }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(160deg, #C4623A 0%, #8C3E22 60%, #5C2610 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: fading ? 'none' : 'all',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Soft glow ring behind logo */}
      <div style={{
        position: 'absolute',
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
      }} />

      <div className="animate-splash-in" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* FC circle logo */}
        <svg width={88} height={88} viewBox="0 0 40 40" fill="none" aria-hidden="true"
          style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.25))' }}>
          <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)" />
          <circle cx="20" cy="20" r="17.5" fill="white" />
          <text x="20" y="19.5" textAnchor="middle" dominantBaseline="middle"
            fill="#C4623A" fontSize="14" fontWeight="800"
            fontFamily="Georgia, serif" letterSpacing="-0.5">FC</text>
          <text x="20" y="31" textAnchor="middle" dominantBaseline="middle"
            fill="#C4623A" fillOpacity="0.72" fontSize="10">♥</text>
        </svg>

        <div className="animate-splash-tag" style={{ textAlign: 'center', marginTop: 22 }}>
          <p style={{
            color: 'white',
            fontFamily: 'Georgia, serif',
            fontSize: 32, fontWeight: 700,
            letterSpacing: '-0.5px', lineHeight: 1,
            margin: 0,
          }}>
            FamiliaCerca
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.78)',
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
  // New users see the 3-slide onboarding carousel (once ever).
  // Returning users (fc_onboarding_done or legacy fc_splash_shown) see the logo splash once per session.
  const onboardingDone = !!localStorage.getItem('fc_onboarding_done') || !!localStorage.getItem('fc_splash_shown')
  const [showSlides, setShowSlides] = useState(!onboardingDone)

  const [splashDone, setSplashDone] = useState(() => !!sessionStorage.getItem('fc_logo_splash_done'))
  const [splashFading, setSplashFading] = useState(false)

  function handleOnboardingDone() {
    localStorage.setItem('fc_onboarding_done', '1')
    setShowSlides(false)
  }

  useEffect(() => {
    if (showSlides || splashDone) return
    sessionStorage.setItem('fc_logo_splash_done', '1')
    const t1 = setTimeout(() => setSplashFading(true), 2200)
    const t2 = setTimeout(() => setSplashDone(true), 2700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [showSlides])

  return (
    <>
      {showSlides && <WelcomeSlides onDone={handleOnboardingDone} />}
      {!showSlides && !splashDone && <Splash fading={splashFading} />}
      <AuthProvider>
        <DarkModeProvider>
        <FamilyProvider>
          <SubscriptionProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"       element={<Login />} />
              <Route path="/register"    element={<Register />} />
              <Route path="/onboarding"  element={<P><Onboarding /></P>} />
              <Route path="/dashboard"   element={<P><Dashboard /></P>} />
              <Route path="/medications" element={<P><Medications />  </P>} />
              <Route path="/historial"   element={<P><MedicationTimeline /></P>} />
              <Route path="/calendar"    element={<P><Calendar /></P>} />
              <Route path="/notes"       element={<P><Notes /></P>} />
              <Route path="/chat"        element={<P><Chat /></P>} />
              <Route path="/album"       element={<P><MemoryAlbum /></P>} />
              <Route path="/diario-voz"  element={<P><Memorias /></P>} />
              <Route path="/memorias"   element={<P><Memorias /></P>} />
              <Route path="/hoy"        element={<P><Hoy /></P>} />
              <Route path="/familia"    element={<P><Familia /></P>} />
              <Route path="/reportes"    element={<P><Reports /></P>} />
              <Route path="/perfil"      element={<P><FamilyProfile /></P>} />
              <Route path="/mas"         element={<P><More /></P>} />
              <Route path="/gastos"      element={<P><Expenses /></P>} />
              <Route path="/directorio"   element={<P><Directory /></P>} />
              <Route path="/join"        element={<JoinFamily />} />
              <Route path="/permisos"    element={<P><Permissions /></P>} />
              <Route path="/pricing"     element={<Pricing />} />
              <Route path="/ajustes"    element={<P><Settings /></P>} />
              <Route path="/terminos"    element={<TermsOfService />} />
              <Route path="/privacidad"  element={<PrivacyPolicy />} />
              <Route path="*"            element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
          </SubscriptionProvider>
        </FamilyProvider>
        </DarkModeProvider>
      </AuthProvider>
    </>
  )
}
