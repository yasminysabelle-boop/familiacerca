import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'
import VoiceInput from './VoiceInput'

const SERVICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`
const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

function fmtScheduled(isoStr) {
  const d = new Date(isoStr)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const dayLabel = isToday ? 'Hoy' : isTomorrow ? 'Mañana'
    : d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dayLabel} · ${timeLabel}`
}

function minutesUntil(isoStr) {
  return Math.round((new Date(isoStr) - Date.now()) / 60000)
}

export default function VideoCallScheduleModal({ open, onClose }) {
  const { ownerId } = useFamily()
  const navigate = useNavigate()

  const [upcomingCalls, setUpcomingCalls] = useState([])
  const [loadingCalls, setLoadingCalls] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
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
    setScheduleError('')
    loadUpcoming()
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
          participants: 'all',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setTitle('')
      loadUpcoming()
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
  const isLive = call => {
    const mins = minutesUntil(call.scheduled_at)
    return mins <= 0 && mins > -60
  }
  const canJoinSoon = call => minutesUntil(call.scheduled_at) <= 15

  // Portal to document.body — escapes Layout's stacking context so z-index
  // is resolved in the root context, above the bottom nav (z-index: 40).
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(30,30,26,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        fontFamily: SANS,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#FFFFFF', borderRadius: '26px 26px 0 0',
        boxShadow: '0 -16px 40px rgba(51,65,85,0.18)',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Fijo: header + formulario — no scrollea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 20px 18px', flexShrink: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#065A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#334155', fontFamily: SANS }}>Programar llamada</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
            </button>
          </div>

          {/* Form */}
          <VoiceInput
            value={title}
            onChange={setTitle}
            placeholder="Ej: Cena familiar, control médico..."
            rows={1}
            label="Título de la llamada"
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</label>
              <input
                type="date"
                value={date}
                min={minDate}
                onChange={e => setDate(e.target.value)}
                style={{ padding: '11px 13px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: '#F8F4ED', fontSize: 14, color: '#334155', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hora</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{ padding: '11px 13px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: '#F8F4ED', fontSize: 14, color: '#334155', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {scheduleError && (
            <p style={{ margin: 0, fontSize: 13, color: '#B91C1C', padding: '10px 14px', borderRadius: 10, background: '#FEF0ED', border: '1px solid #F5C6BB' }}>
              {scheduleError}
            </p>
          )}

          <button
            onClick={handleSchedule}
            disabled={!date || !time || scheduling}
            style={{
              width: '100%', padding: 14, borderRadius: 15, border: 'none',
              background: date && time && !scheduling ? '#087F70' : '#E5DED2',
              color: date && time && !scheduling ? 'white' : '#9CA3AF',
              fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
              cursor: date && time && !scheduling ? 'pointer' : 'default',
              boxShadow: date && time && !scheduling ? '0 6px 18px rgba(8,127,112,0.35)' : 'none',
            }}
          >
            {scheduling ? 'Programando...' : 'Programar'}
          </button>
        </div>

        {/* Scrolleable: divisor "Programadas" + lista — crece dentro del espacio restante bajo el form fijo */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 18,
          padding: '0 20px calc(env(safe-area-inset-bottom) + 32px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#9CA3AF', textTransform: 'uppercase' }}>Programadas</span>
            <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loadingCalls && (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Cargando...</p>
          )}
          {!loadingCalls && upcomingCalls.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '26px 16px', border: '1.5px dashed #C9BFA9', borderRadius: 18 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#065A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg>
              <span style={{ fontSize: 13.5, color: '#64748B', fontWeight: 600 }}>No hay llamadas programadas</span>
            </div>
          )}
          {upcomingCalls.map(call => {
            const live = isLive(call)
            const joinSoon = canJoinSoon(call)
            return (
              <div
                key={call.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: live ? '#EAF7EE' : '#F8F4ED',
                  border: `1px solid ${live ? '#BFE5CC' : '#EDE5D8'}`,
                  borderRadius: 16, padding: '13px 14px',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#065A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 8l5-3v14l-5-3"></path><rect x="2" y="6" width="13" height="12" rx="2.5"></rect></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {call.title}
                    </p>
                    {live && (
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', padding: '2px 7px', borderRadius: 999, background: '#16A34A', color: 'white', flexShrink: 0 }}>
                        EN CURSO
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: live ? '#16A34A' : '#64748B', fontWeight: live ? 700 : 400 }}>
                    {live ? 'En curso ahora' : fmtScheduled(call.scheduled_at)}
                  </p>
                </div>
                <button
                  onClick={() => joinCall(call)}
                  style={{
                    padding: '8px 15px', borderRadius: 11, border: 'none',
                    background: (live || joinSoon) ? '#087F70' : 'transparent',
                    color: (live || joinSoon) ? 'white' : '#9CA3AF',
                    fontWeight: (live || joinSoon) ? 800 : 700, fontSize: 12.5, fontFamily: 'inherit',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {live || joinSoon ? 'Unirse' : 'Ver'}
                </button>
              </div>
            )
          })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
