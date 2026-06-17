import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CARE_ITEMS } from '../lib/careItems'
import { ChevronLeft, Clock } from '../components/Icons'

const DAILY_ITEMS = CARE_ITEMS.filter(i => i.category === 'daily')

const fieldStyle = {
  padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #EDE5D8', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', color: '#1A1A1A',
}
const onFocus = e => { e.target.style.borderColor = '#0d6b63'; e.target.style.boxShadow = '0 0 0 3px rgba(13,107,99,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

export default function CareSchedule() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const navigate = useNavigate()

  const isFamiliar = memberRole === 'familiar'

  const [times, setTimes] = useState(() =>
    Object.fromEntries(DAILY_ITEMS.map(i => [i.key, i.scheduledTime]))
  )
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (ownerId) load()
  }, [ownerId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('care_item_schedules')
      .select('item_key, scheduled_time')
      .eq('user_id', ownerId)
    if (data?.length) {
      setTimes(prev => {
        const next = { ...prev }
        for (const row of data) next[row.item_key] = row.scheduled_time
        return next
      })
    }
    setLoading(false)
  }

  async function save() {
    if (!ownerId || saving) return
    setSaving(true)
    setError('')
    try {
      const rows = DAILY_ITEMS.map(i => ({
        user_id:        ownerId,
        item_key:       i.key,
        scheduled_time: times[i.key] || i.scheduledTime,
        updated_at:     new Date().toISOString(),
      }))
      const { error: err } = await supabase
        .from('care_item_schedules')
        .upsert(rows, { onConflict: 'user_id,item_key' })
      if (err) throw err
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('No se pudo guardar. Verifica tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid #EDE5D8', background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="Volver"
          >
            <ChevronLeft size={18} color="#6B7280" strokeWidth={2} />
          </button>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
              Horarios de rutina
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
              Se avisa si no se marca 30 min después
            </p>
          </div>
        </div>

        {isFamiliar && (
          <div style={{
            background: '#F9FAFB', border: '1px solid #E5E7EB',
            borderRadius: 12, padding: '10px 14px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 15 }}>👁️</span>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              Solo el administrador o el cuidador pueden cambiar los horarios.
            </p>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#0d6b63',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : (
          <>
            <div style={{
              background: 'white', borderRadius: 16,
              border: '1px solid #EDE5D8', overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              marginBottom: 20,
            }}>
              {DAILY_ITEMS.map((item, idx) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    borderBottom: idx < DAILY_ITEMS.length - 1 ? '1px solid #F5EEE6' : 'none',
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                  <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                    {item.label}
                  </p>
                  <input
                    type="time"
                    value={times[item.key] ?? item.scheduledTime}
                    onChange={e => setTimes(prev => ({ ...prev, [item.key]: e.target.value }))}
                    disabled={isFamiliar}
                    style={{
                      ...fieldStyle,
                      width: 112,
                      opacity: isFamiliar ? 0.5 : 1,
                      cursor: isFamiliar ? 'default' : 'auto',
                    }}
                    onFocus={isFamiliar ? undefined : onFocus}
                    onBlur={isFamiliar ? undefined : onBlur}
                  />
                </div>
              ))}
            </div>

            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 12, padding: '10px 14px', marginBottom: 20,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <Clock size={14} color="#16A34A" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#15803D', margin: 0, lineHeight: 1.5 }}>
                Los horarios aplican para toda la familia. Si un ítem no se marca a tiempo,
                aparecerá como <strong>⚠ Tarde</strong> en Hoy.
              </p>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: '#D63031', textAlign: 'center', marginBottom: 12 }}>{error}</p>
            )}

            {!isFamiliar && (
              <button
                onClick={save}
                disabled={saving}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 14, border: 'none',
                  background: saved
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                    : saving
                      ? '#C0CCC5'
                      : 'linear-gradient(135deg, #0d6b63, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 4px 16px rgba(13,107,99,0.25)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {saving ? (
                  <>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white',
                      animation: 'spin 0.7s linear infinite', flexShrink: 0,
                    }} />
                    Guardando...
                  </>
                ) : saved ? '✓ Horarios guardados' : 'Guardar horarios'}
              </button>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
