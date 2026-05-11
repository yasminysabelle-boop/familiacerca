import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Heart } from '../components/Icons'
import imgFamilia from '../assets/images/splash-familia.png'

export default function Onboarding() {
  const { user } = useAuth()
  const { profile, refresh } = useFamily()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? ''

  useEffect(() => {
    if (profile?.name) navigate('/dashboard', { replace: true })
  }, [profile, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('care_profiles').upsert(
      { user_id: user.id, name: name.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    await refresh()
    navigate('/dashboard', { replace: true })
  }

  const hasName = !!name.trim()

  return (
    <div style={{
      position: 'relative',
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0A0A0A',
    }}>
      {/* Background photo — familia image for family member step */}
      <img
        src={imgFamilia}
        alt="Familia"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 30%',
        }}
      />

      {/* Dark overlay — heavier at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.62) 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100svh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px 48px',
      }}>

        {/* Logo */}
        <Logo variant="light" size={36} showWordmark />

        {/* Step dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 32 }}>
          <div style={{ height: 4, width: 32, borderRadius: 2, background: 'rgba(255,255,255,0.32)' }} />
          <div style={{ height: 4, width: 32, borderRadius: 2, background: 'white' }} />
        </div>

        {/* Frosted glass form card */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'rgba(255,248,240,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 24,
          padding: '28px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="animate-heartbeat inline-flex" style={{ marginBottom: 16 }}>
              <Heart size={52} color="#C4623A" strokeWidth={1.2} filled />
            </div>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700,
              color: '#1A1A1A', lineHeight: 1.3, marginBottom: 8,
            }}>
              {firstName ? `${firstName}, ¿cómo` : '¿Cómo'} se llama tu familiar?
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              Solo su nombre por ahora. La foto, edad y medicamentos los agregas después.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ej. Abuela Rosa, Papá..."
              autoFocus
              autoComplete="off"
              style={{
                width: '100%', padding: '14px 16px',
                textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#1A1A1A',
                border: `2px solid ${hasName ? '#C4623A' : '#EDE5D8'}`,
                borderRadius: 14, background: 'white', outline: 'none',
                boxShadow: hasName ? '0 0 0 4px rgba(196,98,58,0.1)' : 'none',
                transition: 'all 0.2s', boxSizing: 'border-box',
              }}
            />

            <button
              type="submit"
              disabled={!hasName || saving}
              style={{
                width: '100%', padding: '14px',
                background: hasName
                  ? 'linear-gradient(135deg, #C4623A, #A85130)'
                  : '#D4C4B8',
                color: 'white', fontWeight: 700, fontSize: 14,
                borderRadius: 16, border: 'none',
                cursor: hasName && !saving ? 'pointer' : 'not-allowed',
                boxShadow: hasName ? '0 8px 24px rgba(196,98,58,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Un momento...' : '¡Empezar a cuidar! →'}
            </button>
          </form>
        </div>

        {/* Skip */}
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          style={{
            marginTop: 20, padding: '10px 24px',
            fontSize: 13, color: 'rgba(255,255,255,0.6)',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          Saltar por ahora
        </button>

        {/* Trust note */}
        <p style={{
          marginTop: 12, textAlign: 'center', fontSize: 11,
          color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
        }}>
          Tus datos están cifrados y son solo tuyos.
          <br />Nunca los compartimos con terceros.
        </p>
      </div>
    </div>
  )
}
