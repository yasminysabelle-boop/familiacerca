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
    setScheduling(true)
    setScheduleError('')
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString()
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
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al programar')
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

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['list', 'schedule'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1, padding: '9px', borderRadius: 10, border: 'none',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: view === v ? '#4A7C59' : '#F3F4F6',
                color: view === v ? 'white' : '#6B7280',
              }}
            >
              {v === 'list' ? 'Próximas llamadas' : '+ Programar'}
            </button>
          ))}
        </div>

        {/* ─── VIEW: LISTA ─── */}
        {view === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingCalls && (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Cargando...</p>
            )}
            {!loadingCalls && upcomingCalls.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 32 }}>📅</p>
                <p style={{ fontSize: 14, color: '#6B7280', margin: '8px 0 0' }}>
                  No hay llamadas programadas
                </p>
                <button
                  onClick={() => setView('schedule')}
                  style={{
                    marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none',
                    background: '#4A7C59', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Programar ahora →
                </button>
              </div>
            )}
            {upcomingCalls.map(call => {
              const mins = minutesUntil(call.scheduled_at)
              const canJoinNow = mins <= 15
              const isLive = mins <= 0 && mins > -60
              return (
                <div
                  key={call.id}
                  style={{
                    padding: '14px', borderRadius: 14,
                    border: `1.5px solid ${isLive ? '#4A7C59' : '#E5E0D8'}`,
                    background: isLive ? '#F0F9F4' : '#FAFAF9',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                      {call.title}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: isLive ? '#4A7C59' : '#6B7280', fontWeight: isLive ? 700 : 400 }}>
                      {isLive ? '🟢 En curso' : fmtScheduled(call.scheduled_at)}
                      {!isLive && canJoinNow && ` · en ${mins} min`}
                    </p>
                  </div>
                  <button
                    onClick={() => joinCall(call)}
                    style={{
                      padding: '8px 16px', borderRadius: 10, border: 'none',
                      background: canJoinNow ? '#4A7C59' : '#E5E0D8',
                      color: canJoinNow ? 'white' : '#9CA3AF',
                      fontWeight: 700, fontSize: 13,
                      cursor: canJoinNow ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                  >
                    {canJoinNow ? 'Unirse' : 'Ver'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── VIEW: PROGRAMAR ─── */}
        {view === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <VoiceInput
              value={title}
              onChange={setTitle}
              placeholder="Ej: Reunión semanal, Actualización médica..."
              rows={1}
              label="Título (opcional)"
            />

            {/* Fecha y hora */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Fecha</label>
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  onChange={e => setDate(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #D1C9BF', fontSize: 14, color: '#1A1A1A' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Hora</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #D1C9BF', fontSize: 14, color: '#1A1A1A' }}
                />
              </div>
            </div>

            {/* Participantes */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Participantes
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: members.length > 0 && participantMode === 'select' ? 10 : 0 }}>
                {['all', 'select'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setParticipantMode(mode)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                      border: `1.5px solid ${participantMode === mode ? '#4A7C59' : '#D1C9BF'}`,
                      background: participantMode === mode ? '#4A7C59' : 'white',
                      color: participantMode === mode ? 'white' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'all' ? '👨‍👩‍👧 Todos' : '✓ Escoger'}
                  </button>
                ))}
              </div>
              {participantMode === 'select' && members.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map(m => (
                    <label
                      key={m.member_user_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                        background: selectedIds.includes(m.member_user_id) ? '#F0F9F4' : '#F9F7F4',
                        border: `1px solid ${selectedIds.includes(m.member_user_id) ? '#BBF7D0' : '#E5E0D8'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(m.member_user_id)}
                        onChange={e => setSelectedIds(prev =>
                          e.target.checked
                            ? [...prev, m.member_user_id]
                            : prev.filter(id => id !== m.member_user_id)
                        )}
                        style={{ width: 16, height: 16, accentColor: '#4A7C59' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>
                        {m.role === 'cuidador' ? 'Cuidador' : 'Familiar'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {participantMode === 'select' && members.length === 0 && (
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
                  No hay miembros adicionales en la familia.
                </p>
              )}
            </div>

            {scheduleError && (
              <p style={{ margin: 0, fontSize: 12, color: '#DC2626', padding: '8px 12px', borderRadius: 8, background: '#FEF2F2' }}>
                {scheduleError}
              </p>
            )}

            <button
              onClick={handleSchedule}
              disabled={!date || !time || scheduling}
              style={{
                padding: '15px', borderRadius: 14, border: 'none',
                background: date && time && !scheduling ? '#4A7C59' : '#9CA3AF',
                color: 'white', fontWeight: 800, fontSize: 15,
                cursor: date && time && !scheduling ? 'pointer' : 'default',
                boxShadow: date && time ? '0 4px 16px rgba(74,124,89,0.3)' : 'none',
              }}
            >
              {scheduling ? 'Programando...' : '📅 Programar videollamada'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
