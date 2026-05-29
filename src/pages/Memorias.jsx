import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { track } from '../lib/analytics'
import { useSpeechToText } from '../hooks/useSpeechToText'

const MOODS = [
  { value: 'good',    emoji: '😊', label: 'Buen día',   color: '#22C55E' },
  { value: 'regular', emoji: '😐', label: 'Regular',    color: '#C9882A' },
  { value: 'hard',    emoji: '😔', label: 'Difícil',    color: '#D63031' },
]

function fmt(s) {
  const m = Math.floor((s ?? 0) / 60), sec = (s ?? 0) % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function isoDateKey(dateStr) {
  return dateStr.split('T')[0]
}

function groupByDate(recs) {
  const groups = {}
  for (const r of recs) {
    const key = isoDateKey(r.created_at)
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }
  const todayKey = isoDateKey(new Date().toISOString())
  const yesterdayKey = isoDateKey(new Date(Date.now() - 86400000).toISOString())
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      let label
      if (key === todayKey) label = 'Hoy'
      else if (key === yesterdayKey) label = 'Ayer'
      else {
        const d = new Date(key + 'T12:00:00')
        label = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      }
      return { key, label, items }
    })
}

export default function Memorias() {
  const { user } = useAuth()
  const { profile, ownerId, memberRole } = useFamily()
  const isFamiliar = memberRole === 'familiar'
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('idle') // 'idle' | 'recording' | 'saving'
  const [elapsed, setElapsed] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [micError, setMicError] = useState('')
  const [playing, setPlaying] = useState(null)
  const [yearAgoMemory, setYearAgoMemory] = useState(null)
  const recorderRef = useRef(null)
  const streamRef   = useRef(null)
  const mimeTypeRef = useRef('')
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const transcriptRef = useRef('')

  const { start: startSpeech, stop: stopSpeech } = useSpeechToText(text => {
    transcriptRef.current = transcriptRef.current
      ? transcriptRef.current + ' ' + text
      : text
  })

  const patientName = profile?.name ?? 'el familiar'
  const myDisplayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    if (user && ownerId) fetchRecordings()
    return () => clearInterval(timerRef.current)
  }, [user, ownerId])

  async function fetchRecordings() {
    setLoading(true)
    const { data } = await supabase
      .from('voice_diary')
      .select('*')
      .order('created_at', { ascending: false })
    const list = data ?? []
    setRecordings(list)

    // Find recording from exactly 1 year ago (±1 day)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const yearAgoStart = new Date(oneYearAgo); yearAgoStart.setHours(0, 0, 0, 0)
    const yearAgoEnd   = new Date(oneYearAgo); yearAgoEnd.setHours(23, 59, 59, 999)
    const found = list.find(r => {
      const d = new Date(r.created_at)
      return d >= yearAgoStart && d <= yearAgoEnd
    })
    setYearAgoMemory(found ?? null)
    setLoading(false)
  }

  function pickMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    return (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported)
      ? (candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '')
      : ''
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicError('')
      setSaveError('')
      chunksRef.current = []
      transcriptRef.current = ''

      const mimeType = pickMimeType()
      console.log('[startRecording] mimeType:', mimeType || '(navegador default)', '— MediaRecorder disponible:', typeof MediaRecorder !== 'undefined')
      mimeTypeRef.current = mimeType
      streamRef.current = stream

      try { startSpeech() } catch (e) { console.warn('[startRecording] SpeechRecognition no disponible:', e) }

      const recOpts = mimeType ? { mimeType } : {}
      const recorder = new MediaRecorder(stream, recOpts)
      recorder.ondataavailable = e => {
        console.log('[ondataavailable] chunk size:', e.data.size)
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(250)
      recorderRef.current = recorder
      setStep('recording'); setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)
    } catch (err) {
      console.error('[startRecording] error:', err)
      setMicError('No se pudo acceder al micrófono. Verifica los permisos del navegador.')
    }
  }

  async function stopAndSave() {
    console.log('[stopAndSave] inicio — elapsed:', elapsed, 'chunks:', chunksRef.current.length)
    clearInterval(timerRef.current)

    const recorder = recorderRef.current
    const stream   = streamRef.current

    if (!recorder || recorder.state === 'inactive') {
      console.warn('[stopAndSave] recorder inactivo o nulo — state:', recorder?.state)
      stopSpeech()
      stream?.getTracks().forEach(t => t.stop())
      setSaveError('La grabación se interrumpió. Intenta de nuevo.')
      setStep('idle')
      return
    }

    setStep('saving')
    setSaveError('')
    const duration = elapsed

    await new Promise(resolve => {
      recorder.onstop = () => {
        try { stopSpeech() } catch (e) { console.warn('[stopAndSave] stopSpeech error:', e) }
        stream?.getTracks().forEach(t => t.stop())
        resolve()
      }
      recorder.stop()
    })

    recorderRef.current = null
    streamRef.current = null

    const mimeType = mimeTypeRef.current || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    console.log('[stopAndSave] chunks:', chunksRef.current.length, '— blob size:', blob.size, 'bytes — mimeType:', mimeType)

    if (blob.size === 0) {
      console.error('[stopAndSave] blob vacío, abortando')
      setSaveError('No se capturó audio. Intenta grabar de nuevo.')
      setStep('idle')
      return
    }

    const ext  = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
    const path = `${user.id}/${Date.now()}.${ext}`
    console.log('[stopAndSave] subiendo a storage — path:', path, 'contentType:', mimeType.split(';')[0])

    const { error: uploadError } = await supabase.storage
      .from('voice-diary')
      .upload(path, blob, { contentType: mimeType.split(';')[0] })

    if (uploadError) {
      console.error('[stopAndSave] error upload:', uploadError)
      // Detect common causes for a clearer user message
      const errMsg = uploadError.message ?? ''
      let friendlyMsg = 'Error al subir el audio.'
      if (errMsg.toLowerCase().includes('bucket') || uploadError.statusCode === '404') {
        friendlyMsg = 'El bucket de almacenamiento no existe. Pide al administrador que ejecute create_storage_buckets.sql en Supabase.'
      } else if (uploadError.statusCode === '403' || errMsg.toLowerCase().includes('policy') || errMsg.toLowerCase().includes('permission')) {
        friendlyMsg = 'Sin permiso para subir archivos. Verifica las políticas RLS del bucket voice-diary en Supabase.'
      } else if (errMsg) {
        friendlyMsg = `Error al subir el audio: ${errMsg}`
      }
      setSaveError(friendlyMsg)
      setStep('idle')
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('voice-diary').getPublicUrl(path)
    console.log('[stopAndSave] upload OK — publicUrl:', publicUrl)

    const defaultTitle = new Date().toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })

    console.log('[stopAndSave] insertando en voice_diary — duration:', duration)
    const { error: insertError } = await supabase.from('voice_diary').insert({
      user_id: user.id,
      audio_url: publicUrl,
      title: defaultTitle,
      duration_seconds: duration,
      transcription: transcriptRef.current || null,
    })

    if (insertError) {
      console.error('[stopAndSave] error insert:', insertError)
      setSaveError('El audio se subió pero no se pudo guardar en la base de datos: ' + insertError.message)
      setStep('idle')
      return
    }

    console.log('[stopAndSave] guardado correctamente')
    track('memory_recorded', { duration_seconds: elapsed })
    setSaveError('')
    setElapsed(0)
    setStep('idle')
    fetchRecordings()
  }

  function cancelRecording() {
    clearInterval(timerRef.current)
    stopSpeech()
    transcriptRef.current = ''
    const recorder = recorderRef.current
    const stream   = streamRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => stream?.getTracks().forEach(t => t.stop())
      recorder.stop()
    } else {
      stream?.getTracks().forEach(t => t.stop())
    }
    recorderRef.current = null
    streamRef.current = null
    setStep('idle'); setElapsed(0)
  }

  async function deleteRecording(id) {
    await supabase.from('voice_diary').delete().eq('id', id)
    setRecordings(prev => prev.filter(r => r.id !== id))
  }

  const grouped = groupByDate(recordings)

  function recorderName(rec) {
    if (rec.user_id === user.id) return myDisplayName.split(' ')[0]
    return 'Familiar'
  }

  return (
    <Layout>
      <style>{`
        @keyframes wave-out {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(2.1); opacity: 0; }
        }
      `}</style>
      <div style={{ padding: '16px 16px 0', maxWidth: 600 }}>

        {/* "1 year ago" banner */}
        {yearAgoMemory && (
          <div style={{
            background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
            border: '1px solid #C4B5FD', borderRadius: 16,
            padding: '12px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🎙️</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6D28D9', margin: '0 0 2px' }}>
                En este día, hace un año...
              </p>
              <p style={{ fontSize: 12, color: '#7C3AED', margin: 0 }}>{yearAgoMemory.title}</p>
            </div>
          </div>
        )}

        {/* Recorder card — hidden for familiar (view only) */}
        {isFamiliar ? (
          <div style={{
            background: '#F9FAFB', borderRadius: 16, border: '1px solid #E5E7EB',
            padding: '16px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 22 }}>👁️</span>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              Solo puedes escuchar las memorias grabadas por el cuidador.
            </p>
          </div>
        ) : (
        <div style={{
          background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
          padding: '20px', marginBottom: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>

          {/* Idle state — animated record button */}
          {step === 'idle' && (
            <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
              <p style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 24,
              }}>
                Memoria de {patientName}
              </p>

              {micError && (
                <div style={{
                  marginBottom: 20, padding: '10px 14px', borderRadius: 12,
                  background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031', fontSize: 13,
                }}>
                  🎤 {micError}
                </div>
              )}
              {saveError && (
                <div style={{
                  marginBottom: 20, padding: '12px 16px', borderRadius: 14,
                  background: '#FFF0F0', border: '1.5px solid #FFBABA',
                  color: '#B91C1C', fontSize: 13, fontWeight: 500,
                  lineHeight: 1.5, textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(214,48,49,0.12)',
                }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 700 }}>⚠️ No se pudo guardar</p>
                  <p style={{ margin: 0 }}>{saveError}</p>
                </div>
              )}

              {/* Wave button */}
              <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 18px' }}>
                {/* 3 ripple rings */}
                {[0, 0.7, 1.4].map((delay, i) => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(124,92,191,0.18)',
                    animation: `wave-out 2.1s ease-out infinite ${delay}s`,
                    pointerEvents: 'none',
                  }} />
                ))}
                {/* Mic circle */}
                <button
                  onClick={startRecording}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%', border: 'none',
                    background: 'linear-gradient(145deg, #8B6CC9, #5E3FA3)',
                    boxShadow: '0 10px 32px rgba(94,63,163,0.45)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 34, transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(94,63,163,0.35)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(94,63,163,0.45)' }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.94)' }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  🎙️
                </button>
              </div>

              <p style={{ fontSize: 13, fontWeight: 700, color: '#7C5CBF', letterSpacing: '0.03em' }}>
                Toca para grabar
              </p>
            </div>
          )}

          {/* Recording */}
          {step === 'recording' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 16px' }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(214,48,49,0.15)', animation: 'ping 1.2s infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 8, borderRadius: '50%',
                  background: 'rgba(214,48,49,0.08)', animation: 'pulse 1.5s infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', background: '#FFF5F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                }}>
                  🎙️
                </div>
              </div>
              <p style={{ fontSize: 32, fontWeight: 700, fontFamily: 'monospace', marginBottom: 6 }}>
                {fmt(elapsed)}
              </p>
              <p style={{ fontSize: 12, color: '#D63031', fontWeight: 600, marginBottom: 20 }}>Grabando...</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={stopAndSave}
                  style={{
                    flex: 2, padding: '13px',
                    background: 'linear-gradient(135deg, #7C5CBF, #5E3FA3)',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    borderRadius: 14, border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(124,92,191,0.3)',
                  }}
                >
                  ✓ Guardar memoria
                </button>
                <button
                  onClick={cancelRecording}
                  style={{
                    flex: 1, padding: '13px',
                    border: '1.5px solid #EDE5D8', background: 'white',
                    color: '#6B7280', fontWeight: 600, fontSize: 14,
                    borderRadius: 14, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Saving */}
          {step === 'saving' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
                border: '3px solid #EDE5D8', borderTopColor: '#7C5CBF',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: 14, color: '#6B7280' }}>Guardando memoria...</p>
            </div>
          )}
        </div>
        )}

        {/* Grouped timeline */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#7C5CBF',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : recordings.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
            padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎙️</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
              Sin memorias aún
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>
              Graba la primera memoria de cómo estuvo hoy {patientName}.
            </p>
          </div>
        ) : (
          grouped.map(({ key, label, items }) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#9CA3AF',
                marginBottom: 8, paddingLeft: 2,
              }}>
                {label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(rec => {
                  const moodObj = MOODS.find(m => m.value === rec.mood)
                  const isOpen = playing === rec.id
                  const name = recorderName(rec)
                  return (
                    <div
                      key={rec.id}
                      onClick={() => setPlaying(isOpen ? null : rec.id)}
                      style={{
                        background: 'white', borderRadius: 16,
                        border: '1px solid #EDE5D8',
                        borderLeft: `4px solid ${moodObj?.color ?? '#7C5CBF'}`,
                        padding: '14px 16px', cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>
                          {moodObj?.emoji ?? '🎙️'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: 0, lineHeight: 1.4 }}>
                              {rec.title}
                            </p>
                            {rec.user_id === user.id && (
                              <button
                                onClick={e => { e.stopPropagation(); deleteRecording(rec.id) }}
                                style={{
                                  background: 'none', border: 'none', color: '#C0CCC5',
                                  cursor: 'pointer', padding: 2, flexShrink: 0, fontSize: 14,
                                }}
                              >✕</button>
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
                            {name} · {new Date(rec.created_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            {rec.duration_seconds ? ` · ⏱ ${fmt(rec.duration_seconds)}` : ''}
                          </p>
                          {moodObj && (
                            <span style={{
                              display: 'inline-block', marginTop: 6,
                              background: `${moodObj.color}15`, color: moodObj.color,
                              padding: '2px 8px', borderRadius: 6,
                              fontSize: 10, fontWeight: 700,
                              border: `1px solid ${moodObj.color}30`,
                            }}>
                              {moodObj.label}
                            </span>
                          )}
                        </div>
                      </div>
                      {rec.transcription && (
                        <p style={{
                          fontSize: 12, color: '#6B7280', lineHeight: 1.5,
                          marginTop: 8, fontStyle: 'italic',
                        }}>
                          "{rec.transcription}"
                        </p>
                      )}
                      {isOpen ? (
                        <audio
                          src={rec.audio_url}
                          controls
                          autoPlay
                          style={{ width: '100%', marginTop: 12 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <p style={{ fontSize: 11, color: '#7C5CBF', marginTop: 8, fontWeight: 600 }}>
                          ▶ Tap para escuchar
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
