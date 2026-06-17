import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon } from '../components/Icons'
import { getTodayPR } from '../lib/utils'

const SECTIONS = [
  {
    key: 'mood',
    label: 'Estado de ánimo',
    options: [
      { value: 'excelente', emoji: '😊', label: 'Excelente' },
      { value: 'bien',      emoji: '🙂', label: 'Bien' },
      { value: 'regular',   emoji: '😐', label: 'Regular' },
      { value: 'mal',       emoji: '😔', label: 'Mal' },
    ],
  },
  {
    key: 'food',
    label: 'Alimentación',
    options: [
      { value: 'bien',      emoji: '🍽️', label: 'Comió bien' },
      { value: 'poco',      emoji: '🍽️', label: 'Comió poco' },
      { value: 'no_comio',  emoji: '🍽️', label: 'No quiso comer' },
    ],
  },
  {
    key: 'hydration',
    label: 'Hidratación',
    options: [
      { value: 'adecuada',    emoji: '💧', label: 'Adecuada' },
      { value: 'insuficiente', emoji: '💧', label: 'Insuficiente' },
    ],
  },
  {
    key: 'sleep',
    label: 'Sueño',
    options: [
      { value: 'bien',        emoji: '😴', label: 'Durmió bien' },
      { value: 'interrumpido', emoji: '😴', label: 'Interrumpido' },
      { value: 'mal',         emoji: '😴', label: 'No durmió bien' },
    ],
  },
  {
    key: 'evacuation',
    label: 'Evacuación',
    options: [
      { value: 'normal',       emoji: '🚽', label: 'Normal' },
      { value: 'estrenimiento', emoji: '🚽', label: 'Estreñimiento' },
      { value: 'diarrea',      emoji: '🚽', label: 'Diarrea' },
    ],
  },
]

const MOOD_BG = {
  excelente: { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D' },
  bien:      { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D' },
  regular:   { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
  mal:       { bg: '#FEF2F2', border: '#FCA5A5', color: '#DC2626' },
}

function dayLabel(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  const raw = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function CareRecord() {
  const { user } = useAuth()
  const { ownerId, memberRole, activePatientName } = useFamily()
  const isFamiliar = memberRole === 'familiar'

  const todayKey = getTodayPR()

  const [form, setForm] = useState({ mood: null, food: null, hydration: null, sleep: null, evacuation: null, notes: '' })
  const [existingId, setExistingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && ownerId) fetchToday()
  }, [user, ownerId])

  async function fetchToday() {
    setLoading(true)
    const startOfDay = new Date(todayKey + 'T00:00:00').toISOString()
    const endOfDay   = new Date(todayKey + 'T23:59:59').toISOString()
    const { data } = await supabase
      .from('care_records')
      .select('*')
      .eq('owner_id', ownerId)
      .gte('recorded_at', startOfDay)
      .lte('recorded_at', endOfDay)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setExistingId(data.id)
      setForm({
        mood:       data.mood       ?? null,
        food:       data.food       ?? null,
        hydration:  data.hydration  ?? null,
        sleep:      data.sleep      ?? null,
        evacuation: data.evacuation ?? null,
        notes:      data.notes      ?? '',
      })
    }
    setLoading(false)
  }

  function pick(key, value) {
    if (isFamiliar) return
    setForm(f => ({ ...f, [key]: f[key] === value ? null : value }))
    setSaved(false)
    setError('')
  }

  async function handleSave() {
    if (isFamiliar) return
    setSaving(true)
    setError('')
    const payload = {
      owner_id:    ownerId,
      user_id:     user.id,
      recorded_at: new Date().toISOString(),
      mood:        form.mood       || null,
      food:        form.food       || null,
      hydration:   form.hydration  || null,
      sleep:       form.sleep      || null,
      evacuation:  form.evacuation || null,
      notes:       form.notes.trim() || null,
    }
    let err
    if (existingId) {
      ;({ error: err } = await supabase.from('care_records').update(payload).eq('id', existingId))
    } else {
      const { data, error: e } = await supabase.from('care_records').insert(payload).select('id').single()
      err = e
      if (data) setExistingId(data.id)
    }
    setSaving(false)
    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const hasAnySelection = Object.values(form).some(v => v && v !== '')
  const moodStyle = form.mood ? (MOOD_BG[form.mood] ?? MOOD_BG.bien) : null

  return (
    <Layout>
      <div style={{ padding: '20px 16px 40px', maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(145deg, #0B4F4A 0%, #3D6128 100%)',
          borderRadius: 20, padding: '20px 20px 18px',
          marginBottom: 20,
          boxShadow: '0 4px 20px rgba(11,79,74,0.25)',
        }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {dayLabel(todayKey)}
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', fontFamily: 'Georgia, serif', margin: '0 0 6px' }}>
            Síntomas físicos del día
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
            {existingId ? 'Registro guardado — toca para editar' : `Registra cómo se encuentra ${activePatientName || 'tu familiar'} hoy`}
          </p>
          {existingId && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 10, background: 'rgba(229,139,115,0.25)',
              border: '1px solid rgba(229,139,115,0.45)',
              borderRadius: 20, padding: '4px 10px',
            }}>
              <CheckIcon size={11} color="#E58B73" strokeWidth={2.5} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#E58B73' }}>Actualizar registro de hoy</span>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 14 }}>
            Cargando...
          </div>
        ) : (
          <>
            {/* Sections */}
            {SECTIONS.map(section => (
              <div key={section.key} style={{
                background: 'white', borderRadius: 16,
                border: '1px solid #EDE5D8',
                padding: '16px 16px 14px',
                marginBottom: 12,
                boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0B4F4A', margin: '0 0 12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {section.label}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {section.options.map(opt => {
                    const isSelected = form[section.key] === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => pick(section.key, opt.value)}
                        disabled={isFamiliar}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px',
                          borderRadius: 24,
                          border: isSelected ? '2px solid #0B4F4A' : '1.5px solid #E5DDD2',
                          background: isSelected ? '#0B4F4A' : 'white',
                          color: isSelected ? 'white' : '#4B5563',
                          fontSize: 13, fontWeight: isSelected ? 700 : 500,
                          cursor: isFamiliar ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                          WebkitTapHighlightColor: 'transparent',
                          opacity: isFamiliar ? 0.7 : 1,
                          boxShadow: isSelected ? '0 2px 8px rgba(11,79,74,0.3)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{opt.emoji}</span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Notes */}
            <div style={{
              background: 'white', borderRadius: 16,
              border: '1px solid #EDE5D8',
              padding: '16px',
              marginBottom: 20,
              boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0B4F4A', margin: '0 0 10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Notas (opcional)
              </p>
              <textarea
                value={form.notes}
                onChange={e => {
                  if (isFamiliar) return
                  setSaved(false)
                  setForm(f => ({ ...f, notes: e.target.value.slice(0, 300) }))
                }}
                readOnly={isFamiliar}
                placeholder="Observaciones del día, comportamiento especial, síntomas..."
                rows={3}
                style={{
                  width: '100%', borderRadius: 10,
                  border: '1.5px solid #E5DDD2',
                  padding: '10px 12px',
                  fontSize: 14, color: '#1A1A1A', lineHeight: 1.6,
                  background: isFamiliar ? '#F9F7F4' : 'white',
                  resize: 'none', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0', textAlign: 'right' }}>
                {form.notes.length}/300
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FCA5A5',
                borderRadius: 10, padding: '10px 14px',
                marginBottom: 14, fontSize: 13, color: '#DC2626',
              }}>
                {error}
              </div>
            )}

            {/* Save button */}
            {!isFamiliar && (
              <button
                onClick={handleSave}
                disabled={saving || !hasAnySelection}
                style={{
                  width: '100%', padding: '15px',
                  borderRadius: 16, border: 'none',
                  background: saved
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                    : (!hasAnySelection || saving)
                      ? '#D1D5DB'
                      : 'linear-gradient(135deg, #0B4F4A, #3D6128)',
                  color: 'white', fontWeight: 700, fontSize: 15,
                  cursor: (!hasAnySelection || saving) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.2s',
                  boxShadow: hasAnySelection && !saving ? '0 4px 16px rgba(11,79,74,0.35)' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {saving ? 'Guardando...' : saved ? (
                  <><CheckIcon size={16} color="white" strokeWidth={2.5} /> Guardado</>
                ) : existingId ? 'Actualizar registro' : 'Guardar registro'}
              </button>
            )}

            {isFamiliar && (
              <div style={{
                background: '#F9F7F4', border: '1px solid #EDE5D8',
                borderRadius: 12, padding: '12px 16px',
                textAlign: 'center', fontSize: 13, color: '#9CA3AF',
              }}>
                Solo el cuidador puede editar el registro diario
              </div>
            )}

            {/* Summary card if record exists */}
            {existingId && hasAnySelection && (
              <div style={{
                marginTop: 20,
                background: moodStyle ? moodStyle.bg : '#F9F7F4',
                border: `1px solid ${moodStyle ? moodStyle.border : '#EDE5D8'}`,
                borderRadius: 16, padding: '16px',
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', margin: '0 0 10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Resumen de hoy
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SECTIONS.map(s => {
                    const val = form[s.key]
                    if (!val) return null
                    const opt = s.options.find(o => o.value === val)
                    if (!opt) return null
                    return (
                      <span key={s.key} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'white', border: '1px solid #E5DDD2',
                        borderRadius: 20, padding: '4px 10px',
                        fontSize: 12, color: '#374151', fontWeight: 500,
                      }}>
                        {opt.emoji} {opt.label}
                      </span>
                    )
                  })}
                </div>
                {form.notes.trim() && (
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '10px 0 0', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{form.notes.trim()}"
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
