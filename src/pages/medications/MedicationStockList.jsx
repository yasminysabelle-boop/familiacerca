import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import { supabase } from '../../lib/supabase'
import MedicationStockTab from '../../components/MedicationStockTab'
import { SkeletonMedCard } from '../../components/SkeletonLoader'
import EmptyState from '../../components/EmptyState'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function stockColor(days) {
  if (days == null) return '#9CA3AF'
  if (days <= 1) return '#DC2626'
  if (days <= 3) return '#D97706'
  if (days <= 7) return '#C9882A'
  return '#16A34A'
}
function stockBg(days) {
  if (days == null) return '#F3F4F6'
  if (days <= 1) return '#FEF2F2'
  if (days <= 3) return '#FEF3C7'
  if (days <= 7) return '#FFFBEB'
  return '#F0FDF4'
}
function stockEmoji(days, pills) {
  if (pills != null) {
    if (pills <= 3) return '🔴'
    if (pills <= 7) return '🟡'
    return '🟢'
  }
  if (days == null) return '⚪'
  if (days <= 3) return '🔴'
  if (days <= 7) return '🟡'
  return '🟢'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MedicationStockList() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [medications, setMedications] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [stockTabMed, setStockTabMed] = useState(null)

  // Inline edit state
  const [inlineEditId, setInlineEditId] = useState(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const inlineInputRef = useRef(null)

  const isAdmin = user?.id === ownerId

  useEffect(() => {
    if (ownerId) load()
  }, [ownerId])

  // Focus inline input when it appears
  useEffect(() => {
    if (inlineEditId && inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [inlineEditId])

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

  async function saveInlineStock(medId, rawValue) {
    const newPills = parseInt(rawValue)
    const stock = stockMap[medId]
    if (!stock || isNaN(newPills) || newPills < 0) { setInlineEditId(null); return }

    const med = medications.find(m => m.id === medId)
    const dosesPerDay = DOSES_PER_DAY[med?.frequency] ?? 1
    const days = Math.floor(newPills / dosesPerDay)
    const end = new Date(); end.setDate(end.getDate() + days)
    const endDate = days > 0 ? end.toISOString().split('T')[0] : null

    await supabase.from('medication_stock').update({
      pills_remaining: newPills,
      estimated_end_date: endDate,
      updated_at: new Date().toISOString(),
    }).eq('medication_id', medId).eq('user_id', ownerId)

    setStockMap(prev => ({
      ...prev,
      [medId]: { ...prev[medId], pills_remaining: newPills, estimated_end_date: endDate },
    }))
    setMedications(prev => prev.map(m =>
      m.id === medId ? { ...m, pills_remaining: newPills } : m
    ))
    setInlineEditId(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
          color: '#1A1A1A', margin: 0,
        }}>
          Stock e inventario
        </h2>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          {isAdmin
            ? 'Toca 📦 para gestionar cada medicamento'
            : 'Vista de inventario de medicamentos'}
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
          description="Agrega medicamentos desde la pestaña Todos para ver su stock aquí."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {medications.map(med => {
            const stock = stockMap[med.id]
            const days = stock ? daysFromNow(stock.estimated_end_date) : null
            const pills = stock?.pills_remaining ?? null
            const minStock = med.min_stock ?? 7
            const isBelowMin = pills != null && pills <= minStock
            // Use min_stock-aware color: red if below min, yellow if close (2×min), green otherwise
            const sColor = pills == null ? '#9CA3AF' : pills <= minStock ? '#DC2626' : pills <= minStock * 2 ? '#D97706' : '#16A34A'
            const sBg    = pills == null ? '#F3F4F6' : pills <= minStock ? '#FEF2F2' : pills <= minStock * 2 ? '#FFFBEB' : '#F0FDF4'
            const sEmoji = pills == null ? '⚪' : pills <= minStock ? '🔴' : pills <= minStock * 2 ? '🟡' : '🟢'
            const pct = stock?.total_pills > 0
              ? Math.max(0, Math.min(100, Math.round((stock.pills_remaining / stock.total_pills) * 100)))
              : 0
            const isEditing = inlineEditId === med.id
            const qtyPerDose = Number(med.quantity_per_dose ?? 1)
            const dailyDoses = DOSES_PER_DAY[med.frequency] ?? 1
            const dailyConsumption = qtyPerDose * dailyDoses

            return (
              <div
                key={med.id}
                style={{
                  background: 'white',
                  borderRadius: 16,
                  border: isBelowMin ? '1.5px solid #FCA5A5' : '1px solid #EDE5D8',
                  borderLeft: `4px solid ${sColor}`,
                  padding: '14px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Top row: name + badge */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: 10, marginBottom: stock ? 10 : 0,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                        💊 {med.name}
                      </span>
                      {med.form && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#0d6b63', background: '#EBF3EE', padding: '2px 7px', borderRadius: 10 }}>
                          {med.form}
                        </span>
                      )}
                    </div>
                    {med.dosage && (
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                        {med.dosage}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: sColor, background: sBg,
                    padding: '4px 10px', borderRadius: 20,
                    border: `1px solid ${sColor}40`,
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {sEmoji} {pills != null ? `${pills} dosis` : 'Sin stock'}
                  </span>
                </div>

                {stock ? (
                  <>
                    {/* Progress bar */}
                    <div style={{
                      height: 6, borderRadius: 3, background: '#F3F4F6',
                      overflow: 'hidden', marginBottom: 10,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3, width: `${pct}%`,
                        background: pct > 30
                          ? 'linear-gradient(90deg, #0d6b63, #22C55E)'
                          : pct > 10
                            ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                            : 'linear-gradient(90deg, #DC2626, #EF4444)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    {/* Info grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: '6px 16px', marginBottom: 12,
                    }}>
                      <div>
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Dosis restantes</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: sColor, margin: '1px 0 0' }}>
                          {stock.pills_remaining} / {stock.total_pills}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Días restantes</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: sColor, margin: '1px 0 0' }}>
                          {days == null ? '—' : days <= 0 ? 'Agotado' : `${days} día${days !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Consumo diario</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '1px 0 0' }}>
                          {dailyConsumption % 1 === 0 ? dailyConsumption : dailyConsumption.toFixed(2)} dosis/día
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Se acaba aprox.</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '1px 0 0' }}>
                          {fmtDate(stock.estimated_end_date)}
                        </p>
                      </div>
                    </div>

                    {/* Min stock alert */}
                    {isBelowMin && (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🔴</span>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', margin: 0 }}>
                          Stock bajo el mínimo ({minStock} dosis) — renovar pronto
                        </p>
                      </div>
                    )}

                    {/* Urgency alert */}
                    {days != null && days <= 7 && (
                      <div style={{
                        background: sBg, border: `1px solid ${sColor}40`,
                        borderRadius: 10, padding: '8px 12px',
                        marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ fontSize: 14 }}>
                          {days <= 1 ? '🚨' : days <= 3 ? '⚠️' : '🔔'}
                        </span>
                        <p style={{ fontSize: 12, fontWeight: 700, color: sColor, margin: 0 }}>
                          {days <= 0
                            ? '¡Medicamento agotado! Renovar urgente'
                            : days === 1
                              ? 'Se acaba mañana — renovar hoy'
                              : `Quedan ${days} días — planificar renovación`}
                        </p>
                      </div>
                    )}

                    {/* Admin actions */}
                    {isAdmin && (
                      <div style={{
                        borderTop: '1px solid #F8F4ED', paddingTop: 10,
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        {/* Inline edit pills_remaining */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>
                            Dosis restantes:
                          </span>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                              <input
                                ref={inlineInputRef}
                                type="number"
                                inputMode="numeric"
                                min="0"
                                value={inlineEditValue}
                                onChange={e => setInlineEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveInlineStock(med.id, inlineEditValue)
                                  if (e.key === 'Escape') setInlineEditId(null)
                                }}
                                style={{
                                  flex: 1, padding: '6px 10px',
                                  borderRadius: 8, border: '1.5px solid #0d6b63',
                                  fontSize: 13, outline: 'none',
                                  width: 80,
                                }}
                              />
                              <button
                                onClick={() => saveInlineStock(med.id, inlineEditValue)}
                                style={{
                                  padding: '6px 12px', borderRadius: 8,
                                  background: '#0d6b63', border: 'none',
                                  color: 'white', fontWeight: 700,
                                  fontSize: 12, cursor: 'pointer',
                                }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setInlineEditId(null)}
                                style={{
                                  padding: '6px 10px', borderRadius: 8,
                                  background: '#F3F4F6', border: 'none',
                                  color: '#6B7280', fontWeight: 700,
                                  fontSize: 12, cursor: 'pointer',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setInlineEditId(med.id)
                                setInlineEditValue(String(stock.pills_remaining))
                              }}
                              style={{
                                padding: '5px 10px', borderRadius: 8,
                                border: '1px solid #EDE5D8', background: '#FDFAF7',
                                color: '#374151', fontSize: 12, fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}
                            >
                              ✏️ {stock.pills_remaining} dosis — editar
                            </button>
                          )}
                        </div>

                        {/* Renovar / Ver stock */}
                        <button
                          onClick={() => setStockTabMed(med)}
                          style={{
                            width: '100%', padding: '10px',
                            borderRadius: 12, border: 'none',
                            background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
                            color: 'white', fontWeight: 700,
                            fontSize: 13, cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(13,107,99,0.25)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: 6,
                          }}
                        >
                          📦 Gestionar stock
                        </button>
                      </div>
                    )}

                    {/* Familiar/cuidador: solo ver */}
                    {!isAdmin && (
                      <button
                        onClick={() => setStockTabMed(med)}
                        style={{
                          width: '100%', padding: '8px',
                          borderRadius: 10, border: '1px solid #EDE5D8',
                          background: '#FDFAF7', color: '#0d6b63',
                          fontWeight: 600, fontSize: 12, cursor: 'pointer',
                          marginTop: 2,
                        }}
                      >
                        📦 Ver detalles de stock
                      </button>
                    )}
                  </>
                ) : (
                  /* No stock configured */
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8,
                  }}>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                      Stock no configurado
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => setStockTabMed(med)}
                        style={{
                          padding: '6px 14px', borderRadius: 10,
                          border: '1px solid #0d6b63', background: '#EBF3EE',
                          color: '#0d6b63', fontWeight: 700,
                          fontSize: 11, cursor: 'pointer',
                        }}
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
