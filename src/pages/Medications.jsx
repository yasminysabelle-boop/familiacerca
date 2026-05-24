import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Plus, XIcon, Pencil, Trash, Bell } from '../components/Icons'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { track } from '../lib/analytics'

const FREQ_OPTIONS = [
  { value: 'once_daily',  label: 'Una vez al día',    times: 1, interval: null },
  { value: 'twice_daily', label: 'Dos veces al día',  times: 2, interval: null },
  { value: 'three_daily', label: 'Tres veces al día', times: 3, interval: null },
  { value: 'every_4h',    label: 'Cada 4 horas',      times: 1, interval: 4 },
  { value: 'every_6h',    label: 'Cada 6 horas',      times: 1, interval: 6 },
  { value: 'every_8h',    label: 'Cada 8 horas',      times: 1, interval: 8 },
  { value: 'every_12h',   label: 'Cada 12 horas',     times: 1, interval: 12 },
  { value: 'as_needed',   label: 'Según necesidad',   times: 0, interval: null },
  { value: 'weekly',      label: 'Semanal',           times: 1, interval: null },
]

function computeScheduledTimes(frequency, startTimes) {
  const opt = FREQ_OPTIONS.find(o => o.value === frequency)
  if (!opt || opt.times === 0) return []
  if (opt.interval) {
    const start = startTimes[0]
    if (!start) return []
    const [h, m] = start.split(':').map(Number)
    const dosesPerDay = 24 / opt.interval
    return Array.from({ length: dosesPerDay }, (_, i) => {
      const total = (h * 60 + m + i * opt.interval * 60) % (24 * 60)
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    })
  }
  return startTimes.filter(Boolean)
}

const emptyForm = { name: '', dosage: '', frequency: '', notes: '' }

const fieldStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1.5px solid #EDE5D8', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', appearance: 'none', WebkitAppearance: 'none',
}
const onFocus = e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
}

export default function Medications() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const { canEdit } = useSubscription()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { permission, supported, requestAndSubscribe } = usePushNotifications()
  const [medications, setMedications] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [scheduledTimes, setScheduledTimes] = useState([''])
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null) // { onConfirm }
  const editOpenedRef = useRef(false)

  const isAdmin = user?.id === ownerId
  const isCuidador = !isAdmin && memberRole === 'cuidador'
  function canActOn(med) {
    if (isAdmin) return true
    if (isCuidador && med.created_by_user_id === user?.id) return true
    return false
  }

  useEffect(() => {
    if (user && ownerId) fetchMedications()
  }, [user, ownerId])

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      openAdd()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading) return
    if (editOpenedRef.current) return
    const med = medications.find(m => m.id === editId)
    if (!med) return
    editOpenedRef.current = true
    openEdit(med)
    setSearchParams({}, { replace: true })
  }, [searchParams, medications, loading])

  async function fetchMedications() {
    setLoading(true)
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    setMedications(data ?? [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleFrequencyChange(val) {
    setForm(prev => ({ ...prev, frequency: val }))
    const opt = FREQ_OPTIONS.find(o => o.value === val)
    if (!opt || opt.times === 0) {
      setScheduledTimes([])
    } else {
      const count = opt.interval ? 1 : opt.times
      setScheduledTimes(prev => {
        const next = [...prev]
        while (next.length < count) next.push('')
        return next.slice(0, count)
      })
    }
  }

  function openAdd() {
    setForm(emptyForm)
    setScheduledTimes([''])
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(med) {
    setForm({
      name: med.name,
      dosage: med.dosage ?? '',
      frequency: med.frequency ?? '',
      notes: med.notes ?? '',
    })
    const opt = FREQ_OPTIONS.find(o => o.value === med.frequency)
    if (med.scheduled_times?.length) {
      setScheduledTimes(opt?.interval ? [med.scheduled_times[0]] : med.scheduled_times)
    } else if (med.time) {
      setScheduledTimes([med.time])
    } else {
      setScheduledTimes([''])
    }
    setEditId(med.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const scheduled_times = computeScheduledTimes(form.frequency, scheduledTimes)
    const payload = {
      name: form.name,
      dosage: form.dosage || null,
      frequency: form.frequency || null,
      notes: form.notes || null,
      scheduled_times,
      user_id: ownerId,
    }
    let error
    if (editId) {
      ;({ error } = await supabase.from('medications').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('medications').insert({ ...payload, created_by_user_id: user.id }))
      if (!error) track('medication_added', { name: payload.name, frequency: payload.frequency })
    }
    setSaving(false)
    if (error) {
      setSaveError('No se pudo guardar el medicamento. Intenta de nuevo.')
      return
    }
    setForm(emptyForm)
    setScheduledTimes([''])
    setEditId(null)
    setShowForm(false)
    fetchMedications()
  }

  async function handleDelete(id) {
    await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    setMedications(prev => prev.filter(m => m.id !== id))
  }

  const freqOpt = FREQ_OPTIONS.find(o => o.value === form.frequency)
  const showTimePickers = freqOpt && freqOpt.times > 0
  const isInterval = freqOpt?.interval != null
  const previewTimes = isInterval && scheduledTimes[0]
    ? computeScheduledTimes(form.frequency, scheduledTimes)
    : []

  return (
    <Layout>
      <div style={{ padding: '16px 16px 0', maxWidth: 600 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
              Medicamentos
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Registro de medicamentos del familiar</p>
          </div>
          <button
            onClick={openAdd}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #C4623A, #A85130)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(196,98,58,0.3)',
            }}
          >
            <Plus size={20} color="white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Notification opt-in banner */}
        {supported && permission !== 'granted' && permission !== 'denied' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'white', borderRadius: 14, border: '1px solid #EDE5D8',
            padding: '12px 14px', marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: '#FDF0EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={18} color="#C4623A" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 1 }}>
                Recordatorios de medicamentos
              </p>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                Activa las notificaciones para no olvidar ninguna dosis.
              </p>
            </div>
            <button
              onClick={requestAndSubscribe}
              style={{
                padding: '7px 14px', borderRadius: 10,
                background: 'linear-gradient(135deg, #C4623A, #A85130)',
                color: 'white', fontWeight: 700, fontSize: 12,
                border: 'none', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Activar
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : medications.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
            padding: '48px 24px', textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💊</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>Sin medicamentos</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
              Agrega los medicamentos del familiar para mantener un control preciso.
            </p>
            <button
              onClick={openAdd}
              style={{
                padding: '10px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg, #C4623A, #A85130)',
                color: 'white', fontWeight: 700, fontSize: 13,
                border: 'none', cursor: 'pointer',
              }}
            >
              + Agregar medicamento
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {medications.map(med => {
              const opt = FREQ_OPTIONS.find(o => o.value === med.frequency)
              const times = med.scheduled_times?.length
                ? med.scheduled_times
                : med.time ? [med.time] : []

              return (
                <div
                  key={med.id}
                  style={{
                    background: 'white', borderRadius: 16,
                    border: '1px solid #EDE5D8', borderLeft: '4px solid #C4623A',
                    padding: '14px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
                        💊 {med.name}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {med.dosage && (
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{med.dosage}</span>
                        )}
                        {(opt?.label ?? med.frequency) && (
                          <span style={{
                            background: '#FDF0EB', color: '#C4623A',
                            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          }}>
                            {opt?.label ?? med.frequency}
                          </span>
                        )}
                      </div>
                      {times.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          {times.map((t, i) => (
                            <span key={i} style={{
                              background: '#F0F8F4', color: '#2D6A4F',
                              padding: '3px 8px', borderRadius: 6,
                              fontSize: 11, fontWeight: 600,
                            }}>
                              ⏰ {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {med.notes && (
                        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.4 }}>
                          {med.notes}
                        </p>
                      )}
                    </div>

                    {canActOn(med) && (
                      <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(med)}
                          style={{
                            padding: '6px 8px', borderRadius: 8,
                            border: '1px solid #EDE5D8', background: 'white',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                          }}
                          title="Editar"
                        >
                          <Pencil size={14} color="#6B7280" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setConfirmDialog({ onConfirm: () => handleDelete(med.id) })}
                          style={{
                            padding: '6px 8px', borderRadius: 8,
                            border: '1px solid #EDE5D8', background: 'white',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                          }}
                          title="Eliminar"
                        >
                          <Trash size={14} color="#D63031" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar este medicamento?</p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit sheet */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div style={{
            width: '100%', maxHeight: '92vh',
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '24px 20px 96px',
            overflowY: 'auto',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
                {editId ? 'Editar medicamento' : 'Nuevo medicamento'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: 8, border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <XIcon size={20} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre del medicamento *</label>
                <input
                  name="med_name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="ej. Metformina"
                  autoComplete="off"
                  style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <label style={labelStyle}>Dosis</label>
                <input
                  name="dosage" value={form.dosage} onChange={handleChange}
                  placeholder="ej. 500mg"
                  style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <label style={labelStyle}>Frecuencia</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={form.frequency}
                    onChange={e => handleFrequencyChange(e.target.value)}
                    style={{ ...fieldStyle, paddingRight: 32 }}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    <option value="">Seleccionar frecuencia...</option>
                    {FREQ_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', color: '#9CA3AF', fontSize: 12,
                  }}>▼</span>
                </div>
              </div>

              {/* Time pickers */}
              {showTimePickers && (
                <div>
                  <label style={labelStyle}>
                    {isInterval ? 'Hora de inicio' : scheduledTimes.length > 1 ? 'Horarios' : 'Hora'}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scheduledTimes.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {scheduledTimes.length > 1 && (
                          <span style={{ fontSize: 12, color: '#9CA3AF', width: 18, flexShrink: 0 }}>
                            {i + 1}.
                          </span>
                        )}
                        <input
                          type="time"
                          value={t}
                          onChange={e => {
                            const next = [...scheduledTimes]
                            next[i] = e.target.value
                            setScheduledTimes(next)
                          }}
                          style={{ ...fieldStyle, flex: 1 }}
                          onFocus={onFocus} onBlur={onBlur}
                        />
                      </div>
                    ))}
                  </div>
                  {/* Preview computed times for interval-based */}
                  {previewTimes.length > 0 && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: '#F0F8F4', borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: '#2D6A4F', fontWeight: 600, marginBottom: 6 }}>
                        Horarios automáticos ({previewTimes.length} dosis al día):
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {previewTimes.map((t, i) => (
                          <span key={i} style={{
                            background: 'white', color: '#2D6A4F',
                            padding: '2px 8px', borderRadius: 6,
                            fontSize: 11, fontWeight: 600, border: '1px solid #C1E4CC',
                          }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>Notas adicionales</label>
                <textarea
                  name="notes" value={form.notes} onChange={handleChange}
                  rows={2} placeholder="Instrucciones especiales, efectos secundarios..."
                  style={{ ...fieldStyle, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button" onClick={() => setShowForm(false)}
                  style={{
                    flex: 1, padding: '13px',
                    border: '1.5px solid #EDE5D8', borderRadius: 14,
                    background: 'white', color: '#6B7280',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving || !canEdit}
                  onClick={!canEdit ? (e) => { e.preventDefault(); navigate('/pricing') } : undefined}
                  style={{
                    flex: 2, padding: '13px',
                    background: (saving || !canEdit) ? '#D4C4B8' : 'linear-gradient(135deg, #C4623A, #A85130)',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    borderRadius: 14, border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 6px 20px rgba(196,98,58,0.3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="btn-spinner" />
                      Guardando...
                    </span>
                  ) : editId ? 'Guardar cambios' : 'Guardar medicamento'}
                </button>
                {saveError && (
                  <p style={{ color: '#B91C1C', fontSize: 13, margin: '4px 0 0', textAlign: 'center' }}>{saveError}</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
