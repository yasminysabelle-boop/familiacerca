import { useNavigate } from 'react-router-dom'
import { useFamilyPlan } from '../contexts/FamilyPlanContext'
import { useFamily } from '../contexts/FamilyContext'

export default function TrialBanner() {
  const { familyIsTrialing: isTrialing, familyTrialExpired: trialExpired, familyDaysLeft: daysLeft } = useFamilyPlan()
  const { memberRole } = useFamily()
  const navigate = useNavigate()

  const isAdmin = memberRole === null
  // Expired trial — yellow persistent banner (admin only)
  if (trialExpired && isAdmin) {
    return (
      <div
        onClick={() => navigate('/upgrade')}
        style={{
          margin: '0 16px 16px', borderRadius: 14, padding: '11px 16px',
          background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
          border: '1.5px solid #FDE68A',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          cursor: 'pointer',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>
          Sigues en el plan Gratis. Ver qué incluye cada plan →
        </p>
      </div>
    )
  }

  if (!isTrialing || !isAdmin) return null

  // Sin avisos de pago los primeros días: la familia primero tiene que
  // sentir el valor. Aparece en los últimos 4 días (decisión nov 2026).
  if (daysLeft > 4) return null

  const urgent = daysLeft <= 1

  return (
    <div
      style={{
        margin: '0 16px 16px', borderRadius: 16, padding: '14px 16px',
        background: urgent
          ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)'
          : 'linear-gradient(135deg, #F7F6F2, #E3F1F8)',
        border: `1.5px solid ${urgent ? '#FDE68A' : '#E6E3DB'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: urgent ? '#92400E' : '#0C6C9C', margin: '0 0 2px' }}>
          {`✨ Te queda${daysLeft !== 1 ? 'n' : ''} ${daysLeft} día${daysLeft !== 1 ? 's' : ''} con todo incluido`}
        </p>
        <p style={{ fontSize: 11, color: '#5E7480', margin: 0 }}>
          Después sigues gratis con lo esencial. Nada se borra.
        </p>
      </div>
      <button
        onClick={() => navigate('/upgrade')}
        style={{
          flexShrink: 0, padding: '8px 16px', borderRadius: 10, border: 'none',
          background: urgent ? '#B45309' : 'linear-gradient(135deg, #0C6C9C, #A6E3EC)',
          color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Ver planes
      </button>
    </div>
  )
}
