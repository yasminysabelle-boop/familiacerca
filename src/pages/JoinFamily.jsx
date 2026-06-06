import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Heart } from '../components/Icons'
import imgFamilia from '../assets/images/splash-familia.png'
import PWAInstallBanner from '../components/PWAInstallBanner'

// ── Sub-components ─────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const cfg = role === 'cuidador'
    ? { label: 'Cuidador', color: '#1D4ED8', bg: '#EFF6FF' }
    : role === 'familiar'
    ? { label: 'Familiar', color: '#D97706', bg: '#FEF3C7' }
    : { label: 'Cuidador', color: '#3D6B54', bg: '#E8F5EE' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '5px 14px',
      borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  )
}

function PatientAvatar({ photo, name, size = 80 }) {
  if (photo) {
    return (
      <img
        src={photo} alt={name}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid white', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          flexShrink: 0,
        }}
      />
    )
  }
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #4A7C59, #2D6A4F)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700, color: 'white',
      border: '3px solid white', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      fontFamily: 'Georgia, serif', flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

const CARD = {
  background: 'rgba(255,248,240,0.96)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRadius: 24, padding: '36px 24px',
  textAlign: 'center',
  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
}

const BTN_PRIMARY = {
  width: '100%', padding: '14px', borderRadius: 14,
  background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
  color: 'white', fontWeight: 700, fontSize: 14,
  border: 'none', cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(74,124,89,0.35)',
  transition: 'all 0.2s',
}

const BTN_OUTLINE = {
  width: '100%', padding: '13px', borderRadius: 14,
  border: '1.5px solid #EDE5D8', background: 'white',
  color: '#374151', fontWeight: 600, fontSize: 14,
  cursor: 'pointer', transition: 'all 0.2s',
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function JoinFamily() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { user, loading: sessionLoading, signOut } = useAuth()
  const { refresh: refreshFamily } = useFamily()

  const [invitation, setInvitation] = useState(null)
  const [invLoading, setInvLoading] = useState(!!token)
  const [invError, setInvError] = useState('')

  const [patientName, setPatientName] = useState('')
  const [patientPhoto, setPatientPhoto] = useState(null)

  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [wrongEmailConfirm, setWrongEmailConfirm] = useState(false)

  // No token → redirect
  useEffect(() => {
    if (!token && !sessionLoading) {
      navigate(user ? '/dashboard' : '/login', { replace: true })
    }
  }, [token, user, sessionLoading])

  // Save token and load invitation on mount
  useEffect(() => {
    if (!token) return
    localStorage.setItem('pendingInviteToken', token)
    fetchInvitation()
  }, [token])

  // Auto-accept when user is logged in and invitation is valid
  useEffect(() => {
    if (!user || !invitation) return
    if (invitation.status !== 'pending') return
    if (isExpired(invitation)) return
    if (accepted || accepting || alreadyMember) return
    if (user.id === invitation.user_id) return
    const emailMismatch = invitation.invited_email && user.email !== invitation.invited_email
    if (emailMismatch && !wrongEmailConfirm) return
    acceptInvitation()
  }, [user, invitation, wrongEmailConfirm])

  async function fetchInvitation() {
    const { data, error } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (error || !data) {
      localStorage.removeItem('pendingInviteToken')
      setInvError('No encontramos esta invitación. Puede que el enlace sea incorrecto.')
      setInvLoading(false)
      return
    }

    // Clear token for already-terminal states (expired or already used)
    if (data.status !== 'pending' || new Date(data.expires_at) < new Date()) {
      localStorage.removeItem('pendingInviteToken')
    }

    setInvitation(data)

    const { data: cp } = await supabase
      .from('care_profiles')
      .select('name, photo_url')
      .eq('user_id', data.user_id)
      .maybeSingle()

    if (cp?.name) setPatientName(cp.name)
    if (cp?.photo_url) setPatientPhoto(cp.photo_url)

    setInvLoading(false)
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
      localStorage.removeItem('pendingInviteToken')
      setAcceptError('Esta invitación ya no es válida o ha expirado.')
      setAccepting(false)
      return
    }

    if (result === 'already_member') {
      localStorage.removeItem('pendingInviteToken')
      localStorage.setItem('fc_active_context', invitation.user_id)
      setAlreadyMember(true)
      setAccepting(false)
      return
    }

    await supabase.auth.updateUser({ data: { onboarding_completed: true } })
    localStorage.removeItem('pendingInviteToken')
    localStorage.setItem('fc_active_context', invitation.user_id)
    localStorage.setItem('fc_member_owner_id', invitation.user_id)
    refreshFamily()
    setAccepting(false)
    setAccepted(true)
  }

  if (!token) return null

  const isValidPending = !!(invitation && invitation.status === 'pending' && !isExpired(invitation) && !invError)
  const hasWrongEmail = !!(
    user && isValidPending &&
    invitation.invited_email && user.email !== invitation.invited_email &&
    !wrongEmailConfirm
  )

  // ── WELCOME SCREEN — unauthenticated + valid invitation ─────────────────────
  if (!sessionLoading && !user && isValidPending && !invLoading) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#F5F0E8',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Logo */}
        <div style={{ paddingTop: 52, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Logo size={36} showWordmark />
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 24px 52px',
          width: '100%', maxWidth: 420,
        }}>
          {/* Patient avatar */}
          <PatientAvatar photo={patientPhoto} name={patientName} size={80} />

          {/* Caption */}
          <p style={{
            marginTop: 20, marginBottom: 6,
            fontSize: 14, color: '#6F7A72',
            textAlign: 'center', lineHeight: 1.4,
          }}>
            Te invitaron a unirte al cuidado de
          </p>

          {/* Patient name */}
          <p style={{
            margin: '0 0 14px',
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: 28, fontWeight: 700, color: '#1E2D26',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            {patientName || 'tu familiar'}
          </p>

          {/* Role badge */}
          <RoleBadge role={invitation.role} />

          {/* Invited by */}
          {invitation.invited_by && (
            <p style={{ marginTop: 14, fontSize: 13, color: '#6F7A72', textAlign: 'center' }}>
              Invitado por{' '}
              <strong style={{ color: '#1E2D26' }}>{invitation.invited_by}</strong>
            </p>
          )}

          {/* Auth buttons */}
          <div style={{ width: '100%', marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => navigate('/login?redirect=invite')}
              style={{
                width: '100%', padding: '15px',
                background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                color: 'white', fontWeight: 700, fontSize: 15,
                borderRadius: 16, border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(74,124,89,0.28)',
              }}
            >
              Ya tengo cuenta
            </button>
            <button
              onClick={() => navigate('/register?redirect=invite')}
              style={{
                width: '100%', padding: '15px',
                background: 'white', color: '#1E2D26',
                fontWeight: 700, fontSize: 15,
                borderRadius: 16, border: '1.5px solid #D8D0C4', cursor: 'pointer',
              }}
            >
              Crear cuenta nueva
            </button>
          </div>

          <p style={{ marginTop: 20, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
            Tus datos están cifrados y protegidos.
          </p>
        </div>
      </div>
    )
  }

  // ── DARK OVERLAY SCREENS — loading, errors, logged-in states ─────────────────
  return (
    <div style={{
      position: 'relative', minHeight: '100svh',
      display: 'flex', flexDirection: 'column', background: '#0A0A0A',
    }}>
      <img
        src={imgFamilia} alt=""
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
          {(invLoading || sessionLoading) && (
            <div style={CARD}>
              <p style={{ color: '#6B7280', fontSize: 14 }}>Verificando invitación...</p>
            </div>
          )}

          {/* Error: not found */}
          {!invLoading && !sessionLoading && invError && (
            <div style={CARD}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Enlace no válido
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                {invError}
              </p>
              <button onClick={() => navigate('/login')} style={BTN_PRIMARY}>
                Ir al inicio
              </button>
            </div>
          )}

          {/* Expired */}
          {!invLoading && invitation && isExpired(invitation) && (
            <div style={CARD}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Invitación expirada
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Esta invitación expiró. Pide al administrador que te envíe una nueva.
              </p>
              <button onClick={() => navigate('/login')} style={BTN_PRIMARY}>
                Ir al inicio
              </button>
            </div>
          )}

          {/* Already used by someone else */}
          {!invLoading && invitation && invitation.status === 'accepted' && !accepted && !alreadyMember && (
            <div style={CARD}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Invitación ya usada
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Este enlace de invitación ya fue utilizado. Cada enlace es de un solo uso.
              </p>
              <button onClick={() => navigate(user ? '/dashboard' : '/login')} style={BTN_PRIMARY}>
                {user ? 'Ir al panel' : 'Ir al inicio'}
              </button>
            </div>
          )}

          {/* Already a member */}
          {alreadyMember && (
            <div style={CARD}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Ya formas parte de esta familia
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Ya eres miembro del grupo de cuidado{patientName ? ` de ${patientName}` : ''}.
              </p>
              <button onClick={() => navigate('/dashboard')} style={BTN_PRIMARY}>
                Entrar al panel →
              </button>
            </div>
          )}

          {/* Success — just accepted */}
          {accepted && (
            <div style={CARD}>
              <div className="animate-heartbeat inline-flex" style={{ marginBottom: 16 }}>
                <Heart size={56} color="#4A7C59" strokeWidth={1.2} filled />
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                ¡Bienvenido a la familia!
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Ahora formas parte del grupo de cuidado{patientName ? ` de ${patientName}` : ''}.
              </p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                style={{ ...BTN_PRIMARY, marginBottom: 12 }}
              >
                Ir al panel →
              </button>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
                Instala la app para recibir alertas en tiempo real
              </p>
            </div>
          )}

          {/* Valid invitation — logged-in user states */}
          {!invLoading && !sessionLoading && isValidPending && !accepted && !alreadyMember && user && (

            user.id === invitation.user_id ? (
              /* Admin opening own link */
              <div style={CARD}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                  Abre desde otra cuenta
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                  Creaste este enlace con tu cuenta ({user.email}). Compártelo con el familiar que quieres agregar.
                </p>
                <button onClick={signOut} style={BTN_OUTLINE}>
                  Cambiar de cuenta
                </button>
              </div>

            ) : hasWrongEmail ? (
              /* Wrong email warning */
              <div style={CARD}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                  Correo diferente
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 4 }}>
                  Esta invitación fue enviada a <strong>{invitation.invited_email}</strong>.
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                  Tu cuenta actual es <strong>{user.email}</strong>. ¿Quieres continuar de todas formas?
                </p>
                {acceptError && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, fontSize: 13, color: '#D63031' }}>
                    ⚠ {acceptError}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => setWrongEmailConfirm(true)} style={BTN_PRIMARY}>
                    Continuar de todas formas
                  </button>
                  <button onClick={signOut} style={BTN_OUTLINE}>
                    Cambiar de cuenta
                  </button>
                </div>
              </div>

            ) : acceptError ? (
              /* Acceptance failed */
              <div style={CARD}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                  No se pudo unir
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                  {acceptError}
                </p>
                <button onClick={acceptInvitation} style={BTN_PRIMARY}>
                  Intentar de nuevo
                </button>
              </div>

            ) : (
              /* Auto-accepting (triggers via useEffect; show while in flight) */
              <div style={CARD}>
                <p style={{ color: '#6B7280', fontSize: 14, marginBottom: patientName ? 8 : 0 }}>
                  Uniéndote al grupo de cuidado...
                </p>
                {patientName && (
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                    {patientName}
                  </p>
                )}
              </div>
            )
          )}

        </div>
      </div>

      {accepted && <PWAInstallBanner />}
    </div>
  )
}
