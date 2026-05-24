import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../contexts/SubscriptionContext'

export default function TrialBanner() {
  const { isTrialing, daysLeft } = useSubscription()
  const navigate = useNavigate()

  if (!isTrialing) return null

  const urgent = daysLeft <= 3

  return (
    <div
      style={{
        margin: '0 16px 16px',
        borderRadius: 16,
        padding: '14px 16px',
        background: urgent
          ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'
          : 'linear-gradient(135deg, #F7F3ED, #EBF3EE)',
        border: `1.5px solid ${urgent ? '#FECACA' : '#EDE5D8'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: urgent ? '#DC2626' : '#4A7C59', margin: '0 0 2px' }}>
          {urgent ? `⚠ Quedan ${daysLeft} día${daysLeft !== 1 ? 's' : ''} de prueba` : `✨ Prueba gratuita — ${daysLeft} días restantes`}
        </p>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
          Elige un plan para no perder el acceso.
        </p>
      </div>
      <button
        onClick={() => navigate('/pricing')}
        style={{
          flexShrink: 0, padding: '8px 16px', borderRadius: 10, border: 'none',
          background: urgent ? '#DC2626' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
          color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Ver planes
      </button>
    </div>
  )
}
