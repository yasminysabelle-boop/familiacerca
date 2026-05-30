import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'

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

  useEffect(() => {
    if (!callId) { navigate('/dashboard', { replace: true }); return }
    load()
  }, [callId])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('video_calls')
      .select('id, title, scheduled_at, room_url, status, owner_id')
      .eq('id', callId)
      .maybeSingle()
    if (err || !data) {
      setError('No se encontró la videollamada.')
    } else {
      setCall(data)
    }
    setLoading(false)
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
            background: '#4A7C59', color: 'white', fontWeight: 700,
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
            background: '#4A7C59', color: 'white', fontWeight: 700,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 10,
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {call.title}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {fmtScheduled(call.scheduled_at)}
          </p>
        </div>
        {isTooEarly && (
          <span style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: 'rgba(255,165,0,0.25)', color: '#FFA500',
          }}>
            En {minutesUntil} min
          </span>
        )}
      </div>

      {/* Daily.co iframe — toma todo el espacio restante */}
      <div style={{ flex: 1, position: 'relative' }}>
        {isTooEarly ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
          }}>
            <span style={{ fontSize: 56 }}>⏰</span>
            <p style={{ color: 'white', fontSize: 20, fontWeight: 800, textAlign: 'center', fontFamily: 'Georgia, serif' }}>
              {call.title}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              La sala abre 15 minutos antes de la llamada.
            </p>
            <div style={{
              padding: '16px 24px', borderRadius: 16,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              textAlign: 'center',
            }}>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Comienza en
              </p>
              <p style={{ margin: '6px 0 0', color: 'white', fontSize: 28, fontWeight: 800 }}>
                {minutesUntil} min
              </p>
              <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                {fmtScheduled(call.scheduled_at)}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: 'white',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Volver al inicio
            </button>
          </div>
        ) : (
          <iframe
            src={call.room_url}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              border: 'none',
            }}
            title={call.title}
          />
        )}
      </div>
    </div>
  )
}
