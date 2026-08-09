import { useEffect, useState } from 'react'
import { useHospitalMode } from '../../contexts/HospitalModeContext'
import { useFamily } from '../../contexts/FamilyContext'

const fieldStyle = {
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: '1.5px solid #FECACA', background: '#FFF5F5',
  fontSize: 14, color: '#1A1A1A', boxSizing: 'border-box',
  outline: 'none', transition: 'border-color 0.15s',
}
const onFocus = e => { e.target.style.borderColor = '#B91C1C'; e.target.style.boxShadow = '0 0 0 3px rgba(185,28,28,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#FECACA'; e.target.style.boxShadow = 'none' }

function fmtUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('es-MX', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function HospitalInfoCard() {
  const { hospitalMode, updateHospitalMode } = useHospitalMode()
  const { activePatientName } = useFamily()
  const patientName = activePatientName ? activePatientName.split(' ')[0] : 'tu familiar'
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    hospital_name:  '',
    room_number:    '',
    treating_doctor: '',
    patient_status: '',
  })

  useEffect(() => {
    if (!editing) {
      setForm({
        hospital_name:   hospitalMode?.hospital_name   ?? '',
        room_number:     hospitalMode?.room_number      ?? '',
        treating_doctor: hospitalMode?.treating_doctor  ?? '',
        patient_status:  hospitalMode?.patient_status   ?? '',
      })
    }
  }, [hospitalMode, editing])

  function change(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    await updateHospitalMode({
      hospital_name:   form.hospital_name.trim()   || null,
      room_number:     form.room_number.trim()      || null,
      treating_doctor: form.treating_doctor.trim()  || null,
      patient_status:  form.patient_status.trim()   || null,
    })
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2500)
  }

  const updatedAt = fmtUpdated(hospitalMode?.updated_at ?? hospitalMode?.activated_at)

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF0F0 100%)',
      borderRadius: 18,
      border: '1.5px solid #FECACA',
      padding: '18px 20px',
      boxShadow: '0 4px 20px rgba(185,28,28,0.08)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 800,
          color: '#B91C1C', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Información hospitalaria
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved && (
            <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>✓ Guardado</span>
          )}
          <button
            onClick={() => { setEditing(e => !e); setSaved(false) }}
            style={{
              padding: '5px 14px', borderRadius: 8,
              border: '1.5px solid #FECACA', background: editing ? '#FEE2E2' : 'white',
              color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </div>

      {/* Display mode */}
      {!editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InfoRow icon="🏥" label="Hospital"
            value={hospitalMode?.hospital_name ?? 'Sin registrar'} />
          <InfoRow icon="🛏️" label="Habitación"
            value={hospitalMode?.room_number ?? 'Sin registrar'} />
          <InfoRow icon="👨‍⚕️" label="Médico tratante"
            value={hospitalMode?.treating_doctor ?? 'Sin registrar'} />
          <InfoRow icon="📋" label="Estado"
            value={hospitalMode?.patient_status ?? 'Sin registrar'}
            multiline />
          {updatedAt && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
              Actualizado: {updatedAt}
            </p>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="🏥 Hospital" value={form.hospital_name}
            onChange={v => change('hospital_name', v)}
            placeholder="Nombre del hospital" />
          <Field label="🛏️ Habitación" value={form.room_number}
            onChange={v => change('room_number', v)}
            placeholder="Número o nombre de la habitación" />
          <Field label="👨‍⚕️ Médico tratante" value={form.treating_doctor}
            onChange={v => change('treating_doctor', v)}
            placeholder="Nombre del médico" />
          <Field label={`📋 Estado de ${patientName}`} value={form.patient_status}
            onChange={v => change('patient_status', v)}
            placeholder="Ej: En observación, Post-operatorio..."
            multiline />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '13px', borderRadius: 12, border: 'none', marginTop: 4,
              background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #B91C1C, #DC2626)',
              color: 'white', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(185,28,28,0.3)',
            }}
          >
            {saving ? 'Guardando...' : 'Guardar información'}
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value, multiline }) {
  const empty = !value || value === 'Sin registrar'
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: multiline ? 'flex-start' : 'center' }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: multiline ? 1 : 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: 14, fontWeight: empty ? 400 : 600,
          color: empty ? '#D1D5DB' : '#1A1A1A',
          lineHeight: 1.5, fontStyle: empty ? 'italic' : 'normal',
        }}>
          {value}
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multiline }) {
  if (multiline) return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#B91C1C', marginBottom: 5, letterSpacing: '0.04em' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ ...fieldStyle, resize: 'vertical' }}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  )
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#B91C1C', marginBottom: 5, letterSpacing: '0.04em' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={fieldStyle}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  )
}
