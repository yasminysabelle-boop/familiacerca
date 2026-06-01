import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, Clock } from '../components/Icons'
import { CARE_CATEGORIES, CARE_ITEMS } from '../lib/careItems'
import EvidencePhoto from '../components/EvidencePhoto'
import EmptyState from '../components/EmptyState'
import SuccessAnimation from '../components/SuccessAnimation'

const DAILY_ITEMS = CARE_ITEMS.filter(i => i.category === 'daily')

const fieldStyle = {
  padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #EDE5D8', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', color: '#1A1A1A',
}
const onFocusStyle = e => { e.target.style.borderColor = '#4A7C59'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }
const onBlurStyle  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

function calcularEstadoCuidado(item, isChecked = false, customTime = null) {
  if (isChecked) return 'completado'
  const time = customTime ?? item.scheduledTime
  if (item.category !== 'daily' || !time) return 'pendiente'
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
  if (diff < 0)   return 'programado'
  if (diff <= 30) return 'pendiente'
  return 'tarde'
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const hh = h > 12 ? h - 12 : (h === 0 ? 12 : h)
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`
}

function toLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Cuidado() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get('tab') === 'horarios' ? 'horarios' : 'hoy'
  )

  const isFamiliar = memberRole === 'familiar'
  const today = toLocalDate()
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  const [careLogs, setCareLogs] = useState({})
  const [careSchedules, setCareSchedules] = useState({})
  const [careToggling, setCareToggling] = useState(null)
  const [justCompletedKey, setJustCompletedKey] = useState(null)
  const [loading, setLoading] = useState(true)

  const [times, setTimes] = useState(() =>
    Object.fromEntries(DAILY_ITEMS.map(i => [i.key, i.scheduledTime]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (user && ownerId) fetchData()
  }, [user, ownerId])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'horarios') setActiveTab('horarios')
  }, [searchParams])

  async function fetchData() {
    setLoading(true)
    try {
      const [{ data: careRows }, { data: scheduleRows }] = await Promise.all([
        supabase.from('daily_care_logs').select('*').eq('user_id', ownerId).eq('log_date', today),
        supabase.from('care_item_schedules').select('item_key,scheduled_time').eq('user_id', ownerId),
      ])
      const cmap = {}
      for (const row of (careRows ?? [])) cmap[row.item_key] = row
      setCareLogs(cmap)
      const smap = {}
      for (const row of (scheduleRows ?? [])) smap[row.item_key] = row.scheduled_time
      setCareSchedules(smap)
      setTimes(prev => {
        const next = { ...prev }
        for (const row of (scheduleRows ?? [])) next[row.item_key] = row.scheduled_time
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  async function toggleCareItem(item) {
    if (isFamiliar || careToggling) return
    const existing = careLogs[item.key]
    setCareToggling(item.key)
    try {
      if (existing) {
        await supabase.from('daily_care_logs').delete().eq('id', existing.id)
        setCareLogs(prev => { const n = { ...prev }; delete n[item.key]; return n })
        if (justCompletedKey === item.key) setJustCompletedKey(null)
      } else {
        const { data, error } = await supabase
          .from('daily_care_logs')
          .upsert({
            user_id: ownerId,
            item_key: item.key,
            log_date: today,
            checked_at: new Date().toISOString(),
            checked_by: displayName,
          }, { onConflict: 'user_id,item_key,log_date' })
          .select()
          .single()
        if (!error && data) {
          setCareLogs(prev => ({ ...prev, [item.key]: data }))
          setJustCompletedKey(item.key)
        }
      }
    } finally {
      setCareToggling(null)
    }
  }

  async function handleRoutinePhoto(itemKey, photoUrl) {
    const log = careLogs[itemKey]
    if (!log) return
    await supabase.from('daily_care_logs').update({ photo_url: photoUrl }).eq('id', log.id)
    setCareLogs(prev => ({ ...prev, [itemKey]: { ...prev[itemKey], photo_url: photoUrl } }))
    setJustCompletedKey(null)
  }

  async function saveSchedules() {
    if (!ownerId || saving) return
    setSaving(true)
    setSaveError('')
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
      setSaveError('No se pudo guardar. Verifica tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  function switchTab(tab) {
    setActiveTab(tab)
    setSearchParams(tab === 'horarios' ? { tab: 'horarios' } : {}, { replace: true })
  }

  const requiredItems = CARE_ITEMS.filter(i => i.category === 'daily')
  const completedRequired = requiredItems.filter(i => !!careLogs[i.key]).length
  const todayTimeline = Object.values(careLogs)
    .filter(l => l.log_date === today)
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at))

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 16,
          background: '#F3F4F6', borderRadius: 14, padding: 4,
        }}>
          {[
            { id: 'hoy',      label: '📋 Hoy' },
            { id: 'horarios', label: '⏰ Horarios' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                flex: 1, padding: '10px 8px',
                borderRadius: 10, border: 'none',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#1A1A1A' : '#9CA3AF',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── HOY TAB ── */}
        {activeTab === 'hoy' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                Rutinas de hoy
              </p>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: completedRequired === requiredItems.length ? '#16A34A' : '#4A7C59',
                background: completedRequired === requiredItems.length ? '#DCFCE7' : '#EBF3EE',
                padding: '3px 10px', borderRadius: 20,
              }}>
                {completedRequired}/{requiredItems.length}
              </span>
            </div>

            {/* Barra de progreso */}
            {!loading && requiredItems.length > 0 && (
              <div style={{ marginBottom: 14, background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: completedRequired === requiredItems.length ? '#16A34A' : '#374151', margin: 0 }}>
                    {completedRequired === requiredItems.length
                      ? '¡Todo listo por hoy! 🎉'
                      : `${completedRequired} de ${requiredItems.length} completadas`}
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: completedRequired === requiredItems.length ? '#16A34A' : '#4A7C59' }}>
                    {Math.round((completedRequired / requiredItems.length) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${(completedRequired / requiredItems.length) * 100}%`,
                    background: completedRequired === requiredItems.length
                      ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                      : 'linear-gradient(90deg, #2D4A1E, #4A7C59)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            )}

            {isFamiliar && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: 12, padding: '10px 14px', marginBottom: 14,
              }}>
                <span style={{ fontSize: 16 }}>👁️</span>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                  Solo puedes ver el cuidado registrado por el cuidador.
                </p>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '3px solid #EDE5D8', borderTopColor: '#4A7C59',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : (
              <>
                {CARE_CATEGORIES.map(cat => {
                  const items = CARE_ITEMS.filter(i => i.category === cat.id)
                  return (
                    <div key={cat.id} style={{ marginBottom: 14 }}>
                      <p style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: '#9CA3AF',
                        marginBottom: 6, paddingLeft: 2,
                      }}>
                        {cat.icon} {cat.label}
                      </p>
                      <div style={{
                        background: 'white', borderRadius: 16,
                        border: '1px solid #EDE5D8', overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      }}>
                        {items.map((item, idx) => {
                          const isChecked  = !!careLogs[item.key]
                          const status     = calcularEstadoCuidado(item, isChecked, careSchedules[item.key])
                          const isOverdue  = status === 'tarde'
                          const isEarly    = status === 'programado'
                          const isToggling = careToggling === item.key
                          const log        = careLogs[item.key]
                          const checkedTime = log?.checked_at
                            ? new Date(log.checked_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })
                            : null
                          return (
                            <div
                              key={item.key}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '13px 14px',
                                background: isChecked ? cat.bg : 'white',
                                borderBottom: idx < items.length - 1
                                  ? `1px solid ${isChecked ? cat.color + '25' : '#F5EEE6'}`
                                  : 'none',
                                transition: 'background 0.2s',
                                opacity: isToggling ? 0.55 : 1,
                              }}
                            >
                              <button
                                onClick={() => toggleCareItem(item)}
                                disabled={isFamiliar || !!careToggling}
                                style={{
                                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                  border: `2px solid ${isChecked ? cat.color : isOverdue ? '#FCA5A5' : '#D1D5DB'}`,
                                  background: isChecked ? cat.color : 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: isFamiliar ? 'default' : 'pointer',
                                  padding: 0, transition: 'all 0.2s',
                                }}
                              >
                                {isChecked && !isToggling && <CheckIcon size={13} color="white" strokeWidth={2.5} />}
                                {isToggling && (
                                  <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    border: `2px solid ${isChecked ? 'rgba(255,255,255,0.4)' : '#D1D5DB'}`,
                                    borderTopColor: isChecked ? 'white' : cat.color,
                                    animation: 'spin 0.6s linear infinite',
                                  }} />
                                )}
                              </button>
                              <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.3,
                                  color: isChecked ? '#9CA3AF' : isOverdue ? '#DC2626' : '#1A1A1A',
                                  textDecoration: isChecked ? 'line-through' : 'none',
                                }}>
                                  {item.label}
                                </p>
                                {isChecked && checkedTime && (
                                  <p style={{ fontSize: 10, color: cat.color, margin: '2px 0 0', fontWeight: 600 }}>
                                    ✓ {checkedTime}{log?.checked_by ? ` · ${log.checked_by.split(' ')[0]}` : ''}
                                  </p>
                                )}
                                {isChecked && justCompletedKey === item.key && !log?.photo_url && (
                                  <EvidencePhoto
                                    onPhotoCapture={url => handleRoutinePhoto(item.key, url)}
                                    label="Agregar foto"
                                    bucket="care-photos"
                                    pathPrefix={`routines/${ownerId}`}
                                  />
                                )}
                                {isChecked && log?.photo_url && (
                                  <div style={{ marginTop: 4 }}>
                                    <EvidencePhoto photoUrl={log.photo_url} />
                                  </div>
                                )}
                                {!isChecked && (careSchedules[item.key] ?? item.scheduledTime) && !isOverdue && (
                                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>
                                    ⏰ {fmtTime(careSchedules[item.key] ?? item.scheduledTime)}
                                  </p>
                                )}
                              </div>
                              {isChecked && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                                  ✓ Listo
                                </span>
                              )}
                              {isOverdue && !isChecked && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#7A5A18', background: '#FEF3C7', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                                  ⚠ Tarde
                                </span>
                              )}
                              {!isChecked && isEarly && (careSchedules[item.key] ?? item.scheduledTime) && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                  🕐 {fmtTime(careSchedules[item.key] ?? item.scheduledTime)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {todayTimeline.length === 0 && completedRequired === 0 && (
                  <div style={{ marginTop: 8 }}>
                    <EmptyState
                      icon="✅"
                      title="Sin rutinas completadas aún"
                      description="Las rutinas completadas hoy aparecerán aquí."
                    />
                  </div>
                )}
                {todayTimeline.length > 0 && (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#9CA3AF',
                      marginBottom: 6, paddingLeft: 2,
                    }}>
                      Línea de tiempo del día
                    </p>
                    <div style={{
                      background: 'white', borderRadius: 16,
                      border: '1px solid #EDE5D8', overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}>
                      {todayTimeline.map((log, i) => {
                        const ci  = CARE_ITEMS.find(x => x.key === log.item_key)
                        const cat = CARE_CATEGORIES.find(c => c.id === ci?.category)
                        return (
                          <div
                            key={log.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '11px 14px',
                              borderBottom: i < todayTimeline.length - 1 ? '1px solid #F5EEE6' : 'none',
                            }}
                          >
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{ci?.icon ?? '✓'}</span>
                            <p style={{ flex: 1, fontSize: 13, color: '#1A1A1A', margin: 0, fontWeight: 500 }}>
                              {ci?.label ?? log.item_key}
                            </p>
                            <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                              {new Date(log.checked_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {log.checked_by && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, flexShrink: 0,
                                color: cat?.color ?? '#4A7C59',
                                background: cat ? `${cat.color}18` : '#EBF3EE',
                                padding: '2px 7px', borderRadius: 6,
                              }}>
                                {log.checked_by.split(' ')[0]}
                              </span>
                            )}
                            {log.photo_url && (
                              <EvidencePhoto photoUrl={log.photo_url} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HORARIOS TAB ── */}
        {activeTab === 'horarios' && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', marginBottom: 4 }}>
              Horarios de rutina
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
              Se avisa si no se marca 30 min después
            </p>

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
                  border: '3px solid #EDE5D8', borderTopColor: '#4A7C59',
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
                        onFocus={isFamiliar ? undefined : onFocusStyle}
                        onBlur={isFamiliar ? undefined : onBlurStyle}
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

                {saveError && (
                  <p style={{ fontSize: 12, color: '#D63031', textAlign: 'center', marginBottom: 12 }}>
                    {saveError}
                  </p>
                )}

                {!isFamiliar && (
                  <button
                    onClick={saveSchedules}
                    disabled={saving}
                    style={{
                      width: '100%', padding: '14px',
                      borderRadius: 14, border: 'none',
                      background: saved
                        ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                        : saving
                          ? '#C0CCC5'
                          : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                      color: 'white', fontWeight: 700, fontSize: 14,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow: saving ? 'none' : '0 4px 16px rgba(74,124,89,0.25)',
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
        )}

      </div>
      <SuccessAnimation visible={!!justCompletedKey} key={justCompletedKey ?? 'none'} />
    </Layout>
  )
}
