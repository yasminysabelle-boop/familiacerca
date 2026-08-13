import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Alertas de paypal-webhook cuando un evento de PayPal no se pudo
// correlacionar con ninguna fila de subscriptions -- un pago que quedó "en
// el aire". Solo staff interno llega acá (RLS en payment_alerts ya lo exige
// además del gate de UI en Admin.jsx, doble candado).
export default function AdminPaymentAlertsSection() {
  const [alerts, setAlerts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('payment_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError('No se pudieron cargar las alertas.'); return }
        setAlerts(data ?? [])
      })
  }, [])

  if (error) return <p style={{ color: '#DC2626', fontSize: 14, textAlign: 'center', padding: 24 }}>{error}</p>
  if (alerts === null) return <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: 24 }}>Cargando alertas...</p>

  if (alerts.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Sin alertas</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>
          Todos los pagos de PayPal se correlacionaron con una cuenta.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 4px' }}>
        Pagos de PayPal que no se pudieron correlacionar con ninguna cuenta.
      </p>
      {alerts.map(a => (
        <div key={a.id} style={{
          background: 'white', borderRadius: 14, border: '1.5px solid #FECACA',
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{a.event_type}</p>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#374151' }}>{a.detail}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
            {fmt(a.created_at)}
            {a.paypal_subscription_id && <> · suscripción: {a.paypal_subscription_id}</>}
            {a.custom_id && <> · custom_id: {a.custom_id}</>}
          </p>
        </div>
      ))}
    </div>
  )
}
