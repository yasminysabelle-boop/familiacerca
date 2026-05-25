import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../contexts/SubscriptionContext'
import { createCheckoutSession } from '../lib/stripe'
import Logo from '../components/Logo'

const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: '14 días de prueba',
    badge: null,
    color: '#6B7280',
    features: [
      'Perfil del familiar',
      'Hasta 3 miembros del equipo',
      'Chat familiar',
      'Timeline de cuidado',
    ],
    locked: [
      'Recordatorios automáticos',
      'Miembros ilimitados',
      'Historial ilimitado',
      'Resúmenes con IA ✨',
    ],
    cta: 'Comenzar gratis →',
    disabled: false,
  },
  {
    id: 'familiar',
    name: 'Plan Familiar',
    price: '$12.99',
    period: '/mes',
    badge: 'Más popular',
    color: '#4A7C59',
    features: [
      'Todo lo del plan Gratis',
      'Miembros ilimitados',
      'Recordatorios automáticos de medicamentos',
      'Notas, álbum y gastos compartidos',
      'Historial completo de dosis',
      'Directorio de contactos médicos',
      'Resúmenes básicos con IA',
    ],
    locked: [
      'Detección de agotamiento del cuidador',
      'PDF médico semanal',
      'Reportes avanzados con IA',
    ],
    cta: 'Empezar ahora →',
    disabled: false,
  },
  {
    id: 'care_plus',
    name: 'Care+',
    price: '$24.99',
    period: '/mes',
    badge: '✨ IA Avanzada',
    color: '#7C3AED',
    features: [
      'Todo lo del Plan Familiar',
      'Asistente IA familiar 24/7',
      'Resumen diario inteligente',
      'Detección de agotamiento del cuidador',
      'Reporte semanal familiar automático',
      'Resumen médico en PDF',
      'Soporte prioritario',
    ],
    locked: [],
    cta: 'Empezar ahora →',
    disabled: false,
  },
]

const FAQ = [
  {
    q: '¿Necesito tarjeta de crédito para la prueba gratuita?',
    a: 'No. Los primeros 14 días son completamente gratis sin necesidad de tarjeta. Solo se solicita al elegir un plan de pago.',
  },
  {
    q: '¿Puedo cancelar en cualquier momento?',
    a: 'Sí. Puedes cancelar desde tu panel de cuenta y seguirás teniendo acceso hasta el final del período pagado.',
  },
  {
    q: '¿Los datos de mi familiar están seguros?',
    a: 'Absolutamente. Toda la información está cifrada y almacenada de forma segura. Solo tú y tu equipo de cuidado pueden verla.',
  },
  {
    q: '¿Qué incluye la detección de agotamiento del cuidador?',
    a: 'La IA analiza los patrones de registro de los últimos 7 días. Si detecta que la misma persona ha registrado más del 80% de las dosis sola, genera un mensaje de reconocimiento y sugiere distribuir el cuidado.',
  },
]

export default function Pricing() {
  const navigate = useNavigate()
  const { sub, isTrialing, daysLeft } = useSubscription()
  const [loading, setLoading] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [openFaq, setOpenFaq] = useState(null)

  async function handleChoose(planId) {
    if (planId === 'free') { navigate('/register'); return }
    setLoading(planId)
    setCheckoutError('')
    try {
      const url = await createCheckoutSession(planId)
      window.location.href = url
    } catch {
      setLoading(null)
      setCheckoutError('No se pudo iniciar el pago. Verifica tu conexión e intenta de nuevo.')
    }
  }

  const currentPlan = sub?.plan

  return (
    <div style={{ minHeight: '100svh', background: '#F7F3ED', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 36, height: 36, borderRadius: 10, border: '1.5px solid #EDE5D8',
            background: 'white', cursor: 'pointer', fontSize: 20, color: '#6B7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          ‹
        </button>
        <Logo size={28} />
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '32px 24px 28px' }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: '#4A7C59', letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          Planes y precios
        </p>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700,
          color: '#1A1A1A', lineHeight: 1.3, marginBottom: 12,
        }}>
          Cuida con todo el amor<br />que tu familia merece
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
          Elige el plan que mejor se adapta a tu equipo de cuidado.
        </p>

        {/* Trial countdown */}
        {isTrialing && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginTop: 16, padding: '8px 16px', borderRadius: 20,
            background: daysLeft <= 3 ? '#FEF2F2' : '#F7F3ED',
            border: `1px solid ${daysLeft <= 3 ? '#FECACA' : '#EDE5D8'}`,
          }}>
            <span style={{ fontSize: 14 }}>{daysLeft <= 3 ? '⚠️' : '🌱'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: daysLeft <= 3 ? '#DC2626' : '#4A7C59' }}>
              Te quedan {daysLeft} día{daysLeft !== 1 ? 's' : ''} de prueba gratuita
            </span>
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id || (plan.id === 'free' && isTrialing)
          const isHighlighted = plan.id === 'familiar'
          const isLoading = loading === plan.id

          return (
            <div
              key={plan.id}
              style={{
                borderRadius: 20,
                border: `2px solid ${isHighlighted ? plan.color : '#EDE5D8'}`,
                background: isHighlighted
                  ? 'linear-gradient(135deg, #F7F3ED, #EBF3EE)'
                  : plan.id === 'care_plus'
                  ? 'linear-gradient(135deg, #FAF5FF, #F5F0FF)'
                  : 'white',
                padding: '20px 20px 22px',
                position: 'relative',
                boxShadow: isHighlighted
                  ? '0 8px 32px rgba(74,124,89,0.15)'
                  : plan.id === 'care_plus'
                  ? '0 8px 32px rgba(124,58,237,0.1)'
                  : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: -1, right: 18,
                  background: plan.color, color: 'white',
                  fontSize: 11, fontWeight: 700,
                  padding: '4px 12px', borderRadius: '0 0 10px 10px',
                }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>
                    {plan.name}
                  </p>
                  {isCurrent && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: plan.color,
                      background: `${plan.color}18`, padding: '2px 8px', borderRadius: 6,
                    }}>
                      Plan actual
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>
                    {plan.price}
                  </span>
                  <br />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{plan.period}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                    <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
                {plan.locked.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                    <span style={{ color: '#D4C4B8', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✕</span>
                    <span style={{ fontSize: 13, color: '#D4C4B8', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleChoose(plan.id)}
                disabled={plan.disabled || isCurrent || isLoading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  fontWeight: 700, fontSize: 14,
                  cursor: (plan.disabled || isCurrent) ? 'default' : 'pointer',
                  background: isCurrent || plan.disabled
                    ? '#EDE5D8'
                    : `linear-gradient(135deg, ${plan.color}, ${plan.color}CC)`,
                  color: isCurrent || plan.disabled ? '#9CA3AF' : 'white',
                  boxShadow: !plan.disabled && !isCurrent ? `0 6px 20px ${plan.color}44` : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {isLoading ? 'Redirigiendo...' : isCurrent ? 'Plan actual' : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* Checkout error */}
      {checkoutError && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 14 }}>
          <p style={{ fontSize: 13, color: '#D63031', margin: 0 }}>⚠ {checkoutError}</p>
        </div>
      )}

      {/* Trust badges */}
      <div style={{ margin: '28px 16px 0', display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
        {[['🔒', 'Pago seguro'], ['↩', 'Cancela cuando quieras'], ['💳', 'Powered by Stripe']].map(([icon, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{ padding: '32px 16px 0' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 16, paddingLeft: 4 }}>
          Preguntas frecuentes
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQ.map((item, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE5D8', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12,
                  padding: '14px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.4 }}>
                  {item.q}
                </span>
                <span style={{
                  color: '#4A7C59', fontSize: 18, flexShrink: 0,
                  display: 'inline-block',
                  transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }}>
                  ⌄
                </span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 16px 14px' }}>
                  <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
