import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../contexts/SubscriptionContext'
import PayPalSubscription from '../components/PayPalSubscription'
import Layout from '../components/Layout'

export default function Upgrade() {
  const { isPaid, sub } = useSubscription()
  const navigate = useNavigate()

  const currentPlan = sub?.plan ?? 'free'

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0B4F4A, #0d6b63)',
          borderRadius: 20, padding: '28px 24px', marginBottom: 20, textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            FamiliaCerca Pro
          </p>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
            Elige tu plan
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Cuida mejor a tu familia con todas las herramientas que necesitas
          </p>
        </div>

        {isPaid ? (
          <div style={{
            background: 'white', borderRadius: 20, border: '1.5px solid #0d6b63',
            padding: '24px', textAlign: 'center', marginBottom: 20,
          }}>
            <p style={{ fontSize: 22, margin: '0 0 8px' }}>
              {currentPlan === 'care_plus' ? '⭐' : '❤️'}
            </p>
            <p style={{ fontWeight: 700, fontSize: 16, color: '#0B4F4A', margin: '0 0 4px' }}>
              Ya tienes un plan activo
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
              {currentPlan === 'care_plus' ? 'Cuidado Total' : 'Plan Familiar'} · Suscripción activa
            </p>
            <button
              onClick={() => navigate('/ajustes')}
              style={{
                padding: '11px 24px', borderRadius: 12,
                border: '1.5px solid #0d6b63', background: 'transparent',
                color: '#0d6b63', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Ver ajustes →
            </button>
          </div>
        ) : (
          <>
            {/* Free plan comparison */}
            <div style={{
              background: '#F8F4ED', borderRadius: 16, padding: '14px 18px',
              marginBottom: 20, border: '1px solid #E8DFD0',
            }}>
              <p style={{ fontSize: 12, color: '#8A7A6A', margin: '0 0 8px', fontWeight: 600 }}>
                Plan Gratis (actual) incluye:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {['Perfil del familiar', 'Hasta 2 cuidadores', 'Checklist de cuidado diario', 'Historial 7 días'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#B0A898', fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 13, color: '#6B5F52' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <PayPalSubscription />
          </>
        )}

        <p style={{ fontSize: 11, color: '#B0A898', textAlign: 'center', margin: '16px 0 0', lineHeight: 1.6 }}>
          Pago seguro procesado por PayPal · Cancela en cualquier momento
        </p>
      </div>
    </Layout>
  )
}
