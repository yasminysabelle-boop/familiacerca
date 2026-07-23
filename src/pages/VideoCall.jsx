import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DailyIframe from '@daily-co/daily-js'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import Layout from '../components/Layout'
import { Video } from '../components/Icons'
import VideoCallScheduleModal from '../components/VideoCallScheduleModal'

const SERVICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`
const PRESENCE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-call-presence`
const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

const SPIN_KEYFRAMES = '@keyframes spin { to { transform: rotate(360deg); } }'
const PULSE_KEYFRAMES = '@keyframes fc-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(8,127,112,0.35); } 50% { box-shadow: 0 0 0 8px rgba(8,127,112,0); } }'

// Reused verbatim on both the main screen and the lobby for visual continuity.
const WATERMARK_PATHS = (
  <>
    <path d="M200 330 C 60 240, 30 140, 110 90 C 160 60, 195 90, 200 130 C 205 90, 240 60, 290 90 C 370 140, 340 240, 200 330 Z" fill="#087F70" />
    <circle cx="165" cy="165" r="22" fill="#F8F4ED" />
    <path d="M130 230 C 130 195, 200 195, 200 230 L 200 245 L 130 245 Z" fill="#F8F4ED" />
    <circle cx="235" cy="165" r="22" fill="#F8F4ED" />
    <path d="M200 230 C 200 195, 270 195, 270 230 L 270 245 L 200 245 Z" fill="#F8F4ED" />
  </>
)

function fmtScheduled(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// "Hoy · 7:00 PM · 4 invitados" style meta line for the upcoming-call card
function fmtUpcomingMeta(isoStr, inviteCount) {
  const d = new Date(isoStr)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const dayLabel = isToday ? 'Hoy' : isTomorrow ? 'Mañana'
    : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })
  const timeLabel = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase().replace(/\./g, '')
  const guestLabel = `${inviteCount} invitado${inviteCount === 1 ? '' : 's'}`
  return `${dayLabel} · ${timeLabel} · ${guestLabel}`
}

// Fallback display name from an email prefix (no full_name on the profile yet)
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function VideoIconCircle({ icon }) {
  return (
    <div style={{
      width: 96, height: 96, borderRadius: '50%',
      background: '#A8E5D6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon ?? <Video size={40} color="#065A50" strokeWidth={1.75} />}
    </div>
  )
}

export default function VideoCall() {
  const [searchParams] = useSearchParams()
  const callId = searchParams.get('id')
  const navigate = useNavigate()
  const { ownerId, activePatientName } = useFamily()
  const { user } = useAuth()
  const onlineIds = usePresence()

  const [call, setCall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [permStatus, setPermStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied'

  const [startingInstant, setStartingInstant] = useState(false)
  const [instantError, setInstantError] = useState('')

  // Landing screen (no callId) state
  const [team, setTeam] = useState([])
  const [nextCall, setNextCall] = useState(null)
  const [reminderSet, setReminderSet] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Lobby state — who's already in the Daily.co room
  const [callPresence, setCallPresence] = useState({ count: 0, participants: [] })

  useEffect(() => {
    if (!callId) return
    load()
  }, [callId])

  // ownerId settles across a few async stages in FamilyContext (initial
  // fallback to user.id, then the real owner once family data resolves).
  // Guard against a slower earlier request clobbering a newer one.
  const teamRequestIdRef = useRef(0)

  useEffect(() => {
    if (callId || !ownerId) return
    const requestId = ++teamRequestIdRef.current
    loadTeam(ownerId, requestId)
    loadNextCall(ownerId, requestId)
  }, [callId, ownerId])

  // Poll real presence while sitting in the lobby (not yet joined).
  useEffect(() => {
    if (!callId || joined) return
    loadPresence(callId)
    const interval = setInterval(() => loadPresence(callId), 8000)
    return () => clearInterval(interval)
  }, [callId, joined])

  async function loadPresence(forCallId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${PRESENCE_URL}?callId=${forCallId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const body = await res.json()
      setCallPresence({ count: body.count ?? 0, participants: body.participants ?? [] })
    } catch {
      // Presence is a nice-to-have in the lobby — fail silently.
    }
  }

  async function loadTeam(forOwnerId, requestId) {
    const { data: memberRows } = await supabase
      .from('family_members')
      .select('member_user_id, member_email')
      .eq('user_id', forOwnerId)
    if (requestId !== teamRequestIdRef.current) return // stale response

    const ids = [...new Set([
      forOwnerId,
      ...(memberRows ?? []).map(m => m.member_user_id).filter(Boolean),
    ])]
    let profileMap = {}
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', ids)
      if (requestId !== teamRequestIdRef.current) return // stale response
      ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })
    }

    const ownerProfile = profileMap[forOwnerId]
    const ownerIsMe = forOwnerId === user?.id
    const ownerFallbackName = ownerIsMe
      ? (user?.user_metadata?.full_name ?? cap(user?.email?.split('@')[0]) ?? 'Admin')
      : 'Admin'
    const entries = [{
      id: forOwnerId,
      name: ownerProfile?.full_name ?? cap(ownerProfile?.email?.split('@')[0]) ?? ownerFallbackName,
    }]
    ;(memberRows ?? []).forEach(m => {
      if (!m.member_user_id || m.member_user_id === forOwnerId) return
      const p = profileMap[m.member_user_id]
      entries.push({
        id: m.member_user_id,
        name: p?.full_name ?? cap(m.member_email?.split('@')[0]) ?? '—',
      })
    })
    setTeam(entries)
  }

  async function loadNextCall(forOwnerId, requestId) {
    const { data } = await supabase
      .from('video_calls')
      .select('id, title, scheduled_at, status, participants')
      .eq('owner_id', forOwnerId)
      .in('status', ['scheduled', 'active'])
      .gte('scheduled_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (requestId !== teamRequestIdRef.current) return // stale response
    setNextCall(data ?? null)
  }

  async function handleInstantCall() {
    if (!ownerId || startingInstant) return
    setStartingInstant(true)
    setInstantError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ownerId, title: 'Llamada ahora', scheduledAt: new Date().toISOString(), participants: 'all' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const body = await res.json()
      navigate(`/videollamada?id=${body.callId}`, { replace: true })
    } catch (err) {
      setInstantError(err.message)
      setStartingInstant(false)
    }
  }

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('video_calls')
      .select('id, title, scheduled_at, room_url, status, owner_id')
      .eq('id', callId)
      .maybeSingle()
    if (err || !data) {
      setError('No se encontró la videollamada.')
    } else if (ownerId && data.owner_id !== ownerId) {
      setError('No tienes acceso a esta videollamada.')
    } else {
      setCall(data)
    }
    setLoading(false)
  }

  // No callId — pantalla de inicio (fiel al export de Claude Design)
  if (!callId) {
    const inviteCount = Array.isArray(nextCall?.participants) ? nextCall.participants.length : team.length
    const headerName = activePatientName || user?.user_metadata?.full_name || user?.email || 'F'
    const headerInitial = headerName.charAt(0).toUpperCase()

    return (
      <Layout>
        <div style={{ position: 'relative', minHeight: '100%', background: '#F8F4ED', overflow: 'hidden', fontFamily: SANS }}>

          {/* Decorative background heart — fiel al export */}
          <svg viewBox="0 0 400 400" style={{ position: 'absolute', top: -60, right: -90, width: 420, height: 420, opacity: 0.05, pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
            {WATERMARK_PATHS}
          </svg>

          {/* Header propio — requiere '/videollamada' en Layout.hasOwnHeader */}
          <header style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: '#FDFBF7', boxShadow: '0 2px 10px rgba(51,65,85,0.06)' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#334155', fontFamily: SANS }}>Videollamada</h1>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#065A50' }}>
              {headerInitial}
            </div>
          </header>

          <main style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 28, padding: '22px 20px 40px' }}>

            {/* Iniciar / Programar */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={handleInstantCall}
                disabled={startingInstant}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', height: 64, border: 'none', borderRadius: 20,
                  background: startingInstant ? '#9CA3AF' : '#087F70',
                  color: '#FFFFFF', fontSize: 18, fontWeight: 700, fontFamily: SANS,
                  cursor: startingInstant ? 'default' : 'pointer',
                  boxShadow: '0 10px 24px rgba(8,127,112,0.3)',
                  animation: startingInstant ? 'none' : 'fc-pulse 2.8s ease-in-out infinite',
                }}
              >
                {startingInstant ? (
                  <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 8l5-3v14l-5-3"></path><rect x="2" y="6" width="13" height="12" rx="2.5"></rect></svg>
                )}
                {startingInstant ? 'Iniciando...' : 'Iniciar videollamada'}
              </button>

              {instantError && (
                <p style={{ margin: 0, fontSize: 13, color: '#B91C1C', textAlign: 'center' }}>{instantError}</p>
              )}

              <button
                onClick={() => setShowScheduleModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', height: 56, border: '2px solid #087F70', borderRadius: 18,
                  background: '#FFFFFF', color: '#087F70', fontSize: 16, fontWeight: 700,
                  fontFamily: SANS, cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#087F70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg>
                Programar llamada
              </button>
            </section>

            {/* ¿Quién está disponible? — usePresence() real, igual que Familia.jsx/Dashboard.jsx */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#334155', fontFamily: SANS }}>¿Quién está disponible?</h2>
              <div style={{ display: 'flex', gap: 18, overflowX: 'auto', paddingBottom: 4 }}>
                {team.map(m => {
                  const online = onlineIds.has(m.id)
                  const initial = m.name.charAt(0).toUpperCase()
                  const bg = online ? '#A8E5D6' : '#E7E1D2'
                  const fg = online ? '#065A50' : '#8A8270'
                  const dot = online ? '#22C55E' : '#94A3B8'
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 64 }}>
                      <div style={{ position: 'relative', width: 56, height: 56 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: fg }}>
                          {initial}
                        </div>
                        <span style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: dot, border: '2px solid #F8F4ED' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{m.name.split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Próximas llamadas — video_calls real, tarjeta clicable para unirse */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#334155', fontFamily: SANS }}>Próximas llamadas</h2>
              {nextCall ? (
                <div
                  onClick={() => navigate(`/videollamada?id=${nextCall.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(51,65,85,0.08)', cursor: 'pointer' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#065A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextCall.title || 'Videollamada familiar'}
                    </span>
                    <span style={{ fontSize: 13, color: '#64748B' }}>{fmtUpcomingMeta(nextCall.scheduled_at, inviteCount)}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setReminderSet(s => !s) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 14,
                      border: '1.5px solid #E9826E',
                      background: reminderSet ? '#E9826E' : '#FDF0EC',
                      color: reminderSet ? '#FFFFFF' : '#E9826E',
                      fontSize: 13, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={reminderSet ? '#FFFFFF' : '#E9826E'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 01-3.46 0"></path></svg>
                    {reminderSet ? 'Recordatorio activo' : 'Recordar'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 16px', border: '1.5px dashed #C9BFA9', borderRadius: 20 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#065A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg>
                  </div>
                  <span style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>No hay llamadas programadas</span>
                </div>
              )}
            </section>

            {/* Recientes — Fase 1: estado vacío elegante, sin backend nuevo (ver Fase 2 en CLAUDE.md) */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#334155', fontFamily: SANS }}>Recientes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 16px', border: '1.5px dashed #C9BFA9', borderRadius: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#065A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 8l5-3v14l-5-3"></path><rect x="2" y="6" width="13" height="12" rx="2.5"></rect></svg>
                </div>
                <span style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>Aún no hay llamadas recientes</span>
              </div>
            </section>

          </main>
        </div>

        <VideoCallScheduleModal
          open={showScheduleModal}
          onClose={() => { setShowScheduleModal(false); loadNextCall(ownerId, teamRequestIdRef.current) }}
        />

        <style>{SPIN_KEYFRAMES}{PULSE_KEYFRAMES}</style>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout>
        <div style={{
          minHeight: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, padding: '48px 24px',
          fontFamily: SANS,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#0d6b63', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#143C32', fontSize: 15, fontWeight: 600 }}>Conectando...</p>
          <style>{SPIN_KEYFRAMES}</style>
        </div>
      </Layout>
    )
  }

  if (error || !call) {
    return (
      <Layout>
        <div style={{
          minHeight: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, padding: 24,
          fontFamily: SANS,
        }}>
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p style={{ color: '#143C32', fontSize: 15, textAlign: 'center' }}>
            {error || 'Videollamada no encontrada'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: '#0d6b63', color: 'white', fontWeight: 700,
              fontSize: 14, cursor: 'pointer', fontFamily: SANS,
            }}
          >
            Volver al inicio
          </button>
        </div>
      </Layout>
    )
  }

  const minutesUntil = Math.round((new Date(call.scheduled_at) - Date.now()) / 60000)
  const isTooEarly = minutesUntil > 15
  const isExpired = minutesUntil < -120

  if (isExpired) {
    return (
      <Layout>
        <div style={{
          minHeight: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, padding: 24,
          fontFamily: SANS,
        }}>
          <span style={{ fontSize: 40 }}>🕐</span>
          <p style={{ color: '#143C32', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{call.title}</p>
          <p style={{ color: '#6B7280', fontSize: 13, textAlign: 'center' }}>
            Esta llamada ya terminó.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: '#0d6b63', color: 'white', fontWeight: 700,
              fontSize: 14, cursor: 'pointer', fontFamily: SANS,
            }}
          >
            Volver al inicio
          </button>
        </div>
      </Layout>
    )
  }

  async function requestPermissionsAndJoin() {
    setPermStatus('requesting')
    try {
      // Keep the stream alive briefly so the browser registers the permission
      // as active before the Daily.co call frame loads and requests it again.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setPermStatus('granted')
      setJoined(true)
      // Stop tracks after a short delay — the call frame will have initialized by then
      setTimeout(() => stream.getTracks().forEach(t => t.stop()), 1500)
    } catch {
      setPermStatus('denied')
    }
  }

  const displayName = user?.user_metadata?.full_name || cap(user?.email?.split('@')[0]) || 'Familiar'

  // Lobby screen — shown before joining (and when too early). Deliberately
  // NOT wrapped in <Layout>: same full-bleed treatment as the active call,
  // since this is part of the same immersive in-call flow (no footer/header).
  if (!joined) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#F8F4ED', overflow: 'hidden', fontFamily: SANS }}>
        <svg viewBox="0 0 400 400" style={{ position: 'absolute', top: -60, right: -90, width: 420, height: 420, opacity: 0.05, pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
          {WATERMARK_PATHS}
        </svg>

        <div style={{
          position: 'relative', zIndex: 1, height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 22, padding: '32px 26px 48px',
        }}>
          <VideoIconCircle icon={isTooEarly ? <span style={{ fontSize: 36 }}>⏰</span> : undefined} />

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#334155', fontSize: 21, fontWeight: 800, margin: '0 0 6px' }}>
              {call.title}
            </p>
            <p style={{ color: '#64748B', fontSize: 13.5, margin: 0 }}>
              {fmtScheduled(call.scheduled_at)}
            </p>
          </div>

          {isTooEarly ? (
            <div style={{
              padding: '16px 24px', borderRadius: 16,
              background: 'white', border: '1px solid #EDE5D8',
              textAlign: 'center',
            }}>
              <p style={{ margin: 0, color: '#6B7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                La sala abre en
              </p>
              <p style={{ margin: '6px 0 0', color: '#087F70', fontSize: 32, fontWeight: 800 }}>
                {minutesUntil} min
              </p>
              <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 12 }}>
                Disponible 15 minutos antes
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                {callPresence.count > 0 ? (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Ya están dentro:</span>
                    <div style={{ display: 'flex' }}>
                      {callPresence.participants.slice(0, 6).map((p, i) => (
                        <div
                          key={i}
                          style={{
                            width: 38, height: 38, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, color: '#065A50', background: '#A8E5D6',
                            border: '2.5px solid #F8F4ED', marginLeft: i === 0 ? 0 : -10,
                          }}
                        >
                          {(p.name || 'F').charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#E9826E', background: '#FDF0EC', padding: '8px 16px', borderRadius: 999 }}>
                    Sé la primera en unirte
                  </span>
                )}
              </div>

              {permStatus === 'denied' && (
                <div style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: '#FEF0ED', border: '1px solid #F5C6BB',
                  textAlign: 'center', maxWidth: 320,
                }}>
                  <p style={{ color: '#B91C1C', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                    Permisos denegados
                  </p>
                  <p style={{ color: '#6B7280', fontSize: 12, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Activa cámara y micrófono desde los ajustes de tu navegador.
                  </p>
                  <button
                    onClick={requestPermissionsAndJoin}
                    style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#087F70', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: SANS }}
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', marginTop: 6 }}>
                <button
                  onClick={requestPermissionsAndJoin}
                  disabled={permStatus === 'requesting'}
                  style={{
                    width: '100%', maxWidth: 300, padding: 17, borderRadius: 18, border: 'none',
                    background: permStatus === 'requesting' ? '#9CA3AF' : '#087F70',
                    color: 'white', fontWeight: 800, fontSize: 16.5,
                    cursor: permStatus === 'requesting' ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    fontFamily: SANS,
                    boxShadow: permStatus === 'requesting' ? 'none' : '0 10px 24px rgba(8,127,112,0.32)',
                  }}
                >
                  {permStatus === 'requesting' ? (
                    <>
                      <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 8l5-3v14l-5-3"></path><rect x="2" y="6" width="13" height="12" rx="2.5"></rect></svg>
                      Unirse a la llamada
                    </>
                  )}
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{ background: 'none', border: 'none', fontSize: 13.5, fontWeight: 700, color: '#64748B', cursor: 'pointer', padding: '6px 10px', fontFamily: SANS }}
                >
                  Volver
                </button>
              </div>
            </>
          )}
          <style>{SPIN_KEYFRAMES}</style>
        </div>
      </div>
    )
  }

  // Active call screen — Daily.co call object (DailyIframe.createFrame).
  // Theme is a client-side createFrame option (NOT a Daily REST room
  // property — the API rejects 'theme' there). Full-bleed dark background,
  // no header, no bottom nav — sala activa permanece oscura per CLAUDE.md,
  // regardless of the theme variant Daily picks for its own chrome.
  return <ActiveCall call={call} displayName={displayName} onLeave={() => { setJoined(false); navigate('/dashboard') }} />
}

// FamiliaCerca theme for the Daily Prebuilt UI — teal accent, cream/dark
// chrome. Both variants keep mainArea (the video grid itself) dark —
// that's the "sala activa" CLAUDE.md requires staying dark, independent
// of which variant Daily picks for the surrounding chrome.
const DAILY_THEME = {
  light: {
    colors: {
      accent: '#087F70',
      accentText: '#FFFFFF',
      background: '#F8F4ED',
      backgroundAccent: '#EDE5D8',
      baseText: '#334155',
      border: '#EDE5D8',
      mainAreaBg: '#0A0A0A',
      mainAreaBgAccent: '#1A1A1A',
      mainAreaText: '#FFFFFF',
      supportiveText: '#64748B',
    },
  },
  dark: {
    colors: {
      accent: '#087F70',
      accentText: '#FFFFFF',
      background: '#1A1A1A',
      backgroundAccent: '#2A2A2A',
      baseText: '#F8F4ED',
      border: '#3A3A3A',
      mainAreaBg: '#0A0A0A',
      mainAreaBgAccent: '#141414',
      mainAreaText: '#FFFFFF',
      supportiveText: '#9CA3AF',
    },
  },
}

function ActiveCall({ call, displayName, onLeave }) {
  const containerRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const frame = DailyIframe.createFrame(containerRef.current, {
      showLeaveButton: false,
      theme: DAILY_THEME,
      iframeStyle: { position: 'absolute', inset: '0', width: '100%', height: '100%', border: 'none' },
    })
    frameRef.current = frame
    frame.join({ url: call.room_url, userName: displayName })
    return () => { frame.destroy(); frameRef.current = null }
  }, [call.room_url])

  function handleLeave() {
    frameRef.current?.leave()
    onLeave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>
      {/* Terminar llamada — fixed bottom centered */}
      <div style={{
        position: 'absolute', bottom: 32, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <button
          onClick={handleLeave}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 999, border: 'none',
            background: '#DC2626',
            color: 'white', fontWeight: 800, fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
            fontFamily: SANS,
          }}
        >
          📵 Terminar llamada
        </button>
      </div>

      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
