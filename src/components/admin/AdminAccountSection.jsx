import { useNavigate } from 'react-router-dom'
import { useBillingAccount } from '../../contexts/BillingAccountContext'

const PLAN_META = {
  free:      { label: 'Gratis',        color: '#9CA3AF', icon: '🌱', features: ['2 cuidadores', 'Chat familiar', 'Medicamentos básicos', 'Historial 7 días'] },
  familiar:  { label: 'Plan Familiar',   color: '#087F70', icon: '❤️', features: ['6 cuidadores', 'Recordatorios automáticos', 'Notas de voz', 'Foto-prueba', 'Reportes PDF', 'Álbum familiar', 'Gastos de cuidado', 'Historial 90 días'] },
  care_plus: { label: 'Cuidado Total',   color: '#7C3AED', icon: '⭐', features: ['Cuidadores ilimitados', 'Alertas SOS prioritarias', 'Reporte semanal IA', 'Historial indefinido', 'Soporte prioritario'] },
}

const STATUS_LABEL = {
  trial:     'Período de prueba',
  active:    'Activa',
  expired:   'Prueba expirada',
  cancelled: 'Cancelada',
}

export default function AdminAccountSection() {
  // useBillingAccount() a propósito, no useFamilyPlan(): esta sección solo
  // se monta dentro de /admin, que ya está gateado a nivel de ruta a
  // memberRole === null && ownerId === user?.id (el dueño de la familia,
  // ver Admin.jsx) -- quien la ve SIEMPRE es el dueño, así que su cuenta de
  // facturación propia y el plan de la familia son la misma fila. Migrarla
  // rompería el botón de cancelar/gestionar suscripción (acciones sobre la
  // propia fila en `subscriptions`, no sobre la de otro).
  const { sub, isPaid, isTrialing, daysLeft, trialExpired } = useBillingAccount()
  const navigate = useNavigate()

  const meta = PLAN_META[sub?.plan ?? 'free']

  if (!sub) return <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: 24 }}>Cargando suscripción...</p>

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const trialEnd = sub.trial_end_date
    ? new Date(sub.trial_end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Plan card */}
      <div style={{
        borderRadius: 16, padding: '18px',
        background: `linear-gradient(135deg, ${meta.color}10, ${meta.color}06)`,
        border: `1.5px solid ${meta.color}25`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: meta.color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>{meta.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{meta.label}</p>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: meta.color + '18', color: meta.color,
              }}>
                {STATUS_LABEL[sub.status] ?? sub.status}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: trialExpired ? '#DC2626' : daysLeft <= 3 ? '#DC2626' : '#6B7280' }}>
              {isTrialing && `⏳ ${daysLeft} día${daysLeft !== 1 ? 's' : ''} de prueba${trialEnd ? ` · Vence ${trialEnd}` : ''}`}
              {isPaid && periodEnd && `Próximo cobro: ${periodEnd}`}
              {trialExpired && '⚠ Prueba expirada — activa un plan'}
              {sub.status === 'cancelled' && 'Suscripción cancelada'}
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {meta.features.map(f => (
            <span key={f} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              background: 'white', border: `1px solid ${meta.color}25`,
              color: '#374151', fontWeight: 500,
            }}>
              ✓ {f}
            </span>
          ))}
        </div>
      </div>

      {/* Subscription management */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE5D8', overflow: 'hidden' }}>
        <button
          onClick={() => navigate('/ajustes')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', background: 'none', border: 'none',
            borderBottom: '1px solid #F5F0EA', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>💳</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
              Gestionar suscripción
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9CA3AF' }}>
              Ver plan activo, próximo cobro, cancelar
            </p>
          </div>
          <span style={{ color: '#D1D5DB', fontSize: 18, flexShrink: 0 }}>›</span>
        </button>

        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
            Los pagos se procesan de forma segura a través de PayPal.
          </p>
        </div>
      </div>

      {/* Upgrade CTA for free/expired */}
      {(trialExpired || sub.plan === 'free') && (
        <button
          onClick={() => navigate('/upgrade')}
          style={{
            padding: '14px', borderRadius: 14, border: 'none',
            background: '#087F70',
            color: 'white', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(8,127,112,0.3)',
          }}
        >
          ⭐ Ver planes y precios
        </button>
      )}
    </div>
  )
}
