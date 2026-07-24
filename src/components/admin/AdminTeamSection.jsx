import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFamily } from '../../contexts/FamilyContext'

const ROLE_LABEL = { familiar: 'Familiar', cuidador: 'Cuidador' }
const ROLE_COLOR = { familiar: '#087F70', cuidador: '#2D86A0' }

function timeAgo(isoStr) {
  if (!isoStr) return 'Nunca'
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60)   return 'Ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  const days = Math.floor(diff / 86400)
  if (days < 7)   return `hace ${days} día${days !== 1 ? 's' : ''}`
  return new Date(isoStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function AdminTeamSection() {
  const { ownerId } = useFamily()
  const [members, setMembers]         = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(null) // memberId being acted on
  const [confirmRemove, setConfirmRemove] = useState(null) // member to remove

  useEffect(() => {
    if (!ownerId) return
    load()
  }, [ownerId])

  async function load() {
    setLoading(true)
    const [{ data: mems }, { data: invs }] = await Promise.all([
      supabase
        .from('family_members')
        .select('id, member_user_id, member_email, role, joined_at')
        .eq('user_id', ownerId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('family_invitations')
        .select('id, invited_email, invited_by, status, created_at, expires_at')
        .eq('user_id', ownerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    // Enrich with user_profiles
    const withProfiles = await Promise.all(
      (mems ?? []).map(async m => {
        if (!m.member_user_id) return { ...m, name: m.member_email, avatar: null, lastSeen: null }
        const { data: p } = await supabase
          .from('user_profiles')
          .select('full_name, avatar_url, last_seen')
          .eq('id', m.member_user_id)
          .maybeSingle()
        return {
          ...m,
          name:     p?.full_name ?? m.member_email,
          avatar:   p?.avatar_url ?? null,
          lastSeen: p?.last_seen  ?? null,
        }
      })
    )

    setMembers(withProfiles)
    setInvitations(invs ?? [])
    setLoading(false)
  }

  async function changeRole(member) {
    const next = member.role === 'familiar' ? 'cuidador' : 'familiar'
    setBusy(member.id)
    const { error } = await supabase
      .from('family_members')
      .update({ role: next })
      .eq('id', member.id)
    if (!error) setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: next } : m))
    setBusy(null)
  }

  async function removeMember(member) {
    setBusy(member.id)
    await supabase.from('family_members').delete().eq('id', member.id)
    setMembers(prev => prev.filter(m => m.id !== member.id))
    setConfirmRemove(null)
    setBusy(null)
  }

  async function revokeInvitation(inv) {
    setBusy(inv.id)
    await supabase
      .from('family_invitations')
      .update({ status: 'expired' })
      .eq('id', inv.id)
    setInvitations(prev => prev.filter(i => i.id !== inv.id))
    setBusy(null)
  }

  if (loading) return <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: 24 }}>Cargando equipo...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Active members */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 2px' }}>
          Miembros activos ({members.length})
        </p>

        {members.length === 0 ? (
          <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
            No hay miembros en el equipo aún.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => (
              <div key={m.id} style={{
                background: 'white', borderRadius: 14, padding: '12px 14px',
                border: '1px solid #EDE5D8',
                boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: ROLE_COLOR[m.role] + '18',
                    border: `2px solid ${ROLE_COLOR[m.role]}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {m.avatar
                      ? <img src={m.avatar} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 18 }}>{m.role === 'cuidador' ? '👩‍⚕️' : '👤'}</span>
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: ROLE_COLOR[m.role] + '18',
                        color: ROLE_COLOR[m.role],
                      }}>
                        {ROLE_LABEL[m.role]}
                      </span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        Activo {timeAgo(m.lastSeen)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => changeRole(m)}
                      disabled={busy === m.id}
                      title={`Cambiar a ${m.role === 'familiar' ? 'Cuidador' : 'Familiar'}`}
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        border: `1px solid ${ROLE_COLOR[m.role]}`,
                        background: 'white', color: ROLE_COLOR[m.role],
                        cursor: busy === m.id ? 'default' : 'pointer',
                        opacity: busy === m.id ? 0.5 : 1,
                      }}
                    >
                      {m.role === 'familiar' ? '→ Cuidador' : '→ Familiar'}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(m)}
                      disabled={busy === m.id}
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        border: '1px solid #FFBABA', background: '#FFF8F8',
                        color: '#D63031', fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: busy === m.id ? 0.5 : 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 2px' }}>
            Invitaciones pendientes ({invitations.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invitations.map(inv => (
              <div key={inv.id} style={{
                background: '#FFFBEB', borderRadius: 12, padding: '12px 14px',
                border: '1px solid #FDE68A',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>✉️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inv.invited_email}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>
                    Enviada {timeAgo(inv.created_at)} · vence {new Date(inv.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <button
                  onClick={() => revokeInvitation(inv)}
                  disabled={busy === inv.id}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: '1px solid #FDE68A', background: 'white',
                    color: '#92400E', cursor: 'pointer',
                    opacity: busy === inv.id ? 0.5 : 1, flexShrink: 0,
                  }}
                >
                  Revocar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: '28px 24px',
            maxWidth: 340, width: '100%', textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          }}>
            <p style={{ fontSize: 36, margin: '0 0 12px' }}>⚠️</p>
            <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 17, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
              ¿Eliminar a {confirmRemove.name}?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>
              Perderá acceso a la familia inmediatamente. Sus datos no se borran.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmRemove(null)} style={{
                flex: 1, padding: 12, borderRadius: 12, border: '1px solid #EDE5D8',
                background: 'white', color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>
                Cancelar
              </button>
              <button onClick={() => removeMember(confirmRemove)} style={{
                flex: 1, padding: 12, borderRadius: 12, border: 'none',
                background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
