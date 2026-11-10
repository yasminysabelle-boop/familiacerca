import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useBillingAccount } from '../contexts/BillingAccountContext'
import Layout from '../components/Layout'
import AdminTeamSection          from '../components/admin/AdminTeamSection'
import AdminAccountSection       from '../components/admin/AdminAccountSection'
import AdminDataSection          from '../components/admin/AdminDataSection'
import AdminActivitySection      from '../components/admin/AdminActivitySection'
import AdminPaymentAlertsSection from '../components/admin/AdminPaymentAlertsSection'

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

// Marca de agua decorativa — mismo trazo SVG que las demás pantallas migradas.

const BASE_TABS = [
  { id: 'team',     label: 'Equipo',   icon: '👥' },
  { id: 'account',  label: 'Cuenta',   icon: '💳' },
  { id: 'data',     label: 'Datos',    icon: '📄' },
  { id: 'activity', label: 'Actividad', icon: '📋' },
]

// Solo visible para staff interno (isAppAdmin) -- este panel es el de cada
// dueño de familia, no un panel de staff, así que la pestaña de alertas de
// pago (que puede tener datos de OTRAS familias) no puede aparecer para un
// dueño de familia común, aunque esté viendo su propio /admin.
const PAYMENT_ALERTS_TAB = { id: 'payments', label: 'Pagos', icon: '⚠️' }

export default function Admin() {
  const { user } = useAuth()
  const { ownerId, memberRole, loading: familyLoading } = useFamily()
  const { isAppAdmin } = useBillingAccount()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'team')
  const TABS = isAppAdmin ? [...BASE_TABS, PAYMENT_ALERTS_TAB] : BASE_TABS

  // Show loading while family context resolves
  if (familyLoading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <p style={{ color: '#5E7480', fontSize: 15 }}>Verificando acceso...</p>
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
            color: '#14303D', margin: '0 0 10px',
          }}>
            Acceso restringido
          </h2>
          <p style={{ fontSize: 15, color: '#4E6470', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 300 }}>
            El panel de administración solo está disponible para el administrador de la familia — quien creó la cuenta.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: '#0C6C9C', color: 'white', fontWeight: 700,
              fontSize: 15, cursor: 'pointer',
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

      <div style={{ position: 'relative', zIndex: 1, padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Header */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #E6E3DB',
          borderRadius: 20, padding: '20px', marginBottom: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#A6E3EC',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>
            ⚙️
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              color: '#2A4350', fontSize: 17, fontWeight: 800,
              fontFamily: SANS, margin: 0, lineHeight: 1.2,
            }}>
              Panel de administración
            </p>
            <p style={{ color: '#5E7480', fontSize: 15, margin: '4px 0 0' }}>
              {user?.user_metadata?.full_name ?? user?.email} · Administrador
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          gap: 6, marginBottom: 20,
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 4px', borderRadius: 12, border: 'none',
                background: activeTab === t.id ? '#0C6C9C' : '#F3F4F6',
                color: activeTab === t.id ? 'white' : '#4E6470',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
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
        {activeTab === 'payments' && isAppAdmin && <AdminPaymentAlertsSection />}
      </div>

      </div>
    </Layout>
  )
}
