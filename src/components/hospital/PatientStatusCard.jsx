import { useEffect, useState } from 'react'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import { useFamily } from '../../contexts/FamilyContext'
import VoiceInput from '../VoiceInput'

export default function PatientStatusCard() {
  const { hospitalMode, updateHospitalMode } = useHospitalMode()
  const { activePatientName } = useFamily()
  const patientName = activePatientName ? activePatientName.split(' ')[0] : 'tu familiar'
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync when hospitalMode loads or changes from another device via Realtime
  useEffect(() => {
    if (!saving) setText(hospitalMode?.patient_status ?? '')
  }, [hospitalMode?.patient_status])

  async function handleSave() {
    setSaving(true)
    await updateHospitalMode({ patient_status: text.trim() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid #F8F4ED',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🩺</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
          Estado de {patientName}
        </h3>
        {saved && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#0d6b63', fontWeight: 700,
          }}>
            ✓ Guardado
          </span>
        )}
      </div>

      {/* Último estado guardado */}
      {hospitalMode?.patient_status && text === hospitalMode.patient_status && !saving && (
        <div style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: '#F0F9F4',
          border: '1px solid #BBF7D0',
          marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#1A5C35', lineHeight: 1.5 }}>
            {hospitalMode.patient_status}
          </p>
        </div>
      )}

      <VoiceInput
        value={text}
        onChange={setText}
        placeholder={`Describe cómo está ${patientName}... (toca el micrófono para dictar)`}
        rows={3}
        label="Actualizar estado"
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
