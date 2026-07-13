import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import { supabase } from '../../lib/supabase'
import MedicationStockTab from '../../components/MedicationStockTab'
import { SkeletonMedCard } from '../../components/SkeletonLoader'
import EmptyState from '../../components/EmptyState'
import { Pill } from '../../components/Icons'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

const DOSES_PER_DAY = {
  once_daily: 1, twice_daily: 2, three_daily: 3,
  every_4h: 6, every_6h: 4, every_8h: 3, every_12h: 2,
  as_needed: 1, weekly: 1 / 7,
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MedicationStockList() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [medications, setMedications] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [stockTabMed, setStockTabMed] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingValue, setEditingValue] = useState(0)

  const isAdmin = user?.id === ownerId

  useEffect(() => {
    if (ownerId) load()
  }, [ownerId])

  async function load() {
    setLoading(true)
    const { data: meds } = await supabase
      .from('medications').select('*').eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    const medList = meds ?? []
    setMedications(medList)

    if (medList.length) {
      const { data: stocks } = await supabase
        .from('medication_stock').select('*').eq('user_id', ownerId)
        .in('medication_id', medList.map(m => m.id))
      const map = {}
      ;(stocks ?? []).forEach(s => { map[s.medication_id] = s })
      setStockMap(map)
    }
    setLoading(false)
  }

  async function saveStock(medId, newPills) {
    const stock = stockMap[medId]
    const med = medications.find(m => m.id === medId)
    if (!stock || !med) { setEditingId(null); return }
    const dosesPerDay = DOSES_PER_DAY[med.frequency] ?? 1
    const days = Math.floor(newPills / dosesPerDay)
    const end = new Date(); end.setDate(end.getDate() + days)
    const endDate = days > 0 ? end.toISOString().split('T')[0] : null

    await supabase.from('medication_stock').update({
      pills_remaining: newPills,
      estimated_end_date: endDate,
      updated_at: new Date().toISOString(),
    }).eq('medication_id', medId).eq('user_id', ownerId)

    setStockMap(prev => ({ ...prev, [medId]: { ...prev[medId], pills_remaining: newPills, estimated_end_date: endDate } }))
    setMedications(prev => prev.map(m => m.id === medId ? { ...m, pills_remaining: newPills } : m))
    setEditingId(null)
  }

  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 600, fontFamily: SANS }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: 18, color: '#1E2C3A', margin: 0 }}>
          Inventario
        </h2>
        <p style={{ fontSize: 13, color: '#6B7A88', margin: '2px 0 0' }}>
          Así llevamos la cuenta de cuánto queda de cada medicamento.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => <SkeletonMedCard key={i} />)}
        </div>
      ) : medications.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Sin medicamentos"
          description="Agrega medicamentos desde la pestaña Lista para ver su stock aquí."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {medications.map(med => {
            const stock = stockMap[med.id]
            const days  = stock ? daysFromNow(stock.estimated_end_date) : null
            const pills = stock?.pills_remaining ?? null
            const isAgotado = stock != null && pills != null && pills <= 0
            const isLow = !isAgotado && stock != null && (days != null ? days <= 7 : pills != null && pills <= (med.min_stock ?? 7))
            const color   = isAgotado ? '#D9534F' : isLow ? '#C4664F' : '#087F70'
            const barColor = isAgotado ? '#D9534F' : isLow ? '#E9826E' : '#087F70'
            const cardBg  = isAgotado ? '#F7DEDD' : isLow ? '#FBEAE4' : '#FFFFFF'
            const iconBg  = isAgotado ? '#F1C9C6' : isLow ? '#F6D9CC' : '#EAF7F3'
            const shadow  = isAgotado ? '#D9534F55' : isLow ? '#E9826E44' : '#087F7022'
            const pct = stock?.total_pills > 0
              ? Math.max(0, Math.min(100, Math.round((stock.pills_remaining / stock.total_pills) * 100)))
              : 0
            const qtyPerDose = Number(med.quantity_per_dose ?? 1)
            const dailyDoses = DOSES_PER_DAY[med.frequency] ?? 1
            const dailyConsumption = qtyPerDose * dailyDoses
            const isEditing = editingId === med.id

            const statusText = !stock
              ? null
              : isAgotado
                ? 'Se agotó — hay que reponer'
                : days != null
                  ? `Alcanza hasta el ${fmtDate(stock.estimated_end_date)}`
                  : null

            return (
              <div key={med.id} style={{ background: cardBg, borderRadius: 20, padding: 16, boxShadow: `0 6px 14px -8px ${shadow}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Pill size={20} color={color} strokeWidth={1.9} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: '#1E2C3A' }}>{med.name}{med.dosage ? ` ${med.dosage}` : ''}</div>
                    {stock && (
                      <div style={{ fontSize: 12.5, color: '#6B7A88', marginTop: 2 }}>
                        {stock.pills_remaining} de {stock.total_pills} dosis · {dailyConsumption % 1 === 0 ? dailyConsumption : dailyConsumption.toFixed(2)} dosis/día
                      </div>
                    )}
                  </div>
                </div>

                {stock ? (
                  <>
                    <div style={{ marginTop: 12, height: 7, borderRadius: 6, background: '#F1EDE3', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: barColor, transition: 'width 0.4s ease' }} />
                    </div>
                    {statusText && (
                      <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: isAgotado ? 700 : 600, color }}>{statusText}</div>
                    )}

                    {isAdmin && (
                      isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                          <button onClick={() => setEditingValue(v => Math.max(0, v - 1))} style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: '#FFFFFF', boxShadow: '0 4px 10px -6px #087F7033', fontSize: 18, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>–</button>
                          <div style={{ minWidth: 34, textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#1E2C3A' }}>{editingValue}</div>
                          <button onClick={() => setEditingValue(v => Math.min(stock.total_pills || v + 1, v + 1))} style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: '#FFFFFF', boxShadow: '0 4px 10px -6px #087F7033', fontSize: 18, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>+</button>
                          <button onClick={() => saveStock(med.id, editingValue)} style={{ marginLeft: 'auto', border: 'none', cursor: 'pointer', padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: SANS, color: '#FFFFFF', background: '#087F70' }}>Guardar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingId(med.id); setEditingValue(stock.pills_remaining) }}
                          style={{ marginTop: 12, border: 'none', cursor: 'pointer', padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: SANS, color: '#087F70', background: '#FFFFFF', boxShadow: '0 4px 10px -6px #087F7033' }}
                        >
                          Actualizar cantidad
                        </button>
                      )
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => setStockTabMed(med)}
                        style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 12, border: 'none', background: 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(8,127,112,0.25)' }}
                      >
                        📦 Gestionar stock
                      </button>
                    )}
                    {!isAdmin && (
                      <button
                        onClick={() => setStockTabMed(med)}
                        style={{ width: '100%', marginTop: 10, padding: 8, borderRadius: 10, border: '1px solid rgba(51,65,85,0.12)', background: '#FDFAF7', color: '#087F70', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                      >
                        📦 Ver detalles de stock
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <p style={{ fontSize: 12.5, color: '#6B7A88', margin: 0 }}>Stock no configurado</p>
                    {isAdmin && (
                      <button
                        onClick={() => setStockTabMed(med)}
                        style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid #087F70', background: '#EAF7F3', color: '#087F70', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                      >
                        + Configurar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Stock bottom sheet */}
      {stockTabMed && (
        <MedicationStockTab
          med={stockTabMed}
          ownerId={ownerId}
          isFamiliar={!isAdmin}
          onClose={() => { setStockTabMed(null); load() }}
        />
      )}
    </div>
  )
}
