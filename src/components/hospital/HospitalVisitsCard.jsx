import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFamily } from '../../contexts/FamilyContext'
import { useAuth } from '../../contexts/AuthContext'
import VoiceInput from '../VoiceInput'

const TODAY = new Date().toISOString().slice(0, 10)

export default function HospitalVisitsCard() {
  const { ownerId } = useFamily()
  const { user } = useAuth()
  const [visits, setVisits] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [visitorName, setVisitorName] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!ownerId) return
    load()
  }, [ownerId])

  async function load() {
    const { data } = await supabase
      .from('hospital_visits')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('visit_date', TODAY)
      .order('visit_time', { ascending: true })
    setVisits(data ?? [])
  }

  async function addVisit() {
    if (!visitorName.trim()) return
    setSaving(true)
    setSaveError('')
    const { data, error } = await supabase
      .from('hospital_visits')
      .insert({
        owner_id: ownerId,
        visitor_name: visitorName.trim(),
        visit_date: TODAY,
        visit_time: visitTime || null,
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()
    setSaving(false)
    if (error) {
      setSaveError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    if (data) setVisits(prev => [...prev, data])
    setVisitorName('')
    setVisitTime('')
    setNotes('')
    setShowForm(false)
  }

  async function toggleConfirm(visit) {
    const { data } = await supabase
      .from('hospital_visits')
      .update({ confirmed: !visit.confirmed })
      .eq('id', visit.id)
      .select()
      .single()
    if (data) setVisits(prev => prev.map(v => v.id === data.id ? data : v))
  }

  async function removeVisit(id) {
    await supabase.from('hospital_visits').delete().eq('id', id)
    setVisits(prev => prev.filter(v => v.id !== id))
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
        <span style={{ fontSize: 20 }}>👥</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A', flex: 1 }}>
          Quién visita hoy
        </h3>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '5px 12px', borderRadius: 8, border: 'none',
            background: '#0d6b63', color: 'white', fontSize: 12,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Agregar
        </button>
      </div>

      {visits.length === 0 && !showForm && (
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>
          Nadie anotado aún para hoy
        </p>
      )}

      {/* Lista de visitas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visits.map(v => (
          <div
            key={v.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: v.confirmed ? '#F0F9F4' : '#FAFAF9',
              border: `1px solid ${v.confirmed ? '#BBF7D0' : '#E5E0D8'}`,
            }}
          >
            <button
              onClick={() => toggleConfirm(v)}
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${v.confirmed ? '#0d6b63' : '#D1C9BF'}`,
                background: v.confirmed ? '#0d6b63' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              {v.confirmed && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 600,
                color: v.confirmed ? '#1A5C35' : '#1A1A1A',
                textDecoration: v.confirmed ? 'none' : 'none',
              }}>
                {v.visitor_name}
              </p>
              {(v.visit_time || v.notes) && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>
                  {v.visit_time && `🕐 ${v.visit_time}`}
                  {v.visit_time && v.notes && ' · '}
                  {v.notes}
                </p>
              )}
            </div>
            <button
              onClick={() => removeVisit(v.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', fontSize: 16, padding: '0 2px', flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{
          marginTop: 12, padding: '14px', borderRadius: 12,
          background: '#F9F7F4', border: '1px solid #E5E0D8',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <VoiceInput
            value={visitorName}
            onChange={setVisitorName}
            placeholder="Nombre de quien visita"
            rows={1}
            label="Visitante"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Hora (opcional)</label>
              <input
                type="time"
                value={visitTime}
                onChange={e => setVisitTime(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: '1.5px solid #D1C9BF',
                  fontSize: 13, color: '#1A1A1A', background: 'white',
                }}
              />
            </div>
          </div>
          <VoiceInput
            value={notes}
            onChange={setNotes}
            placeholder="Nota opcional..."
            rows={1}
            label="Nota"
          />
          {saveError && (
            <p style={{ margin: 0, fontSize: 12, color: '#DC2626', padding: '6px 10px', borderRadius: 8, background: '#FEF2F2' }}>
              {saveError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowForm(false); setSaveError('') }}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid #D1C9BF', background: 'white',
                fontSize: 13, cursor: 'pointer', color: '#6B7280',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={addVisit}
              disabled={!visitorName.trim() || saving}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: visitorName.trim() ? '#0d6b63' : '#9CA3AF',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: visitorName.trim() ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
