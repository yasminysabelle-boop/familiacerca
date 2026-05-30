import { useState } from 'react'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VoiceInput from '../VoiceInput'

export default function PatientStatusCard() {
  const { hospitalMode, updateHospitalMode } = useHospitalMode()
  const { user } = useAuth()
  const [text, setText] = useState(hospitalMode?.patient_status ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
      border: '1px solid #F0EDE6',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🩺</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
          Estado del paciente
        </h3>
        {saved && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#4A7C59', fontWeight: 700,
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
        placeholder="Describe cómo está el paciente... (toca el micrófono para dictar)"
        rows={3}
        label="Actualizar estado"
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
