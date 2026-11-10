import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useGoBack } from '../hooks/useGoBack'
import {
  ChevronLeft, CheckIcon, Clock, Lock, Heart,
  Bath, Tooth, Shirt, Utensils, Bed, Sparkle, Footsteps, Scissors, Lotus,
} from '../components/Icons'
import { CARE_ITEMS, CUSTOM_ICONS, buildCareItems } from '../lib/careItems'
import { scheduledBeforeStart } from '../lib/medTiming'
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
function renderIcon(item, props) {
  if (item.custom) return <span style={{ fontSize: props.size + 2, lineHeight: 1 }}>{item.icon}</span>
  return iconFor(item.key)(props)
}

const fieldStyle = {
  padding: '10px 14px', borderRadius: 12,
  border: '1.5px solid rgba(51,65,85,0.12)', background: '#F7F6F2',
  fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', color: '#2A4350',
}
const onFocusStyle = e => { e.target.style.borderColor = '#0C6C9C'; e.target.style.boxShadow = '0 0 0 3px rgba(12,108,156,0.12)' }
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
  const goBack = useGoBack()
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
  // Rutinas de esta familia: sugeridas que se usan + rutinas propias (nov 2026)
  const [scheduleRows, setScheduleRows] = useState([])
  const [hasCustomCols, setHasCustomCols] = useState(true)
  const [newRoutine, setNewRoutine] = useState(null) // { label, icon, time } cuando se está agregando
  // La rutina viene con cuidados sugeridos. Mientras la familia no la haya
  // usado (ningún cuidado marcado nunca y ningún horario propio), no se marca
  // nada como "Atrasada": el primer día no debe regañar (UX nov 2026).
  const [routineStarted, setRoutineStarted] = useState(true)
  useEffect(() => {
    if (!ownerId) return
    let off = false
    supabase.from('daily_care_logs').select('id').eq('user_id', ownerId).neq('status', 'no_completado').limit(1)
      .then(({ data }) => { if (!off) setRoutineStarted((data ?? []).length > 0) })
    return () => { off = true }
  }, [ownerId])
  const [careToggling, setCareToggling] = useState(null)
  const [justCompletedKey, setJustCompletedKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [openSchedKey, setOpenSchedKey] = useState(null)
  // Cuándo empezó la familia (paso 2 del onboarding). El primer día, los
  // cuidados cuya hora ya pasó antes de registrarse no salen "Atrasada":
  // empiezan mañana (auditoría nov 2026).
  const [familyStart, setFamilyStart] = useState(null)
  useEffect(() => {
    if (!ownerId) return
    supabase.from('patient_profiles').select('created_at').eq('owner_id', ownerId).maybeSingle()
      .then(({ data }) => setFamilyStart(data?.created_at ?? null))
  }, [ownerId])

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
      const [{ data: careRows }, scheduleRes] = await Promise.all([
        supabase.from('daily_care_logs').select('*').eq('user_id', ownerId).eq('log_date', fetchDate),
        supabase.from('care_item_schedules').select('item_key,scheduled_time,label,icon,active').eq('user_id', ownerId),
      ])
      if (scheduleRes.error) {
        // La base todavía no tiene las columnas de rutinas propias: seguir como antes
        setHasCustomCols(false)
        const old = await supabase.from('care_item_schedules').select('item_key,scheduled_time').eq('user_id', ownerId)
        scheduleRes.data = old.data
      }
      const scheduleRows = scheduleRes.data
      setScheduleRows(scheduleRows ?? [])
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
      const rows = scheduleItems.map(i => ({
        user_id:        ownerId,
        item_key:       i.key,
        scheduled_time: times[i.key] || i.scheduledTime,
        updated_at:     new Date().toISOString(),
        ...(hasCustomCols ? { active: i.active, label: i.custom ? i.label : null, icon: i.custom ? i.icon : null } : {}),
      }))
      const { error: err } = await supabase
        .from('care_item_schedules')
        .upsert(rows, { onConflict: 'user_id,item_key' })
      if (err) throw err
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      fetchData()
    } catch {
      setSaveError('No se pudo guardar. Verifica tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  // Encender/apagar una rutina sugerida, o quitar una propia (se guarda con "Guardar")
  function setActive(item, active) {
    setScheduleRows(prev => {
      const others = prev.filter(r => r.item_key !== item.key)
      const cur = prev.find(r => r.item_key === item.key) ?? { item_key: item.key, scheduled_time: times[item.key] ?? item.scheduledTime, label: item.custom ? item.label : null, icon: item.custom ? item.icon : null }
      return [...others, { ...cur, active }]
    })
  }
  function addRoutine() {
    const label = newRoutine?.label?.trim()
    if (!label) return
    const key = 'custom_' + Date.now().toString(36)
    setScheduleRows(prev => [...prev, { item_key: key, scheduled_time: newRoutine.time || '10:00', label, icon: newRoutine.icon || '✨', active: true }])
    setTimes(prev => ({ ...prev, [key]: newRoutine.time || '10:00' }))
    setNewRoutine(null)
  }

  function switchTab(tab) {
    setActiveTab(tab)
    setSearchParams(tab === 'horarios' ? { tab: 'horarios' } : {}, { replace: true })
  }

  const ITEMS = buildCareItems(scheduleRows)
  const rowFor = k => scheduleRows.find(r => r.item_key === k)
  // En Horarios se ven todas las sugeridas (también las apagadas) y las propias
  const scheduleItems = [
    ...DAILY_ITEMS.map(i => ({ ...i, active: rowFor(i.key)?.active !== false })),
    ...ITEMS.filter(i => i.custom).map(i => ({ ...i, active: true })),
  ]
  const isFromTomorrow = i => scheduledBeforeStart(careSchedules[i.key] ?? i.scheduledTime, familyStart)
  const requiredItems = ITEMS.filter(i => i.category === 'daily' && !isFromTomorrow(i))
  const completedRequired = requiredItems.filter(i => !!careLogs[i.key]).length
  const allDone = requiredItems.length > 0 && completedRequired === requiredItems.length

  const timeOf = i => careSchedules[i.key] ?? i.scheduledTime ?? '99:99'
  const byTime = (a, b) => timeOf(a).localeCompare(timeOf(b))
  const routineActive = routineStarted || Object.keys(careLogs).length > 0 || Object.keys(careSchedules).length > 0
  const retrasadas  = !routineActive ? [] : ITEMS.filter(i => !careLogs[i.key] && !isFromTomorrow(i) && calcularEstadoCuidado(i, false, careSchedules[i.key]) === 'tarde').sort(byTime)
  const desdeManana = ITEMS.filter(i => !careLogs[i.key] && isFromTomorrow(i))
  const proximas    = (!routineActive
    ? ITEMS.filter(i => !careLogs[i.key] && !!(careSchedules[i.key] ?? i.scheduledTime))
    : ITEMS.filter(i => !careLogs[i.key] && ['programado', 'pendiente'].includes(calcularEstadoCuidado(i, false, careSchedules[i.key])) && !!(careSchedules[i.key] ?? i.scheduledTime))
  ).sort(byTime)
  const sinHorario  = ITEMS.filter(i => !careLogs[i.key] && !(careSchedules[i.key] ?? i.scheduledTime))
  const completadas = ITEMS.filter(i => !!careLogs[i.key])

  const bannerTitle = allDone
    ? `¡La rutina de ${patientFirstName} está completa!`
    : `Un paso a la vez con ${patientFirstName}`
  const restantes = requiredItems.length - completedRequired
  const bannerSub = allDone
    ? 'Cada cuidado que das hoy cuenta. Gracias por estar cerca.'
    : requiredItems.length === 0
      ? 'Aún no hay cuidados diarios configurados.'
      : !routineActive
        ? 'Estos son cuidados comunes. Marca los que hagan en casa y la rutina empieza a contar. Puedes cambiar las horas en Horarios.'
      : `Van ${completedRequired} de ${requiredItems.length} cuidados. ${restantes === 1 ? 'Queda 1 por marcar.' : `Quedan ${restantes} por marcar.`}`

  return (
    <Layout>
      <style>{`
        @keyframes routinePulseRing { 0% { opacity: .55; transform: scale(.8); } 100% { opacity: 0; transform: scale(1.7); } }
        @keyframes routineSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F7F6F2' }}>

        {/* Header propio */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px 13px', borderBottom: '1px solid rgba(51,65,85,0.09)',
          flexShrink: 0, background: '#F7F6F2',
        }}>
          <button
            onClick={goBack}
            aria-label="Volver"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: 'white', boxShadow: '0 6px 14px -8px rgba(51,65,85,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ChevronLeft size={17} color="#2A4350" strokeWidth={2.3} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#2A4350', letterSpacing: '-0.01em' }}>
              Rutina diaria
            </h1>
            <p style={{ margin: '2px 0 0', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 15, color: '#0C6C9C' }}>
              Cuidando a {patientFirstName}
            </p>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 96px', maxWidth: 600 }}>

          {/* Banner cálido — sin porcentaje, sin barra */}
          <div style={{
            borderRadius: 22, padding: '18px 20px', marginBottom: 16,
            background: allDone
              ? 'linear-gradient(135deg, #A6E3EC 0%, #F7F6F2 100%)'
              : 'linear-gradient(135deg, #FBEAE4 0%, #F7F6F2 100%)',
            boxShadow: allDone ? '0 8px 20px -10px #087F7055' : '0 8px 20px -10px #E9826E44',
            transition: 'background 0.4s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontStyle: 'italic', fontWeight: 600,
                fontSize: 17.5, color: '#0A5A82', lineHeight: 1.35,
              }}>
                {bannerTitle}
              </span>
              {allDone && <Heart size={17} color="#A3452F" strokeWidth={2} filled />}
            </div>
            <p style={{ fontSize: 15, color: '#2A4350', opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
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
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                  background: activeTab === tab.id ? 'linear-gradient(148deg,#1677A6 0%,#0C6C9C 46%,#0A5A82 100%)' : 'white',
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
                  <Lock size={15} color="#4E6470" strokeWidth={2.1} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 15, color: '#4E6470', margin: 0 }}>
                    Solo puedes ver el cuidado registrado por el cuidador.
                  </p>
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '3px solid rgba(12,108,156,0.18)', borderTopColor: '#0C6C9C',
                    animation: 'routineSpin 0.8s linear infinite',
                  }} />
                </div>
              ) : (
                <>
                  {retrasadas.length === 0 && proximas.length === 0 && sinHorario.length === 0 && completadas.length === 0 && (
                    <div style={{ marginTop: 8 }}>
                      <EmptyState
                        icon={<CheckIcon size={40} color="#A6E3EC" strokeWidth={2} />}
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
                    <RoutineSection label={routineActive ? "Próximas" : "Cuidados sugeridos"}>
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

                  {/* Desde mañana: primer día, hora ya pasada al registrarse */}
                  {desdeManana.length > 0 && (
                    <RoutineSection label="Empiezan mañana">
                      {desdeManana.map(item => (
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
                    <RoutineSection label={routineActive ? "Sin horario" : "Otros cuidados"}>
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
                        <CheckIcon size={12} color="#0C6C9C" strokeWidth={2.6} />
                        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0C6C9C' }}>
                          Completadas <span style={{ opacity: 0.7, fontWeight: 600 }}>({completadas.length})</span>
                        </span>
                        <span style={{ marginLeft: 'auto', color: '#5E7480', fontSize: 14 }}>{showCompleted ? '▾' : '▸'}</span>
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
              <p style={{ fontSize: 15, color: '#4E6470', margin: '0 0 16px', lineHeight: 1.5 }}>
                Se avisa si no se marca 30 min después de la hora programada.
              </p>

              {!isAdmin && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white', border: '1px solid rgba(51,65,85,0.08)',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 16,
                }}>
                  <Lock size={15} color="#4E6470" strokeWidth={2.1} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 15, color: '#4E6470', margin: 0 }}>
                    Solo el administrador puede cambiar los horarios.
                  </p>
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    border: '3px solid rgba(12,108,156,0.18)', borderTopColor: '#0C6C9C',
                    animation: 'routineSpin 0.8s linear infinite',
                  }} />
                </div>
              ) : (
                <>
                  {scheduleItems.map(item => {
                    const isOpen = openSchedKey === item.key
                    return (
                      <div key={item.key} style={{ background: 'white', borderRadius: 18, marginBottom: 8, boxShadow: '0 6px 14px -8px #087F7022', overflow: 'hidden' }}>
                        <div
                          onClick={() => isAdmin && setOpenSchedKey(isOpen ? null : item.key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: isAdmin ? 'pointer' : 'default' }}
                        >
                          <span style={{ width: 34, height: 34, borderRadius: 11, background: '#E3F1F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {renderIcon(item, { size: 16, color: '#0C6C9C', strokeWidth: 1.8 })}
                          </span>
                          <p style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#14303D', margin: 0 }}>
                            {item.label}
                          </p>
                          {item.active ? (
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#0A5A82', background: '#E3F1F8', padding: '5px 11px', borderRadius: 999, flexShrink: 0 }}>
                              {fmtTime(times[item.key] ?? item.scheduledTime)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#5E7480', flexShrink: 0 }}>No se usa</span>
                          )}
                        </div>
                        <div style={{ maxHeight: isOpen ? 160 : 0, overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
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
                            {isAdmin && hasCustomCols && (
                              <button
                                onClick={() => { setActive(item, !item.active); setOpenSchedKey(null) }}
                                style={{ marginTop: 10, width: '100%', padding: '11px', borderRadius: 12, border: '1.5px solid #E6E3DB', background: 'white', color: item.active ? '#A3452F' : '#0C6C9C', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                              >
                                {item.custom ? 'Quitar esta rutina' : item.active ? 'No usamos esta rutina' : 'Sí la usamos'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Rutina propia */}
                  {isAdmin && hasCustomCols && (newRoutine ? (
                    <div style={{ background: 'white', borderRadius: 18, padding: 14, marginTop: 4, boxShadow: '0 6px 14px -8px #087F7022' }}>
                      <p style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: '#14303D' }}>Nueva rutina</p>
                      <input
                        autoFocus
                        placeholder="Ej.: Tomar la presión"
                        value={newRoutine.label}
                        onChange={e => setNewRoutine(r => ({ ...r, label: e.target.value }))}
                        style={{ ...fieldStyle, width: '100%', marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {CUSTOM_ICONS.map(ic => (
                          <button key={ic} aria-label={`Ícono ${ic}`} onClick={() => setNewRoutine(r => ({ ...r, icon: ic }))}
                            style={{ width: 44, height: 44, borderRadius: 12, fontSize: 22, cursor: 'pointer', background: newRoutine.icon === ic ? '#E3F1F8' : 'white', border: newRoutine.icon === ic ? '2px solid #0C6C9C' : '1.5px solid #E6E3DB' }}>
                            {ic}
                          </button>
                        ))}
                      </div>
                      <input type="time" value={newRoutine.time} onChange={e => setNewRoutine(r => ({ ...r, time: e.target.value }))} style={{ ...fieldStyle, width: '100%', marginBottom: 12 }} />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setNewRoutine(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid #E6E3DB', background: 'white', color: '#4E6470', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={addRoutine} disabled={!newRoutine.label.trim()} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: newRoutine.label.trim() ? '#0C6C9C' : '#C9D6DB', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Agregar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setNewRoutine({ label: '', icon: '🚶', time: '10:00' })}
                      style={{ width: '100%', padding: 14, borderRadius: 16, border: '2px dashed #0C6C9C', background: 'transparent', color: '#0C6C9C', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 4 }}>
                      ＋ Agregar una rutina propia
                    </button>
                  ))}

                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    background: '#E3F1F8', borderRadius: 12, padding: '10px 14px', margin: '10px 0 20px',
                  }}>
                    <Clock size={14} color="#0C6C9C" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 15, color: '#0A5A82', margin: 0, lineHeight: 1.5 }}>
                      Los horarios aplican para toda la familia. Si un cuidado no se marca a tiempo,
                      aparece en <strong>Atrasadas</strong> dentro de Hoy.
                    </p>
                  </div>

                  {saveError && (
                    <p style={{ fontSize: 15, color: '#A3452F', textAlign: 'center', marginBottom: 12 }}>
                      {saveError}
                    </p>
                  )}

                  {isAdmin && (
                    <button
                      onClick={saveSchedules}
                      disabled={saving}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
                        background: saved ? '#0C6C9C' : saving ? '#C7D6D2' : 'linear-gradient(148deg,#1677A6 0%,#0C6C9C 46%,#0A5A82 100%)',
                        color: 'white', fontWeight: 700, fontSize: 15,
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
                          Cambios guardados
                        </>
                      ) : 'Guardar cambios'}
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
          fontSize: 14, fontWeight: 600, color: '#8A5A4A',
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

function RoutineSection({ label, color = '#5E7480', children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color, margin: '0 0 8px 2px' }}>
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
      background: isCompletada ? '#E3F1F8' : 'white',
      borderRadius: 18, padding: '12px 14px',
      boxShadow: isRetrasada ? '0 6px 14px -8px #E9826E44' : isCompletada ? 'none' : '0 6px 14px -8px #087F7022',
      opacity: isToggling ? 0.6 : 1,
      transition: 'background 0.25s ease, opacity 0.2s ease',
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: 13, flexShrink: 0,
        background: isRetrasada ? '#FBEAE4' : isCompletada ? 'rgba(12,108,156,0.14)' : '#E3F1F8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {renderIcon(item, { size: 19, color: isRetrasada ? '#C4664F' : '#0C6C9C', strokeWidth: 1.8 })}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.3,
          color: isCompletada ? '#5E7480' : '#14303D',
          textDecoration: isCompletada ? 'line-through' : 'none',
        }}>
          {item.label}
        </p>

        {isCompletada && checkedTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 14, fontWeight: 700, color: '#0C6C9C' }}>
            <CheckIcon size={11} color="#0C6C9C" strokeWidth={2.6} />
            {checkedTime}{log?.checked_by ? ` · ${log.checked_by.split(' ')[0]}` : ''}
          </div>
        )}
        {!isCompletada && scheduledTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 14, color: '#4E6470', fontWeight: 600 }}>
            <Clock size={11} color="#4E6470" strokeWidth={2.2} />
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
        <span style={{ fontSize: 14, fontWeight: 800, color: '#8A5A4A', background: '#FBEAE4', padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>
          Atrasada
        </span>
      )}

      <button
        onClick={onToggle}
        disabled={isFamiliar || isToggling}
        aria-label={isCompletada ? 'Desmarcar' : 'Marcar como hecho'}
        style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0, padding: 0,
          border: `2.5px solid ${isCompletada ? '#0C6C9C' : isRetrasada ? '#F0B4A2' : '#A6E3EC'}`,
          background: isCompletada ? '#0C6C9C' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isFamiliar ? 'default' : 'pointer',
          position: 'relative',
          transition: 'transform 0.15s ease, background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {justCompleted && (
          <span style={{
            position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #0C6C9C',
            animation: 'routinePulseRing 0.55s ease-out',
          }} />
        )}
        {isToggling ? (
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `2px solid ${isCompletada ? 'rgba(255,255,255,0.4)' : 'rgba(12,108,156,0.25)'}`,
            borderTopColor: isCompletada ? 'white' : '#0C6C9C',
            animation: 'routineSpin 0.6s linear infinite',
          }} />
        ) : isCompletada ? (
          <CheckIcon size={20} color="white" strokeWidth={2.6} />
        ) : null}
      </button>
    </div>
  )
}
