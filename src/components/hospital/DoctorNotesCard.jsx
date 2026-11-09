import { useEffect, useState } from 'react'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import VoiceInput from '../VoiceInput'

export default function DoctorNotesCard() {
  const { hospitalMode, updateHospitalMode } = useHospitalMode()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync when hospitalMode loads or changes from another device via Realtime
  useEffect(() => {
    if (!saving) setText(hospitalMode?.doctor_notes ?? '')
  }, [hospitalMode?.doctor_notes])

  async function handleSave() {
    setSaving(true)
    await updateHospitalMode({ doctor_notes: text.trim() })
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
      border: '1px solid #F7F6F2',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#14303D' }}>
          Notas del médico
        </h3>
        {saved && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0A5A82', fontWeight: 700 }}>
            ✓ Guardado
          </span>
        )}
      </div>

      {hospitalMode?.doctor_notes && text === hospitalMode.doctor_notes && !saving && (
        <div style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
            {hospitalMode.doctor_notes}
          </p>
        </div>
      )}

      <VoiceInput
        value={text}
        onChange={setText}
        placeholder="Lo que dijo el médico, indicaciones, diagnóstico... (toca el micrófono)"
        rows={3}
        label="Agregar nota médica"
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
