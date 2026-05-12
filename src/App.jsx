import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { FamilyProvider } from './contexts/FamilyContext'
import ProtectedRoute from './components/ProtectedRoute'
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
import VoiceDiary from './pages/VoiceDiary'
import Reports from './pages/Reports'
import More from './pages/More'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import JoinFamily from './pages/JoinFamily'

import imgAbuela  from './assets/images/splash-abuela.png'
import imgHija    from './assets/images/splash-hija.png'
import imgFamilia from './assets/images/splash-familia.png'

const SLIDES = [
  { src: imgAbuela,  alt: 'Abuela con familia' },
  { src: imgHija,    alt: 'Hija cuidando' },
  { src: imgFamilia, alt: 'Familia unida' },
]

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>

function Splash({ fading }) {
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setSlide(1), 2000)
    const t2 = setTimeout(() => setSlide(2), 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0A0A0A',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.45s ease-out',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Photo slides — each absolutely positioned, crossfade via opacity */}
      {SLIDES.map(({ src, alt }, i) => (
        <img
          key={i}
          src={src}
          alt={alt}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 20%',
            opacity: slide === i ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
      ))}

      {/* Gradient — lighter at top for logo readability, darker at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.78) 100%)',
      }} />

      {/* Center content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px',
      }}>
        <div className="animate-splash-in flex flex-col items-center">
          {/* White FC mark on dark background */}
          <svg width={76} height={76} viewBox="0 0 40 40" fill="none" aria-hidden="true"
            style={{ filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.5))' }}>
            <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.18)" />
            <circle cx="20" cy="20" r="17.5" fill="white" />
            <text x="20" y="19.5" textAnchor="middle" dominantBaseline="middle"
              fill="#C4623A" fontSize="14" fontWeight="800"
              fontFamily="Georgia, serif" letterSpacing="-0.5">FC</text>
            <text x="20" y="31" textAnchor="middle" dominantBaseline="middle"
              fill="#C4623A" fillOpacity="0.72" fontSize="10">♥</text>
          </svg>

          <div className="animate-splash-tag flex flex-col items-center mt-5">
            <p style={{
              color: 'white', fontFamily: 'Georgia, serif',
              fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px',
              lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}>
              FamiliaCerca
            </p>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <p style={{
                color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: 400, lineHeight: 1.55,
                textShadow: '0 1px 8px rgba(0,0,0,0.4)',
              }}>
                Conectamos generaciones.
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: 400, lineHeight: 1.55,
                textShadow: '0 1px 8px rgba(0,0,0,0.4)',
              }}>
                Compartimos amor.
              </p>
            </div>
          </div>
        </div>

        {/* Slide progress indicators */}
        <div style={{
          position: 'absolute', bottom: 52,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              height: 4, borderRadius: 2, background: 'white',
              opacity: i === slide ? 1 : 0.32,
              width: i === slide ? 28 : 8,
              transition: 'all 0.35s ease-out',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  // First-visit check — splash only shows once
  const [splashDone, setSplashDone] = useState(() => !!localStorage.getItem('fc_splash_shown'))
  const [splashFading, setSplashFading] = useState(false)

  useEffect(() => {
    if (splashDone) return
    localStorage.setItem('fc_splash_shown', '1')
    // 3 slides × 2 s = 6 s hold, then 0.45 s fade-out
    const t1 = setTimeout(() => setSplashFading(true), 6000)
    const t2 = setTimeout(() => setSplashDone(true), 6450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <>
      {!splashDone && <Splash fading={splashFading} />}
      <AuthProvider>
        <FamilyProvider>
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
              <Route path="/diario-voz"  element={<P><VoiceDiary /></P>} />
              <Route path="/reportes"    element={<P><Reports /></P>} />
              <Route path="/perfil"      element={<P><FamilyProfile /></P>} />
              <Route path="/mas"         element={<P><More /></P>} />
              <Route path="/join"        element={<JoinFamily />} />
              <Route path="/terminos"    element={<TermsOfService />} />
              <Route path="/privacidad"  element={<PrivacyPolicy />} />
              <Route path="*"            element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </FamilyProvider>
      </AuthProvider>
    </>
  )
}
