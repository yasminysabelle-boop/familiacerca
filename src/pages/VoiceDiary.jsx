import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function fmt(s) {
  const m = Math.floor((s ?? 0) / 60), sec = (s ?? 0) % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function VoiceDiary() {
  const { user } = useAuth()
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [micError, setMicError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [title, setTitle] = useState('')
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    if (user) fetchRecordings()
    return () => clearInterval(timerRef.current)
  }, [user])

  async function fetchRecordings() {
    setLoading(true)
    const { data } = await supabase
      .from('voice_diary')
      .select('*')
      .order('created_at', { ascending: false })
    setRecordings(data ?? [])
    setLoading(false)
  }

  async function startRecording() {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop())
      recorder.start(250)
      recorderRef.current = recorder
      setRecording(true); setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)
    } catch {
      setMicError('No se pudo acceder al micrófono. Verifica los permisos del navegador.')
    }
  }

  async function stopAndSave() {
    clearInterval(timerRef.current)
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    setRecording(false); setSaving(true)

    await new Promise(resolve => {
      recorder.onstop = resolve
      recorder.stop()
    })

    const duration = elapsed
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const path = `${user.id}/${Date.now()}.webm`

    const { error: uploadError } = await supabase.storage
      .from('voice-diary')
      .upload(path, blob, { contentType: 'audio/webm' })

    if (uploadError) {
      setSaveError('Error al subir el audio. Verifica tu conexión e inténtalo de nuevo.')
      setSaving(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('voice-diary').getPublicUrl(path)

    const defaultTitle = `Nota del ${new Date().toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })}`
    const { error: insertError } = await supabase.from('voice_diary').insert({
      user_id: user.id,
      audio_url: publicUrl,
      title: title.trim() || defaultTitle,
      duration_seconds: duration,
    })

    if (insertError) {
      setSaveError('El audio se subió pero no se pudo guardar el registro: ' + insertError.message)
      setSaving(false)
      return
    }

    setSaveError('')
    setTitle(''); setElapsed(0); setSaving(false)
    fetchRecordings()
  }

  function cancelRecording() {
    clearInterval(timerRef.current)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    setRecording(false); setElapsed(0)
  }

  async function deleteRecording(id) {
    await supabase.from('voice_diary').delete().eq('id', id)
    setRecordings(prev => prev.filter(r => r.id !== id))
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Diario de voz</h2>
          <p className="text-gray-500 mt-1">Notas de voz de cómo se siente el familiar cada día</p>
        </div>

        {/* Recorder card */}
        <div className="bg-white rounded-2xl border border-green-100 p-6 mb-6">
          {!recording && !saving && (
            <div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Título de la nota de voz (opcional)"
                className="w-full mb-4 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={startRecording}
                className="w-full py-5 bg-accent hover:bg-[#d4614a] text-white font-bold rounded-2xl text-base transition-colors flex items-center justify-center gap-3 shadow-lg shadow-orange-100">
                <span className="text-3xl">🎙️</span>
                <span>Grabar nota de voz</span>
              </button>
              {micError && (
                <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                  <span>⚠</span><span>{micError}</span>
                </div>
              )}
              {!micError && (
                <p className="text-xs text-gray-400 text-center mt-3">
                  Perfecta para que el familiar cuente cómo se siente hoy
                </p>
              )}
            </div>
          )}

          {recording && (
            <div className="text-center">
              <div className="relative w-28 h-28 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-50" />
                <div className="absolute inset-2 rounded-full bg-red-100 animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-red-50 flex items-center justify-center">
                  <span className="text-4xl">🎙️</span>
                </div>
              </div>
              <p className="text-4xl font-mono font-bold text-gray-900 tabular-nums">{fmt(elapsed)}</p>
              <p className="text-sm text-red-500 font-medium mt-1 mb-6">Grabando...</p>
              <div className="flex gap-3">
                <button onClick={stopAndSave}
                  className="flex-1 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-colors">
                  ✓ Guardar nota
                </button>
                <button onClick={cancelRecording}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {saving && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Guardando nota de voz...</p>
            </div>
          )}
        </div>

        {saveError && (
          <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            ⚠ {saveError}
          </div>
        )}

        {/* Recordings list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="bg-white rounded-xl border border-green-100 p-14 text-center">
            <p className="text-5xl mb-3">🎙️</p>
            <p className="text-gray-500 text-sm">No hay notas de voz todavía.</p>
            <p className="text-gray-400 text-xs mt-1">¡Graba la primera nota arriba!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map(rec => (
              <div key={rec.id} className="bg-white rounded-xl border border-green-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-xl flex-shrink-0">
                      🎙️
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{rec.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">
                          {new Date(rec.created_at).toLocaleDateString('es-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        {rec.duration_seconds != null && (
                          <span className="text-xs text-gray-400">⏱ {fmt(rec.duration_seconds)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {rec.user_id === user.id && (
                    <button onClick={() => deleteRecording(rec.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0">✕</button>
                  )}
                </div>
                <audio src={rec.audio_url} controls className="w-full" style={{ height: '36px' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
