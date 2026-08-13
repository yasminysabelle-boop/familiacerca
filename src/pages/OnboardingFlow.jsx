import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import { uploadPatientPhoto } from '../lib/patientPhoto'
import Logo from '../components/Logo'

const FREQ_OPTIONS = [
  { value: 'once_daily',  label: 'Una vez al día' },
  { value: 'twice_daily', label: 'Dos veces al día' },
  { value: 'three_daily', label: 'Tres veces al día' },
  { value: 'every_8h',    label: 'Cada 8 horas' },
  { value: 'every_12h',   label: 'Cada 12 horas' },
  { value: 'as_needed',   label: 'Según necesidad' },
]

// Paso 3 — "Sobre el cuidado" (Care Complexity Score)
const CAREGIVER_OPTIONS = [
  { value: '1',   label: 'Solo yo' },
  { value: '2',   label: 'Yo y otra persona' },
  { value: '3-5', label: 'Varias personas' },
  { value: '6+',  label: 'Muchas personas' },
]

const FOCUS_AREA_OPTIONS = [
  { value: 'medicamentos', label: 'Medicamentos y dosis' },
  { value: 'citas',        label: 'Citas médicas' },
  { value: 'tareas',       label: 'Tareas y recordatorios' },
  { value: 'gastos',       label: 'Gastos de cuidado' },
  { value: 'todo',         label: 'Todo lo anterior' },
]

const COORD_FREQ_OPTIONS = [
  { value: 'ocasional', label: 'Ocasionalmente', sub: 'Menos de 1 vez por semana' },
  { value: 'regular',   label: 'Regularmente',   sub: 'Varias veces por semana' },
  { value: 'diaria',    label: 'Todos los días' },
]

const CAREGIVER_POINTS = { '1': 0, '2': 10, '3-5': 25, '6+': 40 }
const FOCUS_AREA_POINTS = { medicamentos: 15, citas: 10, tareas: 10, gastos: 15 }
const COORD_FREQ_POINTS = { ocasional: 0, regular: 15, diaria: 25 }

function computeComplexity(caregiverCount, focusAreas, frequency) {
  const caregiverScore = CAREGIVER_POINTS[caregiverCount] ?? 0
  const areaScore = focusAreas.includes('todo')
    ? 30
    : focusAreas.reduce((sum, a) => sum + (FOCUS_AREA_POINTS[a] ?? 0), 0)
  const freqScore = COORD_FREQ_POINTS[frequency] ?? 0
  const value = caregiverScore + areaScore + freqScore
  const score = value <= 25 ? 'low' : value <= 60 ? 'medium' : 'high'
  const recommendedPlan = score === 'low' ? 'free' : score === 'medium' ? 'familiar' : 'care_plus'
  return { value, score, recommendedPlan }
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
        background: disabled ? '#C5C9C4' : '#087F70',
        color: 'white', fontSize: 16, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: pressed || disabled ? 'none' : '0 3px 0px rgba(8,127,112,0.35)',
        transform: pressed ? 'translateY(3px)' : 'none',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {children}
    </button>
  )
}

function Chip({ label, sub, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px', borderRadius: 20,
        border: `1.5px solid ${selected ? '#087F70' : '#D1C9BF'}`,
        background: selected ? '#087F70' : 'white',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 2,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: selected ? 'white' : '#374151' }}>{label}</span>
      {sub && <span style={{ fontSize: 11, fontWeight: 500, color: selected ? 'white' : '#9CA3AF' }}>{sub}</span>}
    </button>
  )
}

const QUESTION = {
  fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 10px', lineHeight: 1.35,
}

function SkipBtn({ onClick, label = 'Hacer esto después' }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', color: '#9CA3AF',
        fontSize: 13, cursor: 'pointer', padding: '10px',
        fontFamily: 'inherit', width: '100%',
      }}
    >
      {label}
    </button>
  )
}

export default function OnboardingFlow() {
  const { user } = useAuth()
  const { refresh } = useFamily()
  // 4 pasos core (perfil → sobre el cuidado → medicamento → invitar) + bienvenida
  // y celebración como bookends de 1 tap cada uno. Antes eran 7 — "¿A quién vas
  // a cuidar?" y "¿Qué te preocupa más?" se eliminaron: ninguno de los dos se
  // guardaba en la base de datos, solo personalizaban texto en pantalla (ver
  // auditoría 2026-08-10). "Sobre el cuidado" (paso 3) sí se guarda -- Care
  // Complexity Score, usado después del trial para recomendar plan.
  const TOTAL = 6

  const [step, setStep]     = useState(1)
  const [pressed, setPressed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Paso 2 — perfil básico
  const [patientName, setPatientName]   = useState('')
  const [birthDate, setBirthDate]       = useState('')
  const [photoFile, setPhotoFile]       = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  // Paso 3 — sobre el cuidado (Care Complexity Score)
  const [caregiverCount, setCaregiverCount] = useState('')
  const [focusAreas, setFocusAreas]         = useState([])
  const [frequency, setFrequency]           = useState('')

  // Paso 4 — primer medicamento
  const [medName, setMedName]   = useState('')
  const [medFreq, setMedFreq]   = useState('')
  const [medTime, setMedTime]   = useState('')

  // Paso 4 — invitar equipo
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied]         = useState(false)

  const displayName  = user?.user_metadata?.full_name ?? user?.email ?? 'Yo'
  const progress     = (step / TOTAL) * 100
  const patientFirst = patientName.trim().split(' ')[0] || 'tu familiar'

  const pd = () => setPressed(true)
  const pu = () => setPressed(false)

  function pickPhoto(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  async function generateInviteLink() {
    if (inviteLink) return // ya generado
    try {
      // Use a placeholder email so the RPC does not reject an empty string.
      // The token is what matters — the invited person sets their own email on join.
      const { data: token, error } = await supabase.rpc('create_family_invitation', {
        p_invited_email: 'invitado@familiacerca.app', p_invited_by: displayName,
      })
      if (!error && token) {
        setInviteLink(`${window.location.origin}/join?token=${token}`)
      } else {
        setInviteLink(`${window.location.origin}/join`)
      }
    } catch {
      setInviteLink(`${window.location.origin}/join`)
    }
  }

  // ── Guardar perfil (Paso 2) ──────────────────────────────────────────
  async function handleSaveProfile() {
    if (!patientName.trim() || !birthDate) return
    setSaving(true); setError('')
    try {
      const { error: e1 } = await supabase.from('care_profiles').upsert(
        { user_id: user.id, name: patientName.trim() },
        { onConflict: 'user_id' }
      )
      if (e1) throw e1
      const { error: e2 } = await supabase.from('patient_profiles').upsert(
        { owner_id: user.id, nombre_completo: patientName.trim(), fecha_nacimiento: birthDate },
        { onConflict: 'owner_id' }
      )
      if (e2) throw e2
      if (photoFile) await uploadPatientPhoto(user.id, photoFile)
      setStep(3)
    } catch (e) {
      console.error('[ONB-ERR]', e)
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function toggleArea(value) {
    setFocusAreas(prev => {
      if (value === 'todo') return prev.includes('todo') ? [] : ['todo']
      const withoutTodo = prev.filter(v => v !== 'todo')
      return withoutTodo.includes(value)
        ? withoutTodo.filter(v => v !== value)
        : [...withoutTodo, value]
    })
  }

  // ── Guardar respuestas de "Sobre el cuidado" (Paso 3) ─────────────────
  async function saveComplexity() {
    setSaving(true)
    try {
      const { value, score, recommendedPlan } = computeComplexity(caregiverCount, focusAreas, frequency)
      const { error } = await supabase.from('care_complexity').upsert({
        id: user.id,
        caregiver_count: caregiverCount,
        focus_areas: focusAreas,
        frequency,
        complexity_score_value: value,
        complexity_score: score,
        recommended_plan: recommendedPlan,
        skipped: false,
      }, { onConflict: 'id' })
      if (error) throw error
    } catch (e) {
      console.warn('[OnboardingFlow] saveComplexity failed:', e)
    } finally {
      setSaving(false)
      setStep(4)
    }
  }

  async function skipComplexity() {
    try {
      const { error } = await supabase.from('care_complexity').upsert(
        { id: user.id, skipped: true },
        { onConflict: 'id' }
      )
      if (error) throw error
    } catch (e) {
      console.warn('[OnboardingFlow] skipComplexity failed:', e)
    } finally {
      setStep(4)
    }
  }

  // ── Avanzar del paso 4 (medicamento) al 5 (invitar), generando el enlace ──
  function goToInvite() {
    generateInviteLink()
    setStep(5)
  }

  // ── Guardar primer medicamento (Paso 4) ───────────────────────────────
  async function saveFirstMed() {
    setSaving(true)
    try {
      if (medName.trim()) {
        const times = medTime ? [medTime] : []
        await supabase.from('medications').insert({
          user_id: user.id, created_by_user_id: user.id,
          name: medName.trim(),
          frequency: medFreq || null,
          time: medTime || null,
          scheduled_times: times.length ? times : null,
        })
      }
    } catch (err) {
      console.warn('[OnboardingFlow] saveFirstMed failed:', err)
    } finally {
      setSaving(false)
      goToInvite()
    }
  }

  // ── Funciones de compartir (Paso 4) ───────────────────────────────────
  const inviteMsg = () =>
    `Te invito a FamiliaCerca para coordinar el cuidado de ${patientName || 'nuestro familiar'}. Descárgala en familiacerca.com${inviteLink ? ` o entra aquí: ${inviteLink}` : ''}`

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteMsg())}`, '_blank')
  }
  function shareSMS() {
    window.open(`sms:?body=${encodeURIComponent(inviteMsg())}`, '_blank')
  }
  function shareEmail() {
    const subject = `Únete al equipo de cuidado en FamiliaCerca`
    const body = `Hola,\n\nTe invito a coordinar el cuidado de ${patientName || 'nuestro familiar'} en FamiliaCerca.\n\n${inviteLink ? `Entra aquí: ${inviteLink}\n\n` : ''}Descárgala en familiacerca.com`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { }
  }

  // El perfil/familia ya quedó creado en Supabase para este punto — lo único que puede
  // fallar por una red inestable es este flag. Reintenta unas veces antes de rendirse
  // en vez de depender de que el usuario vuelva a pasar por algún onboarding después.
  async function saveOnboardingCompletedFlag(attempt = 1) {
    const { error } = await supabase.auth.updateUser({ data: { onboarding_completed: true } })
    if (!error) return
    if (attempt >= 3) {
      console.warn('[ONB] flag servidor no guardado tras 3 intentos:', error)
      return
    }
    await new Promise(r => setTimeout(r, attempt * 1000))
    return saveOnboardingCompletedFlag(attempt + 1)
  }

  async function finish() {
    localStorage.setItem('fc_patient_onboarding_done', '1')
    await saveOnboardingCompletedFlag()
    refresh?.()
    window.location.href = '/dashboard'
  }

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#F8F4ED', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header con barra de progreso ── */}
      <div style={{ background: '#075F55', padding: '0 20px', paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
        <Logo showWordmark size={28} variant="light" />
        <div style={{ marginTop: 16, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
          <div style={{
            height: '100%', width: `${progress}%`, background: '#E9826E', borderRadius: 4,
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'right', margin: '6px 0 14px', fontWeight: 600 }}>
          {step} / {TOTAL}
        </p>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '32px 20px 48px', overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ════ PASO 1 — BIENVENIDA ════ */}
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🏠</div>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.2, margin: '0 0 12px' }}>
                Bienvenido a FamiliaCerca
              </p>
              <p style={{ fontSize: 16, color: '#718096', margin: 0, lineHeight: 1.6 }}>
                Organiza el cuidado de tu familiar en un solo lugar.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {[
                { emoji: '💊', text: 'Medicamentos con recordatorios automáticos' },
                { emoji: '👨‍👩‍👧', text: 'Todo el equipo coordinado en tiempo real' },
                { emoji: '📋', text: 'Historial médico accesible desde cualquier lugar' },
              ].map(({ emoji, text }) => (
                <div key={text} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', background: 'white',
                  borderRadius: 16, border: '1.5px solid #E8E4DC',
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
                  <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.4 }}>{text}</p>
                </div>
              ))}
            </div>

            <PrimaryBtn onClick={() => setStep(2)} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
              Comenzar →
            </PrimaryBtn>
          </>
        )}

        {/* ════ PASO 2 — PERFIL BÁSICO ════ */}
        {step === 2 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 6px' }}>
              Cuéntanos sobre tu familiar
            </p>
            <p style={{ fontSize: 14, color: '#718096', margin: '0 0 28px' }}>
              Solo lo básico — puedes agregar detalles médicos después.
            </p>

            {/* Foto */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: 'none' }} />
              <input ref={galleryRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />

              <div
                onClick={() => setPhotoMenuOpen(o => !o)}
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: photoPreview ? 'transparent' : '#A8E5D6',
                  border: '2px dashed #087F70',
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

              {photoMenuOpen && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={() => { cameraRef.current.click(); setPhotoMenuOpen(false) }}
                    style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #087F70', background: 'white', color: '#087F70', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                    📷 Cámara
                  </button>
                  <button onClick={() => { galleryRef.current.click(); setPhotoMenuOpen(false) }}
                    style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #087F70', background: 'white', color: '#087F70', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
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
                  max={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })}
                />
              </div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 12 }}>{error}</p>}

            <div style={{ marginTop: 32 }}>
              <PrimaryBtn onClick={handleSaveProfile} disabled={!patientName.trim() || !birthDate || saving} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
                {saving ? 'Guardando...' : 'Continuar →'}
              </PrimaryBtn>
            </div>
          </>
        )}

        {/* ════ PASO 3 — SOBRE EL CUIDADO ════ */}
        {step === 3 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 24px' }}>
              Sobre el cuidado
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <p style={QUESTION}>¿Cuántas personas están ayudando regularmente en el cuidado?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CAREGIVER_OPTIONS.map(o => (
                    <Chip key={o.value} label={o.label} selected={caregiverCount === o.value} onClick={() => setCaregiverCount(o.value)} />
                  ))}
                </div>
              </div>

              <div>
                <p style={QUESTION}>¿Qué quieres coordinar principalmente?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {FOCUS_AREA_OPTIONS.map(o => (
                    <Chip key={o.value} label={o.label} selected={focusAreas.includes(o.value)} onClick={() => toggleArea(o.value)} />
                  ))}
                </div>
              </div>

              <div>
                <p style={QUESTION}>¿Con qué frecuencia necesitan coordinarse?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {COORD_FREQ_OPTIONS.map(o => (
                    <Chip key={o.value} label={o.label} sub={o.sub} selected={frequency === o.value} onClick={() => setFrequency(o.value)} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PrimaryBtn
                onClick={saveComplexity}
                disabled={saving || !caregiverCount || !frequency || focusAreas.length === 0}
                pressed={pressed} onPD={pd} onPU={pu} onPL={pu}
              >
                {saving ? 'Guardando...' : 'Continuar →'}
              </PrimaryBtn>
              <SkipBtn onClick={skipComplexity} />
            </div>
          </>
        )}

        {/* ════ PASO 4 — PRIMER MEDICAMENTO ════ */}
        {step === 4 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 8px' }}>
              Hagamos algo juntos
            </p>
            <p style={{ fontSize: 14, color: '#718096', margin: '0 0 20px', lineHeight: 1.5 }}>
              Tu primera acción en menos de 1 minuto.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 14px', background: '#A8E5D6', borderRadius: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#087F70', fontWeight: 600 }}>
                  💊 Primer medicamento de {patientFirst}
                </p>
              </div>
              <div>
                <label style={LABEL}>Nombre del medicamento *</label>
                <input style={INPUT} value={medName} autoFocus
                  onChange={e => setMedName(e.target.value)}
                  placeholder="Ej: Metformina, Losartán, Aspirina..." />
              </div>
              <div>
                <label style={LABEL}>Frecuencia</label>
                <div style={{ position: 'relative' }}>
                  <select value={medFreq} onChange={e => setMedFreq(e.target.value)}
                    style={{ ...INPUT, paddingRight: 36, appearance: 'none', WebkitAppearance: 'none' }}>
                    <option value="">Seleccionar...</option>
                    {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 12 }}>▼</span>
                </div>
              </div>
              <div>
                <label style={LABEL}>Hora de toma</label>
                <input type="time" style={INPUT} value={medTime} onChange={e => setMedTime(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PrimaryBtn
                onClick={saveFirstMed}
                disabled={saving || !medName.trim()}
                pressed={pressed} onPD={pd} onPU={pu} onPL={pu}
              >
                {saving ? 'Guardando...' : 'Agregar medicamento →'}
              </PrimaryBtn>
              <SkipBtn onClick={goToInvite} />
            </div>
          </>
        )}

        {/* ════ PASO 5 — INVITA AL EQUIPO ════ */}
        {step === 5 && (
          <>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 8px' }}>
              Invita a alguien del equipo
            </p>
            <p style={{ fontSize: 14, color: '#718096', margin: '0 0 28px', lineHeight: 1.5 }}>
              El cuidado es más fácil cuando toda la familia está conectada.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* WhatsApp */}
              <button
                onClick={shareWhatsApp}
                onPointerDown={pd} onPointerUp={pu} onPointerLeave={pu}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 16, border: 'none',
                  background: '#25D366', color: 'white', cursor: 'pointer',
                  boxShadow: pressed ? 'none' : '0 3px 0px #1da653',
                  transform: pressed ? 'translateY(3px)' : 'none',
                  transition: 'transform 0.08s ease, box-shadow 0.08s ease',
                  fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }}>📱</span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Invitar por WhatsApp</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Mensaje con el nombre del paciente</p>
                </div>
              </button>

              {/* SMS */}
              <button
                onClick={shareSMS}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 16,
                  border: '1.5px solid #E8E4DC', background: 'white', cursor: 'pointer',
                  boxShadow: '0 2px 0px #E0DBD2', fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }}>💬</span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Invitar por SMS</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718096' }}>Mensaje de texto directo</p>
                </div>
              </button>

              {/* Email */}
              <button
                onClick={shareEmail}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 16,
                  border: '1.5px solid #E8E4DC', background: 'white', cursor: 'pointer',
                  boxShadow: '0 2px 0px #E0DBD2', fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }}>📧</span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Invitar por correo</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718096' }}>Asunto y mensaje prellenado</p>
                </div>
              </button>

              {/* Copiar enlace */}
              {inviteLink && (
                <button
                  onClick={copyLink}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px', borderRadius: 14,
                    border: '1.5px solid #E8E4DC', background: 'white', cursor: 'pointer',
                    color: '#087F70', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  {copied ? '✓ ¡Enlace copiado!' : '🔗 Copiar enlace de invitación'}
                </button>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PrimaryBtn onClick={() => setStep(6)} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
                Continuar →
              </PrimaryBtn>
              <SkipBtn onClick={() => setStep(6)} />
            </div>
          </>
        )}

        {/* ════ PASO 6 — CELEBRACIÓN ════ */}
        {step === 6 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 56, marginBottom: 14, lineHeight: 1 }}>🎉</div>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1.25, margin: '0 0 10px' }}>
                {patientName.trim()
                  ? `${patientName.trim().split(' ')[0]} ya está protegido.`
                  : '¡Todo listo!'}
              </p>
              <p style={{ fontSize: 15, color: '#718096', margin: 0, lineHeight: 1.6 }}>
                Tu equipo de cuidado está listo para comenzar.
              </p>
            </div>

            <PrimaryBtn onClick={finish} pressed={pressed} onPD={pd} onPU={pu} onPL={pu}>
              Ir al panel principal →
            </PrimaryBtn>
          </>
        )}

      </div>
    </div>
  )
}
