import { useHospitalMode } from '../../contexts/HospitalModeContext'

export default function HospitalBanner({ onManage }) {
  const { hospitalMode } = useHospitalMode()
  if (!hospitalMode?.active) return null

  const activatedAt = hospitalMode.activated_at
    ? new Date(hospitalMode.activated_at).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)',
      padding: '16px 20px',
      borderRadius: 16,
      color: 'white',
      boxShadow: '0 4px 20px rgba(185,28,28,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🏥</span>
            <span style={{
              fontSize: 17, fontWeight: 800,
              fontFamily: 'Georgia, serif', letterSpacing: '-0.3px',
            }}>
              Modo Hospital Activo
            </span>
          </div>

          {hospitalMode.hospital_name && (
            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, opacity: 0.95 }}>
              {hospitalMode.hospital_name}
              {hospitalMode.room_number && ` · Hab. ${hospitalMode.room_number}`}
            </p>
          )}

          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>
            {hospitalMode.activated_by_name
              ? `Activado por ${hospitalMode.activated_by_name}`
              : 'Modo hospital en curso'}
            {activatedAt && ` · ${activatedAt}`}
          </p>
        </div>

        {onManage && (
          <button
            onClick={onManage}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1.5px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Gestionar
          </button>
        )}
      </div>

      {/* Pulse indicator */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'white',
          animation: 'hbPulse 2s ease-in-out infinite',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 11, opacity: 0.85 }}>
          Medicamentos y rutinas pausados · El equipo fue notificado
        </span>
      </div>

      <style>{`
        @keyframes hbPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
