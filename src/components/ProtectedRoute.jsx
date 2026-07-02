import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import OnboardingFlow from '../pages/OnboardingFlow'

function Bone({ style }) {
  return (
    <div
      className="animate-pulse"
      style={{ background: '#EDE5D8', borderRadius: 10, ...style }}
    />
  )
}

function PageSkeleton() {
  return (
    <div style={{ background: '#F7F3ED', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 40,
        background: 'rgba(255,248,240,0.97)',
        borderBottom: '1px solid #EDE5D8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <Bone style={{ width: 110, height: 22 }} />
        <Bone style={{ width: 32, height: 32, borderRadius: '50%' }} />
      </div>

      {/* Content */}
      <div style={{ paddingTop: 72, paddingBottom: 84, padding: '72px 16px 84px' }}>
        {/* Hero card */}
        <Bone style={{ height: 120, borderRadius: 20, marginBottom: 16 }} />

        {/* Row of small chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[72, 90, 64].map(w => (
            <Bone key={w} style={{ width: w, height: 32, borderRadius: 12 }} />
          ))}
        </div>

        {/* List cards */}
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              background: 'white', borderRadius: 16, padding: '14px 14px',
              marginBottom: 10, border: '1px solid #EDE5D8',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <Bone style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Bone style={{ height: 14, width: '55%' }} />
              <Bone style={{ height: 11, width: '35%' }} />
            </div>
            <Bone style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 68,
        background: 'rgba(255,255,255,0.97)',
        borderTop: '1px solid #EDE5D8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 8px',
      }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Bone style={{ width: 46, height: 28, borderRadius: 10 }} />
            <Bone style={{ width: 28, height: 8, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ConnectingScreen({ onRetry, hasError }) {
  return (
    <div style={{
      minHeight: '100dvh', background: '#F8F4ED',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <img src="/logo.png" alt="FamiliaCerca" style={{ width: 72, objectFit: 'contain', marginBottom: 4 }} />
      <p style={{ fontSize: 17, fontWeight: 700, color: '#143C32', margin: 0, fontFamily: 'Georgia, serif' }}>
        {hasError ? 'No pudimos conectar' : 'Conectando…'}
      </p>
      <p style={{ fontSize: 13, color: '#9AA89E', margin: 0 }}>
        {hasError ? 'Verifica tu conexión a internet' : 'Verificando tu cuenta'}
      </p>
      <button
        onClick={onRetry}
        style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#143C32', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
      >
        Reintentar
      </button>
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { profile, loading: familyLoading, profileResolved, connectError, refresh } = useFamily()

  if (loading || (user && familyLoading)) return <PageSkeleton />
  if (!user) return <Navigate to="/login" replace />

  // DB hasn't responded yet (or query timed out) — don't assume "no profile"
  if (!profileResolved) return <ConnectingScreen onRetry={refresh} hasError={connectError} />

  const onboardingDone = !!localStorage.getItem('fc_patient_onboarding_done')
    || !!user?.user_metadata?.onboarding_completed
  if (!profile && !onboardingDone) return <OnboardingFlow />

  return children
}
