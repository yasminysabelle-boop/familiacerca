import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import VoiceInput from './VoiceInput'

const SERVICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`

function fmtScheduled(isoStr) {
  const d = new Date(isoStr)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const dayLabel = isToday ? 'Hoy' : isTomorrow ? 'Mañana'
    : d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dayLabel} ${timeLabel}`
}

function minutesUntil(isoStr) {
  return Math.round((new Date(isoStr) - Date.now()) / 60000)
}

export default function VideoCallScheduleModal({ open, onClose }) {
  const { user } = useAuth()
  const { ownerId, profile } = useFamily()
  const navigate = useNavigate()

  const [view, setView] = useState('list') // 'list' | 'schedule'
  const [upcomingCalls, setUpcomingCalls] = useState([])
  const [loadingCalls, setLoadingCalls] = useState(false)

  const [startingInstant, setStartingInstant] = useState(false)
  const [instantError, setInstantError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [participantMode, setParticipantMode] = useState('all') // 'all' | 'select'
  const [members, setMembers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

  // Defaults: today's date, next round hour
  useEffect(() => {
    if (!open) return
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    setDate(now.toISOString().slice(0, 10))
    setTime(`${String(now.getHours()).padStart(2, '0')}:00`)
    setView('list')
    setScheduleError('')
    loadUpcoming()
    loadMembers()
  }, [open, ownerId])

  async function loadUpcoming() {
    if (!ownerId) return
    setLoadingCalls(true)
    const { data } = await supabase
      .from('video_calls')
      .select('id, title, scheduled_at, participants, status, room_url')
      .eq('owner_id', ownerId)
      .in('status', ['scheduled', 'active'])
      .gte('scheduled_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5)
    setUpcomingCalls(data ?? [])
    setLoadingCalls(false)
  }

  async function loadMembers() {
    if (!ownerId) return
    const { data } = await supabase
      .from('family_members')
      .select('member_user_id, member_email, role')
      .eq('user_id', ownerId)
    const withProfiles = await Promise.all(
      (data ?? []).map(async m => {
        const { data: p } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', m.member_user_id)
          .maybeSingle()
        return { ...m, name: p?.full_name ?? m.member_email }
      })
    )
    setMembers(withProfiles)
  }

  async function handleSchedule() {
    if (!date || !time) return
    const scheduledAt = new Date(`${date}T${time}`).toISOString()
    if (new Date(scheduledAt) <= new Date()) {
      setScheduleError('La fecha y hora deben ser en el futuro.')
      return
    }
    setScheduling(true)
    setScheduleError('')
    try {
      const participants = participantMode === 'all'
        ? 'all'
        : selectedIds.length > 0 ? selectedIds : 'all'
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ownerId,
          title: title.trim() || 'Videollamada familiar',
          scheduledAt,
          participants,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setView('list')
      loadUpcoming()
      setTitle('')
    } catch (err) {
      setScheduleError(err.message)
    } finally {
      setScheduling(false)
    }
  }

  function joinCall(call) {
    onClose()
    navigate(`/videollamada?id=${call.id}`)
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
      onClose()
      navigate(`/videollamada?id=${body.callId}`)
    } catch (err) {
      setInstantError(err.message)
      setStartingInstant(false)
    }
  }

  if (!open) return null

  const minDate = new Date().toISOString().slice(0, 10)
  const canJoin = call => minutesUntil(call.scheduled_at) <= 15

  // Portal to document.body — escapes Layout's stacking context so z-index
  // is resolved in the root context, above the bottom nav (z-index: 40).
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'white', borderRadius: '24px 24px 0 0',
        padding: '24px 20px calc(env(safe-area-inset-bottom) + 96px)',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📹</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
                Videollamadas
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>
                {profile?.name ? `Sala de ${profile.name}` : 'Sala familiar'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16, color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {/* Instant call — only option */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleInstantCall}
            disabled={startingInstant}
            style={{
              width: '100%', padding: '15px', borderRadius: 16, border: 'none',
              background: startingInstant
                ? '#9CA3AF'
                : 'linear-gradient(135deg, #0d6b63, #2D6A4F)',
              color: 'white', fontWeight: 800, fontSize: 15,
              cursor: startingInstant ? 'default' : 'pointer',
              boxShadow: startingInstant ? 'none' : '0 6px 20px rgba(13,107,99,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.2s',
            }}
          >
            {startingInstant ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Iniciando...
              </>
            ) : '📹 Iniciar llamada ahora'}
          </button>
          {instantError && (
            <p style={{ margin: 0, fontSize: 12, color: '#DC2626', padding: '8px 12px', borderRadius: 8, background: '#FEF2F2' }}>
              {instantError}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
