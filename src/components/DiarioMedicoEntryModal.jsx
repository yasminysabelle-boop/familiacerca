import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import VoiceInput from './VoiceInput'
import VoiceRecorder from './VoiceRecorder'

const GEMINI_VISION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-vision`

const PHOTO_TYPES = [
  { value: 'receta',       label: '💊 Receta' },
  { value: 'historia',     label: '📋 Historia clínica' },
  { value: 'indicaciones', label: '📝 Indicaciones' },
  { value: 'otro',         label: '📄 Otro documento' },
]

const LOCATIONS = [
  { value: 'hospital',  label: '🏥 Hospital' },
  { value: 'consulta',  label: '🏪 Consulta' },
  { value: 'casa',      label: '🏠 Casa' },
  { value: 'otro',      label: '📍 Otro' },
]

const EMPTY_STRUCTURED = {
  estado_general: '',
  que_dijo_el_medico: '',
  medicamentos: [],
  proximos_pasos: [],
  notas: '',
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// feature:'diario' -- cupo de rate limit independiente del de Medications.jsx
// (mismo endpoint gemini-vision, contador separado server-side).
async function callGeminiVision(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(GEMINI_VISION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ feature: 'diario', ...body }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // 429 (límite diario/por hora) y 413 (imagen muy pesada) ya vienen con un
    // mensaje cálido y entendible del servidor -- se muestra tal cual.
    // Cualquier otro fallo usa el código crudo, como antes.
    const friendly = (res.status === 429 || res.status === 413) ? data?.message : null
    throw new Error(friendly || `Gemini API ${res.status}`)
  }
  if (data?.error) throw new Error('No se pudo interpretar la respuesta de IA')
  return data
}

// Redimensiona a un lado mayor de 2048px y recodifica a JPEG calidad 0.85
// antes de subir -- una foto de receta/historia clínica sacada con el
// teléfono puede pesar varios MB sin tocar. 2048 (no menos) para que texto
// chico/letra manuscrita siga siendo legible para la IA -- comprimir de más
// genera MÁS llamadas, no menos, porque la persona reintenta si no se lee.
// Si la imagen ya es igual o más chica, se devuelve tal cual -- no agrandar
// ni recodificar innecesariamente.
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.85
// Margen bajo el techo de 6MB del servidor (medido sobre el body en base64,
// ~33% más pesado que el archivo crudo).
const MAX_RAW_BYTES = 4 * 1024 * 1024

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      try {
        const img = new Image()
        img.onerror = reject
        img.onload = () => {
          try {
            let { width, height } = img
            if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
              resolve(file)
              return
            }
            if (width >= height) { height = Math.round(height * MAX_DIMENSION / width); width = MAX_DIMENSION }
            else { width = Math.round(width * MAX_DIMENSION / height); height = MAX_DIMENSION }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            canvas.getContext('2d').drawImage(img, 0, 0, width, height)
            canvas.toBlob(blob => {
              if (!blob) { reject(new Error('toBlob devolvió null')); return }
              resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
            }, 'image/jpeg', JPEG_QUALITY)
          } catch (err) { reject(err) }
        }
        img.src = reader.result
      } catch (err) { reject(err) }
    }
    reader.readAsDataURL(file)
  })
}

// Nunca rompe el flujo: si la compresión falla (HEIC no decodificable,
// imagen corrupta, formato raro), intenta con el original si está bajo el
// techo; si tampoco entra, pide una foto más liviana en vez de un error técnico.
async function prepareImageForUpload(file) {
  try {
    const compressed = await compressImage(file)
    if (compressed.size <= MAX_RAW_BYTES) return compressed
  } catch (e) {
    console.warn('[DiarioMedico] compresión de imagen falló, se intenta con el original:', e)
  }
  if (file.size <= MAX_RAW_BYTES) return file
  throw new Error('La foto es muy pesada. Probá con una foto más liviana o con menos resolución antes de analizarla.')
}

const VOICE_PROMPT = transcript => `Eres un asistente médico. El familiar habló libremente sobre una consulta:

"${transcript}"

Extrae y estructura en JSON (usa null si no se menciona):
{
  "estado_general": "solo si el documento (o la persona) lo dice de forma explícita, transcrito literalmente. Si hay que resumir, inferir o juntar varias frases para llenarlo, poné null.",
  "que_dijo_el_medico": "indicaciones o diagnóstico",
  "medicamentos": [{"nombre": "", "dosis": "", "frecuencia": ""}],
  "proximos_pasos": ["texto del paso pendiente"],
  "notas": "datos adicionales"
}

Responde SOLO con JSON válido.
No resumas ni parafrasees: transcribí. Si dudás entre transcribir e interpretar, poné null.`

const PHOTO_PROMPT = tipo => `Eres un asistente médico. Analiza esta imagen (${tipo}).

Extrae TODA la información médica visible:
{
  "estado_general": "solo si el documento (o la persona) lo dice de forma explícita, transcrito literalmente. Si hay que resumir, inferir o juntar varias frases para llenarlo, poné null.",
  "que_dijo_el_medico": "indicaciones o diagnóstico del médico",
  "medicamentos": [{"nombre": "", "dosis": "", "frecuencia": ""}],
  "proximos_pasos": ["estudios o citas indicadas"],
  "notas": "información adicional"
}

Responde SOLO con JSON válido.
No resumas ni parafrasees: transcribí. Si dudás entre transcribir e interpretar, poné null.`

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MedList({ meds, onChange }) {
  function update(i, field, val) {
    const next = meds.map((m, idx) => idx === i ? { ...m, [field]: val } : m)
    onChange(next)
  }
  function add() { onChange([...meds, { nombre: '', dosis: '', frecuencia: '' }]) }
  function remove(i) { onChange(meds.filter((_, idx) => idx !== i)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {meds.map((m, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '10px 12px', borderRadius: 10,
          background: '#F0F9F4', border: '1px solid #BBF7D0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>💊</span>
            <input
              value={m.nombre} placeholder="Medicamento"
              onChange={e => update(i, 'nombre', e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #BBF7D0', fontSize: 13 }}
            />
            <button onClick={() => remove(i)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', fontSize: 16, padding: '0 2px', flexShrink: 0,
            }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={m.dosis} placeholder="Dosis (ej: 10mg)"
              onChange={e => update(i, 'dosis', e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #D1C9BF', fontSize: 12 }}
            />
            <input
              value={m.frecuencia} placeholder="Frecuencia (ej: 2x día)"
              onChange={e => update(i, 'frecuencia', e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #D1C9BF', fontSize: 12 }}
            />
          </div>
        </div>
      ))}
      <button onClick={add} style={{
        padding: '8px', borderRadius: 10, border: '1.5px dashed #A8E5D6',
        background: 'transparent', color: '#087F70', fontWeight: 700,
        fontSize: 13, cursor: 'pointer',
      }}>
        + Agregar medicamento
      </button>
    </div>
  )
}

function StepsList({ steps, onChange }) {
  function update(i, val) { onChange(steps.map((s, idx) => idx === i ? val : s)) }
  function add() { onChange([...steps, '']) }
  function remove(i) { onChange(steps.filter((_, idx) => idx !== i)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', background: '#087F70',
            color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{i + 1}</span>
          <input
            value={s}
            onChange={e => update(i, e.target.value)}
            placeholder="Estudio, cita o acción pendiente"
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #D1C9BF', fontSize: 13 }}
          />
          <button onClick={() => remove(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9CA3AF', fontSize: 15, padding: '0 2px', flexShrink: 0,
          }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{
        padding: '7px', borderRadius: 10, border: '1.5px dashed #D1C9BF',
        background: 'transparent', color: '#6B7280', fontWeight: 700,
        fontSize: 13, cursor: 'pointer',
      }}>
        + Agregar paso
      </button>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function DiarioMedicoEntryModal({ open, onClose, onSaved }) {
  const { user } = useAuth()
  const { ownerId, activePatientName } = useFamily()
  const patientName = activePatientName ? activePatientName.split(' ')[0] : 'tu familiar'

  const [step, setStep]               = useState('input')  // input | processing | review
  const [inputType, setInputType]     = useState('voice')  // voice | photo
  const [transcript, setTranscript]   = useState('')
  const [photoFile, setPhotoFile]     = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoType, setPhotoType]     = useState('receta')
  const [aiError, setAiError]         = useState('')

  // Review fields
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime]               = useState(new Date().toTimeString().slice(0, 5))
  const [location, setLocation]       = useState('consulta')
  const [structured, setStructured]   = useState(EMPTY_STRUCTURED)

  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function reset() {
    setStep('input'); setInputType('voice'); setTranscript(''); setPhotoFile(null)
    setPhotoPreview(null); setPhotoType('receta'); setAiError('')
    setDate(new Date().toISOString().slice(0, 10))
    setTime(new Date().toTimeString().slice(0, 5))
    setLocation('consulta'); setStructured(EMPTY_STRUCTURED)
    setSaving(false)
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (inputType === 'voice' && !transcript.trim()) return
    if (inputType === 'photo' && !photoFile) return
    setStep('processing')
    setAiError('')
    try {
      let parsed
      if (inputType === 'voice') {
        parsed = await callGeminiVision({ prompt: VOICE_PROMPT(transcript.trim()) })
      } else {
        const fileToSend = await prepareImageForUpload(photoFile)
        console.log(`[DiarioMedico] foto: ${(photoFile.size / 1024).toFixed(0)}KB original -> ${(fileToSend.size / 1024).toFixed(0)}KB enviado (${fileToSend === photoFile ? 'sin recomprimir' : 'comprimida'})`)
        const b64  = await toBase64(fileToSend)
        const mime = fileToSend.type || 'image/jpeg'
        parsed = await callGeminiVision({ image_base64: b64, media_type: mime, prompt: PHOTO_PROMPT(photoType) })
      }

      setStructured({
        estado_general:      parsed.estado_general     ?? '',
        que_dijo_el_medico:  parsed.que_dijo_el_medico ?? '',
        medicamentos:        (parsed.medicamentos ?? []).filter(m => m.nombre),
        proximos_pasos:      (parsed.proximos_pasos ?? []).filter(Boolean),
        notas:               parsed.notas              ?? '',
      })
      setStep('review')
    } catch (err) {
      setAiError(err.message ?? 'Error al procesar con IA. Puedes agregar los datos manualmente.')
      setStructured(EMPTY_STRUCTURED)
      setStep('review')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      let photoUrl = null

      if (inputType === 'photo' && photoFile) {
        const ext  = photoFile.name.split('.').pop() || 'jpg'
        const path = `${ownerId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('medical-diary')
          .upload(path, photoFile, { contentType: photoFile.type })
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('medical-diary')
            .createSignedUrl(path, 60 * 60 * 24 * 365)
          photoUrl = signed?.signedUrl ?? null
        }
      }

      const { error } = await supabase.from('medical_diary').insert({
        owner_id:          ownerId,
        created_by:        user.id,
        created_by_name:   user.user_metadata?.full_name ?? user.email ?? 'Familiar',
        input_type:        inputType,
        raw_transcript:    inputType === 'voice' ? transcript.trim() : null,
        photo_url:         photoUrl,
        entry_date:        date,
        entry_time:        time || null,
        location,
        estado_general:    structured.estado_general   || null,
        que_dijo_el_medico: structured.que_dijo_el_medico || null,
        medicamentos:      structured.medicamentos,
        proximos_pasos:    structured.proximos_pasos,
        notas:             structured.notas             || null,
        ai_processed:      true,
      })
      if (error) throw error
      onSaved?.()
      reset()
      onClose()
    } catch (err) {
      console.error('[DiarioMedico save]', err)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const s = structured

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) { reset(); onClose() } }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'white', borderRadius: '24px 24px 0 0',
        padding: '24px 20px 48px',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.25)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📓</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#1A1A1A' }}>
                {step === 'review' ? 'Revisar y guardar' : 'Nueva entrada médica'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                {step === 'input' ? 'Voz o foto — la IA estructura automáticamente'
                 : step === 'processing' ? 'Analizando con IA...'
                 : 'Edita cualquier campo antes de guardar'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { reset(); onClose() }}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16, color: '#6B7280' }}
          >✕</button>
        </div>

        {/* ── STEP: INPUT ── */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Type tabs */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'voice', icon: '🎙️', label: 'Voz' },
                { id: 'photo', icon: '📷', label: 'Foto' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setInputType(t.id)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                    background: inputType === t.id ? '#087F70' : '#F3F4F6',
                    color: inputType === t.id ? 'white' : '#6B7280',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>

            {/* Voice input */}
            {inputType === 'voice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Habla libremente sobre la consulta — qué dijo el médico, medicamentos recetados, próximos estudios...
                </p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <VoiceRecorder
                    mode="transcribe"
                    onTranscript={text => setTranscript(prev => (prev + ' ' + text).trimStart())}
                    placeholder="Toca para grabar la consulta"
                  />
                </div>

                {transcript && (
                  <div style={{
                    padding: '12px', borderRadius: 12,
                    background: '#F0F9F4', border: '1px solid #BBF7D0',
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#087F70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Transcripción
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#1A1A1A', lineHeight: 1.6 }}>{transcript}</p>
                    <button
                      onClick={() => setTranscript('')}
                      style={{ marginTop: 8, fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Borrar y grabar de nuevo
                    </button>
                  </div>
                )}

                {!supported && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                    Tu navegador no soporta grabación. Escribe el texto abajo.
                  </p>
                )}

                {/* Fallback text input */}
                {(!supported || transcript) && (
                  <VoiceInput
                    value={transcript}
                    onChange={setTranscript}
                    placeholder="O escribe aquí lo que dijo el médico..."
                    rows={3}
                    label={!supported ? 'Escribe el resumen de la consulta' : 'Editar transcripción'}
                  />
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={!transcript.trim()}
                  style={{
                    padding: '14px', borderRadius: 14, border: 'none',
                    background: transcript.trim() ? '#087F70' : '#9CA3AF',
                    color: 'white', fontWeight: 800, fontSize: 15,
                    cursor: transcript.trim() ? 'pointer' : 'default',
                    boxShadow: transcript.trim() ? '0 4px 16px rgba(8,127,112,0.3)' : 'none',
                  }}
                >
                  ✨ Estructurar con IA →
                </button>
              </div>
            )}

            {/* Photo input */}
            {inputType === 'photo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Toma foto o elige una imagen de receta, historia clínica o indicaciones. La IA leerá y extraerá la información.
                </p>

                {/* Photo type */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PHOTO_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setPhotoType(t.value)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${photoType === t.value ? '#087F70' : '#D1C9BF'}`,
                        background: photoType === t.value ? '#087F70' : 'white',
                        color: photoType === t.value ? 'white' : '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Photo picker */}
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: '20px', borderRadius: 14, border: '2px dashed #D1C9BF',
                    background: photoPreview ? 'transparent' : '#F9F7F4',
                    cursor: 'pointer', overflow: 'hidden',
                    position: 'relative', minHeight: photoPreview ? 200 : 80,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 220 }} />
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 32 }}>📷</span>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#087F70' }}>
                          Toca para tomar foto o elegir imagen
                        </p>
                      </div>
                    )
                  }
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />

                {photoPreview && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                  >
                    Cambiar imagen
                  </button>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={!photoFile}
                  style={{
                    padding: '14px', borderRadius: 14, border: 'none',
                    background: photoFile ? '#087F70' : '#9CA3AF',
                    color: 'white', fontWeight: 800, fontSize: 15,
                    cursor: photoFile ? 'pointer' : 'default',
                    boxShadow: photoFile ? '0 4px 16px rgba(8,127,112,0.3)' : 'none',
                  }}
                >
                  🔍 Analizar con IA →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: PROCESSING ── */}
        {step === 'processing' && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 0', gap: 20,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #087F70, #A8E5D6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, animation: 'spin 1.5s linear infinite',
            }}>✨</div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Analizando con IA
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
                {inputType === 'photo' ? 'Leyendo la imagen...' : 'Estructurando la información...'}
              </p>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {aiError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FDE68A' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>
                  ⚠ {aiError} — Puedes completar los campos manualmente.
                </p>
              </div>
            )}

            {/* Thumbnail if photo */}
            {photoPreview && (
              <img src={photoPreview} alt="Documento" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 10, border: '1px solid #EDE5D8' }} />
            )}

            {/* Date / time / location row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid #D1C9BF', fontSize: 13 }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hora</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid #D1C9BF', fontSize: 13 }} />
              </div>
            </div>

            {/* Location */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Dónde
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LOCATIONS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setLocation(l.value)}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${location === l.value ? '#087F70' : '#D1C9BF'}`,
                      background: location === l.value ? '#087F70' : 'white',
                      color: location === l.value ? 'white' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <VoiceInput
              value={s.estado_general}
              onChange={v => setStructured(p => ({ ...p, estado_general: v }))}
              placeholder={`Cómo está ${patientName}...`}
              rows={2}
              label={`Estado de ${patientName}`}
            />

            <VoiceInput
              value={s.que_dijo_el_medico}
              onChange={v => setStructured(p => ({ ...p, que_dijo_el_medico: v }))}
              placeholder="Indicaciones, diagnóstico, observaciones..."
              rows={3}
              label="Lo que dijo el médico"
            />

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Medicamentos
              </label>
              <MedList
                meds={s.medicamentos}
                onChange={v => setStructured(p => ({ ...p, medicamentos: v }))}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Próximos pasos / Estudios pendientes
              </label>
              <StepsList
                steps={s.proximos_pasos}
                onChange={v => setStructured(p => ({ ...p, proximos_pasos: v }))}
              />
            </div>

            <VoiceInput
              value={s.notas}
              onChange={v => setStructured(p => ({ ...p, notas: v }))}
              placeholder="Notas adicionales..."
              rows={2}
              label="Notas adicionales"
            />

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '15px', borderRadius: 14, border: 'none',
                background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #087F70, #A8E5D6)',
                color: 'white', fontWeight: 800, fontSize: 15,
                cursor: saving ? 'default' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 16px rgba(8,127,112,0.3)',
                marginTop: 4,
              }}
            >
              {saving ? 'Guardando...' : '💾 Guardar entrada'}
            </button>

            <button
              onClick={() => setStep('input')}
              style={{
                padding: '11px', borderRadius: 12, border: '1px solid #EDE5D8',
                background: 'white', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              ← Volver al inicio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
