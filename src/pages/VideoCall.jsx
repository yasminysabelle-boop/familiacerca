import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { Video } from '../components/Icons'

const SERVICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`

const SPIN_KEYFRAMES = '@keyframes spin { to { transform: rotate(360deg); } }'

function fmtScheduled(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function VideoIconCircle({ icon }) {
  return (
    <div style={{
      width: 88, height: 88, borderRadius: '50%',
      background: '#F0EDE6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon ?? <Video size={40} color="#143C32" strokeWidth={1.75} />}
    </div>
  )
}

export default function VideoCall() {
  const [searchParams] = useSearchParams()
  const callId = searchParams.get('id')
  const navigate = useNavigate()
  const { ownerId } = useFamily()
  const { user } = useAuth()

  const [call, setCall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [permStatus, setPermStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied'

  const [startingInstant, setStartingInstant] = useState(false)
  const [instantError, setInstantError] = useState('')

  // Schedule state (no-callId screen only)
  const [schedView, setSchedView] = useState('instant') // 'instant' | 'schedule'
  const [schedTitle, setSchedTitle] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [schedError, setSchedError] = useState('')
  const [schedSuccess, setSchedSuccess] = useState(null)
  const [scheduledCalls, setScheduledCalls] = useState([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)

  useEffect(() => {
    if (!callId) return
    load()
  }, [callId])

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

  async function loadScheduledCalls() {
    if (!ownerId) return
    setLoadingScheduled(true)
    const { data } = await supabase
      .from('scheduled_calls')
      .select('id, title, scheduled_at, status')
      .eq('patient_id', ownerId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5)
    setScheduledCalls(data ?? [])
    setLoadingScheduled(false)
  }

  function openScheduleTab() {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    setSchedDate(now.toISOString().slice(0, 10))
    setSchedTime(`${String(now.getHours()).padStart(2, '0')}:00`)
    setSchedError('')
    setSchedSuccess(null)
    setSchedView('schedule')
    loadScheduledCalls()
  }

  async function handleSchedule() {
    if (!schedDate || !schedTime) return
    const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString()
    if (new Date(scheduledAt) <= new Date()) {
      setSchedError('La fecha y hora deben ser en el futuro.')
      return
    }
    setScheduling(true)
    setSchedError('')
    try {
      const { error: insErr } = await supabase.from('scheduled_calls').insert({
        patient_id: ownerId,
        family_id: ownerId,
        scheduled_at: scheduledAt,
        created_by: user?.id,
        status: 'scheduled',
        title: schedTitle.trim() || 'Videollamada familiar',
      })
      if (insErr) throw insErr
      setSchedSuccess({ scheduled_at: scheduledAt })
      setSchedTitle('')
      loadScheduledCalls()
    } catch (err) {
      setSchedError(err.message)
    } finally {
      setScheduling(false)
    }
  }

  // No callId — pantalla de inicio rápido
  if (!callId) {
    const minDate = new Date().toISOString().slice(0, 10)
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 8, padding: '16px 20px 4px', flexShrink: 0 }}>
            {[
              { key: 'instant', label: '📹 Iniciar ahora' },
              { key: 'schedule', label: '📅 Programar' },
            ].map(tab => {
              const active = schedView === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => tab.key === 'schedule' ? openScheduleTab() : setSchedView('instant')}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 20,
                    border: active ? 'none' : '1.5px solid #EDE5D8',
                    background: active ? '#E9826E' : 'transparent',
                    color: active ? '#143C32' : '#6B7280',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* ── TAB: INICIAR AHORA ── */}
          {schedView === 'instant' && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 24, padding: '32px 24px 48px',
            }}>
              <VideoIconCircle />
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#143C32', fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
                  Videollamada familiar
                </p>
                <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>
                  La sala se abre al instante para toda la familia
                </p>
              </div>
              {instantError && (
                <div style={{
                  padding: '12px 16px', borderRadius: 12, maxWidth: 320,
                  background: '#FEF0ED', border: '1px solid #F5C6BB',
                }}>
                  <p style={{ color: '#B91C1C', fontSize: 13, fontWeight: 600, margin: 0 }}>{instantError}</p>
                </div>
              )}
              <button
                onClick={handleInstantCall}
                disabled={startingInstant}
                style={{
                  padding: '16px 40px', borderRadius: 16, border: 'none',
                  background: startingInstant ? '#C9C2B4' : '#143C32',
                  color: 'white', fontWeight: 800, fontSize: 16,
                  cursor: startingInstant ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                {startingInstant ? (
                  <>
                    <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Iniciando...
                  </>
                ) : 'Iniciar llamada ahora'}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}
              >
                Volver al inicio
              </button>
            </div>
          )}

          {/* ── TAB: PROGRAMAR ── */}
          {schedView === 'schedule' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 48px' }}>

              {schedSuccess ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <span style={{ fontSize: 56 }}>✅</span>
                  <p style={{ color: '#143C32', fontSize: 20, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '16px 0 8px' }}>
                    ¡Videollamada programada!
                  </p>
                  <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
                    {'Videollamada programada para '}
                    {new Date(schedSuccess.scheduled_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' a las '}
                    {new Date(schedSuccess.scheduled_at).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                  <button
                    onClick={() => setSchedSuccess(null)}
                    style={{
                      padding: '12px 28px', borderRadius: 14, border: '1.5px solid #EDE5D8',
                      background: 'transparent', color: '#143C32',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    Programar otra
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Título (opcional)
                    </label>
                    <input
                      type="text"
                      value={schedTitle}
                      onChange={e => setSchedTitle(e.target.value)}
                      placeholder="Ej: Reunión semanal, Actualización médica..."
                      style={{
                        padding: '12px 14px', borderRadius: 12,
                        border: '1.5px solid #EDE5D8',
                        background: 'white',
                        color: '#1A1A1A', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={schedDate}
                        min={minDate}
                        onChange={e => setSchedDate(e.target.value)}
                        style={{
                          padding: '12px 10px', borderRadius: 12,
                          border: '1.5px solid #EDE5D8',
                          background: 'white',
                          color: '#1A1A1A', fontSize: 14, outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Hora
                      </label>
                      <input
                        type="time"
                        value={schedTime}
                        onChange={e => setSchedTime(e.target.value)}
                        style={{
                          padding: '12px 10px', borderRadius: 12,
                          border: '1.5px solid #EDE5D8',
                          background: 'white',
                          color: '#1A1A1A', fontSize: 14, outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {schedError && (
                    <p style={{ margin: 0, fontSize: 13, color: '#B91C1C', padding: '10px 14px', borderRadius: 10, background: '#FEF0ED', border: '1px solid #F5C6BB' }}>
                      {schedError}
                    </p>
                  )}

                  <button
                    onClick={handleSchedule}
                    disabled={!schedDate || !schedTime || scheduling}
                    style={{
                      padding: '15px', borderRadius: 16, border: 'none',
                      background: schedDate && schedTime && !scheduling ? '#143C32' : '#E5DED2',
                      color: schedDate && schedTime && !scheduling ? 'white' : '#9CA3AF',
                      fontWeight: 800, fontSize: 15,
                      cursor: schedDate && schedTime && !scheduling ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    }}
                  >
                    {scheduling ? (
                      <>
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Programando...
                      </>
                    ) : 'Programar videollamada'}
                  </button>
                </div>
              )}

              {/* Próximas programadas */}
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.07em' }}>PRÓXIMAS</span>
                  <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
                </div>
                {loadingScheduled ? (
                  <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Cargando...</p>
                ) : scheduledCalls.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No hay videollamadas programadas</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {scheduledCalls.map(sc => {
                      const minsLeft = Math.round((new Date(sc.scheduled_at) - Date.now()) / 60000)
                      const canJoin = minsLeft <= 15
                      return (
                        <div
                          key={sc.id}
                          style={{
                            padding: '14px', borderRadius: 14,
                            border: `1px solid ${canJoin ? '#143C32' : '#EDE5D8'}`,
                            background: canJoin ? '#EAF3EC' : 'white',
                          }}
                        >
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#143C32' }}>
                            {sc.title || 'Videollamada familiar'}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: canJoin ? '#16A34A' : '#6B7280' }}>
                            {fmtScheduled(sc.scheduled_at)}
                            {canJoin && minsLeft > 0 && ` · en ${minsLeft} min`}
                            {canJoin && minsLeft <= 0 && ' · 🟢 En curso'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <style>{SPIN_KEYFRAMES}</style>
        </div>
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
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#143C32', animation: 'spin 0.8s linear infinite' }} />
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
        }}>
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p style={{ color: '#143C32', fontSize: 15, textAlign: 'center' }}>
            {error || 'Videollamada no encontrada'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: '#143C32', color: 'white', fontWeight: 700,
              fontSize: 14, cursor: 'pointer',
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
              background: '#143C32', color: 'white', fontWeight: 700,
              fontSize: 14, cursor: 'pointer',
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
      // as active before the Daily.co iframe loads and requests it again.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setPermStatus('granted')
      setJoined(true)
      // Stop tracks after a short delay — the iframe will have initialized by then
      setTimeout(() => stream.getTracks().forEach(t => t.stop()), 1500)
    } catch {
      setPermStatus('denied')
    }
  }

  // Lobby screen — shown before joining (and when too early)
  if (!joined) {
    return (
      <Layout>
        <div style={{
          minHeight: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '32px 24px 48px',
        }}>
          <VideoIconCircle icon={isTooEarly ? <span style={{ fontSize: 36 }}>⏰</span> : undefined} />

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#143C32', fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
              {call.title}
            </p>
            <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>
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
              <p style={{ margin: '6px 0 0', color: '#143C32', fontSize: 32, fontWeight: 800 }}>
                {minutesUntil} min
              </p>
              <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 12 }}>
                Disponible 15 minutos antes
              </p>
            </div>
          ) : (
            <>
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
                    style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#143C32', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}

              <button
                onClick={requestPermissionsAndJoin}
                disabled={permStatus === 'requesting'}
                style={{
                  padding: '16px 40px', borderRadius: 16, border: 'none',
                  background: permStatus === 'requesting' ? '#C9C2B4' : '#143C32',
                  color: 'white', fontWeight: 800, fontSize: 16,
                  cursor: permStatus === 'requesting' ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                {permStatus === 'requesting' ? (
                  <>
                    <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Conectando...
                  </>
                ) : 'Unirse a la llamada'}
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: 'none',
              color: '#6B7280', fontSize: 13, cursor: 'pointer',
            }}
          >
            Volver atrás
          </button>
          <style>{SPIN_KEYFRAMES}</style>
        </div>
      </Layout>
    )
  }

  // Active call screen — iframe + visible hang-up button.
  // Deliberately NOT wrapped in <Layout>: full-bleed dark background, no
  // header, no bottom nav — matches the industry-standard video-call UI.
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
          onClick={() => { setJoined(false); navigate('/dashboard') }}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 999, border: 'none',
            background: '#DC2626',
            color: 'white', fontWeight: 800, fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
          }}
        >
          📵 Terminar llamada
        </button>
      </div>

      {/* Daily.co iframe */}
      <iframe
        src={call.room_url}
        allow="camera *; microphone *; fullscreen *; display-capture *; autoplay *"
        allowusermedia="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          border: 'none',
        }}
        title={call.title}
      />
    </div>
  )
}
