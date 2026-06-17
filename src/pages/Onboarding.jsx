import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import imgFamilia from '../assets/images/splash-familia.png'

const STEP_CONFIG = [
  {
    emoji: '❤️',
    title: (firstName) => firstName ? `${firstName}, crea el perfil` : 'Crea el perfil',
    subtitle: 'Ingresa el nombre de tu familiar. Foto y detalles los agregas después.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: () => 'Invita a tu familia',
    subtitle: 'Para que todos puedan ver el historial de cuidado en tiempo real.',
  },
  {
    emoji: '💊',
    title: () => 'Registra los medicamentos',
    subtitle: 'Agrega las dosis y horarios para recibir recordatorios y nunca olvidar una.',
  },
]

const cardStyle = {
  width: '100%', maxWidth: 400,
  background: 'rgba(255,248,240,0.97)',
  backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  borderRadius: 24, padding: '28px 24px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
}

const primaryBtn = (disabled) => ({
  width: '100%', padding: '14px',
  background: disabled ? '#C0CCC5' : 'linear-gradient(135deg, #0d6b63, #3A6347)',
  color: 'white', fontWeight: 700, fontSize: 14,
  borderRadius: 16, border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 8px 24px rgba(13,107,99,0.35)',
  transition: 'all 0.2s',
})

const secondaryBtn = {
  width: '100%', padding: '13px',
  background: 'white', color: '#6B7280', fontWeight: 600, fontSize: 14,
  borderRadius: 14, border: '1.5px solid #EDE5D8', cursor: 'pointer',
}

const inputStyle = (active) => ({
  width: '100%', padding: '14px 16px', textAlign: 'center',
  fontSize: 16, fontWeight: 600, color: '#1A1A1A',
  border: `2px solid ${active ? '#0d6b63' : '#EDE5D8'}`,
  borderRadius: 14, background: 'white', outline: 'none',
  boxShadow: active ? '0 0 0 4px rgba(13,107,99,0.1)' : 'none',
  transition: 'all 0.2s', boxSizing: 'border-box',
})

export default function Onboarding() {
  const { user } = useAuth()
  const { profile, ownerId, loading: familyLoading, refresh } = useFamily()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Step 1
  const [patientName, setPatientName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Step 2
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied] = useState(false)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  const cfg = STEP_CONFIG[step - 1]

  // If onboarding already done, skip to hoy
  useEffect(() => {
    if (user?.user_metadata?.onboarding_completed) {
      navigate('/hoy', { replace: true })
    }
  }, [user, navigate])

  // Member users (accepted invitation) never need to create a profile
  useEffect(() => {
    if (familyLoading || !user) return
    if (ownerId && ownerId !== user.id) {
      // Fire-and-forget — member redirect must not block on metadata update
      supabase.auth.updateUser({ data: { onboarding_completed: true } })
        .catch(err => console.warn('[Onboarding] member metadata update failed:', err))
      navigate('/hoy', { replace: true })
    }
  }, [user, ownerId, familyLoading, navigate])

  // User already has their own care profile — skip step 1
  // Guard: don't skip if onboarding_completed (first useEffect will redirect instead)
  useEffect(() => {
    if (!familyLoading && profile && ownerId === user?.id && step === 1 && !user?.user_metadata?.onboarding_completed) {
      setStep(2)
    }
  }, [familyLoading, profile, ownerId])

  async function handleStep1(e) {
    e.preventDefault()
    if (!patientName.trim()) return
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('care_profiles').upsert(
      { user_id: user.id, name: patientName.trim() },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    if (error) { setSaveError('No se pudo guardar. Intenta de nuevo.'); return }
    await refresh()
    setStep(2)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
    const { data: token, error } = await supabase.rpc('create_family_invitation', {
      p_invited_email: inviteEmail.trim().toLowerCase(),
      p_invited_by: displayName,
    })
    setInviting(false)
    if (error || !token) { setInviteError('No se pudo crear la invitación. Intenta de nuevo.'); return }
    setInviteLink(`${window.location.origin}/join?token=${token}`)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard unavailable */ }
  }

  async function finish(dest = '/hoy') {
    const { error } = await supabase.auth.updateUser({ data: { onboarding_completed: true } })
    if (error) {
      console.error('[Onboarding] updateUser failed:', error)
      // Still navigate — the localStorage flag in App.jsx will prevent the slides from showing again
    }
    navigate(dest, { replace: true })
  }

  return (
    <div style={{ position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#0A0A0A' }}>
      {/* Background */}
      <img
        src={imgFamilia} alt="Familia"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.72) 100%)' }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px 48px',
      }}>
        <Logo variant="light" size={32} showWordmark />

        {/* Step progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 6 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              height: 4, borderRadius: 2, transition: 'all 0.3s ease',
              background: n <= step ? 'white' : 'rgba(255,255,255,0.28)',
              width: n === step ? 36 : 14,
            }} />
          ))}
        </div>
        <p style={{
          color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 22,
        }}>
          Paso {step} de 3
        </p>

        {/* Card */}
        <div style={cardStyle}>
          {/* Step header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>{cfg.emoji}</div>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700,
              color: '#1A1A1A', lineHeight: 1.3, marginBottom: 8,
            }}>
              {cfg.title(firstName)}
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.55 }}>
              {cfg.subtitle}
            </p>
          </div>

          {/* ── Step 1: Care profile ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {saveError && (
                <p style={{ fontSize: 12, color: '#D63031', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, padding: '8px 12px', margin: 0 }}>
                  ⚠ {saveError}
                </p>
              )}
              <input
                type="text" autoFocus required
                value={patientName} onChange={e => setPatientName(e.target.value)}
                placeholder="ej. Abuela Rosa, Papá..."
                style={inputStyle(!!patientName.trim())}
              />
              <button type="submit" disabled={!patientName.trim() || saving} style={primaryBtn(!patientName.trim() || saving)}>
                {saving ? 'Guardando...' : 'Siguiente →'}
              </button>
            </form>
          )}

          {/* ── Step 2: Invite family ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {inviteLink ? (
                <>
                  <div style={{
                    background: '#F0FDF4', border: '1px solid #BBF7D0',
                    borderRadius: 12, padding: '12px 14px',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>
                      ✅ Invitación creada para {inviteEmail}
                    </p>
                    <p style={{ fontSize: 11, color: '#6B7280', wordBreak: 'break-all', margin: 0 }}>
                      {inviteLink}
                    </p>
                  </div>
                  <button onClick={copyLink} style={primaryBtn(false)}>
                    {copied ? '¡Copiado!' : '📋 Copiar enlace'}
                  </button>
                  <button onClick={() => setStep(3)} style={secondaryBtn}>
                    Continuar →
                  </button>
                </>
              ) : (
                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {inviteError && (
                    <p style={{ fontSize: 12, color: '#D63031', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, padding: '8px 12px', margin: 0 }}>
                      ⚠ {inviteError}
                    </p>
                  )}
                  <input
                    type="email" required
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="correo@familiar.com"
                    style={{ ...inputStyle(!!inviteEmail.trim()), fontWeight: 400, fontSize: 14 }}
                  />
                  <button type="submit" disabled={inviting || !inviteEmail.trim()} style={primaryBtn(inviting || !inviteEmail.trim())}>
                    {inviting ? 'Creando enlace...' : 'Crear enlace de invitación →'}
                  </button>
                </form>
              )}
              <button
                onClick={() => setStep(3)}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', padding: '4px 0', textAlign: 'center' }}
              >
                Omitir por ahora
              </button>
            </div>
          )}

          {/* ── Step 3: Medications ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#F7F3ED', border: '1px solid #EDE5D8',
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {[
                  ['⏰', 'Recordatorios automáticos a la hora de cada dosis.'],
                  ['📋', 'Registro de quién dio cada medicamento y cuándo.'],
                  ['💬', 'Toda la familia ve el historial en tiempo real.'],
                ].map(([icon, text]) => (
                  <div key={icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.3 }}>{icon}</span>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.45 }}>{text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => finish('/medications')} style={primaryBtn(false)}>
                Agregar medicamentos →
              </button>
              <button onClick={() => finish('/hoy')} style={secondaryBtn}>
                Explorar primero
              </button>
            </div>
          )}
        </div>

        {/* Global skip */}
        <button
          onClick={() => finish('/hoy')}
          style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: '8px 20px' }}
        >
          Saltar todo
        </button>

        <p style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.6 }}>
          Tus datos están cifrados y son solo tuyos.
        </p>
      </div>
    </div>
  )
}
