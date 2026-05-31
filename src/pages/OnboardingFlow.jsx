import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

function calcAge(dateStr) {
  if (!dateStr) return null
  const b = new Date(dateStr)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age >= 0 ? age : null
}

const FREQ_OPTIONS = [
  { value: 'once_daily',  label: 'Una vez al día',    times: 1, interval: null },
  { value: 'twice_daily', label: 'Dos veces al día',  times: 2, interval: null },
  { value: 'three_daily', label: 'Tres veces al día', times: 3, interval: null },
  { value: 'every_4h',    label: 'Cada 4 horas',      times: 1, interval: 4 },
  { value: 'every_6h',    label: 'Cada 6 horas',      times: 1, interval: 6 },
  { value: 'every_8h',    label: 'Cada 8 horas',      times: 1, interval: 8 },
  { value: 'every_12h',   label: 'Cada 12 horas',     times: 1, interval: 12 },
  { value: 'as_needed',   label: 'Según necesidad',   times: 0, interval: null },
  { value: 'weekly',      label: 'Semanal',           times: 1, interval: null },
]

function computeScheduledTimes(frequency, startTimes) {
  const opt = FREQ_OPTIONS.find(o => o.value === frequency)
  if (!opt || opt.times === 0) return []
  if (opt.interval) {
    const start = startTimes[0]
    if (!start) return []
    const [h, m] = start.split(':').map(Number)
    const dosesPerDay = 24 / opt.interval
    return Array.from({ length: dosesPerDay }, (_, i) => {
      const total = (h * 60 + m + i * opt.interval * 60) % (24 * 60)
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    })
  }
  return startTimes.filter(Boolean)
}

const TIME_PRESETS = [
  { label: '🌅 Mañana', time: '08:00' },
  { label: '☀️ Tarde',  time: '14:00' },
  { label: '🌙 Noche',  time: '20:00' },
]

const INPUT = {
  width: '100%', padding: '14px 16px', borderRadius: 14,
  border: '1.5px solid #E8E4DC', background: 'white',
  fontSize: 15, color: '#1A1A1A', outline: 'none',
  boxSizing: 'border-box', boxShadow: '0 2px 0px #E0DBD2',
  fontFamily: 'inherit',
}

const LABEL = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
}

function PrimaryBtn({ children, onClick, disabled, pressed, onPD, onPU, onPL }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={onPD}
      onPointerUp={onPU}
      onPointerLeave={onPL}
      style={{
        width: '100%', padding: '16px', borderRadius: 16, border: 'none',
        background: disabled ? '#C5C9C4' : '#2D4A1E',
        color: 'white', fontSize: 16, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: pressed || disabled ? 'none' : '0 3px 0px #1A2E12',
        transform: pressed ? 'translateY(3px)' : 'none',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {children}
    </button>
  )
}

export default function OnboardingFlow() {
  const { user } = useAuth()
  const { refresh } = useFamily()

  const [step, setStep] = useState(1)
  const [pressed, setPressed] = useState(false)

  // Step 1
  const [patientName, setPatientName] = useState('')
  const [birthDate, setBirthDate]     = useState('')
  const [photoFile, setPhotoFile]     = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  // Step 2
  const [medName, setMedName]           = useState('')
  const [medDose, setMedDose]           = useState('')
  const [medFrequency, setMedFrequency] = useState('')
  const [medTimes, setMedTimes]         = useState([''])

  // Step 3
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied]         = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Yo'
  const progress    = (step / 3) * 100

  function pickPhoto(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  function handleFreqChange(val) {
    setMedFrequency(val)
    const opt = FREQ_OPTIONS.find(o => o.value === val)
    if (!opt || opt.times === 0) {
      setMedTimes([])
    } else {
      const count = opt.interval ? 1 : opt.times
      setMedTimes(prev => {
        const next = [...prev]
        while (next.length < count) next.push('')
        return next.slice(0, count)
      })
    }
  }

  async function handleStep1() {
    if (!patientName.trim() || !birthDate) return
    setSaving(true)
    setError('')
    try {
      let photoUrl = null
      if (photoFile) {
        const path = `${user.id}/profile.jpg`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, photoFile, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      const { error: e1 } = await supabase.from('care_profiles').upsert(
        { user_id: user.id, name: patientName.trim(), age: calcAge(birthDate), photo_url: photoUrl },
        { onConflict: 'user_id' }
      )
      if (e1) throw e1

      await supabase.from('patient_profiles').upsert(
        { owner_id: user.id, nombre_completo: patientName.trim(), fecha_nacimiento: birthDate },
        { onConflict: 'owner_id' }
      )

      setStep(2)
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function generateLink() {
    try {
      const { data: token } = await supabase.rpc('create_family_invitation', {
        p_invited_email: '',
        p_invited_by: displayName,
      })
      if (token) { setInviteLink(`${window.location.origin}/join?token=${token}`); return }
    } catch { }
    setInviteLink(window.location.origin)
  }

  async function handleStep2() {
    if (!medName.trim()) return
    setSaving(true)
    const scheduled_times = computeScheduledTimes(medFrequency, medTimes)
    const firstTime = scheduled_times[0] ?? null
    try {
      const { error: medErr } = await supabase.from('medications').insert({
        user_id: user.id,
        name: medName.trim(),
        dosage: medDose.trim() || null,
        frequency: medFrequency || null,
        time: firstTime,
        scheduled_times: scheduled_times.length ? scheduled_times : null,
      })
      if (medErr) console.warn('[OnboardingFlow] medication insert failed:', medErr)
    } catch (err) {
      console.warn('[OnboardingFlow] medication insert error:', err)
    }
    await generateLink()
    setSaving(false)
    setStep(3)
  }

  async function skipToStep3() {
    await generateLink()
    setStep(3)
  }

  function shareWhatsApp() {
    const msg = `¡Hola! Te invito a cuidar juntos en FamiliaCerca. Entra aquí: ${inviteLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { }
  }

  function finish() {
    localStorage.setItem('fc_patient_onboarding_done', '1')
    refresh?.()
    window.location.href = '/dashboard'
  }

  const pd = () => setPressed(true)
  const pu = () => setPressed(false)

  const freqOpt = FREQ_OPTIONS.find(o => o.value === medFrequency)
  const showTimePickers = freqOpt && freqOpt.times > 0
  const isInterval = freqOpt?.interval != null
  const previewTimes = isInterval && medTimes[0]
    ? computeScheduledTimes(medFrequency, medTimes)
    : []

  return (
    <div style={{ minHeight: '100dvh', background: '#F0EDE6', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#2D4A1E', padding: '0 20px', paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
        <Logo showWordmark size={28} />
        <div style={{ marginTop: 16, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
          <div style={{
            height: '100%', width: `${progress}%`, background: '#C9894A', borderRadius: 4,
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'right', margin: '6px 0 14px', fontWeight: 600 }}>
          {step} / 3
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '32px 20px 48px', overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── PASO 1 ── */}
        {step === 1 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 6px' }}>
              ¿A quién vas a cuidar?
            </p>
            <p style={{ fontSize: 14, color: '#718096', margin: '0 0 28px' }}>
              Crea el perfil del paciente para comenzar.
            </p>

            {/* Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              {/* Hidden inputs */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={pickPhoto}
                style={{ display: 'none' }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                onChange={pickPhoto}
                style={{ display: 'none' }}
              />

              {/* Circle */}
              <div
                onClick={() => setPhotoMenuOpen(o => !o)}
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: photoPreview ? 'transparent' : '#EAF0E6',
                  border: '2px dashed #4A7C59',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', cursor: 'pointer',
                }}
              >
                {photoPreview
                  ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="foto" />
                  : <span style={{ fontSize: 30 }}>📷</span>}
              </div>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
                {photoPreview ? 'Cambiar foto' : 'Foto (opcional)'}
              </p>

              {/* Source picker */}
              {photoMenuOpen && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => { cameraRef.current.click(); setPhotoMenuOpen(false) }}
                    style={{
                      padding: '10px 18px', borderRadius: 12,
                      border: '1.5px solid #4A7C59', background: 'white',
                      color: '#2D4A1E', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: 'inherit',
                    }}
                  >
                    📷 Cámara
                  </button>
                  <button
                    onClick={() => { galleryRef.current.click(); setPhotoMenuOpen(false) }}
                    style={{
                      padding: '10px 18px', borderRadius: 12,
                      border: '1.5px solid #4A7C59', background: 'white',
                      color: '#2D4A1E', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: 'inherit',
                    }}
                  >
                    🖼️ Galería
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={LABEL}>Nombre completo *</label>
                <input
                  style={INPUT} value={patientName} autoFocus
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="Ej: María González"
                />
              </div>
              <div>
                <label style={LABEL}>Fecha de nacimiento *</label>
                <input
                  type="date" style={INPUT} value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 12 }}>{error}</p>}

            <div style={{ marginTop: 32 }}>
              <PrimaryBtn onClick={handleStep1} disabled={!patientName.trim() || !birthDate || saving} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
                {saving ? 'Guardando...' : 'Continuar →'}
              </PrimaryBtn>
            </div>
          </>
        )}

        {/* ── PASO 2 ── */}
        {step === 2 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 6px' }}>
              Agrega su primer medicamento
            </p>
            <p style={{ fontSize: 14, color: '#718096', margin: '0 0 28px' }}>
              Puedes agregar más desde la app cuando quieras.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={LABEL}>Nombre del medicamento *</label>
                <input
                  style={INPUT} value={medName} autoFocus
                  onChange={e => setMedName(e.target.value)}
                  placeholder="Ej: Metformina"
                />
              </div>
              <div>
                <label style={LABEL}>Dosis (opcional)</label>
                <input
                  style={INPUT} value={medDose}
                  onChange={e => setMedDose(e.target.value)}
                  placeholder="Ej: 500mg"
                />
              </div>

              {/* Frecuencia */}
              <div>
                <label style={LABEL}>Frecuencia</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={medFrequency}
                    onChange={e => handleFreqChange(e.target.value)}
                    style={{
                      ...INPUT,
                      paddingRight: 36,
                      appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    <option value="">Seleccionar frecuencia...</option>
                    {FREQ_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', color: '#9CA3AF', fontSize: 12,
                  }}>▼</span>
                </div>
              </div>

              {/* Hora(s) */}
              {showTimePickers && (
                <div>
                  <label style={LABEL}>
                    {isInterval ? 'Hora de inicio' : medTimes.length > 1 ? 'Horarios' : 'Hora'}
                  </label>

                  {/* Quick presets */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {TIME_PRESETS.map(({ label, time }) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          if (isInterval || medTimes.length === 1) {
                            setMedTimes([time])
                          } else {
                            // for multi-dose, fill slots in order
                            setMedTimes(prev => {
                              const next = [...prev]
                              const emptyIdx = next.findIndex(t => !t)
                              if (emptyIdx !== -1) next[emptyIdx] = time
                              else next[next.length - 1] = time
                              return next
                            })
                          }
                        }}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 10,
                          border: '1.5px solid #E8E4DC', background: 'white',
                          cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          color: '#4A7C59', fontFamily: 'inherit',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {medTimes.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {medTimes.length > 1 && (
                          <span style={{ fontSize: 12, color: '#9CA3AF', width: 18, flexShrink: 0 }}>{i + 1}.</span>
                        )}
                        <input
                          type="time"
                          value={t}
                          onChange={e => {
                            const next = [...medTimes]
                            next[i] = e.target.value
                            setMedTimes(next)
                          }}
                          style={{ ...INPUT, flex: 1 }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Preview for interval-based */}
                  {previewTimes.length > 0 && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: '#EAF0E6', borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: '#2D4A1E', fontWeight: 600, marginBottom: 6 }}>
                        Horarios automáticos ({previewTimes.length} dosis al día):
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {previewTimes.map((t, i) => (
                          <span key={i} style={{
                            background: 'white', color: '#2D4A1E',
                            padding: '2px 8px', borderRadius: 6,
                            fontSize: 11, fontWeight: 600, border: '1px solid #C9DFC4',
                          }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PrimaryBtn onClick={handleStep2} disabled={!medName.trim() || saving} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
                {saving ? 'Guardando...' : 'Continuar →'}
              </PrimaryBtn>
              <button
                onClick={skipToStep3}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', padding: '10px', fontFamily: 'inherit' }}
              >
                Saltar este paso
              </button>
            </div>
          </>
        )}

        {/* ── PASO 3 ── */}
        {step === 3 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 6px' }}>
              Invita a un familiar
            </p>
            <p style={{ fontSize: 14, color: '#718096', margin: '0 0 32px' }}>
              Cuiden juntos — comparte el acceso a FamiliaCerca.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* WhatsApp */}
              <button
                onPointerDown={pd} onPointerUp={pu} onPointerLeave={pu}
                onClick={shareWhatsApp}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                  background: '#25D366', color: 'white', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: pressed ? 'none' : '0 3px 0px #1da653',
                  transform: pressed ? 'translateY(3px)' : 'none',
                  transition: 'transform 0.08s ease, box-shadow 0.08s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 20 }}>💬</span> Compartir por WhatsApp
              </button>

              {/* Copy link */}
              <button
                onClick={copyLink}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  border: '1.5px solid #E8E4DC', background: 'white',
                  color: '#2D4A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 0px #E0DBD2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                {copied ? '✓ ¡Copiado!' : '🔗 Copiar link'}
              </button>

              {/* Finish */}
              <div style={{ marginTop: 8 }}>
                <PrimaryBtn onClick={finish} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
                  Terminar y entrar a la app →
                </PrimaryBtn>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
