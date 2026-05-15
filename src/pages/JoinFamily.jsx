import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Heart, UserPlus, Eye, EyeOff } from '../components/Icons'
import imgFamilia from '../assets/images/splash-familia.png'

export default function JoinFamily() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { user, loading: sessionLoading, signIn, signUp } = useAuth()
  const { refresh: refreshFamily } = useFamily()

  const [invitation, setInvitation] = useState(null)
  const [invLoading, setInvLoading] = useState(!!token)
  const [invError, setInvError]     = useState('')

  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const [authName, setAuthName]       = useState('')
  const [authEmail, setAuthEmail]     = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError]     = useState('')

  const [accepting, setAccepting]   = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const [accepted, setAccepted]     = useState(false)

  // No token → not an invitation page; redirect once auth state is settled
  useEffect(() => {
    if (!token && !sessionLoading) {
      navigate(user ? '/dashboard' : '/login', { replace: true })
    }
  }, [token, user, sessionLoading])

  // Load invitation on mount (only when a token is present)
  useEffect(() => {
    if (!token) return
    fetchInvitation()
  }, [token])

  // If user just logged in and we have a valid invitation, accept automatically
  useEffect(() => {
    if (user && invitation && invitation.status === 'pending' && !isExpired(invitation) && !accepted) {
      acceptInvitation()
    }
  }, [user, invitation])

  async function fetchInvitation() {
    const { data, error } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    setInvLoading(false)

    if (error || !data) {
      setInvError('No encontramos esta invitación. Puede que el enlace sea incorrecto.')
      return
    }

    setInvitation(data)
  }

  function isExpired(inv) {
    return new Date(inv.expires_at) < new Date()
  }

  async function acceptInvitation() {
    if (!user || !invitation) return
    setAccepting(true)
    setAcceptError('')

    const { data: result, error } = await supabase
      .rpc('accept_family_invitation', { p_token: token })

    if (error) {
      setAcceptError('No se pudo unir a la familia: ' + error.message)
      setAccepting(false)
      return
    }

    if (result === 'invalid') {
      setAcceptError('Esta invitación ya no es válida o ha expirado.')
      setAccepting(false)
      return
    }

    // Mark onboarding complete — members join an existing family, no profile creation needed
    await supabase.auth.updateUser({ data: { onboarding_completed: true } })

    setAccepting(false)
    setAccepted(true)
    localStorage.setItem('fc_active_family', 'member')
    refreshFamily() // connect member to family group immediately
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    let result
    if (authMode === 'login') {
      result = await signIn(authEmail, authPassword)
      if (result.error) {
        setAuthError('Correo o contraseña incorrectos.')
        setAuthLoading(false)
        return
      }
    } else {
      result = await signUp(authEmail, authPassword, { full_name: authName })
      if (result.error) {
        setAuthError('No se pudo crear la cuenta: ' + result.error.message)
        setAuthLoading(false)
        return
      }
    }

    setAuthLoading(false)
    // acceptInvitation will be called by the useEffect watching user
  }

  const fieldBase = {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid #EDE5D8', borderRadius: 12,
    fontSize: 14, outline: 'none', background: 'white',
    boxSizing: 'border-box', transition: 'all 0.15s',
  }
  const onFocus = e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }
  const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

  // Render nothing while the no-token redirect is in flight
  if (!token) return null

  return (
    <div style={{
      position: 'relative',
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0A0A0A',
    }}>
      {/* Background photo */}
      <img
        src={imgFamilia}
        alt="Familia"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 30%',
        }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100svh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px 48px',
      }}>
        <Logo variant="light" size={32} showWordmark />

        <div style={{ marginTop: 24, width: '100%', maxWidth: 400 }}>

          {/* Loading */}
          {invLoading && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <p style={{ color: '#6B7280', fontSize: 14 }}>Verificando invitación...</p>
            </div>
          )}

          {/* Error: not found / bad link */}
          {!invLoading && invError && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Enlace no válido
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                {invError}
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '12px 28px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #C4623A, #A85130)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(196,98,58,0.3)',
                }}
              >
                Ir al inicio
              </button>
            </div>
          )}

          {/* Expired invitation */}
          {!invLoading && invitation && isExpired(invitation) && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Invitación expirada
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 6 }}>
                Esta invitación de <strong>{invitation.invited_by}</strong> expiró.
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Pídele que te envíe una nueva.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '12px 28px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #C4623A, #A85130)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(196,98,58,0.3)',
                }}
              >
                Ir al inicio
              </button>
            </div>
          )}

          {/* Already accepted */}
          {!invLoading && invitation && invitation.status === 'accepted' && !accepted && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Invitación ya aceptada
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Esta invitación ya fue utilizada.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '12px 28px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #C4623A, #A85130)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(196,98,58,0.3)',
                }}
              >
                Ir al panel
              </button>
            </div>
          )}

          {/* Success: just accepted */}
          {accepted && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              <div className="animate-heartbeat inline-flex" style={{ marginBottom: 16 }}>
                <Heart size={56} color="#C4623A" strokeWidth={1.2} filled />
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                ¡Bienvenido a la familia!
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Ya eres parte del grupo de cuidado de <strong>{invitation?.invited_by}</strong>.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #C4623A, #A85130)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  borderRadius: 14, border: 'none', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(196,98,58,0.35)',
                }}
              >
                Ir al panel →
              </button>
            </div>
          )}

          {/* Valid invitation — main flow */}
          {!invLoading && invitation && invitation.status === 'pending' && !isExpired(invitation) && !accepted && (
            <div style={{
              background: 'rgba(255,248,240,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24, padding: '28px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}>
              {/* Invitation header */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(196,98,58,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <UserPlus size={24} color="#C4623A" strokeWidth={1.5} />
                </div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 6 }}>
                  Invitación a FamiliaCerca
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  <strong style={{ color: '#1A1A1A' }}>{invitation.invited_by}</strong> te invita a unirte a su grupo familiar de cuidado.
                </p>
              </div>

              {acceptError && (
                <div style={{
                  marginBottom: 14, padding: '10px 14px',
                  background: '#FFF0F0', border: '1px solid #FFBABA',
                  borderRadius: 10, fontSize: 13, color: '#D63031',
                }}>
                  ⚠ {acceptError}
                </div>
              )}

              {/* If already logged in: just show accept button */}
              {user ? (
                <div>
                  <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 }}>
                    Ingresando como <strong>{user.email}</strong>
                  </p>
                  <button
                    onClick={acceptInvitation}
                    disabled={accepting}
                    style={{
                      width: '100%', padding: '14px',
                      background: accepting
                        ? '#D4C4B8'
                        : 'linear-gradient(135deg, #C4623A, #A85130)',
                      color: 'white', fontWeight: 700, fontSize: 14,
                      borderRadius: 14, border: 'none',
                      cursor: accepting ? 'not-allowed' : 'pointer',
                      boxShadow: accepting ? 'none' : '0 8px 24px rgba(196,98,58,0.35)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {accepting ? 'Uniéndome...' : 'Aceptar invitación →'}
                  </button>
                </div>
              ) : (
                /* Not logged in: show auth form */
                <div>
                  {/* Auth mode tabs */}
                  <div style={{
                    display: 'flex', background: '#F3F4F6',
                    borderRadius: 12, padding: 3, marginBottom: 18,
                  }}>
                    {['login', 'register'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => { setAuthMode(mode); setAuthError('') }}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: authMode === mode ? 'white' : 'transparent',
                          color: authMode === mode ? '#1A1A1A' : '#9CA3AF',
                          boxShadow: authMode === mode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        {mode === 'login' ? 'Ya tengo cuenta' : 'Soy nuevo'}
                      </button>
                    ))}
                  </div>

                  {authError && (
                    <div style={{
                      marginBottom: 12, padding: '10px 14px',
                      background: '#FFF0F0', border: '1px solid #FFBABA',
                      borderRadius: 10, fontSize: 13, color: '#D63031',
                    }}>
                      ⚠ {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {authMode === 'register' && (
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={e => setAuthName(e.target.value)}
                        placeholder="Tu nombre completo"
                        style={fieldBase}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      />
                    )}
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      style={fieldBase}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        placeholder="Contraseña"
                        style={{ ...fieldBase, paddingRight: 44 }}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        style={{
                          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 4, display: 'flex', alignItems: 'center',
                        }}
                        aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPw
                          ? <EyeOff size={18} color="#9CA3AF" strokeWidth={1.5} />
                          : <Eye    size={18} color="#9CA3AF" strokeWidth={1.5} />
                        }
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      style={{
                        marginTop: 4, width: '100%', padding: '13px',
                        background: authLoading
                          ? '#D4C4B8'
                          : 'linear-gradient(135deg, #C4623A, #A85130)',
                        color: 'white', fontWeight: 700, fontSize: 14,
                        borderRadius: 14, border: 'none',
                        cursor: authLoading ? 'not-allowed' : 'pointer',
                        boxShadow: authLoading ? 'none' : '0 6px 20px rgba(196,98,58,0.3)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {authLoading
                        ? 'Un momento...'
                        : authMode === 'login'
                          ? 'Ingresar y aceptar →'
                          : 'Crear cuenta y aceptar →'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        <p style={{
          marginTop: 20, textAlign: 'center', fontSize: 11,
          color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
        }}>
          Tus datos están cifrados y son solo tuyos.
        </p>
      </div>
    </div>
  )
}
