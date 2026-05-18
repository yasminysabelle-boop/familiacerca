import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { createPortalSession } from '../lib/stripe'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { UserPlus, Phone, Mail, MapPin, XIcon, BookOpen, Users, LogOut } from '../components/Icons'
import { track } from '../lib/analytics'

const PLAN_LABELS = { free: 'Prueba gratuita', familiar: 'Plan Familiar', care_plus: 'Care+' }
const PLAN_COLORS = { free: '#9CA3AF', familiar: '#C4623A', care_plus: '#7C3AED' }

export default function Familia() {
  const { user, signOut } = useAuth()
  const { profile, ownerId } = useFamily()
  const { sub, isPaid, isTrialing, daysLeft } = useSubscription()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [memberProfiles, setMemberProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [memberModal, setMemberModal] = useState(null)
  const [memberContact, setMemberContact] = useState(undefined)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('idle')
  const [inviteLink, setInviteLink] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [shifts, setShifts] = useState({})
  const [shiftModal, setShiftModal] = useState(null)
  const [shiftName, setShiftName] = useState('')
  const [savingShift, setSavingShift] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [confirmRemoveDialog, setConfirmRemoveDialog] = useState(null) // { member, name }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const isAdmin = user?.id === ownerId

  const today = new Date()
  const todayKey = today.toISOString().split('T')[0]

  function getWeekDays() {
    const d = new Date(today)
    const dow = d.getDay()
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d)
      day.setDate(d.getDate() + i)
      return day
    })
  }

  useEffect(() => {
    if (user && ownerId) { fetchMembers(); loadShifts() }
  }, [user, ownerId])

  async function loadShifts() {
    const weekDays = getWeekDays()
    const from = weekDays[0].toISOString().split('T')[0]
    const to   = weekDays[6].toISOString().split('T')[0]
    const { data } = await supabase
      .from('care_shifts')
      .select('*')
      .eq('owner_id', ownerId)
      .gte('shift_date', from)
      .lte('shift_date', to)
    const map = {}
    ;(data ?? []).forEach(s => { map[s.shift_date] = s })
    setShifts(map)
  }

  async function saveShift(dateKey) {
    if (!shiftName.trim()) return
    setSavingShift(true)
    await supabase.from('care_shifts').upsert({
      owner_id: ownerId,
      shift_date: dateKey,
      caregiver_user_id: user.id,
      caregiver_name: shiftName.trim(),
    }, { onConflict: 'owner_id,shift_date' })
    setShifts(prev => ({ ...prev, [dateKey]: { shift_date: dateKey, caregiver_name: shiftName.trim() } }))
    setShiftModal(null)
    setShiftName('')
    setSavingShift(false)
  }

  async function fetchMembers() {
    setLoading(true)
    const { data: memberRows } = await supabase
      .from('family_members')
      .select('member_user_id, member_email, joined_at, role')
      .eq('user_id', ownerId)

    setMembers(memberRows ?? [])

    const ids = (memberRows ?? []).map(m => m.member_user_id).filter(Boolean)
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, last_seen')
        .in('id', ids)
      const map = {}
      ;(profiles ?? []).forEach(p => { map[p.id] = p })
      setMemberProfiles(map)
    }
    setLoading(false)
  }

  function isOnline(mp) {
    return mp?.last_seen && Date.now() - new Date(mp.last_seen).getTime() < 5 * 60 * 1000
  }

  function openModal(member, mp) {
    setMemberModal({ member, profile: mp })
    setMemberContact(undefined)
    supabase
      .from('contacts')
      .select('*')
      .eq('user_id', ownerId)
      .ilike('email', member.member_email ?? '')
      .maybeSingle()
      .then(({ data }) => setMemberContact(data ?? null))
  }

  async function handleInvite(e) {
    e.preventDefault()
    setInviteStatus('sending')
    const { data: token, error } = await supabase.rpc('create_family_invitation', {
      p_invited_email: inviteEmail.trim().toLowerCase(),
      p_invited_by: displayName,
    })
    if (error) { setInviteStatus('error'); return }
    track('family_member_invited', { email: inviteEmail.trim() })
    const link = `${window.location.origin}/join?token=${token}`
    setInviteLink(link)
    const { error: sendErr } = await supabase.functions.invoke('send-invitation', {
      body: {
        inviteeEmail: inviteEmail.trim().toLowerCase(),
        inviterName: displayName,
        relativeName: profile?.name ?? 'su familiar',
        invitationLink: link,
        role: 'familiar',
      },
    })
    setEmailSent(!sendErr)
    setInviteStatus('success')
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink) } catch { return }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function openInvite() {
    setInviteEmail(''); setInviteStatus('idle'); setInviteLink(''); setCopied(false)
    setShowInvite(true)
  }

  async function handlePortal() {
    if (!isPaid) { navigate('/pricing'); return }
    setPortalLoading(true)
    setPortalError('')
    try {
      const url = await createPortalSession()
      window.location.href = url
    } catch {
      setPortalLoading(false)
      setPortalError('No se pudo abrir el portal. Intenta de nuevo.')
    }
  }

  async function handleAssignRole(memberUserId, newRole) {
    setSavingRole(true)
    const { error } = await supabase.rpc('assign_member_role', {
      p_member_user_id: memberUserId,
      p_role: newRole,
    })
    if (!error) {
      setMembers(prev => prev.map(m => m.member_user_id === memberUserId ? { ...m, role: newRole } : m))
      setMemberModal(prev => prev ? { ...prev, member: { ...prev.member, role: newRole } } : null)
      track('member_role_assigned', { role: newRole })
    }
    setSavingRole(false)
  }

  async function handleRemoveMember(memberUserId) {
    await supabase.from('family_members')
      .delete()
      .eq('user_id', ownerId)
      .eq('member_user_id', memberUserId)
    setMembers(prev => prev.filter(m => m.member_user_id !== memberUserId))
    setConfirmRemoveDialog(null)
    setMemberModal(null)
    track('family_member_removed', {})
  }

  async function handleSignOut() {
    try { await signOut() } catch { }
    finally {
      localStorage.removeItem('fc_active_family')
      window.location.href = '/login'
    }
  }

  const fieldStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid #EDE5D8', background: '#FDFAF7',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'all 0.15s',
  }

  return (
    <Layout>
      <div style={{ padding: '16px 16px 0', maxWidth: 600 }}>

        {/* Care profile summary */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'linear-gradient(135deg, #BF5E37, #8C3E22)',
            borderRadius: 20, padding: '16px 18px', marginBottom: 16,
          }}>
            {profile.photo_url ? (
              <img src={profile.photo_url} alt={profile.name}
                style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: 'white',
              }}>
                {profile.name?.charAt(0) ?? '?'}
              </div>
            )}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: '0 0 2px' }}>
                Familiar a cuidar
              </p>
              <p style={{ color: 'white', fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', margin: 0 }}>
                {profile.name}
              </p>
              {profile.age && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '2px 0 0' }}>
                  {profile.age} años
                </p>
              )}
            </div>
          </div>
        )}

        {/* ¿Quién cuida hoy? — Care shift rotation */}
        {(() => {
          const weekDays = getWeekDays()
          const todayShift = shifts[todayKey]
          const DAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
          return (
            <div style={{
              background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
              padding: '16px 18px', marginBottom: 12,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 12px' }}>
                ¿Quién cuida hoy?
              </p>
              {/* Today's caregiver highlight */}
              <div style={{
                background: todayShift ? 'linear-gradient(135deg, #FDF0EB, #FFF8F0)' : '#F9F5F1',
                borderRadius: 14, border: `1.5px solid ${todayShift ? '#C4623A' : '#EDE5D8'}`,
                padding: '12px 14px', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 24 }}>{todayShift ? '👤' : '❓'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: todayShift ? '#C4623A' : '#9CA3AF', margin: 0 }}>
                    {todayShift ? todayShift.caregiver_name : 'Sin asignar'}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>Cuidador de hoy</p>
                </div>
                <button
                  onClick={() => { setShiftModal(todayKey); setShiftName(todayShift?.caregiver_name ?? '') }}
                  style={{
                    padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                    border: '1.5px solid #C4623A', background: 'white', color: '#C4623A', cursor: 'pointer',
                  }}
                >
                  {todayShift ? 'Cambiar' : 'Asignar'}
                </button>
              </div>
              {/* Weekly mini-calendar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {weekDays.map((day, i) => {
                  const dk = day.toISOString().split('T')[0]
                  const isToday = dk === todayKey
                  const shift = shifts[dk]
                  const initials = shift?.caregiver_name?.charAt(0)?.toUpperCase() ?? '·'
                  return (
                    <button
                      key={dk}
                      onClick={() => { setShiftModal(dk); setShiftName(shift?.caregiver_name ?? '') }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        padding: '6px 2px', borderRadius: 10, border: 'none',
                        background: isToday ? '#FDF0EB' : shift ? '#F0F8F4' : '#F9F5F1',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.04em' }}>
                        {DAY_LABELS[i]}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                        {day.getDate()}
                      </span>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: isToday ? '#C4623A' : shift ? '#4A7C59' : '#E5E7EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        color: (isToday || shift) ? 'white' : '#9CA3AF',
                      }}>
                        {initials}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Subscription badge */}
        {sub && (
          <div style={{
            background: 'white', borderRadius: 16, border: '1px solid #EDE5D8',
            padding: '14px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${PLAN_COLORS[sub.plan] ?? '#9CA3AF'}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {sub.plan === 'care_plus' ? '✨' : sub.plan === 'familiar' ? '❤️' : '🌱'}

              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>
                  {PLAN_LABELS[sub.plan] ?? sub.plan}
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                  {isTrialing ? `${daysLeft} días restantes` : isPaid ? 'Activo' : 'Período de prueba terminado'}
                </p>
              </div>
            </div>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              style={{
                padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: '1.5px solid #EDE5D8', background: 'white',
                color: '#6B7280', cursor: 'pointer',
              }}
            >
              {portalLoading ? '...' : isPaid ? 'Gestionar' : 'Ver planes'}
            </button>
          </div>
        )}
        {portalError && (
          <p style={{ fontSize: 12, color: '#D63031', margin: '-4px 0 12px', padding: '8px 12px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10 }}>
            ⚠ {portalError}
          </p>
        )}

        {/* Members section */}
        <div style={{
          background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
          padding: '18px 18px', marginBottom: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              Equipo de cuidado
            </p>
            <button
              onClick={openInvite}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 10,
                border: '1.5px solid #C4623A', background: '#FFF8F4',
                color: '#C4623A', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <UserPlus size={14} color="#C4623A" strokeWidth={1.75} />
              Invitar
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Admin self-card — always first */}
              {isAdmin && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 14,
                  background: '#FDF8F5', border: '1.5px solid #C4623A',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: '#FDF0EB', border: '2px solid #C4623A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#C4623A',
                  }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>
                      {displayName.split(' ')[0]} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(tú)</span>
                    </p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>🟢 Administrador</p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#C4623A',
                    background: '#FDF0EB', padding: '4px 10px', borderRadius: 6,
                  }}>
                    Admin
                  </span>
                </div>
              )}

              {/* Invited members */}
              {members.length === 0 && (
                <div style={{ textAlign: 'center', padding: isAdmin ? '12px 0 4px' : '24px 0' }}>
                  {!isAdmin && (
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
                      background: '#FDF0EB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Users size={24} color="#C4623A" strokeWidth={1.5} />
                    </div>
                  )}
                  <p style={{ fontSize: isAdmin ? 12 : 14, fontWeight: isAdmin ? 400 : 600, color: isAdmin ? '#9CA3AF' : '#1A1A1A', marginBottom: isAdmin ? 0 : 6 }}>
                    {isAdmin ? 'Aún no hay otros miembros' : 'Eres el único cuidador'}
                  </p>
                  {!isAdmin && (
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 0 }}>
                      Invita a familiares para compartir el cuidado.
                    </p>
                  )}
                </div>
              )}

              {members.map(member => {
                const mp = memberProfiles[member.member_user_id]
                const online = isOnline(mp)
                const name = mp?.full_name ?? member.member_email?.split('@')[0] ?? '—'
                const initials = name.charAt(0).toUpperCase()
                const joined = member.joined_at
                  ? new Date(member.joined_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : null
                const isCuidador = member.role === 'cuidador'
                return (
                  <div
                    key={member.member_user_id ?? member.member_email}
                    onClick={() => openModal(member, mp)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 14,
                      background: '#FDFAF7', border: '1px solid #EDE5D8',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
                        background: '#FDF0EB', border: '2px solid #EDE5D8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {mp?.avatar_url ? (
                          <img src={mp.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#C4623A' }}>{initials}</span>
                        )}
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 12, height: 12, borderRadius: '50%',
                        border: '2px solid white',
                        background: online ? '#22C55E' : '#9CA3AF',
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px' }}>
                        {name.split(' ')[0]}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                        {online ? '🟢 En línea' : '⚫ Desconectado'}
                        {joined ? ` · Desde ${joined}` : ''}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: isCuidador ? '#C4623A' : '#6B7280',
                        background: isCuidador ? '#FDF0EB' : '#F3F4F6',
                        padding: '3px 10px', borderRadius: 6,
                      }}>
                        {isCuidador ? 'Cuidador' : 'Familiar'}
                      </span>
                      <span style={{ color: '#D1D5DB', fontSize: 18, lineHeight: 1 }}>›</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Directory shortcut */}
        <Link
          to="/directorio"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'white', borderRadius: 16, border: '1px solid #EDE5D8',
            padding: '14px 16px', marginBottom: 12, textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: '#F0F8F4', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} color="#4A7C59" strokeWidth={1.5} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px' }}>Directorio</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Médicos, contactos y emergencias</p>
          </div>
          <span style={{ color: '#D1D5DB', fontSize: 18 }}>›</span>
        </Link>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '14px', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: '1.5px solid #FFBABA', borderRadius: 16,
            background: '#FFF8F8', color: '#D63031',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          <LogOut size={17} color="#D63031" strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>

      {/* Member contact modal */}
      {memberModal && (() => {
        const { member, profile: mp } = memberModal
        const mc = memberContact
        const online = mp?.last_seen && Date.now() - new Date(mp.last_seen).getTime() < 5 * 60 * 1000
        const name = mp?.full_name ?? member.member_email?.split('@')[0] ?? '—'
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setMemberModal(null) }}
          >
            <div style={{
              width: '100%', maxWidth: 480,
              background: 'white', borderRadius: '24px 24px 0 0',
              padding: '28px 24px 96px',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => setMemberModal(null)}
                  style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}>
                  <XIcon size={16} color="#6B7280" strokeWidth={2} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
                    background: '#FDF0EB', border: '3px solid #EDE5D8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {mp?.avatar_url
                      ? <img src={mp.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 24, fontWeight: 700, color: '#C4623A' }}>{name.charAt(0)}</span>
                    }
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
                    borderRadius: '50%', border: '2px solid white', background: online ? '#22C55E' : '#9CA3AF' }} />
                </div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{name}</p>
                {mc?.relationship && <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0' }}>{mc.relationship}</p>}
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
                  {online ? '🟢 En línea' : '⚫ Desconectado'}
                </p>
              </div>
              {/* Role assignment — admin only */}
              {isAdmin && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Rol en el equipo
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'familiar', label: 'Familiar', desc: 'Puede ver registros' },
                      { value: 'cuidador', label: 'Cuidador', desc: 'Puede registrar medicamentos' },
                    ].map(r => (
                      <button
                        key={r.value}
                        onClick={() => member.role !== r.value && handleAssignRole(member.member_user_id, r.value)}
                        disabled={savingRole || member.role === r.value}
                        style={{
                          flex: 1, padding: '11px 8px', borderRadius: 12,
                          border: `1.5px solid ${member.role === r.value ? '#C4623A' : '#EDE5D8'}`,
                          background: member.role === r.value ? '#FDF0EB' : 'white',
                          color: member.role === r.value ? '#C4623A' : '#6B7280',
                          cursor: member.role === r.value || savingRole ? 'default' : 'pointer',
                          fontWeight: 700, fontSize: 13,
                          transition: 'all 0.15s',
                        }}
                      >
                        <p style={{ margin: 0 }}>{r.label}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, fontWeight: 400, color: member.role === r.value ? '#A85130' : '#9CA3AF' }}>
                          {r.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderRadius: 16, background: '#F9F5F1', border: '1px solid #EDE5D8', padding: '4px 16px', marginBottom: 16 }}>
                {member.member_email && (
                  <a href={`mailto:${member.member_email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #EDE5D8', textDecoration: 'none' }}>
                    <Mail size={15} color="#9CA3AF" strokeWidth={1.5} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{member.member_email}</span>
                  </a>
                )}
                {mc === undefined ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
                    <Phone size={15} color="#D4C4B8" strokeWidth={1.5} />
                    <span style={{ fontSize: 13, color: '#D4C4B8' }}>Cargando...</span>
                  </div>
                ) : mc?.phone ? (
                  <a href={`tel:${mc.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: mc?.address ? '1px solid #EDE5D8' : 'none', textDecoration: 'none' }}>
                    <Phone size={15} color="#9CA3AF" strokeWidth={1.5} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{mc.phone}</span>
                  </a>
                ) : null}
                {mc?.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0' }}>
                    <MapPin size={15} color="#9CA3AF" strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{mc.address}</span>
                  </div>
                )}
              </div>
              {mc?.phone && (
                <a href={`tel:${mc.phone}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '13px', borderRadius: 16, marginBottom: 10,
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
                }}>
                  <Phone size={16} color="white" strokeWidth={2} />
                  Llamar
                </a>
              )}
              <Link to="/directorio" onClick={() => setMemberModal(null)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '12px', borderRadius: 14,
                background: '#F9F5F1', border: '1px solid #EDE5D8',
                color: '#9CA3AF', fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                {mc === null ? 'Agregar al directorio →' : 'Ver en directorio →'}
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setConfirmRemoveDialog({ member, name })}
                  style={{
                    width: '100%', padding: '12px', marginTop: 10, borderRadius: 14,
                    background: '#FFF8F8', border: '1.5px solid #FFBABA',
                    color: '#D63031', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Eliminar de la familia
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Shift assignment modal */}
      {shiftModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShiftModal(null) }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '28px 24px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                Asignar cuidador
              </p>
              <button onClick={() => setShiftModal(null)}
                style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}>
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
              {(() => {
                const d = new Date(shiftModal + 'T12:00:00')
                return d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
              })()}
            </p>
            {/* Quick-pick from team members */}
            {members.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[{ label: displayName }, ...members.map(m => ({ label: memberProfiles[m.member_user_id]?.full_name ?? m.member_email?.split('@')[0] ?? '—' }))].map(({ label }) => (
                  <button key={label} onClick={() => setShiftName(label)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: shiftName === label ? '#FDF0EB' : '#F3F4F6',
                      border: shiftName === label ? '1.5px solid #C4623A' : '1.5px solid transparent',
                      color: shiftName === label ? '#C4623A' : '#6B7280',
                      transition: 'all 0.15s',
                    }}>
                    {label.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
            <input
              value={shiftName}
              onChange={e => setShiftName(e.target.value)}
              placeholder="Nombre del cuidador"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 12,
                border: '1.5px solid #EDE5D8', background: '#FDFAF7',
                fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14,
              }}
              onFocus={e => { e.target.style.borderColor = '#C4623A' }}
              onBlur={e => { e.target.style.borderColor = '#EDE5D8' }}
            />
            <button
              onClick={() => saveShift(shiftModal)}
              disabled={savingShift || !shiftName.trim()}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: shiftName.trim() && !savingShift ? 'linear-gradient(135deg, #C4623A, #A85130)' : '#D4C4B8',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: shiftName.trim() && !savingShift ? 'pointer' : 'not-allowed',
                boxShadow: shiftName.trim() ? '0 6px 20px rgba(196,98,58,0.3)' : 'none',
              }}
            >
              {savingShift ? 'Guardando...' : 'Guardar turno'}
            </button>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '28px 24px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                  Invitar familiar
                </p>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>El enlace expira en 24 horas</p>
              </div>
              <button onClick={() => setShowInvite(false)}
                style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}>
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            {inviteStatus === 'success' ? (
              <div>
                {emailSent ? (
                  <div style={{ padding: 16, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, marginBottom: 14, textAlign: 'center' }}>
                    <p style={{ fontSize: 22, margin: '0 0 6px' }}>📧</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#15803D', margin: '0 0 4px' }}>¡Invitación enviada!</p>
                    <p style={{ fontSize: 12, color: '#4B7A5D', margin: 0 }}>
                      Le llegará un email a <strong>{inviteEmail}</strong> con el enlace para unirse.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, marginBottom: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>⚠ No pudimos enviar el email</p>
                      <p style={{ fontSize: 12, color: '#78350F', margin: 0 }}>Comparte este enlace directamente con {inviteEmail}:</p>
                    </div>
                    <div style={{ padding: '12px 14px', background: '#F9F5F1', border: '1.5px solid #EDE5D8', borderRadius: 12, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, color: '#6B7280', wordBreak: 'break-all', margin: 0 }}>{inviteLink}</p>
                    </div>
                    <button onClick={copyLink} style={{
                      width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'white',
                      background: copied ? 'linear-gradient(135deg, #4A7C59, #3A6147)' : 'linear-gradient(135deg, #C4623A, #A85130)',
                      transition: 'all 0.2s', marginBottom: 10,
                    }}>
                      {copied ? '¡Copiado!' : 'Copiar enlace'}
                    </button>
                  </div>
                )}
                <button onClick={() => setShowInvite(false)} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Correo del familiar
                  </label>
                  <input
                    type="email" required value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="familiar@correo.com" autoFocus
                    style={fieldStyle}
                    onFocus={e => { e.target.style.borderColor = '#C4623A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,98,58,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                {inviteStatus === 'error' && (
                  <p style={{ padding: '10px 14px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, fontSize: 13, color: '#D63031', margin: 0 }}>
                    ⚠ No se pudo crear la invitación
                  </p>
                )}
                <button
                  type="submit"
                  disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
                  style={{
                    width: '100%', padding: 14, borderRadius: 14, border: 'none',
                    fontWeight: 700, fontSize: 14, color: 'white', cursor: 'pointer',
                    background: inviteEmail.trim() && inviteStatus !== 'sending'
                      ? 'linear-gradient(135deg, #C4623A, #A85130)' : '#D4C4B8',
                    boxShadow: inviteEmail.trim() ? '0 6px 20px rgba(196,98,58,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {inviteStatus === 'sending' ? 'Creando...' : 'Enviar invitación →'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Remove member confirmation — z-index 300 sits above the member modal (200) */}
      {confirmRemoveDialog && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmRemoveDialog(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px',
            maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>👤</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              ¿Eliminar a {confirmRemoveDialog.name.split(' ')[0]} de la familia?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              Ya no podrá ver el historial ni recibir notificaciones.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmRemoveDialog(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRemoveMember(confirmRemoveDialog.member.member_user_id)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
