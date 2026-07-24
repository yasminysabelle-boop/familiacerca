import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import Layout from '../components/Layout'
import AdminTeamSection     from '../components/admin/AdminTeamSection'
import AdminAccountSection  from '../components/admin/AdminAccountSection'
import AdminDataSection     from '../components/admin/AdminDataSection'
import AdminActivitySection from '../components/admin/AdminActivitySection'

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

// Marca de agua decorativa — mismo trazo SVG que las demás pantallas migradas.
const WATERMARK_PATHS = (
  <>
    <path d="M200 330 C 60 240, 30 140, 110 90 C 160 60, 195 90, 200 130 C 205 90, 240 60, 290 90 C 370 140, 340 240, 200 330 Z" fill="#087F70" />
    <circle cx="165" cy="165" r="22" fill="#F8F4ED" />
    <path d="M130 230 C 130 195, 200 195, 200 230 L 200 245 L 130 245 Z" fill="#F8F4ED" />
    <circle cx="235" cy="165" r="22" fill="#F8F4ED" />
    <path d="M200 230 C 200 195, 270 195, 270 230 L 270 245 L 200 245 Z" fill="#F8F4ED" />
  </>
)

const TABS = [
  { id: 'team',     label: 'Equipo',   icon: '👥' },
  { id: 'account',  label: 'Cuenta',   icon: '💳' },
  { id: 'data',     label: 'Datos',    icon: '📄' },
  { id: 'activity', label: 'Actividad', icon: '📋' },
]

export default function Admin() {
  const { user } = useAuth()
  const { ownerId, memberRole, loading: familyLoading } = useFamily()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('team')

  // Show loading while family context resolves
  if (familyLoading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>Verificando acceso...</p>
        </div>
      </Layout>
    )
  }

  // Access gate: only the owner (memberRole === null && ownerId === user.id)
  const isAdmin = memberRole === null && ownerId === user?.id
  if (!isAdmin) {
    return (
      <Layout>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '32px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#FEF2F2', border: '2px solid #FFBABA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, marginBottom: 20,
          }}>
            🔒
          </div>
          <h2 style={{
            fontFamily: SANS, fontSize: 20, fontWeight: 700,
            color: '#1A1A1A', margin: '0 0 10px',
          }}>
            Acceso restringido
          </h2>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 300 }}>
            El panel de administración solo está disponible para el administrador de la familia — quien creó la cuenta.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: '#087F70', color: 'white', fontWeight: 700,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Volver al inicio
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ position: 'relative', minHeight: '100%', overflow: 'hidden' }}>

        {/* Marca de agua decorativa — fiel al patrón de las demás pantallas migradas */}
        <svg viewBox="0 0 400 400" style={{ position: 'absolute', top: -60, right: -90, width: 420, height: 420, opacity: 0.05, pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
          {WATERMARK_PATHS}
        </svg>

      <div style={{ position: 'relative', zIndex: 1, padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Header */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #EDE5D8',
          borderRadius: 20, padding: '20px', marginBottom: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#A8E5D6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>
            ⚙️
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              color: '#334155', fontSize: 17, fontWeight: 800,
              fontFamily: SANS, margin: 0, lineHeight: 1.2,
            }}>
              Panel de administración
            </p>
            <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>
              {user?.user_metadata?.full_name ?? user?.email} · Administrador
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6, marginBottom: 20,
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 4px', borderRadius: 12, border: 'none',
                background: activeTab === t.id ? '#087F70' : '#F3F4F6',
                color: activeTab === t.id ? 'white' : '#6B7280',
                fontWeight: 700, fontSize: 11, cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'team'     && <AdminTeamSection />}
        {activeTab === 'account'  && <AdminAccountSection />}
        {activeTab === 'data'     && <AdminDataSection />}
        {activeTab === 'activity' && <AdminActivitySection />}
      </div>

      </div>
    </Layout>
  )
}
