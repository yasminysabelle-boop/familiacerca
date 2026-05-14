import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { useDarkMode } from '../contexts/DarkModeContext'
import { createPortalSession } from '../lib/stripe'
import { supabase } from '../lib/supabase'
import { isLocationEnabled, setLocationEnabled } from '../lib/gps'
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
          background: checked ? '#C4623A' : '#D1D5DB',
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
  const { sub, isPaid, isTrialing, trialExpired, daysLeft } = useSubscription()
  const { dark, toggleDark } = useDarkMode()
  const navigate = useNavigate()
  const [portalLoading, setPortalLoading] = useState(false)
  const [locationOn, setLocationOn] = useState(() => isLocationEnabled())
  const [exportingPdf, setExportingPdf] = useState(false)

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

  function handleLocationToggle(val) {
    setLocationEnabled(val)
    setLocationOn(val)
  }

  async function exportPDF() {
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]

      // Fetch data
      const [
        { data: meds },
        { data: notes },
        { data: events },
        { data: memories },
      ] = await Promise.all([
        supabase.from('medication_logs')
          .select('*, medications(name, dosage)')
          .eq('user_id', user.id)
          .gte('log_date', fromDate)
          .eq('status', 'confirmed')
          .order('log_date', { ascending: false }),
        supabase.from('notes')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', fromDate + 'T00:00:00Z')
          .order('created_at', { ascending: false }),
        supabase.from('events')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', fromDate)
          .order('date', { ascending: false }),
        supabase.from('voice_diary')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', fromDate + 'T00:00:00Z')
          .order('created_at', { ascending: false }),
      ])

      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()

      // Header
      doc.setFillColor(196, 98, 58)
      doc.rect(0, 0, pageW, 32, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('FamiliaCerca — Historial de Cuidado', 14, 14)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Últimos 30 días · Generado el ${new Date().toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 24)

      let y = 42
      doc.setTextColor(26, 26, 26)

      function sectionTitle(title, emoji) {
        if (y > 260) { doc.addPage(); y = 20 }
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(196, 98, 58)
        doc.text(`${emoji}  ${title}`, 14, y)
        doc.setTextColor(26, 26, 26)
        y += 6
      }

      // Medications
      if (meds?.length) {
        sectionTitle('Medicamentos administrados', '💊')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Medicamento', 'Dosis', 'Administrado por']],
          body: meds.map(m => [
            m.log_date,
            m.medications?.name ?? '—',
            m.medications?.dosage ?? '—',
            m.confirmed_by_name ?? '—',
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [196, 98, 58], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 248, 240] },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      // Notes
      if (notes?.length) {
        if (y > 260) { doc.addPage(); y = 20 }
        sectionTitle('Notas', '📝')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Título', 'Contenido']],
          body: notes.map(n => [
            n.created_at?.split('T')[0] ?? '—',
            n.title ?? '—',
            (n.content ?? '').substring(0, 80) + ((n.content?.length ?? 0) > 80 ? '…' : ''),
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [74, 124, 89], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [235, 243, 238] },
          margin: { left: 14, right: 14 },
          columnStyles: { 2: { cellWidth: 90 } },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      // Calendar events
      if (events?.length) {
        if (y > 260) { doc.addPage(); y = 20 }
        sectionTitle('Eventos del calendario', '📅')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Evento', 'Hora']],
          body: events.map(ev => [ev.date, ev.title ?? '—', ev.time ?? '—']),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      // Voice memories
      if (memories?.length) {
        if (y > 260) { doc.addPage(); y = 20 }
        sectionTitle('Memorias de voz', '🎙️')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Estado de ánimo', 'Transcripción']],
          body: memories.map(m => [
            m.created_at?.split('T')[0] ?? '—',
            m.mood ?? '—',
            (m.transcription ?? '').substring(0, 80) + ((m.transcription?.length ?? 0) > 80 ? '…' : ''),
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [124, 92, 191], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 243, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: { 2: { cellWidth: 90 } },
        })
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175)
        doc.text(`FamiliaCerca LLC · Página ${i} de ${totalPages}`, 14, doc.internal.pageSize.getHeight() - 8)
      }

      doc.save(`historial-familiacerca-${today}.pdf`)
    } catch (err) {
      alert('Error al generar el PDF: ' + err.message)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

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

        {/* PDF Export */}
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '16px', marginBottom: 12 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 6px' }}>
            Exportar historial
          </p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 14px', lineHeight: 1.5 }}>
            Genera un PDF con los últimos 30 días: medicamentos, notas, citas y memorias de voz.
          </p>
          <button
            onClick={exportPDF}
            disabled={exportingPdf}
            style={{
              width: '100%', padding: '12px', borderRadius: 14, border: 'none',
              background: exportingPdf ? '#D4C4B8' : 'linear-gradient(135deg, #4A7C59, #3A6147)',
              color: 'white', fontWeight: 700, fontSize: 14,
              cursor: exportingPdf ? 'not-allowed' : 'pointer',
              boxShadow: exportingPdf ? 'none' : '0 4px 16px rgba(74,124,89,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <span>{exportingPdf ? '⏳' : '📄'}</span>
            {exportingPdf ? 'Generando PDF...' : 'Exportar historial PDF'}
          </button>
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
