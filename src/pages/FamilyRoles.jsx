import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ROLE_META = {
  admin:    { label: 'Admin',    color: '#3D6B54', bg: '#E8F5EE' },
  cuidador: { label: 'Cuidador', color: '#1D4ED8', bg: '#EFF6FF' },
  familiar: { label: 'Familiar', color: '#7C3AED', bg: '#F5F3FF' },
}

function roleKey(role) {
  return role === null || role === undefined ? 'admin' : role
}

function RoleBadge({ role }) {
  const meta = ROLE_META[roleKey(role)]
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20,
      background: meta.bg, color: meta.color,
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      {meta.label}
    </span>
  )
}

function MemberRow({ name, email, avatarUrl, role, isCurrentUser, isAdmin, isOwner, editing, saving, onEdit, onCancelEdit, onAssign }) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #F8F4ED',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: isOwner ? '#0B4F4A' : '#3D6B54',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 16,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1E2D26', lineHeight: 1.3 }}>
              {name}
            </p>
            {isCurrentUser && (
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>(tú)</span>
            )}
          </div>
          {email && (
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <RoleBadge role={role} />
          {isAdmin && !isOwner && !isCurrentUser && !editing && (
            <button
              onClick={onEdit}
              style={{
                background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
                cursor: 'pointer', padding: '4px 10px',
                fontSize: 12, color: '#6B7280', fontWeight: 500,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F8F4ED' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
            Cambiar rol:
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'cuidador', label: '🧑‍⚕️ Cuidador', desc: 'Acceso completo' },
              { value: 'familiar', label: '👥 Familiar', desc: 'Solo lectura' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => onAssign(opt.value)}
                disabled={saving || opt.value === role}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none',
                  background: opt.value === role ? '#E8F5EE' : '#F8F6F2',
                  cursor: saving || opt.value === role ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1E2D26' }}>{opt.label}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
          <button
            onClick={onCancelEdit}
            style={{
              marginTop: 8, width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 12, color: '#9CA3AF', padding: '6px 0',
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

export default function FamilyRoles() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const navigate = useNavigate()
  const isAdmin = user?.id === ownerId

  const [members,  setMembers]  = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (user && ownerId) load()
  }, [user, ownerId])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('family_members')
      .select('member_user_id, member_email, joined_at, role')
      .eq('user_id', ownerId)
    setMembers(rows ?? [])

    const ids = [...new Set([
      ...(rows ?? []).map(m => m.member_user_id).filter(Boolean),
      user.id, ownerId,
    ].filter(Boolean))]

    if (ids.length) {
      const { data: ps } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids)
      const map = {}
      ;(ps ?? []).forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
    setLoading(false)
  }

  async function assignRole(memberUserId, newRole) {
    setSaving(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('assign_member_role', {
      p_member_user_id: memberUserId,
      p_role: newRole,
    })
    if (rpcErr) {
      setError('No se pudo cambiar el rol. Intenta de nuevo.')
    } else {
      setMembers(prev => prev.map(m =>
        m.member_user_id === memberUserId ? { ...m, role: newRole } : m
      ))
      setEditing(null)
    }
    setSaving(false)
  }

  const ownerProfile = profiles[ownerId]
  const ownerName = ownerProfile?.full_name
    || user?.user_metadata?.full_name
    || user?.email
    || 'Admin'

  return (
    <Layout>
      <div style={{ padding: '16px 16px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <button
          onClick={() => navigate('/ajustes')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#3D6B54', fontWeight: 600, fontSize: 14,
            padding: '4px 0', marginBottom: 16,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ← Mi cuenta
        </button>

        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1E2D26', fontFamily: 'Georgia, serif' }}>
          Permisos de acceso
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9CA3AF', lineHeight: 1.5 }}>
          {isAdmin
            ? 'Administra los roles de tu equipo de cuidado.'
            : 'Roles y accesos del equipo de cuidado.'}
        </p>

        {/* Role legend */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'admin',    desc: 'Acceso total' },
            { key: 'cuidador', desc: 'Acceso completo' },
            { key: 'familiar', desc: 'Solo lectura' },
          ].map(({ key, desc }) => {
            const meta = ROLE_META[key]
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ padding: '2px 8px', borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700 }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{desc}</span>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 14 }}>
            Cargando...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Owner row */}
            <MemberRow
              name={ownerName}
              email={user?.id === ownerId ? user?.email : undefined}
              avatarUrl={ownerProfile?.avatar_url}
              role={null}
              isCurrentUser={user?.id === ownerId}
              isAdmin={isAdmin}
              isOwner
              editing={false}
              saving={false}
              onEdit={() => {}}
              onCancelEdit={() => {}}
              onAssign={() => {}}
            />

            {members.map(m => {
              const mp = profiles[m.member_user_id]
              const name = mp?.full_name || m.member_email || 'Familiar'
              return (
                <MemberRow
                  key={m.member_user_id ?? m.member_email}
                  name={name}
                  email={m.member_email}
                  avatarUrl={mp?.avatar_url}
                  role={m.role}
                  isCurrentUser={user?.id === m.member_user_id}
                  isAdmin={isAdmin}
                  isOwner={false}
                  editing={editing === m.member_user_id}
                  saving={saving}
                  onEdit={() => setEditing(m.member_user_id)}
                  onCancelEdit={() => setEditing(null)}
                  onAssign={newRole => assignRole(m.member_user_id, newRole)}
                />
              )
            })}

            {members.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                background: 'white', borderRadius: 16,
                border: '1px solid #F8F4ED', color: '#9CA3AF', fontSize: 13,
              }}>
                No hay otros miembros en el equipo todavía.<br />
                <span style={{ fontSize: 12 }}>Invita a tu familia desde <b>Mi Familia</b>.</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <p style={{ marginTop: 16, fontSize: 13, color: '#E45B4C', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </Layout>
  )
}
