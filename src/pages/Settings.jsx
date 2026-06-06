import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { useDarkMode } from '../contexts/DarkModeContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { createPortalSession } from '../lib/stripe'
import { supabase } from '../lib/supabase'
import { isLocationEnabled, setLocationEnabled } from '../lib/gps'
import Layout from '../components/Layout'
import { ChevronRight, LogOut } from '../components/Icons'

const PLAN_META = {
  free:      { label: 'Gratis',        color: '#9CA3AF', icon: '🌱' },
  familiar:  { label: 'Plan Familiar', color: '#4A7C59', icon: '❤️' },
  care_plus: { label: 'Cuidado Total',  color: '#7C3AED', icon: '⭐' },
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
    'Hasta 2 cuidadores',
    'Chat familiar',
    'Checklist de cuidado diario',
    'Medicamentos básicos',
    'Historial 7 días',
  ],
  familiar: [
    'Hasta 6 cuidadores',
    'Recordatorios automáticos de medicamentos',
    'Notas de voz y texto',
    'Foto-prueba de medicamentos',
    'Reportes y exportación PDF',
    'Álbum familiar',
    'Gastos compartidos',
  ],
  care_plus: [
    'Cuidadores ilimitados',
    'Todo lo del Plan Familiar',
    'Directorio médico completo',
    'Alertas SOS prioritarias',
    'Detección de agotamiento del cuidador',
    'Reporte semanal automático',
    'Historial indefinido',
    'Soporte prioritario',
  ],
}

function ToggleRow({ icon, label, subtitle, checked, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderBottom: '1px solid #F5F0EA',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{label}</p>
        {subtitle && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0' }}>{subtitle}</p>}
      </div>
      <button
        role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 'none',
          background: checked ? '#4A7C59' : '#D1D5DB',
          position: 'relative', cursor: 'pointer',
          transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: 'white', transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }} />
      </button>
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { ownerId, memberRole, families, switchFamily, hasMultiple, activeOwnerId } = useFamily()
  const isAdmin = memberRole === null && ownerId === user?.id
  const { sub, isPaid, isTrialing, trialExpired, daysLeft } = useSubscription()
  const { dark, toggleDark } = useDarkMode()
  const { permission, subscribed, supported, subscribeError, requestAndSubscribe, resubscribe } = usePushNotifications()
  const navigate = useNavigate()
  const [portalLoading, setPortalLoading] = useState(false)
  const [locationOn, setLocationOn] = useState(() => isLocationEnabled())
  const [portalError, setPortalError] = useState('')
  const [testingPush, setTestingPush] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showCancelMilo, setShowCancelMilo] = useState(false)
  const [cancelReason, setCancelReason] = useState(null)

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
    setPortalError('')
    try {
      const url = await createPortalSession()
      window.location.href = url
    } catch {
      setPortalLoading(false)
      setPortalError('No se pudo abrir el portal. Intenta de nuevo.')
    }
  }

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

  function handleLocationToggle(val) {
    setLocationEnabled(val)
    setLocationOn(val)
  }

  async function sendTestNotification() {
    setTestingPush(true)
    setTestResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('send-test-notification')
      if (error) throw error
      const sent = data.sent ?? 0
      const failed = data.failed ?? 0
      if (sent > 0 && failed === 0) {
        setTestResult({ ok: true, msg: `✅ Enviado a ${sent} dispositivo${sent !== 1 ? 's' : ''}` })
      } else if (failed > 0 && sent === 0) {
        setTestResult({ ok: false, stale: true, msg: `Token expirado — suscripción eliminada. Toca "Reactivar" para renovarla.` })
      } else if (sent > 0 && failed > 0) {
        setTestResult({ ok: true, stale: true, msg: `Enviado a ${sent} dispositivo. ${failed} suscripción expirada eliminada.` })
      } else if (data.error) {
        setTestResult({ ok: false, msg: `Sin suscripciones guardadas. Activa las notificaciones primero.` })
      } else {
        setTestResult({ ok: false, msg: `No se encontraron suscripciones. ¿El servicio worker está registrado?` })
      }
    } catch (err) {
      setTestResult({ ok: false, msg: `Error: ${err.message ?? 'Desconocido'}` })
    } finally {
      setTestingPush(false)
    }
  }

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Account card */}
        <div style={{
          background: 'linear-gradient(135deg, #4A7C59, #2E5240)',
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

        {/* Mis familias — only shown when user belongs to more than one care group */}
        {hasMultiple && (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', overflow: 'hidden', marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 8px', margin: 0 }}>
              Mis familias
            </p>
            {families.map((fam, i) => {
              const isActive = fam.ownerId === activeOwnerId
              const roleLabel = fam.role === null ? 'Administrador' : fam.role === 'cuidador' ? 'Cuidador' : 'Familiar'
              const roleColor = fam.role === null ? '#3D6B54' : fam.role === 'cuidador' ? '#1D4ED8' : '#D97706'
              const roleBg   = fam.role === null ? '#E8F5EE' : fam.role === 'cuidador' ? '#EFF6FF' : '#FEF3C7'
              const initial  = (fam.patientName ?? 'F').charAt(0).toUpperCase()
              return (
                <button
                  key={fam.ownerId}
                  onClick={() => switchFamily(fam.ownerId)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                    background: isActive ? '#F0FDF4' : 'transparent', border: 'none',
                    borderBottom: i < families.length - 1 ? '1px solid #F5F0EA' : 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {fam.patientPhotoUrl ? (
                    <img src={fam.patientPhotoUrl} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: isActive ? '2px solid #4A7C59' : '2px solid transparent' }} />
                  ) : (
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? '#4A7C59' : '#C5B9A8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 17,
                    }}>
                      {initial}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fam.patientName ?? 'Sin paciente'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                      {fam.role === null ? 'Tu grupo de cuidado' : 'Miembro del grupo'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: roleBg, color: roleColor }}>
                      {roleLabel}
                    </span>
                    {isActive && (
                      <span style={{ color: '#4A7C59', fontSize: 16, lineHeight: 1 }}>✓</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Subscription card */}
        <div style={{
          background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
          padding: '20px', marginBottom: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 16px' }}>
            Suscripción
          </p>

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
                  {daysLeft <= 3 ? '⚠ ' : ''}{daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''} de prueba
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

          {isPaid ? (
            <>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  background: portalLoading ? '#C0CCC5' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  cursor: portalLoading ? 'not-allowed' : 'pointer',
                  boxShadow: portalLoading ? 'none' : '0 6px 20px rgba(74,124,89,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {portalLoading ? 'Abriendo portal...' : 'Gestionar suscripción →'}
              </button>
              {portalError && (
                <p style={{ fontSize: 12, color: '#D63031', margin: '8px 0 0', padding: '8px 12px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10 }}>
                  ⚠ {portalError}
                </p>
              )}
              <button
                onClick={() => { setShowCancelMilo(true); setCancelReason(null) }}
                style={{
                  width: '100%', padding: '11px', borderRadius: 12, marginTop: 8,
                  border: '1.5px solid #EDE5D8', background: 'transparent',
                  color: '#9CA3AF', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancelar suscripción
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/pricing')}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(74,124,89,0.3)',
              }}
            >
              {trialExpired ? 'Reactivar acceso →' : 'Ver planes →'}
            </button>
          )}
        </div>

        {/* Preferences */}
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', overflow: 'hidden', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 8px', margin: 0 }}>
            Preferencias
          </p>
          <ToggleRow
            icon="🌙"
            label="Modo oscuro"
            subtitle="Colores cálidos oscuros, sin azules"
            checked={dark}
            onChange={toggleDark}
          />
          <ToggleRow
            icon="📍"
            label="Compartir ubicación"
            subtitle="Captura GPS al marcar medicamentos y notas"
            checked={locationOn}
            onChange={handleLocationToggle}
          />
        </div>

        {/* Push Notifications */}
        {supported && (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '16px', marginBottom: 12 }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 6px' }}>
              Notificaciones push
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 12px', lineHeight: 1.5 }}>
              {permission === 'granted'
                ? subscribed
                  ? 'Activas — recibirás recordatorios de medicamentos y alertas familiares.'
                  : 'Permiso otorgado pero sin suscripción activa.'
                : permission === 'denied'
                  ? 'Bloqueadas en el navegador. Habilítalas en Configuración del sistema.'
                  : 'Activa las notificaciones para recibir recordatorios de medicamentos.'}
            </p>

            {/* Status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, marginBottom: 12,
              background: permission === 'granted' && subscribed ? '#F0FDF4' : '#FFF7ED',
              border: `1px solid ${permission === 'granted' && subscribed ? '#BBF7D0' : '#FED7AA'}`,
            }}>
              <span style={{ fontSize: 16 }}>
                {permission === 'granted' && subscribed ? '🔔' : permission === 'denied' ? '🔕' : '🔔'}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: permission === 'granted' && subscribed ? '#15803D' : '#7A5A18',
              }}>
                {permission === 'granted' && subscribed
                  ? 'Notificaciones activas'
                  : permission === 'denied'
                    ? 'Bloqueadas por el navegador'
                    : 'Notificaciones inactivas'}
              </span>
            </div>

            {/* Activate button — shown when not yet granted */}
            {permission !== 'denied' && !(permission === 'granted' && subscribed) && (
              <button
                onClick={requestAndSubscribe}
                style={{
                  width: '100%', padding: '12px', borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(74,124,89,0.25)',
                  marginBottom: 8,
                }}
              >
                🔔 Activar notificaciones
              </button>
            )}

            {/* Test button — shown when subscribed */}
            {permission === 'granted' && subscribed && (
              <button
                onClick={sendTestNotification}
                disabled={testingPush}
                style={{
                  width: '100%', padding: '12px', borderRadius: 14,
                  border: '1.5px solid #4A7C59', background: 'white',
                  color: '#4A7C59', fontWeight: 700, fontSize: 14,
                  cursor: testingPush ? 'not-allowed' : 'pointer',
                  opacity: testingPush ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {testingPush ? '⏳ Enviando...' : '🧪 Test notificación'}
              </button>
            )}

            {/* Result message */}
            {testResult && (
              <>
                <p style={{
                  fontSize: 12, fontWeight: 600, margin: '10px 0 0',
                  color: testResult.ok ? '#15803D' : '#DC2626',
                  padding: '8px 12px', borderRadius: 10,
                  background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
                }}>
                  {testResult.msg}
                </p>
                {testResult.stale && (
                  <button
                    onClick={() => { setTestResult(null); resubscribe() }}
                    style={{
                      width: '100%', padding: '11px', borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                      color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      marginTop: 8, boxShadow: '0 4px 14px rgba(74,124,89,0.25)',
                    }}
                  >
                    🔄 Reactivar suscripción
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Admin panel link — only for owners */}
        {isAdmin && (
          <div style={{
            borderRadius: 20, overflow: 'hidden', marginBottom: 12,
            border: '1px solid #2D4A1E30', background: '#F0F9F4',
          }}>
            <button
              onClick={() => navigate('/admin')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: '#2D4A1E18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>⚙️</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#2D4A1E' }}>
                  Panel de administración
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4A7C59' }}>
                  Equipo, cuenta, datos y actividad
                </p>
              </div>
              <ChevronRight size={16} color="#4A7C59" strokeWidth={2} />
            </button>
          </div>
        )}


        {/* More options */}
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', overflow: 'hidden', marginBottom: 12 }}>
          {[
            { label: 'Permisos de acceso',    to: '/roles',     icon: '🛡️' },
            { label: 'Planes y suscripción',  to: '/pricing',   icon: '⭐' },
            { label: 'Privacidad y seguridad', to: '/privacidad', icon: '🔒' },
            { label: 'Términos de servicio',  to: '/terminos',  icon: '📄' },
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

      {/* Milo cancellation dialog */}
      {showCancelMilo && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowCancelMilo(false) }}
        >
          <div style={{
            width: '100%', maxWidth: 480, background: 'white',
            borderRadius: '28px 28px 0 0',
            padding: '32px 24px 48px',
            boxShadow: '0 -12px 48px rgba(0,0,0,0.18)',
          }}>
            {/* Milo avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4A7C59, #2E5240)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34, marginBottom: 14,
                boxShadow: '0 6px 20px rgba(74,124,89,0.3)',
              }}>
                🐾
              </div>
              <p style={{
                fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700,
                color: '#1A1A1A', margin: '0 0 6px', textAlign: 'center',
              }}>
                Espera 🥺
              </p>
              <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                Soy Milo, tu asistente de cuidado.<br />
                ¿Puedo preguntarte algo antes de irte?
              </p>
            </div>

            {!cancelReason ? (
              <>
                <p style={{
                  fontSize: 12, fontWeight: 700, color: '#9CA3AF',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  textAlign: 'center', marginBottom: 14,
                }}>
                  ¿Por qué quieres cancelar?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { id: 'price',   emoji: '💸', label: 'Es muy caro' },
                    { id: 'usage',   emoji: '📉', label: 'No lo uso suficiente' },
                    { id: 'missing', emoji: '🔍', label: 'Le falta algo' },
                    { id: 'other',   emoji: '💬', label: 'Otra razón' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setCancelReason(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 16px', borderRadius: 14,
                        border: '1.5px solid #EDE5D8', background: '#FDFAF7',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{r.emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{r.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                {cancelReason === 'price' && (
                  <div style={{ background: '#F0F9F4', borderRadius: 16, padding: '18px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: '#2E5240', lineHeight: 1.7, margin: 0 }}>
                      Entiendo 💚 El cuidado familiar ya tiene suficientes gastos.<br /><br />
                      ¿Sabías que puedes <strong>pausar</strong> tu plan y reactivarlo cuando lo necesites?
                      También ofrecemos descuentos para familias con múltiples cuidadores.
                    </p>
                  </div>
                )}
                {cancelReason === 'usage' && (
                  <div style={{ background: '#F0F9F4', borderRadius: 16, padding: '18px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: '#2E5240', lineHeight: 1.7, margin: 0 }}>
                      Lo entiendo, la vida de cuidador es muy ocupada 🤝<br /><br />
                      Muchas familias nos dicen que las <strong>alertas de medicamentos</strong> y el
                      <strong> diario médico compartido</strong> son lo que más valoran.
                      ¿Quieres explorarlos antes de decidir?
                    </p>
                  </div>
                )}
                {cancelReason === 'missing' && (
                  <div style={{ background: '#F0F9F4', borderRadius: 16, padding: '18px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: '#2E5240', lineHeight: 1.7, margin: 0 }}>
                      Nos encantaría saberlo 🙏<br /><br />
                      Tu opinión es lo más valioso que puedes darnos.
                      Estamos construyendo FamiliaCerca con familias como la tuya.
                      ¿Nos escribes a <strong>hola@familiacerca.com</strong> para contarnos?
                    </p>
                  </div>
                )}
                {cancelReason === 'other' && (
                  <div style={{ background: '#F0F9F4', borderRadius: 16, padding: '18px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: '#2E5240', lineHeight: 1.7, margin: 0 }}>
                      Gracias por acompañarnos hasta aquí 💚<br /><br />
                      Si alguna vez regresas, tu historial familiar y datos estarán seguros.
                      Siempre tendrás un lugar en FamiliaCerca.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setShowCancelMilo(false)}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(74,124,89,0.3)',
                    marginBottom: 10,
                  }}
                >
                  Mantener mi suscripción
                </button>
              </div>
            )}

            {/* Always visible cancel anyway */}
            <button
              onClick={() => { setShowCancelMilo(false); handlePortal() }}
              style={{
                width: '100%', padding: '12px', borderRadius: 12, marginTop: cancelReason ? 0 : 16,
                border: '1.5px solid #EDE5D8', background: 'transparent',
                color: '#9CA3AF', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancelar de todas formas →
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
