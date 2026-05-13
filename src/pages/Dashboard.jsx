import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, User } from '../components/Icons'

// Mood lookup — handles both stored text values and emoji values
const MOOD_MAP = {
  good:    { emoji: '😊', color: '#22C55E' },
  regular: { emoji: '😐', color: '#D4A853' },
  hard:    { emoji: '😔', color: '#D63031' },
  '😊':   { emoji: '😊', color: '#22C55E' },
  '😐':   { emoji: '😐', color: '#D4A853' },
  '😔':   { emoji: '😔', color: '#D63031' },
}

function getMoodEmoji(val) { return MOOD_MAP[val]?.emoji ?? '🎙️' }
function getMoodColor(val) { return MOOD_MAP[val]?.color ?? '#7C5CBF' }

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function fmtTimestamp(date) {
  if (!date) return ''
  return date.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function minutesAgo(timeStr, todayKey) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const scheduled = new Date(`${todayKey}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  const diff = Math.floor((Date.now() - scheduled) / 60000)
  if (diff <= 0) return null
  if (diff < 60) return `hace ${diff} min`
  const hrs = Math.floor(diff / 60)
  return `hace ${hrs} hora${hrs !== 1 ? 's' : ''}`
}

function dateLabelFor(dateKey, todayKey, yesterdayKey) {
  if (dateKey === todayKey) return 'Hoy'
  if (dateKey === yesterdayKey) return 'Ayer'
  const d = new Date(dateKey + 'T12:00:00')
  const raw = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function sortSection(events) {
  return [...events].sort((a, b) => {
    if (a.type === 'MED_PENDING' && b.type !== 'MED_PENDING') return -1
    if (b.type === 'MED_PENDING' && a.type !== 'MED_PENDING') return 1
    return b.timestamp - a.timestamp
  })
}

// ── Card components ───────────────────────────────────────────────────────────

function PendingCard({ evt, confirming, onConfirm, todayKey }) {
  const busy = confirming === evt.medicationId
  const ago = minutesAgo(evt.medTime, todayKey)
  return (
    <div style={{
      background: '#FFFBEB', borderRadius: 16,
      border: '1.5px solid #FDE68A',
      padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(196,98,58,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', margin: 0, lineHeight: 1.4 }}>
            {evt.medName}{evt.medDosage ? ` · ${evt.medDosage}` : ''} pendiente
            {ago && <span style={{ fontWeight: 400, color: '#B45309' }}> — {ago}</span>}
          </p>
          {evt.medTime && (
            <p style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
              Programado a las {fmtTime(evt.medTime)}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => onConfirm(evt)}
        disabled={busy}
        style={{
          marginTop: 10, width: '100%', padding: '9px 0',
          background: busy ? '#D4C4B8' : 'linear-gradient(135deg, #22C55E, #16A34A)',
          color: 'white', fontWeight: 700, fontSize: 13,
          borderRadius: 10, border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.2s',
        }}
      >
        {busy ? 'Guardando...' : (
          <>
            <CheckIcon size={14} color="white" strokeWidth={2.5} />
            Marcar como dado
          </>
        )}
      </button>
    </div>
  )
}

function ConfirmedCard({ evt }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  const name = evt.confirmedBy ? evt.confirmedBy.split(' ')[0] : null
  return (
    <div style={{
      background: '#F0FDF4', borderRadius: 16,
      border: '1px solid #BBF7D0',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💊</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', margin: 0, lineHeight: 1.4 }}>
          {time && <span style={{ fontWeight: 400, color: '#4B7A5D' }}>{time} — </span>}
          {name ? `${name} dio ${evt.medName}` : evt.medName}
          {evt.medDosage ? <span style={{ fontWeight: 400, color: '#4B7A5D' }}> {evt.medDosage}</span> : ''}
        </p>
      </div>
      <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
    </div>
  )
}

function MemoryCard({ evt, isExpanded, onToggle }) {
  const color = getMoodColor(evt.mood)
  const emoji = getMoodEmoji(evt.mood)
  const name = evt.recorderName ? evt.recorderName.split(' ')[0] : null
  return (
    <div
      onClick={onToggle}
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid #EDE5D8',
        borderLeft: `3px solid ${color}`,
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🎙️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {name ? `${name} dejó una memoria` : 'Memoria de voz'}
            {evt.mood && <span style={{ marginLeft: 5 }}>{emoji}</span>}
          </p>
          {evt.transcription && !isExpanded && (
            <p style={{
              fontSize: 11, color: '#9CA3AF', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {evt.transcription}
            </p>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
          {isExpanded ? '▲' : '▶ Escuchar'}
        </span>
      </div>
      {isExpanded && evt.audioUrl && (
        <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
          <audio
            src={evt.audioUrl}
            controls
            autoPlay
            style={{ width: '100%', height: 36, borderRadius: 8 }}
          />
          {evt.transcription && (
            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
              "{evt.transcription}"
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PhotoCard({ evt }) {
  const name = evt.uploaderName ? evt.uploaderName.split(' ')[0] : null
  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1px solid #EDE5D8',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <img
        src={evt.fileUrl}
        alt={evt.caption ?? 'Foto familiar'}
        style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
      />
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>📸</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {name ? `${name} subió una foto` : 'Nueva foto'}
          </p>
          {evt.caption && (
            <p style={{
              fontSize: 11, color: '#9CA3AF', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {evt.caption}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ExpenseCard({ evt }) {
  const name = evt.paidBy ? evt.paidBy.split(' ')[0] : null
  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1px solid #EDE5D8',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💰</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          {name ? `${name} pagó ${evt.description}` : evt.description}
        </p>
      </div>
      {evt.amount != null && (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#4A7C59', flexShrink: 0 }}>
          ${Number(evt.amount).toFixed(2)}
        </span>
      )}
    </div>
  )
}

function AppointmentCard({ evt, todayKey, tomorrowKey }) {
  const isToday = evt.dateKey === todayKey
  const isTomorrow = evt.dateKey === tomorrowKey
  const whenLabel = isToday ? 'hoy' : isTomorrow ? 'mañana' : null
  const timeText = evt.appointmentTime
    ? (whenLabel ? `${whenLabel} a las ${fmtTime(evt.appointmentTime)}` : fmtTime(evt.appointmentTime))
    : 'Ver en calendario'
  return (
    <Link
      to="/calendar"
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid #BFDBFE',
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>📅</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          {evt.appointmentTitle}
        </p>
        <p style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>{timeText}</p>
      </div>
      <span style={{ color: '#BBBBBB', fontSize: 14 }}>›</span>
    </Link>
  )
}

function CaregiverCard({ evt }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
      borderRadius: 16, border: '1px solid #C4B5FD',
      padding: '14px 16px',
      boxShadow: '0 2px 8px rgba(124,92,191,0.12)',
    }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#5B21B6', margin: '0 0 4px' }}>
        💙 Reconocimiento semanal
      </p>
      <p style={{ fontSize: 13, color: '#6D28D9', lineHeight: 1.5, margin: 0 }}>
        {evt.caregiverName.split(' ')[0]} coordinó{' '}
        <strong>{evt.weekCount} dosis</strong> esta semana.
        El cuidado invisible merece ser visto. 💙
      </p>
    </div>
  )
}

function TimelineEvent({ evt, confirming, expandedAudio, onConfirm, onToggleAudio, todayKey, tomorrowKey }) {
  if (evt.type === 'MED_PENDING') {
    return <PendingCard evt={evt} confirming={confirming} onConfirm={onConfirm} todayKey={todayKey} />
  }
  if (evt.type === 'MED_CONFIRMED') return <ConfirmedCard evt={evt} />
  if (evt.type === 'VOICE_MEMORY') {
    return (
      <MemoryCard
        evt={evt}
        isExpanded={expandedAudio === evt.id}
        onToggle={() => onToggleAudio(evt.id)}
      />
    )
  }
  if (evt.type === 'PHOTO') return <PhotoCard evt={evt} />
  if (evt.type === 'EXPENSE') return <ExpenseCard evt={evt} />
  if (evt.type === 'APPOINTMENT') {
    return <AppointmentCard evt={evt} todayKey={todayKey} tomorrowKey={tomorrowKey} />
  }
  if (evt.type === 'CAREGIVER_CARD') return <CaregiverCard evt={evt} />
  return null
}

function EmptyState({ profile }) {
  return (
    <div style={{
      background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
      padding: '48px 24px', textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>
        {profile ? '💊' : '🌱'}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
        {profile ? 'Todo tranquilo por aquí' : 'Bienvenido a FamiliaCerca'}
      </p>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20, lineHeight: 1.6 }}>
        {profile
          ? 'El historial de cuidado aparecerá aquí. Agrega medicamentos para comenzar.'
          : 'Configura el perfil familiar para comenzar a registrar el cuidado.'}
      </p>
      <Link
        to={profile ? '/medications' : '/onboarding'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #C4623A, #A85130)',
          color: 'white', fontWeight: 700, fontSize: 13,
          textDecoration: 'none',
        }}
      >
        {profile ? '+ Agregar medicamento' : '+ Configurar familiar'}
      </Link>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const { profile, ownerId } = useFamily()

  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [expandedAudio, setExpandedAudio] = useState(null)

  const now = new Date()
  const todayKey = now.toISOString().split('T')[0]
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().split('T')[0]
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split('T')[0]
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 6)
  const sevenAgoKey = sevenAgo.toISOString().split('T')[0]

  const fullName = user?.user_metadata?.full_name ?? user?.email ?? 'Cuidador'
  const firstName = fullName.split(' ')[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isSundayEvening = now.getDay() === 0 && now.getHours() >= 17

  const h = now.getHours()
  const timeGreeting = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const timeIcon = h < 12 ? '☀️' : h < 19 ? '🌤️' : '🌙'

  useEffect(() => {
    if (user && ownerId) fetchTimeline()
  }, [user, ownerId])

  // Schedule daily browser notifications (fires when app is open/in background)
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const patientName = profile?.name ?? 'el familiar'

    function msUntil(targetH, targetM) {
      const n = new Date()
      const t = new Date(n)
      t.setHours(targetH, targetM, 0, 0)
      if (t <= n) t.setDate(t.getDate() + 1)
      return t - n
    }

    // 7:30am — morning ritual
    const morningTimer = setTimeout(() => {
      new Notification('Buenos días 🌅', {
        body: `Hoy toca dar medicamentos. ${firstName} cuida hoy.`,
        icon: '/icon-192.png',
        tag: 'morning-ritual',
      })
    }, msUntil(7, 30))

    // 9pm — evening tranquility
    const eveningTimer = setTimeout(() => {
      const todaySec = sections.find(s => s.dateKey === todayKey)
      const confirmed = todaySec?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0
      const pending = todaySec?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
      const body = pending > 0
        ? `Faltó ${pending} medicamento${pending !== 1 ? 's' : ''} hoy. Mañana es un nuevo día 💙`
        : `Todo en orden hoy 💙 — ${confirmed} medicamento${confirmed !== 1 ? 's' : ''} dado${confirmed !== 1 ? 's' : ''}, ${firstName} estuvo con ${patientName}`
      new Notification('FamiliaCerca', {
        body,
        icon: '/icon-192.png',
        tag: 'evening-summary',
      })
    }, msUntil(21, 0))

    return () => {
      clearTimeout(morningTimer)
      clearTimeout(eveningTimer)
    }
  }, [profile?.name, firstName, sections, todayKey])

  async function fetchTimeline() {
    setLoading(true)

    // Get all family member IDs for shared data queries
    const { data: familyMembers } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', ownerId)

    const allFamilyIds = [
      ownerId,
      ...(familyMembers ?? []).map(m => m.member_user_id).filter(Boolean),
    ]

    const [
      { data: meds },
      { data: todayLogs },
      { data: confirmedLogs },
      { data: voiceMemories },
      { data: photoMemories },
      { data: expenses },
      { data: events },
    ] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', ownerId),

      supabase.from('medication_logs').select('*')
        .eq('user_id', ownerId).eq('log_date', todayKey),

      supabase.from('medication_logs')
        .select('*, medications(name, dosage)')
        .eq('user_id', ownerId)
        .gte('log_date', sevenAgoKey)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: false })
        .limit(60),

      supabase.from('voice_diary')
        .select('*, user_profiles(full_name)')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('memories')
        .select('*')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase.from('care_expenses')
        .select('*')
        .eq('user_id', ownerId)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('events')
        .select('*')
        .eq('user_id', ownerId)
        .gte('date', todayKey)
        .order('date', { ascending: true })
        .limit(5),
    ])

    const todayLogMap = {}
    ;(todayLogs ?? []).forEach(l => { todayLogMap[l.medication_id] = l })

    const allEvents = []

    // ── Pending medications (scheduled time passed, not confirmed) ──
    for (const med of (meds ?? [])) {
      if (todayLogMap[med.id]?.status === 'confirmed') continue
      const times = med.scheduled_times?.length
        ? [...med.scheduled_times].sort()
        : (med.time ? [med.time] : [])
      const pastTimes = times.filter(t => {
        const [th, tm] = t.split(':').map(Number)
        return th * 60 + tm <= nowMinutes
      })
      if (pastTimes.length > 0 || times.length === 0) {
        allEvents.push({
          id: `pending-${med.id}`,
          type: 'MED_PENDING',
          timestamp: times[0]
            ? new Date(`${todayKey}T${times[0]}:00`)
            : new Date(`${todayKey}T00:00:00`),
          dateKey: todayKey,
          medicationId: med.id,
          medName: med.name,
          medDosage: med.dosage,
          medTime: times[0] ?? null,
          allTimes: times,
        })
      }
    }

    // ── Confirmed medication logs ──
    for (const log of (confirmedLogs ?? [])) {
      if (!log.medications) continue
      allEvents.push({
        id: `log-${log.id}`,
        type: 'MED_CONFIRMED',
        timestamp: new Date(log.confirmed_at ?? `${log.log_date}T12:00:00`),
        dateKey: log.log_date,
        medName: log.medications.name,
        medDosage: log.medications.dosage,
        confirmedBy: log.confirmed_by_name,
      })
    }

    // ── Voice memories ──
    for (const mem of (voiceMemories ?? [])) {
      const dateKey = mem.created_at.split('T')[0]
      allEvents.push({
        id: `mem-${mem.id}`,
        type: 'VOICE_MEMORY',
        timestamp: new Date(mem.created_at),
        dateKey,
        audioUrl: mem.audio_url,
        transcription: mem.transcription,
        recorderName: mem.user_profiles?.full_name ?? null,
        mood: mem.mood ?? null,
      })
    }

    // ── Photo memories ──
    for (const photo of (photoMemories ?? [])) {
      const dateKey = photo.created_at.split('T')[0]
      allEvents.push({
        id: `photo-${photo.id}`,
        type: 'PHOTO',
        timestamp: new Date(photo.created_at),
        dateKey,
        fileUrl: photo.file_url,
        fileType: photo.file_type,
        uploaderName: photo.uploader_name ?? null,
        caption: photo.caption ?? null,
      })
    }

    // ── Expenses ──
    for (const exp of (expenses ?? [])) {
      const ts = exp.created_at ?? (exp.date ? exp.date + 'T12:00:00' : todayKey)
      const dateKey = ts.split('T')[0]
      allEvents.push({
        id: `exp-${exp.id}`,
        type: 'EXPENSE',
        timestamp: new Date(ts),
        dateKey,
        amount: exp.amount,
        description: exp.description ?? exp.category ?? 'Gasto',
        paidBy: exp.paid_by ?? null,
      })
    }

    // ── Upcoming appointments ──
    for (const ev of (events ?? [])) {
      const evDate = ev.date
      const evTime = ev.time
      allEvents.push({
        id: `evt-${ev.id}`,
        type: 'APPOINTMENT',
        timestamp: new Date(`${evDate}T${evTime ?? '09:00'}:00`),
        dateKey: evDate,
        appointmentTitle: ev.title,
        appointmentTime: evTime ?? null,
      })
    }

    // ── Caregiver recognition (Sunday evenings) ──
    if (isSundayEvening) {
      allEvents.push({
        id: 'caregiver-card',
        type: 'CAREGIVER_CARD',
        timestamp: new Date(`${todayKey}T17:00:00`),
        dateKey: todayKey,
        caregiverName: fullName,
        weekCount: (confirmedLogs ?? []).length,
      })
    }

    // Group by date, sort sections newest first
    const dateMap = {}
    for (const evt of allEvents) {
      if (!dateMap[evt.dateKey]) dateMap[evt.dateKey] = []
      dateMap[evt.dateKey].push(evt)
    }

    const sortedKeys = Object.keys(dateMap).sort((a, b) => b.localeCompare(a))
    const newSections = sortedKeys.map(dk => ({
      dateKey: dk,
      label: dateLabelFor(dk, todayKey, yesterdayKey),
      events: sortSection(dateMap[dk]),
    }))

    setSections(newSections)
    setLoading(false)
  }

  async function quickConfirm(evt) {
    setConfirming(evt.medicationId)
    const { error } = await supabase.from('medication_logs').upsert({
      medication_id: evt.medicationId,
      user_id: ownerId,
      status: 'confirmed',
      log_date: todayKey,
      confirmed_by_name: fullName,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: 'medication_id,log_date,user_id' })

    if (!error) {
      const confirmedEvt = {
        id: `log-new-${evt.medicationId}`,
        type: 'MED_CONFIRMED',
        timestamp: new Date(),
        dateKey: todayKey,
        medName: evt.medName,
        medDosage: evt.medDosage,
        confirmedBy: fullName,
      }
      setSections(prev =>
        prev
          .map(section => {
            if (section.dateKey !== todayKey) return section
            const filtered = section.events.filter(e => e.id !== evt.id)
            return { ...section, events: sortSection([...filtered, confirmedEvt]) }
          })
          .filter(s => s.events.length > 0)
      )
    }
    setConfirming(null)
  }

  const todaySection = sections.find(s => s.dateKey === todayKey)
  const pendingCount = todaySection?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
  const confirmedTodayCount = todaySection?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0

  return (
    <Layout>
      <div style={{ padding: '12px 16px 24px', maxWidth: 600 }}>

        {/* Greeting header */}
        <div style={{
          background: 'linear-gradient(135deg, #BF5E37 0%, #7A3418 100%)',
          borderRadius: 20, padding: '16px 18px', marginBottom: 16,
          boxShadow: '0 4px 20px rgba(196,98,58,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.name}
                style={{
                  width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid rgba(212,168,83,0.5)', flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={22} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: 0 }}>
                {timeIcon} {timeGreeting}, {firstName}
              </p>
              {profile ? (
                <p style={{
                  color: 'white', fontSize: 16, fontWeight: 700,
                  fontFamily: 'Georgia, serif', margin: '2px 0 0',
                }}>
                  Cuidando a {profile.name}
                </p>
              ) : (
                <Link
                  to="/onboarding"
                  style={{
                    color: 'rgba(255,255,255,0.75)', fontSize: 13,
                    display: 'block', marginTop: 2, textDecoration: 'underline',
                  }}
                >
                  + Agregar familiar →
                </Link>
              )}
              {pendingCount > 0 ? (
                <p style={{ color: 'rgba(255,220,100,0.95)', fontSize: 12, margin: '5px 0 0' }}>
                  ⚠️ {pendingCount} medicamento{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
                </p>
              ) : confirmedTodayCount > 0 ? (
                <p style={{ color: 'rgba(130,255,170,0.9)', fontSize: 12, margin: '5px 0 0' }}>
                  ✅ Todo al día hoy · {confirmedTodayCount} dado{confirmedTodayCount !== 1 ? 's' : ''}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Family timeline */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : sections.length === 0 ? (
          <EmptyState profile={profile} />
        ) : (
          sections.map(section => (
            <div key={section.dateKey} style={{ marginBottom: 20 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#9CA3AF',
                marginBottom: 8, paddingLeft: 2,
              }}>
                {section.label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.events.map(evt => (
                  <TimelineEvent
                    key={evt.id}
                    evt={evt}
                    confirming={confirming}
                    expandedAudio={expandedAudio}
                    onConfirm={quickConfirm}
                    onToggleAudio={id => setExpandedAudio(prev => prev === id ? null : id)}
                    todayKey={todayKey}
                    tomorrowKey={tomorrowKey}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
