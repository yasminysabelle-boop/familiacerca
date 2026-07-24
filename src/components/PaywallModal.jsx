import { useNavigate } from 'react-router-dom'

export default function PaywallModal({ onClose, patientName }) {
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
        maxWidth: 340, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 20, fontWeight: 700,
          color: '#1A1A1A', margin: '0 0 10px',
        }}>
          Tu prueba gratuita ha terminado
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>
          Actualiza tu plan para seguir cuidando a{' '}
          <strong style={{ color: '#1A1A1A' }}>{patientName || 'tu familiar'}</strong>{' '}
          sin interrupciones.
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
          Más tarde
        </button>
      </div>
    </div>
  )
}
