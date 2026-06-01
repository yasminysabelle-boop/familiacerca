import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import { useAuth } from '../../contexts/AuthContext'
import VoiceInput from '../VoiceInput'

/**
 * Modal para activar o gestionar el Modo Hospital.
 * Props:
 *   open      boolean
 *   onClose   fn()
 */
export default function HospitalModeModal({ open, onClose }) {
  const { isHospitalMode, hospitalMode, activateHospitalMode, deactivateHospitalMode, updateHospitalMode } = useHospitalMode()
  const { user } = useAuth()
  const [hospitalName, setHospitalName] = useState(hospitalMode?.hospital_name ?? '')
  const [roomNumber, setRoomNumber] = useState(hospitalMode?.room_number ?? '')
  const [treatingDoctor, setTreatingDoctor] = useState(hospitalMode?.treating_doctor ?? '')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('main') // 'main' | 'confirmDeactivate'

  if (!open) return null

  const activatedByName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  async function handleActivate() {
    setSaving(true)
    await activateHospitalMode({ hospitalName, roomNumber, treatingDoctor, activatedByName })
    setSaving(false)
    onClose()
  }

  async function handleDeactivate() {
    setSaving(true)
    await deactivateHospitalMode(activatedByName)
    setSaving(false)
    setStep('main')
    onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 100000,
        maxWidth: 480, margin: '0 auto',
        maxHeight: 'calc(90vh - env(safe-area-inset-bottom))',
        overflowY: 'auto',
        background: 'white', borderRadius: '24px 24px 0 0',
        padding: '28px 24px calc(80px + env(safe-area-inset-bottom))',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🏥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif' }}>
                Modo Hospital
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>
                {isHospitalMode ? 'Activo — el equipo está en alerta' : 'Activa cuando el paciente esté hospitalizado'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: '#F3F4F6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#6B7280', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* — Confirm deactivate step — */}
        {step === 'confirmDeactivate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: '16px', borderRadius: 14,
              background: '#FFF7ED', border: '1px solid #FDE68A',
            }}>
              <p style={{ margin: 0, fontSize: 14, color: '#92400E', lineHeight: 1.6 }}>
                Al desactivar el Modo Hospital, los medicamentos y rutinas se reanudan y se notifica a todo el equipo.
              </p>
            </div>
            <button
              onClick={handleDeactivate}
              disabled={saving}
              style={{
                padding: '14px', borderRadius: 14, border: 'none',
                background: '#4A7C59', color: 'white',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              {saving ? 'Desactivando...' : '✅ Sí, desactivar Modo Hospital'}
            </button>
            <button
              onClick={() => setStep('main')}
              style={{
                padding: '13px', borderRadius: 14,
                border: '1px solid #EDE5D8', background: 'white',
                color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* — Main step — */}
        {step === 'main' && !isHospitalMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: '#FFF0F0', border: '1px solid #FFBABA',
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
                Al activar: se pausa la rutina normal, se reorganiza el dashboard por prioridad y se notifica a todos.
              </p>
            </div>

            <VoiceInput
              value={hospitalName}
              onChange={setHospitalName}
              placeholder="Nombre del hospital (opcional)"
              rows={1}
              label="Hospital"
            />
            <VoiceInput
              value={roomNumber}
              onChange={setRoomNumber}
              placeholder="Número de habitación (opcional)"
              rows={1}
              label="Habitación"
            />
            <VoiceInput
              value={treatingDoctor}
              onChange={setTreatingDoctor}
              placeholder="Médico tratante (opcional)"
              rows={1}
              label="Médico tratante"
            />

            <button
              onClick={handleActivate}
              disabled={saving}
              style={{
                padding: '16px', borderRadius: 16, border: 'none',
                background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #B91C1C, #DC2626)',
                color: 'white', fontWeight: 800, fontSize: 15,
                cursor: saving ? 'default' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 20px rgba(185,28,28,0.35)',
              }}
            >
              {saving ? 'Activando...' : '🏥 Activar Modo Hospital'}
            </button>
          </div>
        )}

        {/* — Manage mode (already active) — */}
        {step === 'main' && isHospitalMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Info box */}
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(185,28,28,0.08), rgba(220,38,38,0.05))',
              border: '1px solid rgba(185,28,28,0.2)',
            }}>
              {hospitalMode?.hospital_name && (
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>
                  {hospitalMode.hospital_name}
                  {hospitalMode.room_number && ` · Hab. ${hospitalMode.room_number}`}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                Activado por {hospitalMode?.activated_by_name ?? 'el equipo'}
              </p>
            </div>

            {/* Update fields */}
            <VoiceInput
              value={hospitalName}
              onChange={setHospitalName}
              placeholder="Nombre del hospital"
              rows={1}
              label="Hospital"
            />
            <VoiceInput
              value={roomNumber}
              onChange={setRoomNumber}
              placeholder="Habitación"
              rows={1}
              label="Habitación"
            />
            <VoiceInput
              value={treatingDoctor}
              onChange={setTreatingDoctor}
              placeholder="Médico tratante"
              rows={1}
              label="Médico tratante"
            />

            <button
              onClick={async () => {
                setSaving(true)
                await updateHospitalMode({ hospital_name: hospitalName, room_number: roomNumber, treating_doctor: treatingDoctor })
                setSaving(false)
                onClose()
              }}
              disabled={saving}
              style={{
                padding: '13px', borderRadius: 14, border: 'none',
                background: '#4A7C59', color: 'white',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Actualizar información
            </button>

            <button
              onClick={() => setStep('confirmDeactivate')}
              style={{
                padding: '13px', borderRadius: 14,
                border: '1.5px solid #DC2626', background: 'white',
                color: '#DC2626', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Desactivar Modo Hospital
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
