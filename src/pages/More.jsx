import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  Pill, Clock, BookOpen,
  Image, Mic,
  BarChart, User,
  Settings, Shield, Star,
  UserPlus, LogOut, ChevronRight, XIcon,
} from '../components/Icons'

const MORE_SECTIONS = [
  {
    label: 'Cuidado',
    items: [
      { to: '/medications',      Icon: Pill,     label: 'Medicamentos',        desc: 'Agregar y editar medicamentos',        color: '#4A7C59' },
      { to: '/cuidado/horarios', Icon: Clock,    label: 'Horarios de cuidado', desc: 'Turnos y rutinas del cuidado',         color: '#4A7C59' },
      { to: '/directorio',       Icon: BookOpen, label: 'Directorio',          desc: 'Médicos, hospitales y contactos',      color: '#2D86A0' },
    ],
  },
  {
    label: 'Memorias y reportes',
    items: [
      { to: '/album',    Icon: Image,   label: 'Álbum familiar', desc: 'Fotos y videos de momentos especiales', color: '#C9882A' },
      { to: '/memorias', Icon: Mic,     label: 'Memorias',       desc: 'Diario de voz familiar',                color: '#7C5CBF' },
      { to: '/reportes', Icon: BarChart,label: 'Reportes',       desc: 'Análisis semanal y PDF médico',         color: '#2D86A0' },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { to: '/ajustes',  Icon: Settings, label: 'Mi cuenta', desc: 'Suscripción y configuración', color: '#6B7280' },
      { to: '/permisos', Icon: Shield,   label: 'Permisos',  desc: 'Control de acceso familiar',  color: '#6B7280' },
      { to: '/pricing',  Icon: Star,     label: 'Planes',    desc: 'Actualizar suscripción',       color: '#C9882A' },
    ],
  },
]

const PLAN_COLORS = { free: '#9CA3AF', familiar: '#4A7C59', care_plus: '#7C3AED' }
const PLAN_LABELS = { free: 'Prueba gratuita', familiar: 'Plan Familiar', care_plus: 'Cuidado Total' }

export default function More() {
  const { user, signOut } = useAuth()
  const { profile, ownerId, memberRole } = useFamily()
  const canEdit = memberRole === null || memberRole === 'cuidador'
  const { sub, isTrialing, daysLeft, trialExpired } = useSubscription()
  const navigate = useNavigate()
  const caretakerName = user?.user_metadata?.full_name ?? user?.email ?? ''
  const planColor = PLAN_COLORS[sub?.plan] ?? '#9CA3AF'
  const planLabel = PLAN_LABELS[sub?.plan] ?? 'Cargando...'

  const [patientProfile, setPatientProfile] = useState(null)

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('patient_profiles')
      .select('nombre_completo, diagnostico_principal, alergias, condiciones_secundarias, medico_tratante, especialidad_medico')
      .eq('owner_id', ownerId)
      .maybeSingle()
      .then(({ data }) => setPatientProfile(data ?? null))
  }, [ownerId])

  const [showModal, setShowModal]     = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [status, setStatus]           = useState('idle') // idle | sending | success | error
  const [inviteLink, setInviteLink]   = useState('')
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied]           = useState(false)

  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      // ignore — still clear local state and redirect
    } finally {
      localStorage.removeItem('fc_active_family')
      window.location.href = '/login'
    }
  }

  function openModal() {
    setInviteEmail('')
    setStatus('idle')
    setInviteLink('')
    setInviteError('')
    setCopied(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setStatus('sending')
    setInviteError('')

    const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Un familiar'

    const { data: token, error } = await supabase
      .rpc('create_family_invitation', {
        p_invited_email: inviteEmail.trim().toLowerCase(),
        p_invited_by:    displayName,
      })

    if (error) {
      setInviteError('No se pudo crear la invitación: ' + error.message)
      setStatus('error')
      return
    }

    const link = `${window.location.origin}/join?token=${token}`
    setInviteLink(link)
    setStatus('success')
    // Fire-and-forget — link shown as fallback if email fails
    supabase.functions.invoke('send-invitation', {
      body: {
        inviteeEmail: inviteEmail.trim().toLowerCase(),
        inviterName: displayName,
        relativeName: profile?.name ?? 'su familiar',
        invitationLink: link,
        role: 'familiar',
      },
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: select the text
    }
  }

  const fieldBase = {
    width: '100%', padding: '12px 14px',
    border: '1.5px solid #EDE5D8', borderRadius: 12,
    fontSize: 14, outline: 'none', background: '#FDFAF7',
    boxSizing: 'border-box', transition: 'all 0.15s',
  }

  return (
    <Layout>
      <div className="p-5 pb-8">

        {/* Profile hero card */}
        <div
          className="rounded-3xl overflow-hidden mb-5"
          style={{ background: 'linear-gradient(145deg, #4A7C59 0%, #2E5240 100%)' }}
        >
          <div className="p-6 flex items-center gap-4">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.name}
                className="object-cover flex-shrink-0"
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  border: '2.5px solid rgba(201,136,42,0.5)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.12)',
                }}
              >
                <User size={28} color="rgba(255,255,255,0.55)" strokeWidth={1.2} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {profile ? (
                <>
                  <p
                    className="font-bold text-white leading-tight truncate"
                    style={{ fontFamily: 'Georgia, serif', fontSize: 20 }}
                  >
                    {patientProfile?.nombre_completo || profile.name}
                  </p>
                  {profile.age && (
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>
                      {profile.age} años
                    </p>
                  )}
                  {patientProfile?.diagnostico_principal && (
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3, lineHeight: 1.4 }} className="truncate">
                      {patientProfile.diagnostico_principal}
                    </p>
                  )}
                  {patientProfile?.alergias?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                      <span style={{ fontSize: 10, color: '#FCA5A5', fontWeight: 700 }}>⚠</span>
                      {patientProfile.alergias.slice(0, 3).map(a => (
                        <span key={a} style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                          background: 'rgba(220,38,38,0.25)', color: '#FCA5A5',
                          border: '1px solid rgba(220,38,38,0.3)',
                        }}>{a}</span>
                      ))}
                      {patientProfile.alergias.length > 3 && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>+{patientProfile.alergias.length - 3}</span>
                      )}
                    </div>
                  )}
                  {!patientProfile?.nombre_completo && canEdit && (
                    <Link to="/paciente/perfil" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, display: 'block', marginTop: 4, textDecoration: 'underline' }}>
                      + Completar perfil del paciente
                    </Link>
                  )}
                </>
              ) : null}
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4, letterSpacing: '0.03em' }}>
                Cuidado por {caretakerName}
              </p>
              {sub && (
                <div
                  onClick={() => navigate('/ajustes')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    marginTop: 8, padding: '4px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                    {planLabel}
                  </span>
                  {isTrialing && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                      · {daysLeft}d restantes
                    </span>
                  )}
                  {trialExpired && (
                    <span style={{ fontSize: 10, color: '#FCA5A5' }}>· Expirado</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature sections */}
        <div className="space-y-6 mb-5">
          {MORE_SECTIONS.map(({ label: sectionLabel, items }) => (
            <div key={sectionLabel}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                margin: '0 0 8px 4px',
              }}>
                {sectionLabel}
              </p>
              <div className="space-y-2">
                {items.map(({ to, Icon: IconComp, label, desc, color }) => (
                  <Link
                    key={to + label}
                    to={to}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white active:scale-[0.98] transition-transform"
                    style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8' }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 44, height: 44, borderRadius: 13, background: `${color}12` }}
                    >
                      <IconComp size={20} color={color} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    <ChevronRight size={16} color="#CCCCCC" strokeWidth={2} />
                  </Link>
                ))}

                {sectionLabel === 'Cuenta' && (
                  <>
                    <button
                      onClick={openModal}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white active:scale-[0.98] transition-transform"
                      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #EDE5D8', cursor: 'pointer' }}
                    >
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 44, height: 44, borderRadius: 13, background: '#4A7C5912' }}
                      >
                        <UserPlus size={20} color="#4A7C59" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                          Invitar familiar
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Agregar miembro a la familia</p>
                      </div>
                      <ChevronRight size={16} color="#CCCCCC" strokeWidth={2} />
                    </button>

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl active:scale-[0.98] transition-transform"
                      style={{ border: '1px solid #FFBABA', background: '#FFF8F8', cursor: 'pointer' }}
                    >
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 44, height: 44, borderRadius: 13, background: '#D6303112' }}
                      >
                        <LogOut size={20} color="#D63031" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-bold text-sm" style={{ fontFamily: 'Georgia, serif', color: '#D63031' }}>
                          Cerrar sesión
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Salir de la cuenta</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white',
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
                  Invitar familiar
                </p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  El enlace expira en 24 horas
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}
              >
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            {status === 'success' ? (
              <div>
                {/* Success state */}
                <div style={{
                  padding: '16px', background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 14, marginBottom: 16,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', marginBottom: 4 }}>
                    ✓ Invitación creada
                  </p>
                  <p style={{ fontSize: 12, color: '#4B7A5D', lineHeight: 1.5 }}>
                    Comparte este enlace con {inviteEmail}
                  </p>
                </div>

                <div style={{
                  padding: '12px 14px', background: '#F9F5F1',
                  border: '1.5px solid #EDE5D8', borderRadius: 12, marginBottom: 12,
                }}>
                  <p style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {inviteLink}
                  </p>
                </div>

                <button
                  onClick={copyLink}
                  style={{
                    width: '100%', padding: '13px',
                    background: copied
                      ? 'linear-gradient(135deg, #4A7C59, #3A6147)'
                      : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    borderRadius: 14, border: 'none', cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(74,124,89,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? '¡Copiado!' : 'Copiar enlace'}
                </button>

                <button
                  onClick={closeModal}
                  style={{
                    width: '100%', marginTop: 10, padding: '12px',
                    background: 'none', border: 'none', color: '#9CA3AF',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: '#6B7280', letterSpacing: '0.08em',
                    textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    Correo del familiar
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="familiar@correo.com"
                    autoFocus
                    style={fieldBase}
                    onFocus={e => { e.target.style.borderColor = '#4A7C59'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {inviteError && (
                  <div style={{
                    padding: '10px 14px', background: '#FFF0F0',
                    border: '1px solid #FFBABA', borderRadius: 10, fontSize: 13, color: '#D63031',
                  }}>
                    ⚠ {inviteError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !inviteEmail.trim()}
                  style={{
                    width: '100%', padding: '14px',
                    background: inviteEmail.trim() && status !== 'sending'
                      ? 'linear-gradient(135deg, #4A7C59, #3A6347)'
                      : '#C0CCC5',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    borderRadius: 14, border: 'none',
                    cursor: inviteEmail.trim() && status !== 'sending' ? 'pointer' : 'not-allowed',
                    boxShadow: inviteEmail.trim() ? '0 6px 20px rgba(74,124,89,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {status === 'sending' ? 'Creando invitación...' : 'Enviar invitación →'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
