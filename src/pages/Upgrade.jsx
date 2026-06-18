import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const PAYPAL_OPTIONS = {
  clientId: 'BAA59ArCPyhPel6E3o3Fg35_Ppi7ObhJyAUCKfSupXe_Ki7m6j6eY1wW_gTg9VFZs4wwrt0BHN0QlQ6nf0',
  intent: 'subscription',
  vault: true,
  currency: 'USD',
  components: 'buttons',
}

const FREE_FEATURES = [
  'Hasta 2 cuidadores',
  'Chat familiar',
  'Medicamentos básicos',
  'Historial 7 días',
]

const FAMILIAR_FEATURES = [
  'Hasta 3 cuidadores',
  'Medicamentos con OCR',
  'Videollamadas',
  'Milo & Luna IA',
  'Historial 30 días',
]

const TOTAL_FEATURES = [
  'Cuidadores ilimitados',
  'Todo el Plan Familiar',
  'Hospital Mode',
  'Soporte prioritario',
  'Historial ilimitado',
]

function PlanCard({ title, price, priceSubtitle, badge, features, action, accentColor }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 20,
      border: badge ? `2px solid ${accentColor}` : '1.5px solid #E8DFD0',
      padding: '22px 20px 20px',
      position: 'relative',
      boxShadow: badge ? `0 8px 28px ${accentColor}28` : '0 2px 10px rgba(0,0,0,0.05)',
    }}>
      {badge && (
        <div style={{
          position: 'absolute',
          top: -1, right: 18,
          background: '#E58B73',
          color: 'white',
          fontSize: 11, fontWeight: 700,
          padding: '4px 12px',
          borderRadius: '0 0 10px 10px',
        }}>
          {badge}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: 'Georgia, serif' }}>
          {title}
        </p>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: accentColor }}>{price}</span>
        </div>
      </div>

      {priceSubtitle && (
        <p style={{ fontSize: 12, color: '#0B4F4A', fontWeight: 600, margin: '0 0 14px' }}>
          {priceSubtitle}
        </p>
      )}

      <div style={{ marginBottom: 18 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
            <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      {action}
    </div>
  )
}

function UpgradeContent() {
  const { user } = useAuth()
  const { sub, isPaid, refresh } = useSubscription()
  const navigate = useNavigate()
  const [{ isResolved, isRejected }] = usePayPalScriptReducer()
  const [success, setSuccess] = useState(null)
  const [errors, setErrors] = useState({})

  const currentPlan = sub?.plan ?? 'free'

  async function onApprove(planId, data) {
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
    } catch {
      setErrors(prev => ({ ...prev, [planId]: 'No se pudo activar el plan. Contacta soporte.' }))
    }
  }

  function onError(planId) {
    setErrors(prev => ({ ...prev, [planId]: 'Error con PayPal. Intenta de nuevo.' }))
  }

  if (isPaid) {
    return (
      <Layout>
        <div style={{ padding: '24px 16px 96px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {currentPlan === 'care_plus' ? '⭐' : '❤️'}
          </div>
          <p style={{ fontWeight: 700, fontSize: 17, color: '#0B4F4A', margin: '0 0 6px' }}>
            Ya tienes un plan activo
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>
            {currentPlan === 'care_plus' ? 'Cuidado Total' : 'Plan Familiar'} · Suscripción activa
          </p>
          <button
            onClick={() => navigate('/ajustes')}
            style={{
              padding: '12px 28px', borderRadius: 12,
              border: '1.5px solid #0B4F4A', background: 'transparent',
              color: '#0B4F4A', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Ver ajustes →
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ background: '#F8F4ED', minHeight: '100svh' }}>
        {/* Header */}
        <div style={{
          background: '#0B4F4A',
          padding: '36px 24px 32px',
          textAlign: 'center',
        }}>
          <h1 style={{
            color: 'white',
            fontSize: 26, fontWeight: 700,
            fontFamily: 'Georgia, serif',
            margin: '0 0 8px',
          }}>
            Elige tu plan
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            14 días gratis, cancela cuando quieras
          </p>
        </div>

        {/* Cards */}
        <div style={{ padding: '20px 16px 96px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>

          {/* Card 1 — Gratis */}
          <PlanCard
            title="Plan Gratis"
            price="$0"
            accentColor="#9CA3AF"
            features={FREE_FEATURES}
            action={
              <button
                disabled
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  background: '#E5E7EB', color: '#9CA3AF',
                  fontWeight: 600, fontSize: 14, cursor: 'default',
                }}
              >
                Tu plan actual
              </button>
            }
          />

          {/* Card 2 — Familiar */}
          <PlanCard
            title="Plan Familiar"
            price="$12.99/mes"
            priceSubtitle="14 días gratis"
            badge="Más popular"
            accentColor="#0B4F4A"
            features={FAMILIAR_FEATURES}
            action={
              success === 'familiar' ? (
                <div style={{
                  background: '#E0F0EF', border: '1.5px solid #0B4F4A',
                  borderRadius: 14, padding: '14px', textAlign: 'center',
                }}>
                  <p style={{ color: '#0B4F4A', fontWeight: 700, fontSize: 15, margin: 0 }}>
                    ✅ ¡Plan activado! Redirigiendo...
                  </p>
                </div>
              ) : isResolved ? (
                <>
                  <PayPalButtons
                    style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 45 }}
                    createSubscription={(_d, actions) =>
                      actions.subscription.create({ plan_id: 'P-6GJ913990S148394PNIZUIZQ' })
                    }
                    onApprove={data => onApprove('familiar', data)}
                    onError={() => onError('familiar')}
                  />
                  {errors.familiar && (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0', padding: '8px 12px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10 }}>
                      ⚠ {errors.familiar}
                    </p>
                  )}
                </>
              ) : isRejected ? (
                <p style={{ fontSize: 13, color: '#DC2626', textAlign: 'center', margin: 0 }}>
                  No se pudo cargar PayPal. Verifica tu conexión.
                </p>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF', fontSize: 13 }}>
                  Cargando opciones de pago...
                </div>
              )
            }
          />

          {/* Card 3 — Cuidado Total */}
          <PlanCard
            title="Plan Cuidado Total"
            price="$24.99/mes"
            priceSubtitle="14 días gratis"
            accentColor="#0B4F4A"
            features={TOTAL_FEATURES}
            action={
              success === 'care_plus' ? (
                <div style={{
                  background: '#E0F0EF', border: '1.5px solid #0B4F4A',
                  borderRadius: 14, padding: '14px', textAlign: 'center',
                }}>
                  <p style={{ color: '#0B4F4A', fontWeight: 700, fontSize: 15, margin: 0 }}>
                    ✅ ¡Plan activado! Redirigiendo...
                  </p>
                </div>
              ) : isResolved ? (
                <>
                  <PayPalButtons
                    style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 45 }}
                    createSubscription={(_d, actions) =>
                      actions.subscription.create({ plan_id: 'P-3Y806075YA415820CNIZULYA' })
                    }
                    onApprove={data => onApprove('care_plus', data)}
                    onError={() => onError('care_plus')}
                  />
                  {errors.care_plus && (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0', padding: '8px 12px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10 }}>
                      ⚠ {errors.care_plus}
                    </p>
                  )}
                </>
              ) : isRejected ? (
                <p style={{ fontSize: 13, color: '#DC2626', textAlign: 'center', margin: 0 }}>
                  No se pudo cargar PayPal. Verifica tu conexión.
                </p>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF', fontSize: 13 }}>
                  Cargando opciones de pago...
                </div>
              )
            }
          />

          <p style={{ fontSize: 11, color: '#B0A898', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.6 }}>
            Pago seguro procesado por PayPal · Cancela en cualquier momento
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default function Upgrade() {
  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <UpgradeContent />
    </PayPalScriptProvider>
  )
}
