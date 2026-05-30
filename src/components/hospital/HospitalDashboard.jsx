import { Link } from 'react-router-dom'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import HospitalBanner from './HospitalBanner'
import PatientStatusCard from './PatientStatusCard'
import DoctorNotesCard from './DoctorNotesCard'
import HospitalVisitsCard from './HospitalVisitsCard'
import HospitalDocumentsCard from './HospitalDocumentsCard'
import DischargeDateCard from './DischargeDateCard'
import MedicationsPausedCard from './MedicationsPausedCard'

export default function HospitalDashboard({ onManageMode, onSOS, onVideoCall }) {
  const { hospitalMode } = useHospitalMode()

  return (
    <div style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* 1. Banner rojo */}
      <HospitalBanner onManage={onManageMode} />

      {/* 2. Estado del paciente */}
      <PatientStatusCard />

      {/* 3. Notas del médico */}
      <DoctorNotesCard />

      {/* 4. Quién visita hoy */}
      <HospitalVisitsCard />

      {/* 5. Documentos */}
      <HospitalDocumentsCard />

      {/* 6. Fecha de alta */}
      <DischargeDateCard />

      {/* 7. Chat familiar */}
      <QuickLink
        to="/chat"
        emoji="💬"
        title="Chat familiar"
        subtitle="Mantente comunicado con el equipo"
        color="#4A7C59"
        bg="#F0F9F4"
        border="#BBF7D0"
      />

      {/* 8. Videollamadas */}
      <VideoCallCard onOpen={onVideoCall} />

      {/* 9. Cuentas claras */}
      <QuickLink
        to="/gastos"
        emoji="💰"
        title="Cuentas claras"
        subtitle="Gastos del hospital y medicamentos"
        color="#C9882A"
        bg="#FFFBEB"
        border="#FDE68A"
      />

      {/* 10. SOS */}
      <SOSCard onSOS={onSOS} />

      {/* 11. Medicamentos pausados */}
      <MedicationsPausedCard />
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

function VideoCallCard({ onOpen }) {
  return (
    <button
      onClick={onOpen}
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
  )
}

function SOSCard({ onSOS }) {
  return (
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
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white' }}>
          SOS — Emergencia
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
          Notifica a todo el equipo de inmediato
        </p>
      </div>
    </button>
  )
}
