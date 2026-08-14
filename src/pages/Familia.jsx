import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { usePresence } from '../contexts/PresenceContext'
import { useFamilyPlan } from '../contexts/FamilyPlanContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { UserPlus, Phone, Mail, MapPin, XIcon } from '../components/Icons'
import { track } from '../lib/analytics'
import PaywallModal from '../components/PaywallModal'
import { getTodayPR, getDatePR } from '../lib/utils'

// Espejo mínimo de calcMedStatus() en Medications.jsx — solo necesitamos
// distinguir "tarde" (ya se auto-marca missed aparte) del resto.
function isMedTarde(scheduledTime, windowMinutes = 60) {
  if (!scheduledTime) return false
  const [h, m] = scheduledTime.split(':').map(Number)
  const now = new Date()
  const diffMins = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
  return diffMins >= windowMinutes
}

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

// Marca de agua decorativa — mismo patrón/trazo que VideoCall.jsx, en teal.
const WATERMARK_PATHS = (
  <>
    <path d="M200 330 C 60 240, 30 140, 110 90 C 160 60, 195 90, 200 130 C 205 90, 240 60, 290 90 C 370 140, 340 240, 200 330 Z" fill="#087F70" />
    <circle cx="165" cy="165" r="22" fill="#F8F4ED" />
    <path d="M130 230 C 130 195, 200 195, 200 230 L 200 245 L 130 245 Z" fill="#F8F4ED" />
    <circle cx="235" cy="165" r="22" fill="#F8F4ED" />
    <path d="M200 230 C 200 195, 270 195, 270 230 L 270 245 L 200 245 Z" fill="#F8F4ED" />
  </>
)

export default function Familia() {
  const { user } = useAuth()
  const { profile, ownerId, activePatientName } = useFamily()
  const onlineIds = usePresence()
  const { familyPlan, familyTrialExpired, familyCaregiverLimit } = useFamilyPlan()
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
  const [shifts, setShifts] = useState({})
  const [shiftModal, setShiftModal] = useState(null)
  const [shiftName, setShiftName] = useState('')
  const [savingShift, setSavingShift] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [confirmRemoveDialog, setConfirmRemoveDialog] = useState(null) // { member, name }
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallVariant, setPaywallVariant] = useState('trial') // 'trial' | 'team-full'
  const [memberLastActivity, setMemberLastActivity] = useState(null)
  const [todayGlance, setTodayGlance] = useState({ nextMed: null, nextEvent: null })

  const displayName = user?.user_metadata?.full_name?.trim() || user?.email?.trim() || 'Familiar'
  const isAdmin = user?.id === ownerId

  function fmtLastSeen(lastSeenIso) {
    if (!lastSeenIso) return null
    const diffMs = Date.now() - new Date(lastSeenIso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 5) return null // treat as online
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs} h`
    const days = Math.floor(hrs / 24)
    if (days === 1) return 'ayer'
    return `hace ${days} días`
  }

  const today = new Date()
  const todayKey = getTodayPR()

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
    if (user && ownerId) { fetchMembers(); loadShifts(); loadTodayGlance() }
  }, [user, ownerId])

  // "Hoy": próxima medicación PENDIENTE (status='pending' explícito — nunca
  // confirmada/perdida) y próxima cita. Sin "actividad reciente": ese feed
  // incluye entradas automáticas del sistema (ej. rutina no marcada al
  // cierre del día, actor_name='Sistema automático') que no son información
  // accionable para la familia, solo ruido en una sección pensada para "qué
  // falta atender hoy".
  async function loadTodayGlance() {
    const todayPR = getTodayPR()
    const [{ data: meds }, { data: logsToday }, { data: eventRows }] = await Promise.all([
      supabase
        .from('medications')
        .select('id, name, dosage, time, scheduled_times, time_window_minutes')
        .eq('user_id', ownerId),
      supabase
        .from('medication_logs')
        .select('medication_id, status')
        .eq('user_id', ownerId)
        .eq('log_date', todayPR),
      supabase
        .from('events')
        .select('title, date, time')
        .eq('user_id', ownerId)
        .gte('date', todayPR)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(1),
    ])

    // "Pendiente" = no tiene log confirmed/missed hoy — medication_logs NUNCA
    // tiene una fila con status='pending' (se confirmó revisando Medications.jsx:
    // ese estado es la ausencia de log, no un valor guardado). Se excluyen las
    // "tarde" (se auto-marcan missed aparte, send-med-notifications/useEffect
    // dedicado) para no duplicar esa lógica aquí.
    const nextMed = (meds ?? [])
      .filter(med => !(logsToday ?? []).some(l => l.medication_id === med.id && (l.status === 'confirmed' || l.status === 'missed')))
      .map(med => {
        const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
        return { name: med.name, dosage: med.dosage, scheduled_time: times.length ? [...times].sort()[0] : null, time_window_minutes: med.time_window_minutes }
      })
      .filter(med => !isMedTarde(med.scheduled_time, med.time_window_minutes ?? 60))
      .sort((a, b) => (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99'))[0] ?? null

    setTodayGlance({
      nextMed,
      nextEvent: eventRows?.[0] ?? null,
    })
  }

  function fmt12h(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  async function loadShifts() {
    const weekDays = getWeekDays()
    const from = getDatePR(weekDays[0])
    const to   = getDatePR(weekDays[6])
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

    // Include ownerId so the admin's profile is always available for non-admin views
    const ids = [...new Set([(memberRows ?? []).map(m => m.member_user_id).filter(Boolean), user.id, ownerId].flat().filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, last_seen')
        .in('id', ids)
      const map = {}
      ;(profiles ?? []).forEach(p => { map[p.id] = p })
      setMemberProfiles(map)
    }
    setLoading(false)
  }

  function openModal(member, mp) {
    setMemberModal({ member, profile: mp })
    setMemberContact(undefined)
    setMemberLastActivity(null)
    supabase
      .from('contacts')
      .select('*')
      .eq('user_id', ownerId)
      .ilike('email', member.member_email ?? '')
      .maybeSingle()
      .then(({ data }) => setMemberContact(data ?? null))
    if (member.member_user_id) {
      setMemberLastActivity(undefined)
      supabase
        .from('activity_log')
        .select('type, description, created_at')
        .eq('owner_id', ownerId)
        .eq('actor_id', member.member_user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setMemberLastActivity(data ?? null))
    }
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

  // Tamaño de equipo = dueño + members (el dueño se muestra por separado más
  // abajo pero cuenta como una persona del equipo — "hasta 2 cuidadores"
  // incluye al dueño, no son 2 invitados además de él).
  const teamSize = 1 + members.length

  function openInvite() {
    // Tope de equipo primero: es la razón más específica y la que de verdad
    // explica el bloqueo cuando ambas condiciones son ciertas a la vez (un
    // Free con trial vencido llega al tope de 2 con solo un invitado). El
    // trial vencido es la razón correcta solo cuando el equipo NO está lleno.
    if (teamSize >= familyCaregiverLimit) { setPaywallVariant('team-full'); setShowPaywall(true); return }
    if (familyTrialExpired && isAdmin) { setPaywallVariant('trial'); setShowPaywall(true); return }
    setInviteEmail(''); setInviteStatus('idle'); setInviteLink(''); setCopied(false)
    setShowInvite(true)
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

  const fieldStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid #EDE5D8', background: '#FDFAF7',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'all 0.15s',
  }

  const { nextMed, nextEvent } = todayGlance
  const hasGlanceData = nextMed || nextEvent

  return (
    <Layout>
      <div style={{ position: 'relative', minHeight: '100%', overflow: 'hidden' }}>

        {/* Marca de agua decorativa — fiel al patrón de VideoCall.jsx */}
        <svg viewBox="0 0 400 400" style={{ position: 'absolute', top: -60, right: -90, width: 420, height: 420, opacity: 0.05, pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
          {WATERMARK_PATHS}
        </svg>

      <div style={{ position: 'relative', zIndex: 1, padding: '16px 16px 0', maxWidth: 600 }}>

        {/* Care profile summary */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: '#FFFFFF', border: '1px solid #EDE5D8',
            borderRadius: 20, padding: '16px 18px', marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            {profile.photo_url ? (
              <img src={profile.photo_url} alt={profile.name}
                style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid #A8E5D6', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: '#A8E5D6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#065A50',
              }}>
                {(activePatientName || profile?.name)?.charAt(0) ?? '?'}
              </div>
            )}
            <div>
              <p style={{ color: '#6B7280', fontSize: 11, margin: '0 0 2px' }}>
                Familiar a cuidar
              </p>
              <p style={{ color: '#334155', fontSize: 18, fontWeight: 700, fontFamily: SANS, margin: 0 }}>
                {activePatientName || profile?.name}
              </p>
            </div>
          </div>
        )}

        {/* Hoy — vistazo accionable: qué falta atender (medicación pendiente, próxima cita) */}
        {hasGlanceData && (
          <div style={{
            background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
            padding: '16px 18px', marginBottom: 12,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: '#334155', margin: 0 }}>
              Hoy
            </p>
            {nextMed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>
                  💊
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nextMed.name ?? 'Medicamento'}
                    {nextMed.dosage ? ` ${nextMed.dosage}` : ''}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                    Pendiente{nextMed.scheduled_time ? ` a las ${fmt12h(nextMed.scheduled_time)}` : ''}
                  </p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7A5A18', background: '#FEF3C7', padding: '3px 10px', borderRadius: 6, flexShrink: 0 }}>
                  Pendiente
                </span>
              </div>
            )}
            {nextEvent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>
                  📅
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nextEvent.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                    {new Date(nextEvent.date + 'T12:00:00').toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                    {nextEvent.time ? ` · ${fmt12h(nextEvent.time)}` : ''}
                  </p>
                </div>
              </div>
            )}
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
              <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 12px' }}>
                ¿Quién cuida hoy?
              </p>
              {/* Today's caregiver highlight */}
              <div style={{
                background: todayShift ? 'linear-gradient(135deg, #EBF3EE, #F7F3ED)' : '#F9F5F1',
                borderRadius: 14, border: `1.5px solid ${todayShift ? '#087F70' : '#EDE5D8'}`,
                padding: '12px 14px', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 24 }}>{todayShift ? '👤' : '❓'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: todayShift ? '#087F70' : '#9CA3AF', margin: 0 }}>
                    {todayShift ? todayShift.caregiver_name : 'Sin asignar'}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>Cuidador de hoy</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { setShiftModal(todayKey); setShiftName(todayShift?.caregiver_name ?? '') }}
                    style={{
                      padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      border: '1.5px solid #087F70', background: 'white', color: '#087F70', cursor: 'pointer',
                    }}
                  >
                    {todayShift ? 'Cambiar' : 'Asignar'}
                  </button>
                )}
              </div>
              {/* Weekly mini-calendar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {weekDays.map((day, i) => {
                  const dk = getDatePR(day)
                  const isToday = dk === todayKey
                  const shift = shifts[dk]
                  const initials = shift?.caregiver_name?.charAt(0)?.toUpperCase() ?? '·'
                  return (
                    <button
                      key={dk}
                      onClick={isAdmin ? () => { setShiftModal(dk); setShiftName(shift?.caregiver_name ?? '') } : undefined}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        padding: '6px 2px', borderRadius: 10, border: 'none',
                        background: isToday ? '#EBF3EE' : shift ? '#F0F8F4' : '#F9F5F1',
                        cursor: isAdmin ? 'pointer' : 'default', transition: 'all 0.15s',
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
                        background: isToday ? '#087F70' : shift ? '#087F70' : '#E5E7EB',
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

        {/* Members section */}
        <div style={{
          background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
          padding: '18px 18px', marginBottom: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              Equipo de cuidado
            </p>
            <button
              onClick={openInvite}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 10,
                border: '1.5px solid #087F70', background: '#FFF8F4',
                color: '#087F70', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <UserPlus size={14} color="#087F70" strokeWidth={1.75} />
              Invitar
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '3px solid #EDE5D8', borderTopColor: '#087F70',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Invited members */}
              {isAdmin && members.length === 0 && (
                <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 0 }}>
                    Aún no hay otros miembros en el equipo
                  </p>
                </div>
              )}

              {/* Admin card — always visible to everyone (bidirectional visibility) */}
              {(() => {
                const adminId = ownerId
                const adminMp = memberProfiles[adminId]
                const adminName = isAdmin
                  ? displayName
                  : (adminMp?.full_name?.trim() || adminMp?.email?.trim() || 'Familiar')
                const adminInitials = adminName.charAt(0).toUpperCase()
                const adminOnline = isAdmin ? true : onlineIds.has(adminId)
                return (
                  <div
                    onClick={() => navigate(`/directorio?member=${encodeURIComponent(isAdmin ? (user.email ?? '') : (adminMp?.email ?? ''))}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 14,
                      background: '#FDF8F5', border: '1.5px solid #087F7022',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
                        background: '#EBF3EE', border: '2px solid #087F7044',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {adminMp?.avatar_url
                          ? <img src={adminMp.avatar_url} alt={adminName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 16, fontWeight: 700, color: '#087F70' }}>{adminInitials}</span>
                        }
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', border: '2px solid white', background: adminOnline ? '#22C55E' : '#9CA3AF' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px' }}>
                        {adminName.split(' ')[0]}
                        {isAdmin && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#087F70', background: '#EBF3EE', padding: '2px 7px', borderRadius: 6 }}>Tú</span>}
                      </p>
                      <p style={{ fontSize: 11, color: adminOnline ? '#16A34A' : '#9CA3AF', margin: 0 }}>
                        {adminOnline
                          ? '🟢 En línea ahora'
                          : (() => {
                              const ago = fmtLastSeen(adminMp?.last_seen)
                              return ago ? `⚪ Última vez ${ago}` : '⚪ Ausente'
                            })()}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#087F70', background: '#EBF3EE', padding: '3px 10px', borderRadius: 6 }}>
                        Admin
                      </span>
                      <span style={{ color: '#D1D5DB', fontSize: 18, lineHeight: 1 }}>›</span>
                    </div>
                  </div>
                )
              })()}

              {/* All members — everyone sees the full team including themselves */}
              {members.map(member => {
                const mp = memberProfiles[member.member_user_id]
                const online = onlineIds.has(member.member_user_id)
                const name = mp?.full_name ?? member.member_email?.split('@')[0] ?? '—'
                const initials = name.charAt(0).toUpperCase()
                const joined = member.joined_at
                  ? new Date(member.joined_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : null
                const isCuidador = member.role === 'cuidador'
                const isPending = !member.member_user_id
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
                        background: '#EBF3EE', border: '2px solid #EDE5D8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {mp?.avatar_url ? (
                          <img src={mp.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#087F70' }}>{initials}</span>
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
                      <p style={{ fontSize: 11, color: online ? '#16A34A' : '#9CA3AF', margin: 0 }}>
                        {online
                          ? '🟢 En línea ahora'
                          : (() => {
                              const ago = fmtLastSeen(mp?.last_seen)
                              return ago ? `⚪ Última vez ${ago}` : '⚪ Ausente'
                            })()}
                        {!online && joined ? ` · Desde ${joined}` : ''}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: isPending ? '#7A5A18' : isCuidador ? '#087F70' : '#6B7280',
                          background: isPending ? '#FEF3C7' : isCuidador ? '#EBF3EE' : '#F3F4F6',
                          padding: '3px 10px', borderRadius: 6,
                        }}>
                          {isPending ? 'Invitación pendiente' : isCuidador ? 'Cuidador' : 'Familiar'}
                        </span>
                        <span style={{ color: '#D1D5DB', fontSize: 18, lineHeight: 1 }}>›</span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); openModal(member, mp) }}
                          style={{
                            padding: '6px 7px', borderRadius: 9,
                            background: '#F3F4F6', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title="Gestionar miembro"
                        >
                          <span style={{ fontSize: 14, lineHeight: 1 }}>⚙</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      </div>

      {/* Member contact modal */}
      {memberModal && (() => {
        const { member, profile: mp } = memberModal
        const mc = memberContact
        const online = onlineIds.has(member.member_user_id)
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
                    background: '#EBF3EE', border: '3px solid #EDE5D8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {mp?.avatar_url
                      ? <img src={mp.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 24, fontWeight: 700, color: '#087F70' }}>{name.charAt(0)}</span>
                    }
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
                    borderRadius: '50%', border: '2px solid white', background: online ? '#22C55E' : '#9CA3AF' }} />
                </div>
                <p style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{name}</p>
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
                          border: `1.5px solid ${member.role === r.value ? '#087F70' : '#EDE5D8'}`,
                          background: member.role === r.value ? '#EBF3EE' : 'white',
                          color: member.role === r.value ? '#087F70' : '#6B7280',
                          cursor: member.role === r.value || savingRole ? 'default' : 'pointer',
                          fontWeight: 700, fontSize: 13,
                          transition: 'all 0.15s',
                        }}
                      >
                        <p style={{ margin: 0 }}>{r.label}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, fontWeight: 400, color: member.role === r.value ? '#065A50' : '#9CA3AF' }}>
                          {r.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Última actividad */}
              <div style={{ borderRadius: 14, background: '#F9F5F1', border: '1px solid #EDE5D8', padding: '12px 14px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Última actividad
                </p>
                {memberLastActivity === undefined ? (
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Cargando...</p>
                ) : memberLastActivity === null ? (
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Sin actividad registrada</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, flex: 1, lineHeight: 1.4 }}>
                      {memberLastActivity.description}
                    </p>
                    <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                      {new Date(memberLastActivity.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Botón mensaje al chat */}
              <button
                onClick={() => { setMemberModal(null); navigate('/chat') }}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  background: '#087F70',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 10,
                  boxShadow: '0 4px 16px rgba(13,107,99,0.25)',
                }}
              >
                💬 Enviar mensaje
              </button>

              <div style={{ borderRadius: 16, background: '#F9F5F1', border: '1px solid #EDE5D8', padding: '4px 16px', marginBottom: 16 }}>
                {member.member_email && (
                  <a href={`mailto:${member.member_email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #EDE5D8', textDecoration: 'none' }}>
                    <Mail size={15} color="#9CA3AF" strokeWidth={1.5} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{member.member_email}</span>
                  </a>
                )}
                {mc === undefined ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
                    <Phone size={15} color="#C0CCC5" strokeWidth={1.5} />
                    <span style={{ fontSize: 13, color: '#C0CCC5' }}>Cargando...</span>
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
              <p style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
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
                      background: shiftName === label ? '#EBF3EE' : '#F3F4F6',
                      border: shiftName === label ? '1.5px solid #087F70' : '1.5px solid transparent',
                      color: shiftName === label ? '#087F70' : '#6B7280',
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
              onFocus={e => { e.target.style.borderColor = '#087F70' }}
              onBlur={e => { e.target.style.borderColor = '#EDE5D8' }}
            />
            <button
              onClick={() => saveShift(shiftModal)}
              disabled={savingShift || !shiftName.trim()}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: shiftName.trim() && !savingShift ? '#087F70' : '#C0CCC5',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: shiftName.trim() && !savingShift ? 'pointer' : 'not-allowed',
                boxShadow: shiftName.trim() ? '0 6px 20px rgba(13,107,99,0.3)' : 'none',
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
                <p style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
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
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#7A5A18', margin: '0 0 2px' }}>⚠ No pudimos enviar el email</p>
                      <p style={{ fontSize: 12, color: '#5A4010', margin: 0 }}>Comparte este enlace directamente con {inviteEmail}:</p>
                    </div>
                    <div style={{ padding: '12px 14px', background: '#F9F5F1', border: '1.5px solid #EDE5D8', borderRadius: 12, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, color: '#6B7280', wordBreak: 'break-all', margin: 0 }}>{inviteLink}</p>
                    </div>
                    <button onClick={copyLink} style={{
                      width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'white',
                      background: '#087F70',
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
                    onFocus={e => { e.target.style.borderColor = '#087F70'; e.target.style.boxShadow = '0 0 0 3px rgba(13,107,99,0.1)' }}
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
                      ? '#087F70' : '#C0CCC5',
                    boxShadow: inviteEmail.trim() ? '0 6px 20px rgba(13,107,99,0.3)' : 'none',
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
            <p style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
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
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          patientName={profile?.name?.split(' ')[0]}
          title={paywallVariant === 'team-full' ? 'Tu equipo está completo' : undefined}
          message={paywallVariant === 'team-full'
            ? familyPlan?.plan === 'familiar'
              ? 'El plan Familiar permite un equipo de 6 personas, contándote a ti. Con Cuidado Total no hay límite.'
              : 'El plan Gratis permite un equipo de 2 personas, contándote a ti. Con Familiar pueden ser hasta 6.'
            : undefined}
        />
      )}
    </Layout>
  )
}
