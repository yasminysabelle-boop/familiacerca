import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { XIcon } from './Icons'

const RENEWAL_LABELS = {
  pharmacy:     '🏪 Farmacia',
  mail:         '📬 Correo/envío',
  prescription: '📄 Receta física',
  manual:       '✍️ Registro manual',
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  const end = new Date(dateStr + 'T12:00:00')
  return Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function MedicationStockTab({ med, ownerId, isFamiliar, onClose }) {
  const { user } = useAuth()
  const [stock, setStock] = useState(null)
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [newPillCount, setNewPillCount] = useState('')
  const [renewing, setRenewing] = useState(false)
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    if (med?.id && ownerId) load()
  }, [med?.id, ownerId])

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('medication_stock')
        .select('*').eq('medication_id', med.id).eq('user_id', ownerId).maybeSingle(),
      supabase.from('medication_renewals')
        .select('*').eq('medication_id', med.id).eq('user_id', ownerId)
        .order('renewed_at', { ascending: false }).limit(10),
    ])
    setStock(s ?? null)
    setRenewals(r ?? [])
    setLoading(false)
  }

  async function handleRenew() {
    const count = parseInt(newPillCount)
    if (!count || count <= 0) return
    setRenewing(true)
    const dosesPerDay = stock?.doses_per_day ?? 1
    const days = Math.floor(count / dosesPerDay)
    const end = new Date()
    end.setDate(end.getDate() + days)
    const today = new Date().toISOString().split('T')[0]

    await Promise.all([
      supabase.from('medication_stock').update({
        total_pills: count,
        pills_remaining: count,
        start_date: today,
        estimated_end_date: days > 0 ? end.toISOString().split('T')[0] : null,
        alert_7_sent: false,
        alert_3_sent: false,
        alert_1_sent: false,
        needs_renewal_ack: false,
        updated_at: new Date().toISOString(),
      }).eq('medication_id', med.id).eq('user_id', ownerId),
      supabase.from('medication_renewals').insert({
        medication_id: med.id,
        user_id: ownerId,
        pill_count: count,
        renewed_by_name: displayName,
        renewed_at: new Date().toISOString(),
      }),
    ])
    setRenewing(false)
    setShowRenewModal(false)
    setNewPillCount('')
    load()
  }

  const days = stock ? daysFromNow(stock.estimated_end_date) : null
  const pct  = stock?.total_pills > 0
    ? Math.max(0, Math.min(100, Math.round((stock.pills_remaining / stock.total_pills) * 100)))
    : 0
  const urgColor = days == null ? '#9CA3AF'
    : days <= 1 ? '#DC2626' : days <= 3 ? '#D97706' : days <= 7 ? '#C9882A' : '#16A34A'
  const urgBg = days == null ? '#F3F4F6'
    : days <= 1 ? '#FEF2F2' : days <= 3 ? '#FEF3C7' : days <= 7 ? '#FFFBEB' : '#F0FDF4'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480, background: 'white',
        borderRadius: '24px 24px 0 0', padding: '24px 20px 96px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>
              📦 Stock y Renovación
            </p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              {med.name}
            </p>
            {med.dosage && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>{med.dosage}</p>}
          </div>
          <button onClick={onClose} style={{ padding: 8, border: 'none', background: '#F3F4F6', borderRadius: 10, cursor: 'pointer' }}>
            <XIcon size={16} color="#6B7280" strokeWidth={2} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#4A7C59', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : !stock ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📦</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>Sin datos de stock</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
              Configura el stock al agregar o editar el medicamento.
            </p>
          </div>
        ) : (
          <>
            {/* Urgency banner */}
            {days !== null && days <= 7 && (
              <div style={{ background: urgBg, borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${urgColor}40` }}>
                <span style={{ fontSize: 20 }}>{days <= 1 ? '🚨' : days <= 3 ? '⚠️' : '🔔'}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: urgColor, margin: 0 }}>
                    {days <= 0 ? '¡Medicamento agotado!' : days === 1 ? 'Mañana se acaba' : `Quedan ${days} días`}
                  </p>
                  {stock.refills_remaining === 0 && (
                    <p style={{ fontSize: 11, color: '#D97706', margin: '2px 0 0' }}>
                      Sin refills — necesitas cita con el médico
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pill bar */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Pastillas restantes</p>
                <span style={{ fontSize: 13, fontWeight: 700, color: urgColor }}>
                  {stock.pills_remaining} / {stock.total_pills} 💊
                </span>
              </div>
              <div style={{ height: 14, borderRadius: 7, background: '#F3F4F6', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  height: '100%', borderRadius: 7, width: `${pct}%`,
                  background: pct > 30
                    ? 'linear-gradient(90deg, #4A7C59, #22C55E)'
                    : pct > 10
                      ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                      : 'linear-gradient(90deg, #DC2626, #EF4444)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Inicio del conteo</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '1px 0 0' }}>{fmtDate(stock.start_date)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Agotamiento estimado</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: urgColor, margin: '1px 0 0' }}>
                    {fmtDate(stock.estimated_end_date)}
                    {days !== null && (
                      <span style={{ fontWeight: 400, color: '#9CA3AF' }}>
                        {' · '}{days <= 0 ? 'hoy' : `en ${days} día${days !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Renewal method */}
            {stock.renewal_method && (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Método de renovación
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                  {RENEWAL_LABELS[stock.renewal_method] ?? stock.renewal_method}
                </p>
                {stock.pharmacy_name && (
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>📍 {stock.pharmacy_name}</p>
                )}
                {stock.refills_remaining != null && (
                  <p style={{ fontSize: 12, color: stock.refills_remaining === 0 ? '#DC2626' : '#6B7280', margin: '4px 0 0' }}>
                    Refills disponibles: <strong>
                      {stock.refills_remaining === 0 ? 'Ninguno — se necesita cita' : stock.refills_remaining}
                    </strong>
                  </p>
                )}
                {stock.last_mail_date && (
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
                    Último envío: {fmtDate(stock.last_mail_date)}
                  </p>
                )}
              </div>
            )}

            {/* Renew button */}
            {!isFamiliar && (
              <button
                onClick={() => setShowRenewModal(true)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none', marginBottom: 20,
                  background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(74,124,89,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                ✅ Ya se renovó → nueva caja
              </button>
            )}

            {/* Renewal history */}
            {renewals.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                  Historial de renovaciones
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {renewals.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'white', borderRadius: 12, border: '1px solid #EDE5D8' }}>
                      <span style={{ fontSize: 16 }}>📦</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>+{r.pill_count} pastillas</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                          {fmtDate(r.renewed_at?.split('T')[0])}
                          {r.renewed_by_name ? ` · ${r.renewed_by_name.split(' ')[0]}` : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: 6 }}>✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Renew modal */}
      {showRenewModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowRenewModal(false); setNewPillCount('') } }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: '0 0 6px' }}>
              ✅ Nueva caja
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
              ¿Cuántas pastillas trae la nueva caja de <strong>{med.name}</strong>?
            </p>
            <input
              type="number" inputMode="numeric" min="1"
              value={newPillCount}
              onChange={e => setNewPillCount(e.target.value)}
              placeholder="Ej: 30, 60, 90..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #EDE5D8', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowRenewModal(false); setNewPillCount('') }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRenew}
                disabled={!newPillCount || parseInt(newPillCount) <= 0 || renewing}
                style={{
                  flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                  background: (!newPillCount || renewing) ? '#C0CCC5' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  cursor: (!newPillCount || renewing) ? 'not-allowed' : 'pointer',
                }}
              >
                {renewing ? 'Guardando...' : 'Confirmar renovación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
