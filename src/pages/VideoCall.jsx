import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'

const SERVICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`

function fmtScheduled(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function VideoCall() {
  const [searchParams] = useSearchParams()
  const callId = searchParams.get('id')
  const navigate = useNavigate()
  const { ownerId } = useFamily()

  const [call, setCall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [permStatus, setPermStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied'

  const [startingInstant, setStartingInstant] = useState(false)
  const [instantError, setInstantError] = useState('')

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

  // No callId — pantalla de inicio rápido
  if (!callId) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'white', flexShrink: 0,
            }}
          >
            ←
          </button>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white' }}>Videollamada</p>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24, padding: '32px 24px',
        }}>
          <span style={{ fontSize: 72 }}>📹</span>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
              Videollamada familiar
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>
              La sala se abre al instante para toda la familia
            </p>
          </div>

          {instantError && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, maxWidth: 320,
              background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
            }}>
              <p style={{ color: '#FCA5A5', fontSize: 13, fontWeight: 600, margin: 0 }}>{instantError}</p>
            </div>
          )}

          <button
            onClick={handleInstantCall}
            disabled={startingInstant}
            style={{
              padding: '16px 40px', borderRadius: 20, border: 'none',
              background: startingInstant
                ? 'rgba(255,255,255,0.2)'
                : 'linear-gradient(135deg, #0d6b63, #2D6A4F)',
              color: 'white', fontWeight: 800, fontSize: 16,
              cursor: startingInstant ? 'default' : 'pointer',
              boxShadow: startingInstant ? 'none' : '0 8px 32px rgba(13,107,99,0.4)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {startingInstant ? (
              <>
                <div style={{
                  width: 18, height: 18, border: '2px solid white',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Iniciando...
              </>
            ) : '📹 Iniciar llamada ahora'}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer' }}
          >
            Volver al inicio
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0A0A0A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <span style={{ fontSize: 40 }}>📹</span>
        <p style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>Conectando...</p>
      </div>
    )
  }

  if (error || !call) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0A0A0A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 24,
      }}>
        <span style={{ fontSize: 40 }}>⚠️</span>
        <p style={{ color: 'white', fontSize: 15, textAlign: 'center' }}>
          {error || 'Videollamada no encontrada'}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '12px 28px', borderRadius: 12, border: 'none',
            background: '#0d6b63', color: 'white', fontWeight: 700,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Volver al inicio
        </button>
      </div>
    )
  }

  const minutesUntil = Math.round((new Date(call.scheduled_at) - Date.now()) / 60000)
  const isTooEarly = minutesUntil > 15
  const isExpired = minutesUntil < -120

  if (isExpired) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0A0A0A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 24,
      }}>
        <span style={{ fontSize: 40 }}>🕐</span>
        <p style={{ color: 'white', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{call.title}</p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>
          Esta llamada ya terminó.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '12px 28px', borderRadius: 12, border: 'none',
            background: '#0d6b63', color: 'white', fontWeight: 700,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Volver al inicio
        </button>
      </div>
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
      <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'white', flexShrink: 0,
            }}
          >
            ←
          </button>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {call.title}
          </p>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '32px 24px',
        }}>
          <span style={{ fontSize: 64 }}>{isTooEarly ? '⏰' : '📹'}</span>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
              {call.title}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>
              {fmtScheduled(call.scheduled_at)}
            </p>
          </div>

          {isTooEarly ? (
            <div style={{
              padding: '16px 24px', borderRadius: 16,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              textAlign: 'center',
            }}>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                La sala abre en
              </p>
              <p style={{ margin: '6px 0 0', color: 'white', fontSize: 32, fontWeight: 800 }}>
                {minutesUntil} min
              </p>
              <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                Disponible 15 minutos antes
              </p>
            </div>
          ) : (
            <>
              {permStatus === 'denied' && (
                <div style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
                  textAlign: 'center', maxWidth: 320,
                }}>
                  <p style={{ color: '#FCA5A5', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                    Permisos denegados
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Activa cámara y micrófono desde los ajustes de tu navegador.
                  </p>
                  <button
                    onClick={requestPermissionsAndJoin}
                    style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}

              <button
                onClick={requestPermissionsAndJoin}
                disabled={permStatus === 'requesting'}
                style={{
                  padding: '16px 40px', borderRadius: 20, border: 'none',
                  background: permStatus === 'requesting'
                    ? 'rgba(255,255,255,0.2)'
                    : 'linear-gradient(135deg, #0d6b63, #2D6A4F)',
                  color: 'white', fontWeight: 800, fontSize: 16,
                  cursor: permStatus === 'requesting' ? 'default' : 'pointer',
                  boxShadow: permStatus === 'requesting' ? 'none' : '0 8px 32px rgba(13,107,99,0.4)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                {permStatus === 'requesting' ? (
                  <>
                    <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Conectando...
                  </>
                ) : (
                  <>
                    📹 Unirse a la llamada
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Volver atrás
          </button>
        </div>
      </div>
    )
  }

  // Active call screen — iframe + visible hang-up button
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>
      {/* Hang-up bar — always visible */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 16px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        pointerEvents: 'none',
      }}>
        <button
          onClick={() => { setJoined(false) }}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 32px', borderRadius: 30, border: 'none',
            background: '#DC2626',
            color: 'white', fontWeight: 800, fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
          }}
        >
          📵 Colgar
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
