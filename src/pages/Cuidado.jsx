import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  ChevronLeft, CheckIcon, Clock, Lock, Heart,
  Bath, Tooth, Shirt, Utensils, Bed, Sparkle, Footsteps, Scissors, Lotus,
} from '../components/Icons'
import { CARE_ITEMS } from '../lib/careItems'
import EvidencePhoto from '../components/EvidencePhoto'
import EmptyState from '../components/EmptyState'
import SuccessAnimation from '../components/SuccessAnimation'

const DAILY_ITEMS = CARE_ITEMS.filter(i => i.category === 'daily')

// Ícono por ítem — mapa local (careItems.js queda fuera del alcance de esta
// ronda). Mismo set que el molde aprobado, ahora en Icons.jsx.
const ICON_BY_KEY = {
  bath: Bath,
  dental_morning: Tooth, dental_afternoon: Tooth, dental_night: Tooth,
  clothes: Shirt,
  breakfast: Utensils, lunch: Utensils, dinner: Utensils,
  bed_sheets: Bed,
  nail_trim: Sparkle,
  exercise: Footsteps,
  haircut: Scissors,
  home_therapy: Lotus,
}
function iconFor(key) { return ICON_BY_KEY[key] ?? Sparkle }

const fieldStyle = {
  padding: '10px 14px', borderRadius: 12,
  border: '1.5px solid rgba(51,65,85,0.12)', background: '#F8F4ED',
  fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', color: '#334155',
}
const onFocusStyle = e => { e.target.style.borderColor = '#087F70'; e.target.style.boxShadow = '0 0 0 3px rgba(8,127,112,0.12)' }
const onBlurStyle  = e => { e.target.style.borderColor = 'rgba(51,65,85,0.12)'; e.target.style.boxShadow = 'none' }

function getPeriodo(timeStr) {
  if (!timeStr) return null
  const h = parseInt(timeStr.split(':')[0], 10)
  if (h >= 6 && h < 12) return { label: 'la mañana', desde: '06:00', desdeHora: 6 }
  if (h >= 12 && h < 18) return { label: 'la tarde', desde: '12:00', desdeHora: 12 }
  if (h >= 18) return { label: 'la noche', desde: '18:00', desdeHora: 18 }
  return null
}

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
  const { ownerId, memberRole, activePatientName } = useFamily()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get('tab') === 'horarios' ? 'horarios' : 'hoy'
  )

  const isFamiliar = memberRole === 'familiar'
  const isAdmin    = memberRole === null
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const patientFirstName = activePatientName?.split(' ')[0] || 'tu familiar'

  const [careLogs, setCareLogs] = useState({})
  const [careSchedules, setCareSchedules] = useState({})
  const [careToggling, setCareToggling] = useState(null)
  const [justCompletedKey, setJustCompletedKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [openSchedKey, setOpenSchedKey] = useState(null)

  const [times, setTimes] = useState(() =>
    Object.fromEntries(DAILY_ITEMS.map(i => [i.key, i.scheduledTime]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [blockedMsg, setBlockedMsg] = useState('')
  const blockedTimer = useRef(null)

  async function fetchData() {
    setCareLogs({})
    setLoading(true)
    const fetchDate = toLocalDate()
    try {
      const [{ data: careRows }, { data: scheduleRows }] = await Promise.all([
        supabase.from('daily_care_logs').select('*').eq('user_id', ownerId).eq('log_date', fetchDate),
        supabase.from('care_item_schedules').select('item_key,scheduled_time').eq('user_id', ownerId),
      ])
      const cmap = {}
      for (const row of (careRows ?? [])) {
        if (row.status === 'no_completado') continue
        cmap[row.item_key] = row
      }
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

  useEffect(() => {
    if (user && ownerId) fetchData()
  }, [user, ownerId])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'horarios') setActiveTab('horarios')
  }, [searchParams])

  useEffect(() => {
    if (!blockedMsg) return
    clearTimeout(blockedTimer.current)
    blockedTimer.current = setTimeout(() => setBlockedMsg(''), 3500)
    return () => clearTimeout(blockedTimer.current)
  }, [blockedMsg])

  async function toggleCareItem(item) {
    if (isFamiliar || careToggling) return
    const today = toLocalDate()
    const existing = careLogs[item.key]

    if (!existing) {
      const schedTime = careSchedules[item.key] ?? item.scheduledTime
      const periodo = getPeriodo(schedTime)
      if (periodo && new Date().getHours() < periodo.desdeHora) {
        setBlockedMsg(`Esta rutina está programada para ${periodo.label}. Podrás registrarla a partir de las ${periodo.desde}`)
        return
      }
    }

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
            status: 'completed',
          }, { onConflict: 'user_id,item_key,log_date' })
          .select()
          .single()
        if (!error && data) {
          setCareLogs(prev => ({ ...prev, [item.key]: data }))
          setJustCompletedKey(item.key)
          // Completadas empieza colapsada — sin esto, el check recién marcado
          // (con su animación) queda invisible detrás del acordeón cerrado.
          setShowCompleted(true)
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
  const allDone = requiredItems.length > 0 && completedRequired === requiredItems.length

  const retrasadas  = CARE_ITEMS.filter(i => !careLogs[i.key] && calcularEstadoCuidado(i, false, careSchedules[i.key]) === 'tarde')
  const proximas    = CARE_ITEMS.filter(i => !careLogs[i.key] && ['programado', 'pendiente'].includes(calcularEstadoCuidado(i, false, careSchedules[i.key])) && !!(careSchedules[i.key] ?? i.scheduledTime))
  const sinHorario  = CARE_ITEMS.filter(i => !careLogs[i.key] && !(careSchedules[i.key] ?? i.scheduledTime))
  const completadas = CARE_ITEMS.filter(i => !!careLogs[i.key])

  const bannerTitle = allDone
    ? `¡La rutina de ${patientFirstName} está completa!`
    : `Un paso a la vez con ${patientFirstName}`
  const restantes = requiredItems.length - completedRequired
  const bannerSub = allDone
    ? 'Cada cuidado que das hoy cuenta. Gracias por estar cerca.'
    : requiredItems.length === 0
      ? 'Aún no hay cuidados diarios configurados.'
      : `Van ${completedRequired} de ${requiredItems.length} cuidados. ${restantes === 1 ? 'Queda 1 por marcar.' : `Quedan ${restantes} por marcar.`}`

  return (
    <Layout>
      <style>{`
        @keyframes routinePulseRing { 0% { opacity: .55; transform: scale(.8); } 100% { opacity: 0; transform: scale(1.7); } }
        @keyframes routineSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F8F4ED' }}>

        {/* Header propio */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px 13px', borderBottom: '1px solid rgba(51,65,85,0.09)',
          flexShrink: 0, background: '#F8F4ED',
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: 'white', boxShadow: '0 6px 14px -8px rgba(51,65,85,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ChevronLeft size={17} color="#334155" strokeWidth={2.3} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#334155', letterSpacing: '-0.01em' }}>
              Rutina diaria
            </h1>
            <p style={{ margin: '2px 0 0', fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500, fontSize: 14, color: '#087F70' }}>
              Cuidando a {patientFirstName}
            </p>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 96px', maxWidth: 600 }}>

          {/* Banner cálido — sin porcentaje, sin barra */}
          <div style={{
            borderRadius: 22, padding: '18px 20px', marginBottom: 16,
            background: allDone
              ? 'linear-gradient(135deg, #A8E5D6 0%, #F8F4ED 100%)'
              : 'linear-gradient(135deg, #FBEAE4 0%, #F8F4ED 100%)',
            boxShadow: allDone ? '0 8px 20px -10px #087F7055' : '0 8px 20px -10px #E9826E44',
            transition: 'background 0.4s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 600,
                fontSize: 17.5, color: '#055C51', lineHeight: 1.35,
              }}>
                {bannerTitle}
              </span>
              {allDone && <Heart size={17} color="#E9826E" strokeWidth={2} filled />}
            </div>
            <p style={{ fontSize: 13.5, color: '#334155', opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              {bannerSub}
            </p>
          </div>

          {/* Tabs — pills, patrón Medicamentos */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'horarios', label: 'Horarios' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                style={{
                  flex: 1, padding: '10px 0', cursor: 'pointer', borderRadius: 999, border: 'none',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
                  background: activeTab === tab.id ? 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)' : 'white',
                  color: activeTab === tab.id ? '#FFFFFF' : '#5C6B78',
                  boxShadow: activeTab === tab.id ? '0 8px 16px -8px #087F7066' : '0 4px 10px -6px #087F7022',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── HOY TAB ── */}
          {activeTab === 'hoy' && (
            <div>
              {isFamiliar && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'white', border: '1px solid rgba(51,65,85,0.08)',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 14,
                }}>
                  <Lock size={15} color="#6B7A88" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#6B7A88', margin: 0 }}>
                    Solo puedes ver el cuidado registrado por el cuidador.
                  </p>
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '3px solid rgba(8,127,112,0.18)', borderTopColor: '#087F70',
                    animation: 'routineSpin 0.8s linear infinite',
                  }} />
                </div>
              ) : (
                <>
                  {retrasadas.length === 0 && proximas.length === 0 && sinHorario.length === 0 && completadas.length === 0 && (
                    <div style={{ marginTop: 8 }}>
                      <EmptyState
                        icon={<CheckIcon size={40} color="#A8E5D6" strokeWidth={2} />}
                        title="Sin rutinas registradas aún"
                        description="Las rutinas del día aparecerán aquí."
                      />
                    </div>
                  )}

                  {/* Atrasadas */}
                  {retrasadas.length > 0 && (
                    <RoutineSection label="Atrasadas" color="#C4664F">
                      {retrasadas.map(item => (
                        <RoutineCard
                          key={item.key}
                          item={item}
                          state="retrasada"
                          isToggling={careToggling === item.key}
                          isFamiliar={isFamiliar}
                          scheduledTime={careSchedules[item.key] ?? item.scheduledTime}
                          onToggle={() => toggleCareItem(item)}
                        />
                      ))}
                    </RoutineSection>
                  )}

                  {/* Próximas */}
                  {proximas.length > 0 && (
                    <RoutineSection label="Próximas">
                      {proximas.map(item => (
                        <RoutineCard
                          key={item.key}
                          item={item}
                          state="proxima"
                          isToggling={careToggling === item.key}
                          isFamiliar={isFamiliar}
                          scheduledTime={careSchedules[item.key] ?? item.scheduledTime}
                          onToggle={() => toggleCareItem(item)}
                        />
                      ))}
                    </RoutineSection>
                  )}

                  {/* Sin horario */}
                  {sinHorario.length > 0 && (
                    <RoutineSection label="Sin horario">
                      {sinHorario.map(item => (
                        <RoutineCard
                          key={item.key}
                          item={item}
                          state="sinHorario"
                          isToggling={careToggling === item.key}
                          isFamiliar={isFamiliar}
                          onToggle={() => toggleCareItem(item)}
                        />
                      ))}
                    </RoutineSection>
                  )}

                  {/* Completadas — colapsado por defecto */}
                  {completadas.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 2, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setShowCompleted(s => !s)}
                      >
                        <CheckIcon size={12} color="#087F70" strokeWidth={2.6} />
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#087F70' }}>
                          Completadas <span style={{ opacity: 0.7, fontWeight: 600 }}>({completadas.length})</span>
                        </span>
                        <span style={{ marginLeft: 'auto', color: '#94A0AD', fontSize: 13 }}>{showCompleted ? '▾' : '▸'}</span>
                      </div>
                      {showCompleted && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {completadas.map(item => (
                            <RoutineCard
                              key={item.key}
                              item={item}
                              state="completada"
                              isToggling={careToggling === item.key}
                              isFamiliar={isFamiliar}
                              log={careLogs[item.key]}
                              justCompleted={justCompletedKey === item.key}
                              onToggle={() => toggleCareItem(item)}
                              onPhotoCapture={url => handleRoutinePhoto(item.key, url)}
                              ownerId={ownerId}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── HORARIOS TAB ── */}
          {activeTab === 'horarios' && (
            <div>
              <p style={{ fontSize: 12.5, color: '#6B7A88', margin: '0 0 16px', lineHeight: 1.5 }}>
                Se avisa si no se marca 30 min después de la hora programada.
              </p>

              {!isAdmin && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white', border: '1px solid rgba(51,65,85,0.08)',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 16,
                }}>
                  <Lock size={15} color="#6B7A88" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#6B7A88', margin: 0 }}>
                    Solo el administrador puede cambiar los horarios.
                  </p>
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    border: '3px solid rgba(8,127,112,0.18)', borderTopColor: '#087F70',
                    animation: 'routineSpin 0.8s linear infinite',
                  }} />
                </div>
              ) : (
                <>
                  {DAILY_ITEMS.map(item => {
                    const isOpen = openSchedKey === item.key
                    return (
                      <div key={item.key} style={{ background: 'white', borderRadius: 18, marginBottom: 8, boxShadow: '0 6px 14px -8px #087F7022', overflow: 'hidden' }}>
                        <div
                          onClick={() => isAdmin && setOpenSchedKey(isOpen ? null : item.key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: isAdmin ? 'pointer' : 'default' }}
                        >
                          <span style={{ width: 34, height: 34, borderRadius: 11, background: '#EAF7F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {iconFor(item.key)({ size: 16, color: '#087F70', strokeWidth: 1.8 })}
                          </span>
                          <p style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: '#1E2C3A', margin: 0 }}>
                            {item.label}
                          </p>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#08554A', background: '#EAF7F3', padding: '5px 11px', borderRadius: 999, flexShrink: 0 }}>
                            {fmtTime(times[item.key] ?? item.scheduledTime)}
                          </span>
                        </div>
                        <div style={{ maxHeight: isOpen ? 90 : 0, overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
                          <div style={{ padding: '0 14px 14px' }}>
                            <input
                              type="time"
                              value={times[item.key] ?? item.scheduledTime}
                              onChange={e => setTimes(prev => ({ ...prev, [item.key]: e.target.value }))}
                              disabled={!isAdmin}
                              style={{ ...fieldStyle, width: '100%' }}
                              onFocus={!isAdmin ? undefined : onFocusStyle}
                              onBlur={!isAdmin ? undefined : onBlurStyle}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    background: '#EAF7F3', borderRadius: 12, padding: '10px 14px', margin: '10px 0 20px',
                  }}>
                    <Clock size={14} color="#087F70" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: '#08554A', margin: 0, lineHeight: 1.5 }}>
                      Los horarios aplican para toda la familia. Si un cuidado no se marca a tiempo,
                      aparece en <strong>Atrasadas</strong> dentro de Hoy.
                    </p>
                  </div>

                  {saveError && (
                    <p style={{ fontSize: 12, color: '#C4664F', textAlign: 'center', marginBottom: 12 }}>
                      {saveError}
                    </p>
                  )}

                  {isAdmin && (
                    <button
                      onClick={saveSchedules}
                      disabled={saving}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
                        background: saved ? '#087F70' : saving ? '#C7D6D2' : 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)',
                        color: 'white', fontWeight: 700, fontSize: 14,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: saving ? 'none' : '0 8px 18px -8px #087F7066',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {saving ? (
                        <>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'routineSpin 0.7s linear infinite', flexShrink: 0 }} />
                          Guardando...
                        </>
                      ) : saved ? (
                        <>
                          <CheckIcon size={16} color="white" strokeWidth={2.6} />
                          Horarios guardados
                        </>
                      ) : 'Guardar horarios'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>

      <SuccessAnimation visible={!!justCompletedKey} key={justCompletedKey ?? 'none'} />

      {/* Aviso de franja horaria — melocotón, sin alarmismo */}
      {blockedMsg && (
        <div style={{
          position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
          zIndex: 400, background: '#FBEAE4', border: '1px solid rgba(196,102,79,0.25)',
          borderRadius: 14, padding: '12px 18px',
          fontSize: 13, fontWeight: 600, color: '#8A5A4A',
          maxWidth: 320, width: 'calc(100% - 32px)',
          boxShadow: '0 8px 24px -10px rgba(196,102,79,0.4)',
          textAlign: 'center', lineHeight: 1.5,
          pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Clock size={15} color="#C4664F" strokeWidth={2} style={{ flexShrink: 0 }} />
          {blockedMsg}
        </div>
      )}
    </Layout>
  )
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function RoutineSection({ label, color = '#94A0AD', children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color, margin: '0 0 8px 2px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

// tarjeta con check grande — LA acción de la pantalla
function RoutineCard({ item, state, isToggling, isFamiliar, scheduledTime, log, justCompleted, onToggle, onPhotoCapture, ownerId }) {
  const isRetrasada = state === 'retrasada'
  const isCompletada = state === 'completada'
  const checkedTime = log?.checked_at
    ? new Date(log.checked_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: isCompletada ? '#EAF7F3' : 'white',
      borderRadius: 18, padding: '12px 14px',
      boxShadow: isRetrasada ? '0 6px 14px -8px #E9826E44' : isCompletada ? 'none' : '0 6px 14px -8px #087F7022',
      opacity: isToggling ? 0.6 : 1,
      transition: 'background 0.25s ease, opacity 0.2s ease',
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: 13, flexShrink: 0,
        background: isRetrasada ? '#FBEAE4' : isCompletada ? 'rgba(8,127,112,0.14)' : '#EAF7F3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {iconFor(item.key)({ size: 19, color: isRetrasada ? '#C4664F' : '#087F70', strokeWidth: 1.8 })}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14.5, fontWeight: 700, margin: 0, lineHeight: 1.3,
          color: isCompletada ? '#94A0AD' : '#1E2C3A',
          textDecoration: isCompletada ? 'line-through' : 'none',
        }}>
          {item.label}
        </p>

        {isCompletada && checkedTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11.5, fontWeight: 700, color: '#087F70' }}>
            <CheckIcon size={11} color="#087F70" strokeWidth={2.6} />
            {checkedTime}{log?.checked_by ? ` · ${log.checked_by.split(' ')[0]}` : ''}
          </div>
        )}
        {!isCompletada && scheduledTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11.5, color: '#6B7A88', fontWeight: 600 }}>
            <Clock size={11} color="#6B7A88" strokeWidth={2.2} />
            {fmtTime(scheduledTime)}
          </div>
        )}

        {/* Evidencia — mismo patrón que medicamentos administrados. Cualquier
            completada de HOY sin foto ofrece agregarla (careLogs solo trae
            filas de hoy — fetchData filtra por log_date — así que esta
            lista nunca incluye días pasados; no hace falta filtrar de más).
            Solo quien puede marcar (no isFamiliar) puede subir la foto. */}
        {isCompletada && (
          <div style={{ marginTop: 6 }}>
            {log?.photo_url ? (
              <EvidencePhoto photoUrl={log.photo_url} />
            ) : !isFamiliar && onPhotoCapture ? (
              <EvidencePhoto onPhotoCapture={onPhotoCapture} label="Agregar foto" bucket="care-photos" pathPrefix={`routines/${ownerId}`} />
            ) : null}
          </div>
        )}
      </div>

      {isRetrasada && (
        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#8A5A4A', background: '#FBEAE4', padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>
          Atrasada
        </span>
      )}

      <button
        onClick={onToggle}
        disabled={isFamiliar || isToggling}
        aria-label={isCompletada ? 'Desmarcar' : 'Marcar como hecho'}
        style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0, padding: 0,
          border: `2.5px solid ${isCompletada ? '#087F70' : isRetrasada ? '#F0B4A2' : '#A8E5D6'}`,
          background: isCompletada ? '#087F70' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isFamiliar ? 'default' : 'pointer',
          position: 'relative',
          transition: 'transform 0.15s ease, background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {justCompleted && (
          <span style={{
            position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #087F70',
            animation: 'routinePulseRing 0.55s ease-out',
          }} />
        )}
        {isToggling ? (
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `2px solid ${isCompletada ? 'rgba(255,255,255,0.4)' : 'rgba(8,127,112,0.25)'}`,
            borderTopColor: isCompletada ? 'white' : '#087F70',
            animation: 'routineSpin 0.6s linear infinite',
          }} />
        ) : isCompletada ? (
          <CheckIcon size={20} color="white" strokeWidth={2.6} />
        ) : null}
      </button>
    </div>
  )
}
