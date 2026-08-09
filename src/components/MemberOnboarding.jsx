import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import VoiceInput from './VoiceInput'
import imgFamilia from '../assets/images/splash-familia.png'

const RELATIONSHIPS = [
  { value: 'hijo_a',    label: 'Hijo/a',     emoji: '👦' },
  { value: 'hermano_a', label: 'Hermano/a',   emoji: '🧑' },
  { value: 'cuidador_a',label: 'Cuidador/a',  emoji: '👩‍⚕️' },
  { value: 'pareja',    label: 'Pareja',      emoji: '❤️' },
  { value: 'nieto_a',   label: 'Nieto/a',     emoji: '🧒' },
  { value: 'otro',      label: 'Otro',        emoji: '👤' },
]

export default function MemberOnboarding({ onDone }) {
  const { user } = useAuth()
  const { profile: ownerProfile } = useFamily()

  const [step, setStep] = useState(1)

  // Step 1 state
  const [name, setName]               = useState(user?.user_metadata?.full_name ?? '')
  const [relationship, setRelationship] = useState('')
  const [photoFile, setPhotoFile]     = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileInputRef = useRef()

  // Step 2 state
  const [phone, setPhone] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const patientName = ownerProfile?.name ?? 'el paciente'

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function validateStep1() {
    if (!name.trim()) { setError('Escribe tu nombre.'); return false }
    if (!relationship) { setError(`Selecciona tu relación con ${patientName}.`); return false }
    return true
  }

  async function handleFinish() {
    if (!phone.trim()) { setError('Agrega tu número de celular.'); return }
    setSaving(true)
    setError('')
    try {
      let avatarUrl = null

      // Upload photo if selected
      if (photoFile) {
        const ext  = photoFile.name.split('.').pop() || 'jpg'
        const path = `${user.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type })
        if (upErr) {
          setError('No se pudo subir la foto. Tu perfil se guardará sin imagen.')
        } else {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
          avatarUrl = publicUrl
        }
      }

      // Update auth metadata (name + onboarding flag)
      await supabase.auth.updateUser({
        data: { full_name: name.trim(), onboarding_completed: true },
      }).catch(() => {})

      // Upsert user_profile
      await supabase.from('user_profiles').upsert(
        {
          id:           user.id,
          email:        user.email,
          full_name:    name.trim(),
          phone:        phone.trim(),
          relationship: relationship,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        },
        { onConflict: 'id' }
      )

      onDone()
    } catch (err) {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const cardStyle = {
    background: 'rgba(255,248,240,0.97)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 24,
    padding: '28px 24px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Background */}
      <img src={imgFamilia} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center 30%',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Progress dots */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            width: s === step ? 24 : 8, height: 8, borderRadius: 4,
            background: s <= step ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* ─── PASO 1 ─── */}
      {step === 1 && (
        <div style={{ ...cardStyle, position: 'relative', zIndex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Paso 1 de 2
          </p>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1A1A1A', fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.2 }}>
            Cuéntanos de ti
          </h2>
          <p style={{ margin: '0 0 22px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
            Te unes al cuidado de <strong style={{ color: '#1A1A1A' }}>{patientName}</strong>.
          </p>

          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 88, height: 88, borderRadius: '50%', border: 'none',
                  background: photoPreview ? 'transparent' : '#E8F6F3',
                  cursor: 'pointer', padding: 0, overflow: 'hidden',
                  border: '3px solid #087F70',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {photoPreview
                  ? <img src={photoPreview} alt="Tu foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 32 }}>📷</span>
                }
              </button>
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 24, height: 24, borderRadius: '50%',
                background: '#087F70', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, pointerEvents: 'none',
              }}>
                ✏️
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>
          <p style={{ margin: '-12px 0 18px', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
            Toca para agregar foto (opcional)
          </p>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <VoiceInput
              value={name}
              onChange={setName}
              placeholder="Tu nombre completo"
              rows={1}
              label="Tu nombre"
            />
          </div>

          {/* Relationship */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Tu relación con {patientName}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {RELATIONSHIPS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRelationship(r.value)}
                  style={{
                    padding: '10px 4px', borderRadius: 12, border: 'none',
                    background: relationship === r.value ? '#087F70' : '#F9F7F4',
                    border: `1.5px solid ${relationship === r.value ? '#087F70' : '#E5E0D8'}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{r.emoji}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: relationship === r.value ? 'white' : '#374151',
                  }}>
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#DC2626', padding: '7px 12px', borderRadius: 8, background: '#FEF2F2' }}>
              {error}
            </p>
          )}

          <button
            onClick={() => {
              if (!validateStep1()) return
              setError('')
              setStep(2)
            }}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #087F70, #A8E5D6)',
              color: 'white', fontWeight: 800, fontSize: 15,
              cursor: 'pointer', boxShadow: '0 6px 20px rgba(8,127,112,0.3)',
            }}
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ─── PASO 2 ─── */}
      {step === 2 && (
        <div style={{ ...cardStyle, position: 'relative', zIndex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Paso 2 de 2
          </p>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1A1A1A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Tu celular
          </h2>
          <p style={{ margin: '0 0 22px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
            Para que el equipo pueda contactarte en una emergencia.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Número de celular
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: '1.5px solid #D1C9BF', fontSize: 15,
                color: '#1A1A1A', background: 'white', boxSizing: 'border-box',
                letterSpacing: '0.03em',
              }}
              autoFocus
            />
          </div>

          {error && (
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#DC2626', padding: '7px 12px', borderRadius: 8, background: '#FEF2F2' }}>
              {error}
            </p>
          )}

          <button
            onClick={handleFinish}
            disabled={saving}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #087F70, #A8E5D6)',
              color: 'white', fontWeight: 800, fontSize: 15,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: saving ? 'none' : '0 6px 20px rgba(8,127,112,0.3)',
              marginBottom: 10,
            }}
          >
            {saving ? 'Guardando...' : '¡Listo! Ir al panel →'}
          </button>

          <button
            onClick={() => setStep(1)}
            style={{
              width: '100%', padding: '11px', borderRadius: 14,
              border: '1px solid #EDE5D8', background: 'white',
              color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            ← Atrás
          </button>
        </div>
      )}
    </div>
  )
}
