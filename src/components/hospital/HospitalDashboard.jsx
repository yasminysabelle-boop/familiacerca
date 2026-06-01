import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import { useAuth } from '../../contexts/AuthContext'
import HospitalBanner from './HospitalBanner'
import HospitalInfoCard from './HospitalInfoCard'
import PatientStatusCard from './PatientStatusCard'
import DoctorNotesCard from './DoctorNotesCard'
import DischargeDateCard from './DischargeDateCard'
import MedicationsPausedCard from './MedicationsPausedCard'

export default function HospitalDashboard({ onManageMode, onSOS, onVideoCall }) {
  const { deactivateHospitalMode } = useHospitalMode()
  const { user } = useAuth()
  const [deactivating, setDeactivating] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')

  async function handleDeactivate() {
    setDeactivating(true)
    setDeactivateError('')
    try {
      const name = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
      const { error } = await deactivateHospitalMode(name)
      if (error) throw error
      setConfirmDeactivate(false)
    } catch {
      setDeactivateError('No se pudo desactivar. Verifica tu conexión.')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      backgroundColor: '#F0EDE6', overflowY: 'auto',
      padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>

      {/* 1. Banner rojo con estado global */}
      <HospitalBanner onManage={onManageMode} />

      {/* 2. Tarjeta principal — info hospitalaria editable */}
      <HospitalInfoCard />

      {/* ── Tarjeta secundaria ─────────────────────────────── */}

      {/* 3. Medicamentos activos (pausados) */}
      <MedicationsPausedCard />

      {/* 4. Notas médicas */}
      <DoctorNotesCard />

      {/* 5. Próxima evaluación / fecha de alta */}
      <DischargeDateCard />

      {/* ── Comunicación ──────────────────────────────────── */}

      {/* 6. Chat familiar */}
      <QuickLink
        to="/chat"
        emoji="💬"
        title="Chat familiar"
        subtitle="Mantente comunicado con el equipo"
        color="#4A7C59"
        bg="#F0F9F4"
        border="#BBF7D0"
      />

      {/* 7. Videollamada */}
      <button
        onClick={onVideoCall}
        style={{
          width: '100%', background: 'white', borderRadius: 16, padding: '16px 18px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0EDE6',
          cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <span style={{ fontSize: 28, flexShrink: 0 }}>📹</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Videollamadas</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>Programar o unirse a la sala familiar</p>
        </div>
        <span style={{ color: '#4A7C59', fontSize: 18, flexShrink: 0 }}>›</span>
      </button>

      {/* ── Emergencia ────────────────────────────────────── */}

      {/* 8. SOS */}
      <button
        onClick={onSOS}
        style={{
          width: '100%', padding: '18px', borderRadius: 16,
          border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #B91C1C, #EF4444)',
          boxShadow: '0 4px 20px rgba(185,28,28,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}
      >
        <span style={{ fontSize: 28 }}>🚨</span>
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white' }}>SOS — Emergencia</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            Notifica a todo el equipo de inmediato
          </p>
        </div>
      </button>

      {/* 9. Desactivar Modo Hospital */}
      {!confirmDeactivate ? (
        <button
          onClick={() => setConfirmDeactivate(true)}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            border: '2px solid #DC2626', background: 'white',
            color: '#DC2626', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Desactivar Modo Hospital
        </button>
      ) : (
        <div style={{
          borderRadius: 16, border: '2px solid #B91C1C',
          background: '#FFF5F5', padding: '18px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: '#B91C1C', fontWeight: 700, textAlign: 'center' }}>
            ¿Confirmar alta hospitalaria?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 1.5 }}>
            Los medicamentos y rutinas se reanudan. El equipo será notificado.
          </p>
          {deactivateError && (
            <p style={{ margin: 0, fontSize: 12, color: '#DC2626', textAlign: 'center', fontWeight: 600 }}>
              ⚠ {deactivateError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setConfirmDeactivate(false)}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                border: '1.5px solid #EDE5D8', background: 'white',
                color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                border: 'none',
                background: deactivating ? '#9CA3AF' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: deactivating ? 'default' : 'pointer',
                boxShadow: deactivating ? 'none' : '0 4px 14px rgba(74,124,89,0.3)',
              }}
            >
              {deactivating ? 'Desactivando...' : '✅ Confirmar alta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function QuickLink({ to, emoji, title, subtitle, color, bg, border }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 16, textDecoration: 'none',
        background: bg, border: `1px solid ${border}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>{subtitle}</p>
      </div>
      <span style={{ color: color, fontSize: 18, flexShrink: 0 }}>›</span>
    </Link>
  )
}
