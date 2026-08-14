import { useNavigate } from 'react-router-dom'

// Mensaje único al expirar el trial — reemplaza el paywall global que antes
// vivía en Layout.jsx. Se muestra una sola vez (persistido en
// subscriptions.trial_ended_seen_at, ver BillingAccountContext), nunca se
// repite en cada recarga/pestaña/dispositivo. Informa qué cambió y qué se
// conserva — no es un cobro. Los bloqueos reales pasan en contexto
// (Familia, Historial, Gastos), no acá.
export default function TrialEndedNotice({ onClose }) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'white', borderRadius: 24, padding: '32px 24px',
        maxWidth: 360, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>💚</div>
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 19, fontWeight: 700,
          color: '#1A1A1A', margin: '0 0 16px', lineHeight: 1.3,
        }}>
          Tu prueba terminó — ahora estás en el plan Gratis
        </h2>
        <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 12px', textAlign: 'left' }}>
          <strong style={{ color: '#1A1A1A' }}>Conservás:</strong> Milo y Luna, tu
          checklist diario, medicamentos, historial de 7 días y un equipo de 2
          personas.
        </p>
        <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 22px', textAlign: 'left' }}>
          <strong style={{ color: '#1A1A1A' }}>Con Familiar sumás:</strong> alertas
          si una dosis no aparece registrada, hasta 6 cuidadores, historial de
          90 días y gastos de cuidado.
        </p>
        <button
          onClick={() => { navigate('/upgrade'); onClose() }}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: '#087F70',
            color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(8,127,112,0.3)', marginBottom: 10,
          }}
        >
          Ver planes →
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: '1.5px solid #EDE5D8', background: 'white',
            color: '#9CA3AF', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
