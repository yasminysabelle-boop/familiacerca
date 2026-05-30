import { useState } from 'react'
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

  // Step 2
  const [medName, setMedName]       = useState('')
  const [medDose, setMedDose]       = useState('')
  const [schedule, setSchedule]     = useState('mañana')

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
    const timeMap = { mañana: '08:00', tarde: '14:00', noche: '20:00' }
    const t = timeMap[schedule]
    try {
      await supabase.from('medications').insert({
        user_id: user.id, name: medName.trim(),
        dosage: medDose.trim() || null, time: t, scheduled_times: [t],
      })
    } catch { }
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <label style={{ cursor: 'pointer', textAlign: 'center' }}>
                <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: 'none' }} />
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: photoPreview ? 'transparent' : '#EAF0E6',
                  border: '2px dashed #4A7C59',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {photoPreview
                    ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="foto" />
                    : <span style={{ fontSize: 30 }}>📷</span>}
                </div>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
                  {photoPreview ? 'Cambiar foto' : 'Foto (opcional)'}
                </p>
              </label>
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
              <div>
                <label style={LABEL}>Horario</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { key: 'mañana', emoji: '🌅', label: 'Mañana' },
                    { key: 'tarde',  emoji: '☀️',  label: 'Tarde' },
                    { key: 'noche',  emoji: '🌙',  label: 'Noche' },
                  ].map(({ key, emoji, label }) => (
                    <button
                      key={key}
                      onClick={() => setSchedule(key)}
                      style={{
                        flex: 1, padding: '12px 4px', borderRadius: 12,
                        border: `1.5px solid ${schedule === key ? '#2D4A1E' : '#E8E4DC'}`,
                        background: schedule === key ? '#EAF0E6' : 'white',
                        cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 4,
                        boxShadow: '0 2px 0px #E0DBD2',
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: schedule === key ? '#2D4A1E' : '#718096' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
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
