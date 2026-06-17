import { useEffect, useRef, useState } from 'react'
import { useSpeechToText } from '../hooks/useSpeechToText'

function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return MediaRecorder.isTypeSupported
    ? (candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '')
    : ''
}

// Equalizer bars for record mode
function EqBars() {
  const bars = [
    { h: 28, delay: '0s'    },
    { h: 20, delay: '0.15s' },
    { h: 32, delay: '0.3s'  },
    { h: 16, delay: '0.08s' },
    { h: 26, delay: '0.45s' },
    { h: 22, delay: '0.22s' },
    { h: 30, delay: '0.38s' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 32 }}>
      {bars.map(({ h, delay }, i) => (
        <div key={i} style={{
          width: 4, borderRadius: 3, height: h,
          background: 'linear-gradient(to top, #D63031, #FF6B6B)',
          transformOrigin: 'bottom',
          animation: `vr-bar ${0.55 + (i % 3) * 0.12}s ease-in-out infinite ${delay}`,
        }} />
      ))}
    </div>
  )
}

/**
 * VoiceRecorder — componente unificado de grabación de voz.
 *
 * Props:
 *   mode          'transcribe' | 'record'   — transcribe usa Web Speech API; record usa MediaRecorder
 *   onTranscript  fn(text)                  — llamado al transcribir texto final (mode=transcribe)
 *   onAudioBlob   fn(blob, durationSecs)    — llamado al terminar grabación (mode=record)
 *   language      string                    — idioma para Speech API (default 'es-MX')
 *   placeholder   string                    — texto en reposo
 */
export default function VoiceRecorder({
  mode = 'transcribe',
  onTranscript,
  onAudioBlob,
  language = 'es-MX',
  placeholder = 'Toca para grabar',
}) {
  const [active, setActive]   = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError]     = useState('')

  const timerRef    = useRef(null)
  const recorderRef = useRef(null)
  const streamRef   = useRef(null)
  const chunksRef   = useRef([])
  const mimeRef     = useRef('')

  const { interim, error: speechError, supported, start: startSpeech, stop: stopSpeech } =
    useSpeechToText(text => onTranscript?.(text))

  useEffect(() => {
    if (speechError) setError(speechError)
  }, [speechError])

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (mode === 'transcribe') stopSpeech()
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  async function handleTap() {
    if (!active) {
      setError('')
      setElapsed(0)

      if (mode === 'transcribe') {
        if (!supported) {
          setError('Usa Chrome o Safari para esta función.')
          return
        }
        startSpeech()
        setActive(true)
        timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          chunksRef.current = []
          const mime = pickMimeType()
          mimeRef.current = mime
          streamRef.current = stream
          const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
          recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
          recorder.start(250)
          recorderRef.current = recorder
          setActive(true)
          timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)
        } catch {
          setError('No se pudo acceder al micrófono. Verifica los permisos del navegador.')
        }
      }
    } else {
      clearInterval(timerRef.current)

      if (mode === 'transcribe') {
        stopSpeech()
        setActive(false)
      } else {
        const recorder = recorderRef.current
        const stream   = streamRef.current
        const duration = elapsed

        if (!recorder || recorder.state === 'inactive') {
          stream?.getTracks().forEach(t => t.stop())
          setActive(false)
          setElapsed(0)
          return
        }

        await new Promise(resolve => {
          recorder.onstop = () => {
            stream?.getTracks().forEach(t => t.stop())
            resolve()
          }
          recorder.stop()
        })

        recorderRef.current = null
        streamRef.current   = null

        const mime = mimeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })

        if (blob.size > 0) {
          onAudioBlob?.(blob, duration)
        } else {
          setError('No se capturó audio. Intenta de nuevo.')
        }

        setActive(false)
        setElapsed(0)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <style>{`
        @keyframes vr-rec  { 0%{transform:scale(1);opacity:.5}  100%{transform:scale(2.4);opacity:0} }
        @keyframes vr-idle { 0%{transform:scale(1);opacity:.4}  100%{transform:scale(2.1);opacity:0} }
        @keyframes vr-bar  { 0%,100%{transform:scaleY(.25)} 50%{transform:scaleY(1)} }
      `}</style>

      {/* Mic button with ripple rings */}
      <div style={{ position: 'relative', width: 88, height: 88 }}>
        {(active ? [0, 0.5, 1] : [0, 0.7, 1.4]).map((delay, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: active ? 'rgba(220,38,38,0.18)' : 'rgba(11,79,74,0.12)',
            animation: `${active ? 'vr-rec 1.6s' : 'vr-idle 2.1s'} ease-out infinite ${delay}s`,
            pointerEvents: 'none',
          }} />
        ))}
        <button
          onClick={handleTap}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%', border: 'none',
            background: active
              ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
              : 'linear-gradient(135deg, #0B4F4A, #0d6b63)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: active
              ? '0 0 0 4px rgba(220,38,38,0.2), 0 6px 20px rgba(185,28,28,0.4)'
              : '0 6px 20px rgba(11,79,74,0.35)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          <span style={{ fontSize: 32 }}>{active ? '⏹' : '🎙️'}</span>
        </button>
      </div>

      {/* Equalizer bars (record mode only) */}
      {active && mode === 'record' && <EqBars />}

      {/* Timer */}
      {active && (
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: '#1A1A1A' }}>
          {fmt(elapsed)}
        </p>
      )}

      {/* Status text */}
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: active ? '#DC2626' : '#0B4F4A' }}>
        {active ? 'Grabando... toca para detener' : placeholder}
      </p>

      {/* Live interim text (transcribe mode) */}
      {active && mode === 'transcribe' && interim && (
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', maxWidth: 280 }}>
          {interim}...
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 12, color: '#DC2626', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}
