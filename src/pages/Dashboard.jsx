import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, User } from '../components/Icons'

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
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

// ── Sub-components ────────────────────────────────────────────────────────────

function PendingCard({ evt, confirming, onConfirm }) {
  const busy = confirming === evt.medicationId
  return (
    <div style={{
      background: '#FFFBEB', borderRadius: 16,
      border: '1.5px solid #FDE68A',
      padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(196,98,58,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', margin: 0 }}>
            {evt.medName}
          </p>
          <p style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
            {evt.medDosage && `${evt.medDosage} · `}
            {evt.medTime ? `Pendiente desde las ${fmtTime(evt.medTime)}` : 'Sin horario asignado'}
          </p>
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
        {busy ? (
          'Guardando...'
        ) : (
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
  const time = evt.timestamp
    ? evt.timestamp.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })
    : null
  return (
    <div style={{
      background: '#F0FDF4', borderRadius: 16,
      border: '1px solid #BBF7D0',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💊</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', margin: 0 }}>
          {evt.medName}
          {evt.medDosage && (
            <span style={{ fontWeight: 400, color: '#4B7A5D' }}> · {evt.medDosage}</span>
          )}
        </p>
        {(evt.confirmedBy || time) && (
          <p style={{ fontSize: 11, color: '#4ADE80', marginTop: 2 }}>
            ✓ {evt.confirmedBy ? `${evt.confirmedBy.split(' ')[0]} lo dio` : 'Dado'}
            {time && ` · ${time}`}
          </p>
        )}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#16A34A',
        background: '#DCFCE7', padding: '3px 8px', borderRadius: 6, flexShrink: 0,
      }}>
        ✓ Dado
      </span>
    </div>
  )
}

function MemoryCard({ evt, isExpanded, onToggle }) {
  const moodColor = evt.mood === '😊' ? '#7C5CBF' : evt.mood === '😔' ? '#9CA3AF' : '#C4623A'
  return (
    <div
      onClick={onToggle}
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid #EDE5D8',
        borderLeft: `3px solid ${moodColor}`,
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🎙️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {evt.recorderName
              ? `${evt.recorderName.split(' ')[0]} dejó una memoria`
              : 'Memoria de voz'}
            {evt.mood && <span style={{ marginLeft: 5 }}>{evt.mood}</span>}
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

function ExpenseCard({ evt }) {
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
          {evt.description}
        </p>
        {evt.paidBy && (
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            Pagado por {evt.paidBy.split(' ')[0]}
          </p>
        )}
      </div>
      {evt.amount != null && (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#4A7C59', flexShrink: 0 }}>
          ${Number(evt.amount).toFixed(2)}
        </span>
      )}
    </div>
  )
}

function AppointmentCard({ evt }) {
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
        <p style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>
          {evt.appointmentTime ? fmtTime(evt.appointmentTime) : 'Ver en calendario'}
        </p>
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
        ¡Gracias por tu dedicación!
      </p>
    </div>
  )
}

function TimelineEvent({ evt, confirming, expandedAudio, onConfirm, onToggleAudio }) {
  if (evt.type === 'MED_PENDING') {
    return <PendingCard evt={evt} confirming={confirming} onConfirm={onConfirm} />
  }
  if (evt.type === 'MED_CONFIRMED') {
    return <ConfirmedCard evt={evt} />
  }
  if (evt.type === 'VOICE_MEMORY') {
    return (
      <MemoryCard
        evt={evt}
        isExpanded={expandedAudio === evt.id}
        onToggle={() => onToggleAudio(evt.id)}
      />
    )
  }
  if (evt.type === 'EXPENSE') {
    return <ExpenseCard evt={evt} />
  }
  if (evt.type === 'APPOINTMENT') {
    return <AppointmentCard evt={evt} />
  }
  if (evt.type === 'CAREGIVER_CARD') {
    return <CaregiverCard evt={evt} />
  }
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

  async function fetchTimeline() {
    setLoading(true)

    // Step 1: get all family member IDs so we can include their voice memories
    const { data: familyMembers } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', ownerId)

    const allFamilyIds = [
      ownerId,
      ...(familyMembers ?? []).map(m => m.member_user_id).filter(Boolean),
    ]

    // Step 2: parallel queries
    const [
      { data: meds },
      { data: todayLogs },
      { data: confirmedLogs },
      { data: memories },
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

      supabase.from('expenses')
        .select('*')
        .eq('user_id', ownerId)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('events')
        .select('*')
        .eq('user_id', ownerId)
        .gte('start_date', todayKey)
        .order('start_date', { ascending: true })
        .limit(5),
    ])

    // Build today's confirmed map
    const todayLogMap = {}
    ;(todayLogs ?? []).forEach(l => { todayLogMap[l.medication_id] = l })

    const allEvents = []

    // ── Pending medications (scheduled time has passed, not confirmed) ──
    for (const med of (meds ?? [])) {
      if (todayLogMap[med.id]?.status === 'confirmed') continue
      const times = med.scheduled_times?.length
        ? [...med.scheduled_times].sort()
        : (med.time ? [med.time] : [])
      const pastTimes = times.filter(t => {
        const [th, tm] = t.split(':').map(Number)
        return th * 60 + tm <= nowMinutes
      })
      // Show if any scheduled time passed, or if no times at all (show all day)
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
    for (const mem of (memories ?? [])) {
      const dateKey = mem.created_at.split('T')[0]
      allEvents.push({
        id: `mem-${mem.id}`,
        type: 'VOICE_MEMORY',
        timestamp: new Date(mem.created_at),
        dateKey,
        audioUrl: mem.file_url,
        transcription: mem.transcription,
        recorderName: mem.user_profiles?.full_name ?? null,
        mood: mem.mood ?? null,
      })
    }

    // ── Expenses ──
    for (const exp of (expenses ?? [])) {
      const ts = exp.created_at ?? exp.date ?? todayKey
      const dateKey = ts.split('T')[0]
      allEvents.push({
        id: `exp-${exp.id}`,
        type: 'EXPENSE',
        timestamp: new Date(ts),
        dateKey,
        amount: exp.amount,
        description: exp.description ?? exp.title ?? 'Gasto',
        paidBy: exp.paid_by_name ?? null,
      })
    }

    // ── Upcoming appointments ──
    for (const ev of (events ?? [])) {
      allEvents.push({
        id: `evt-${ev.id}`,
        type: 'APPOINTMENT',
        timestamp: new Date(`${ev.start_date}T${ev.start_time ?? '09:00'}:00`),
        dateKey: ev.start_date,
        appointmentTitle: ev.title,
        appointmentTime: ev.start_time ?? null,
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

  // Summary counts for the header
  const todaySection = sections.find(s => s.dateKey === todayKey)
  const pendingCount = todaySection?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
  const confirmedTodayCount = todaySection?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0

  return (
    <Layout>
      <div style={{ padding: '12px 16px 24px', maxWidth: 600 }}>

        {/* ── Greeting header ── */}
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

        {/* ── Timeline ── */}
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
                    onToggleAudio={id =>
                      setExpandedAudio(prev => (prev === id ? null : id))
                    }
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
