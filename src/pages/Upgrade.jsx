import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useBillingAccount } from '../contexts/BillingAccountContext'
import Layout from '../components/Layout'
import { PAYPAL_PLAN_IDS } from '../config/paypalPlans'

const PAYPAL_OPTIONS = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
  intent: 'subscription',
  vault: true,
  currency: 'USD',
  components: 'buttons',
}

// El cliente nunca escribe `plan`/`status` en `subscriptions` -- ni con una
// policy de RLS nueva (mismo argumento que `care_complexity`: abriria la
// puerta a que cualquiera se ponga plan='care_plus' por REST). La unica
// fuente confiable de que el pago ocurrio es el webhook de PayPal
// (paypal-webhook, service role). onApprove() solo espera a que esa fila
// cambie -- ver project_familiacerca_paypal_payment_broken en memoria.
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 20000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback para navegadores/webviews sin Clipboard API sobre contexto
    // no del todo estandar -- poco comun en HTTPS moderno, pero mas barato
    // cubrirlo aca que dejar el boton mudo en algun dispositivo raro.
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}

function CopyableSubscriptionId({ subscriptionId }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(subscriptionId)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', gap: 8, padding: '10px 12px', marginTop: 8,
        background: '#F8F4ED', border: '1px solid #EDE5D8', borderRadius: 10,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{
        fontFamily: 'monospace', fontSize: 12.5, color: '#374151',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {subscriptionId}
      </span>
      <span style={{
        flexShrink: 0, fontSize: 11.5, fontWeight: 700,
        color: copied ? '#087F70' : '#9CA3AF',
      }}>
        {copied ? 'Copiado ✓' : 'Copiar'}
      </span>
    </button>
  )
}

const FREE_FEATURES = [
  'Hasta 2 cuidadores',
  '1 paciente',
  'Chat familiar',
  'Medicamentos básicos (manual)',
  'Checklist de cuidado diario',
  'Historial 7 días',
  'Síntomas físicos básicos',
]

const FAMILIAR_FEATURES = [
  'Hasta 6 cuidadores',
  'Medicamentos con OCR (foto)',
  'Videollamadas integradas',
  'Milo & Luna IA 🐶🐱',
  'Rutinas por período (mañana/tarde/noche)',
  'Notas con evidencia fotográfica',
  'Rastreo GPS en notas',
  'Indicadores de presencia del equipo',
  'Gastos de cuidado',
  'Historial de 90 días',
  'Todo lo del Plan Gratis',
]

const TOTAL_FEATURES = [
  'Cuidadores ilimitados',
  'Hospital Mode (pantalla completa dedicada)',
  'Gastos de cuidado',
  'Reporte médico en PDF',
  'Soporte prioritario',
  'Historial ilimitado',
  'Todo lo del Plan Familiar',
]

function PayPalSection({
  planKey, paypalPlanId, userId, success, pending, timedOut, isActive,
  errors, isResolved, isRejected, onApprove, onError, onBackToSettings,
}) {
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
  if (timedOut?.planKey === planKey) {
    return (
      <div style={{
        background: '#F8F4ED', border: '1.5px solid #E9826E',
        borderRadius: 14, padding: '16px',
      }}>
        <p style={{ color: '#087F70', fontWeight: 700, fontSize: 15, margin: '0 0 4px', lineHeight: 1.4 }}>
          ✅ Tu pago se completó en PayPal.
        </p>
        <p style={{ color: '#374151', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
          Estamos activando tu plan — puede tardar unos minutos.
        </p>
        <p style={{ color: '#6B7280', fontSize: 12.5, margin: '0 0 4px', lineHeight: 1.5 }}>
          Si al volver no ves el cambio, escribinos a <strong>hola@familiacerca.com</strong> con este número:
        </p>
        <CopyableSubscriptionId subscriptionId={timedOut.subscriptionId} />
        <button
          onClick={onBackToSettings}
          style={{
            width: '100%', marginTop: 12, padding: '11px', borderRadius: 12,
            border: 'none', background: '#087F70', color: 'white',
            fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Volver a Ajustes
        </button>
      </div>
    )
  }
  if (pending?.planKey === planKey) {
    return (
      <div style={{
        background: '#E0F0EF', border: '1.5px solid #0B4F4A',
        borderRadius: 14, padding: '16px', textAlign: 'center',
      }}>
        <p style={{ color: '#0B4F4A', fontWeight: 700, fontSize: 14, margin: 0 }}>
          Confirmando tu pago...
        </p>
        <p style={{ color: '#3A6B65', fontSize: 12.5, margin: '4px 0 0' }}>
          Esto suele tardar unos segundos.
        </p>
      </div>
    )
  }
  // isActive va DESPUES de success/timedOut/pending a proposito -- esta
  // cadena de if es la unica fuente de verdad sobre que se muestra para
  // este plan. Antes esta decision estaba partida entre este componente y
  // un ternario externo en UpgradeContent (activePlan === planKey ? boton
  // : <PayPalSection/>), que decidia si PayPalSection llegaba a montarse
  // ANTES de que este componente pudiera revisar success/pending/timedOut.
  // Eso dejaba el resultado a merced de una carrera: el poll que confirma
  // el pago llama a refresh() (setSub, que mueve activePlan) ANTES de
  // llamar a setSuccess() -- asi que el re-render con activePlan ya en
  // 'familiar'/'care_plus' pero success todavia null caia en la rama del
  // boton "Tu plan actual" del ternario externo, desmontando
  // PayPalSection para siempre en ese plan. setSuccess() llegaba un
  // instante despues, pero ya no habia donde mostrarlo -- el usuario
  // nunca veia "Plan activado", solo la redireccion 2s despues. Con la
  // prioridad viviendo aca, como orden de if en un solo lugar, los
  // estados transitorios ganan siempre mientras esten puestos, sin
  // importar en que orden lleguen los setState.
  if (isActive) {
    return (
      <button disabled style={{
        width: '100%', padding: '13px', borderRadius: 14, border: 'none',
        background: '#E5E7EB', color: '#9CA3AF',
        fontWeight: 600, fontSize: 14, cursor: 'default',
      }}>
        Tu plan actual
      </button>
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
          // custom_id -- PayPal lo devuelve en el resource de todos los
          // eventos webhook de esta suscripción. Es lo único que le permite
          // a paypal-webhook (que corre con service role, nunca al cliente)
          // saber a qué user_id de FamiliaCerca corresponde el pago, sin
          // depender de que el cliente escriba nada en `subscriptions`.
          actions.subscription.create({ plan_id: paypalPlanId, custom_id: userId })
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
  const { memberRole, ownerId, profileResolved } = useFamily()
  const isAdmin = memberRole === null && ownerId === user?.id
  const { sub, refresh } = useBillingAccount()
  const navigate = useNavigate()
  const [{ isResolved, isRejected }] = usePayPalScriptReducer()
  const [success, setSuccess] = useState(null)
  const [pending, setPending] = useState(null) // { planKey, subscriptionId } | null
  const [timedOut, setTimedOut] = useState(null) // { planKey, subscriptionId } | null
  const [errors, setErrors] = useState({})
  const mountedRef = useRef(true)
  useEffect(() => {
    // No alcanza con useRef(true) + solo cleanup -- en StrictMode (dev) React
    // monta/desmonta/remonta los effects una vez para detectar codigo no
    // idempotente, y esa simulacion deja mountedRef.current en `false` para
    // siempre si el mount real nunca lo vuelve a poner en `true` (encontrado
    // con Playwright: el loop de polling quedaba trabado en "Confirmando tu
    // pago" sin nunca resolver ni a exito ni a timeout).
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Derive active plan directly from sub row — only 'active' status with a paid plan counts
  const activePlan = (sub?.status === 'active' && (sub?.plan === 'familiar' || sub?.plan === 'care_plus'))
    ? sub.plan
    : null

  async function onApprove(planKey, data) {
    const subscriptionId = data.subscriptionID
    setErrors(prev => {
      if (!(planKey in prev)) return prev
      const next = { ...prev }
      delete next[planKey]
      return next
    })
    setTimedOut(null)
    setPending({ planKey, subscriptionId })

    // El pago ya se hizo del lado de PayPal en este punto -- lo unico que
    // esperamos es que paypal-webhook (service role, unica escritura real
    // permitida en `subscriptions`) confirme la fila. El chequeo de exito
    // corre SIEMPRE antes que el chequeo de timeout dentro de la misma
    // vuelta del loop, asi que no hay forma de que ambos disparen para el
    // mismo evento -- si el webhook llega justo en el limite, gana la
    // confirmacion.
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let activated = false
    while (mountedRef.current) {
      let fresh = null
      try {
        fresh = await refresh()
      } catch {
        // Hiccup de red en un poll -- no es el fallo del pago, seguimos intentando.
      }
      if (!mountedRef.current) return
      if (fresh?.status === 'active' && fresh?.paypal_subscription_id === subscriptionId) {
        activated = true
        break
      }
      if (Date.now() >= deadline) break
      await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())))
    }
    if (!mountedRef.current) return

    if (activated) {
      setPending(null)
      setSuccess(planKey)
      setTimeout(() => navigate('/ajustes'), 2000)
    } else {
      setPending(null)
      setTimedOut({ planKey, subscriptionId })
    }
  }

  function onError(planKey) {
    setPending(null)
    setErrors(prev => ({ ...prev, [planKey]: 'Error con PayPal. Intenta de nuevo.' }))
  }

  function onBackToSettings() {
    navigate('/ajustes')
  }

  // Hook de prueba SOLO para dev (import.meta.env.DEV es `false` en build de
  // produccion, y el bundler elimina el bloque como codigo muerto -- no
  // llega al bundle real, verificado con grep sobre dist/ despues de un
  // build). Deja arrancar el estado "procesando" sin pasar por el boton
  // real de PayPal, para poder probar el polling/timeout con Playwright sin
  // hacer un cobro real -- ver project_familiacerca_paypal_payment_broken
  // en memoria para el porque.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__fcUpgradeDebug = {
      startProcessing: (planKey, subscriptionId) => onApprove(planKey, { subscriptionID: subscriptionId }),
    }
    return () => { delete window.__fcUpgradeDebug }
  })

  const paypalProps = {
    userId: user.id, success, pending, timedOut, errors,
    isResolved, isRejected, onApprove, onError, onBackToSettings,
  }

  // Gate de RENDER, no de post-render: nunca mostramos las tarjetas de
  // planes/botones de PayPal para despues ocultarlas -- eso es el flicker
  // que se pidio evitar. `profileResolved` (de useFamily()) viene primero
  // a proposito: memberRole/ownerId caen a valores de fallback (memberRole
  // null, ownerId = user.id) ANTES de que la familia real se resuelva, lo
  // que haria a isAdmin dar true por defecto para CUALQUIERA -- el mismo
  // patron de bug ya encontrado en FamilyPlanContext, ver
  // project_familiacerca_subscription_scoped_to_viewer en memoria. Sin
  // este orden, un invitado real vería un flash de la pagina de pago
  // completa antes de que se corrija a "bloqueado".
  if (!profileResolved) {
    return <Layout><div style={{ minHeight: '60vh' }} /></Layout>
  }
  if (!isAdmin) {
    return (
      <Layout>
        <div style={{
          background: '#F8F4ED', minHeight: '100svh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
            padding: '32px 24px', textAlign: 'center', maxWidth: 340,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔒</p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              Solo quien creó la familia puede cambiar el plan.
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 20 }}>
              Si necesitas más cuidadores, historial o funciones, pídele al dueño de la familia que actualice el plan desde su cuenta.
            </p>
            <button
              onClick={() => navigate('/ajustes')}
              style={{
                padding: '11px 24px', borderRadius: 12, border: 'none',
                background: '#087F70', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              Volver a Ajustes
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ background: '#F8F4ED', minHeight: '100svh' }}>

        {/* Header */}
        <div style={{ background: '#0B4F4A', padding: '36px 24px 32px', textAlign: 'center' }}>
          <h1 style={{
            color: 'white', fontSize: 26, fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif", margin: '0 0 8px',
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
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
              {activePlan === 'familiar' ? 'Tu plan actual' : 'Recomendado para la mayoría de las familias'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
            <PayPalSection
              planKey="familiar"
              paypalPlanId={PAYPAL_PLAN_IDS.familiar}
              isActive={activePlan === 'familiar'}
              {...paypalProps}
            />
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
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
            <PayPalSection
              planKey="care_plus"
              paypalPlanId={PAYPAL_PLAN_IDS.care_plus}
              isActive={activePlan === 'care_plus'}
              {...paypalProps}
            />
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
