import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../contexts/SubscriptionContext'
import { useFamily } from '../contexts/FamilyContext'

export default function Paywall() {
  const { trialExpired, isPaid, paywallDismissed, dismissPaywall } = useSubscription()
  const { memberRole } = useFamily()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  const isAdmin = memberRole === null
  if (!trialExpired || !isAdmin || isPaid || paywallDismissed || dismissed) return null

  function handleDismiss() {
    dismissPaywall()
    setDismissed(true)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: 'white',
          borderRadius: '28px 28px 0 0',
          padding: '32px 24px 96px',
          boxShadow: '0 -16px 64px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #EBF3EE, #F5DDD3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 36,
        }}>
          🔒
        </div>

        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 700,
          color: '#1A1A1A', marginBottom: 10, lineHeight: 1.3,
        }}>
          Tu período de prueba terminó
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>
          Para seguir cuidando a tu familiar con FamiliaCerca, elige un plan. Desde $12.99/mes.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => navigate('/upgrade')}
            style={{
              width: '100%', padding: '15px', borderRadius: 16, border: 'none',
              background: '#087F70',
              color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(8,127,112,0.35)',
            }}
          >
            Ver planes →
          </button>
          <button
            onClick={handleDismiss}
            style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              background: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer',
            }}
          >
            Continuar con acceso limitado
          </button>
        </div>
      </div>
    </div>
  )
}
