import { useEffect, useState } from 'react'
import { useHospitalMode } from '../../contexts/HospitalModeContext'

export default function DischargeDateCard() {
  const { hospitalMode, updateHospitalMode } = useHospitalMode()
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync when hospitalMode loads or changes from another device via Realtime
  useEffect(() => {
    if (!editing) setDate(hospitalMode?.discharge_date ?? '')
  }, [hospitalMode?.discharge_date])

  function fmtDate(d) {
    if (!d) return null
    const parsed = new Date(d + 'T12:00:00')
    return parsed.toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function daysLeft(d) {
    if (!d) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d + 'T12:00:00')
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}`
    if (diff === 0) return '¡hoy!'
    return `en ${diff} día${diff !== 1 ? 's' : ''}`
  }

  async function handleSave() {
    setSaving(true)
    await updateHospitalMode({ discharge_date: date || null })
    setSaving(false)
    setEditing(false)
  }

  const displayDate = hospitalMode?.discharge_date
  const formatted = fmtDate(displayDate)
  const remaining = daysLeft(displayDate)

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid #F0EDE6',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🗓️</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A', flex: 1 }}>
          Fecha de alta estimada
        </h3>
        <button
          onClick={() => setEditing(e => !e)}
          style={{
            padding: '5px 12px', borderRadius: 8, border: '1px solid #D1C9BF',
            background: 'white', color: '#4A7C59', fontSize: 12,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          {editing ? 'Cancelar' : (displayDate ? 'Cambiar' : 'Agregar')}
        </button>
      </div>

      {!editing && displayDate && (
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
          border: '1px solid #BFDBFE',
        }}>
          <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#1E40AF' }}>
            {formatted}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#3B82F6', fontWeight: 600 }}>
            Alta estimada {remaining}
          </p>
        </div>
      )}

      {!editing && !displayDate && (
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '6px 0' }}>
          Sin fecha estimada aún
        </p>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Fecha de alta
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid #D1C9BF', fontSize: 14, color: '#1A1A1A',
                background: 'white', boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              alignSelf: 'flex-end', padding: '8px 20px', borderRadius: 10,
              border: 'none', background: '#4A7C59', color: 'white',
              fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )
}
