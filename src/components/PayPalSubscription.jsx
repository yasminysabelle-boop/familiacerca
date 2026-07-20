import { PayPalButtons } from '@paypal/react-paypal-js'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import { PAYPAL_PLAN_IDS } from '../config/paypalPlans'

const PLANS = [
  {
    id: 'familiar',
    paypalPlanId: PAYPAL_PLAN_IDS.familiar,
    name: 'Plan Familiar',
    price: '$12.99',
    period: '/mes',
    color: '#0d6b63',
    bg: '#E0F0EF',
    icon: '❤️',
    features: [
      'Hasta 6 cuidadores',
      'Recordatorios automáticos de medicamentos',
      'Notas de voz y texto',
      'Foto-prueba de medicamentos',
      'Reportes y exportación PDF',
      'Álbum familiar',
      'Gastos compartidos',
    ],
  },
  {
    id: 'care_plus',
    paypalPlanId: PAYPAL_PLAN_IDS.care_plus,
    name: 'Cuidado Total',
    price: '$24.99',
    period: '/mes',
    color: '#0B4F4A',
    bg: '#E0F0EF',
    icon: '⭐',
    badge: 'Más completo',
    features: [
      'Cuidadores ilimitados',
      'Todo lo del Plan Familiar',
      'Directorio médico completo',
      'Alertas SOS prioritarias',
      'Detección de agotamiento del cuidador',
      'Reporte semanal automático',
      'Historial indefinido',
      'Soporte prioritario',
    ],
  },
]

export default function PayPalSubscription() {
  const { user } = useAuth()
  const { refresh } = useSubscription()
  const navigate = useNavigate()
  const [loading, setLoading] = useState({})
  const [error, setError] = useState({})
  const [success, setSuccess] = useState(null)

  async function onApprove(planId, data) {
    setLoading(prev => ({ ...prev, [planId]: true }))
    setError(prev => ({ ...prev, [planId]: null }))
    try {
      const { error: dbErr } = await supabase
        .from('subscriptions')
        .update({
          plan: planId,
          status: 'active',
          paypal_subscription_id: data.subscriptionID,
        })
        .eq('user_id', user.id)

      if (dbErr) throw dbErr

      await refresh()
      setSuccess(planId)
      setTimeout(() => navigate('/ajustes'), 2000)
    } catch (err) {
      setError(prev => ({ ...prev, [planId]: 'No se pudo activar el plan. Contacta soporte.' }))
    } finally {
      setLoading(prev => ({ ...prev, [planId]: false }))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {PLANS.map(plan => (
        <div
          key={plan.id}
          style={{
            background: 'white',
            borderRadius: 20,
            border: plan.id === 'care_plus' ? `2px solid #0B4F4A` : '1.5px solid #E0EDEC',
            overflow: 'hidden',
            boxShadow: plan.id === 'care_plus' ? '0 4px 24px rgba(11,79,74,0.12)' : '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header */}
          <div style={{
            background: plan.id === 'care_plus'
              ? 'linear-gradient(135deg, #0B4F4A, #0d6b63)'
              : 'linear-gradient(135deg, #0d6b63, #3A6347)',
            padding: '20px 20px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>{plan.icon}</span>
                  <span style={{ color: 'white', fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif' }}>
                    {plan.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ color: '#E58B73', fontSize: 28, fontWeight: 700 }}>{plan.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{plan.period}</span>
                </div>
              </div>
              {plan.badge && (
                <span style={{
                  background: '#E58B73', color: 'white',
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                }}>
                  {plan.badge}
                </span>
              )}
            </div>
          </div>

          {/* Features */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: '#0d6b63', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>

            {success === plan.id ? (
              <div style={{
                background: '#E0F0EF', border: '1.5px solid #0d6b63',
                borderRadius: 14, padding: '14px', textAlign: 'center',
              }}>
                <p style={{ color: '#0B4F4A', fontWeight: 700, fontSize: 15, margin: 0 }}>
                  ✅ ¡Plan activado! Redirigiendo...
                </p>
              </div>
            ) : (
              <>
                <PayPalButtons
                  style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 45 }}
                  disabled={!!loading[plan.id]}
                  createSubscription={(_data, actions) =>
                    actions.subscription.create({ plan_id: plan.paypalPlanId })
                  }
                  onApprove={(data) => onApprove(plan.id, data)}
                  onError={() =>
                    setError(prev => ({ ...prev, [plan.id]: 'Error con PayPal. Intenta de nuevo.' }))
                  }
                />
                {error[plan.id] && (
                  <p style={{
                    fontSize: 12, color: '#DC2626', margin: '8px 0 0',
                    padding: '8px 12px', background: '#FFF0F0',
                    border: '1px solid #FFBABA', borderRadius: 10,
                  }}>
                    ⚠ {error[plan.id]}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
