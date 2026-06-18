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

function PayPalSection({ planKey, paypalPlanId, success, errors, isResolved, isRejected, onApprove, onError }) {
  if (success === planKey) {
    return (
      <div style={{
        background: '#E0F0EF', border: '1.5px solid #0B4F4A',
        borderRadius: 14, padding: '14px', textAlign: 'center',
      }}>
        <p style={{ color: '#0B4F4A', fontWeight: 700, fontSize: 15, margin: 0 }}>
          ✅ ¡Plan activado! Redirigiendo...
        </p>
      </div>
    )
  }
  if (isRejected) {
    return (
      <p style={{ fontSize: 13, color: '#DC2626', textAlign: 'center', margin: 0 }}>
        No se pudo cargar PayPal. Verifica tu conexión.
      </p>
    )
  }
  if (!isResolved) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF', fontSize: 13 }}>
        Cargando opciones de pago...
      </div>
    )
  }
  return (
    <>
      <PayPalButtons
        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 45 }}
        createSubscription={(_d, actions) =>
          actions.subscription.create({ plan_id: paypalPlanId })
        }
        onApprove={data => onApprove(planKey, data)}
        onError={() => onError(planKey)}
      />
      {errors[planKey] && (
        <p style={{
          fontSize: 12, color: '#DC2626', margin: '8px 0 0',
          padding: '8px 12px', background: '#FFF0F0',
          border: '1px solid #FFBABA', borderRadius: 10,
        }}>
          ⚠ {errors[planKey]}
        </p>
      )}
    </>
  )
}

function UpgradeContent() {
  const { user } = useAuth()
  const { sub, refresh } = useSubscription()
  const navigate = useNavigate()
  const [{ isResolved, isRejected }] = usePayPalScriptReducer()
  const [success, setSuccess] = useState(null)
  const [errors, setErrors] = useState({})

  // Derive active plan directly from sub row — only 'active' status with a paid plan counts
  const activePlan = (sub?.status === 'active' && (sub?.plan === 'familiar' || sub?.plan === 'care_plus'))
    ? sub.plan
    : null

  async function onApprove(planKey, data) {
    try {
      const { error: dbErr } = await supabase
        .from('subscriptions')
        .update({
          plan: planKey,
          status: 'active',
          paypal_subscription_id: data.subscriptionID,
        })
        .eq('user_id', user.id)
      if (dbErr) throw dbErr
      await refresh()
      setSuccess(planKey)
      setTimeout(() => navigate('/ajustes'), 2000)
    } catch {
      setErrors(prev => ({ ...prev, [planKey]: 'No se pudo activar el plan. Contacta soporte.' }))
    }
  }

  function onError(planKey) {
    setErrors(prev => ({ ...prev, [planKey]: 'Error con PayPal. Intenta de nuevo.' }))
  }

  const paypalProps = { success, errors, isResolved, isRejected, onApprove, onError }

  return (
    <Layout>
      <div style={{ background: '#F8F4ED', minHeight: '100svh' }}>

        {/* Header */}
        <div style={{ background: '#0B4F4A', padding: '36px 24px 32px', textAlign: 'center' }}>
          <h1 style={{
            color: 'white', fontSize: 26, fontWeight: 700,
            fontFamily: 'Georgia, serif', margin: '0 0 8px',
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
          <div style={{
            background: 'white', borderRadius: 20,
            border: activePlan === null ? '2px solid #9CA3AF' : '1.5px solid #E8DFD0',
            padding: '22px 20px 20px', position: 'relative',
            boxShadow: activePlan === null ? '0 8px 28px rgba(156,163,175,0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
          }}>
            {activePlan === null && (
              <div style={{
                position: 'absolute', top: -1, right: 18,
                background: '#9CA3AF', color: 'white',
                fontSize: 11, fontWeight: 700,
                padding: '4px 12px', borderRadius: '0 0 10px 10px',
              }}>
                Tu plan actual
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: 'Georgia, serif' }}>
                Plan Gratis
              </p>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#9CA3AF' }}>$0</span>
            </div>
            <div style={{ marginBottom: 18 }}>
              {FREE_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                  <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
            <button disabled style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              background: '#E5E7EB', color: '#9CA3AF',
              fontWeight: 600, fontSize: 14, cursor: 'default',
            }}>
              {activePlan === null ? 'Tu plan actual' : 'Plan básico'}
            </button>
          </div>

          {/* Card 2 — Familiar */}
          <div style={{
            background: 'white', borderRadius: 20,
            border: `2px solid #0B4F4A`,
            padding: '22px 20px 20px', position: 'relative',
            boxShadow: '0 8px 28px rgba(11,79,74,0.15)',
          }}>
            <div style={{
              position: 'absolute', top: -1, right: 18,
              background: activePlan === 'familiar' ? '#0B4F4A' : '#E58B73',
              color: 'white', fontSize: 11, fontWeight: 700,
              padding: '4px 12px', borderRadius: '0 0 10px 10px',
            }}>
              {activePlan === 'familiar' ? 'Tu plan actual' : 'Más popular'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: 'Georgia, serif' }}>
                Plan Familiar
              </p>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#0B4F4A' }}>$12.99/mes</span>
            </div>
            <p style={{ fontSize: 12, color: '#0B4F4A', fontWeight: 600, margin: '0 0 14px' }}>
              14 días gratis
            </p>
            <div style={{ marginBottom: 18 }}>
              {FAMILIAR_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                  <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
            {activePlan === 'familiar' ? (
              <button disabled style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: '#E5E7EB', color: '#9CA3AF',
                fontWeight: 600, fontSize: 14, cursor: 'default',
              }}>
                Tu plan actual
              </button>
            ) : (
              <PayPalSection
                planKey="familiar"
                paypalPlanId="P-6GJ913990S148394PNIZUIZQ"
                {...paypalProps}
              />
            )}
          </div>

          {/* Card 3 — Cuidado Total */}
          <div style={{
            background: 'white', borderRadius: 20,
            border: activePlan === 'care_plus' ? '2px solid #0B4F4A' : '1.5px solid #E8DFD0',
            padding: '22px 20px 20px', position: 'relative',
            boxShadow: activePlan === 'care_plus' ? '0 8px 28px rgba(11,79,74,0.15)' : '0 2px 10px rgba(0,0,0,0.05)',
          }}>
            {activePlan === 'care_plus' && (
              <div style={{
                position: 'absolute', top: -1, right: 18,
                background: '#0B4F4A', color: 'white',
                fontSize: 11, fontWeight: 700,
                padding: '4px 12px', borderRadius: '0 0 10px 10px',
              }}>
                Tu plan actual
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: 'Georgia, serif' }}>
                Plan Cuidado Total
              </p>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#0B4F4A' }}>$24.99/mes</span>
            </div>
            <p style={{ fontSize: 12, color: '#0B4F4A', fontWeight: 600, margin: '0 0 14px' }}>
              14 días gratis
            </p>
            <div style={{ marginBottom: 18 }}>
              {TOTAL_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                  <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
            {activePlan === 'care_plus' ? (
              <button disabled style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: '#E5E7EB', color: '#9CA3AF',
                fontWeight: 600, fontSize: 14, cursor: 'default',
              }}>
                Tu plan actual
              </button>
            ) : (
              <PayPalSection
                planKey="care_plus"
                paypalPlanId="P-3Y806075YA415820CNIZULYA"
                {...paypalProps}
              />
            )}
          </div>

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
