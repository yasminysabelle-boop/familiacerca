import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { createPortalSession } from '../lib/stripe'
import Layout from '../components/Layout'
import { ChevronRight, LogOut } from '../components/Icons'

const PLAN_META = {
  free:      { label: 'Gratis',        color: '#9CA3AF', icon: '🌱' },
  familiar:  { label: 'Plan Familiar', color: '#C4623A', icon: '❤️' },
  care_plus: { label: 'Care+',         color: '#7C3AED', icon: '✨' },
}

const STATUS_LABEL = {
  trial:     'Período de prueba',
  active:    'Activo',
  expired:   'Prueba expirada',
  cancelled: 'Cancelado',
}

const PLAN_FEATURES = {
  free: [
    'Perfil del familiar',
    'Hasta 3 miembros del equipo',
    'Chat familiar',
    'Timeline de cuidado',
  ],
  familiar: [
    'Miembros ilimitados',
    'Recordatorios automáticos',
    'Notas, álbum y gastos',
    'Historial completo de dosis',
    'Directorio de contactos',
    'Resúmenes básicos con IA',
  ],
  care_plus: [
    'Todo lo del Plan Familiar',
    'Asistente IA 24/7',
    'Detección de agotamiento del cuidador',
    'Reporte semanal familiar',
    'Resumen médico en PDF',
    'Soporte prioritario',
  ],
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { sub, isPaid, isTrialing, trialExpired, daysLeft } = useSubscription()
  const navigate = useNavigate()
  const [portalLoading, setPortalLoading] = useState(false)

  const plan = sub?.plan ?? 'free'
  const meta = PLAN_META[plan] ?? PLAN_META.free
  const features = PLAN_FEATURES[plan] ?? []

  const trialEnd = sub?.trial_end_date
    ? new Date(sub.trial_end_date).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const url = await createPortalSession()
      window.location.href = url
    } catch {
      setPortalLoading(false)
      alert('No se pudo abrir el portal. Intenta de nuevo.')
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <Layout>
      <div style={{ padding: '16px 16px 48px', maxWidth: 600 }}>

        {/* Account card */}
        <div style={{
          background: 'linear-gradient(135deg, #BF5E37, #7A3418)',
          borderRadius: 20, padding: '20px 20px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: 'white',
              border: '2px solid rgba(255,255,255,0.25)',
            }}>
              {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'Georgia, serif', margin: 0 }}>
                {user?.user_metadata?.full_name ?? 'Mi cuenta'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: '3px 0 0' }}>
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription card */}
        <div style={{
          background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
          padding: '20px', marginBottom: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 16px' }}>
            Suscripción
          </p>

          {/* Plan row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px', borderRadius: 14,
            background: `${meta.color}0C`, border: `1.5px solid ${meta.color}22`,
            marginBottom: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: `${meta.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {meta.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                  {meta.label}
                </p>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: meta.color, background: `${meta.color}18`,
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {STATUS_LABEL[sub?.status] ?? sub?.status}
                </span>
              </div>
              {isTrialing && (
                <p style={{ fontSize: 12, color: daysLeft <= 3 ? '#DC2626' : '#9CA3AF', margin: '3px 0 0' }}>
                  {daysLeft <= 3 ? `⚠ ` : ''}{daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''} de prueba
                  {trialEnd ? ` · Vence ${trialEnd}` : ''}
                </p>
              )}
              {isPaid && periodEnd && (
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>
                  Próximo cobro: {periodEnd}
                </p>
              )}
              {trialExpired && (
                <p style={{ fontSize: 12, color: '#DC2626', margin: '3px 0 0' }}>
                  Período de prueba terminado
                </p>
              )}
            </div>
          </div>

          {/* What's included */}
          {features.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Tu plan incluye
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {isPaid ? (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: portalLoading ? '#D4C4B8' : 'linear-gradient(135deg, #C4623A, #A85130)',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: portalLoading ? 'not-allowed' : 'pointer',
                boxShadow: portalLoading ? 'none' : '0 6px 20px rgba(196,98,58,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {portalLoading ? 'Abriendo portal...' : 'Gestionar suscripción →'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/pricing')}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #C4623A, #A85130)',
                color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(196,98,58,0.3)',
              }}
            >
              {trialExpired ? 'Reactivar acceso →' : 'Ver planes →'}
            </button>
          )}
        </div>

        {/* More options */}
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', overflow: 'hidden', marginBottom: 12 }}>
          {[
            { label: 'Privacidad y seguridad', to: '/privacidad', icon: '🔒' },
            { label: 'Términos de servicio', to: '/terminos', icon: '📄' },
          ].map(({ label, to, icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', background: 'none', border: 'none',
                borderBottom: '1px solid #F5F0EA', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{label}</span>
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} />
            </button>
          ))}
          <button
            onClick={handleSignOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>🚪</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#D63031' }}>Cerrar sesión</span>
            <LogOut size={15} color="#D63031" strokeWidth={1.75} />
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 8 }}>
          © 2025 FamiliaCerca LLC · v1.0
        </p>
      </div>
    </Layout>
  )
}
