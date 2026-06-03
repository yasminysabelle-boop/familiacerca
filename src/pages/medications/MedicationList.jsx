import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import { supabase } from '../../lib/supabase'
import { Pencil, Trash, Plus } from '../../components/Icons'
import { SkeletonMedCard } from '../../components/SkeletonLoader'
import EmptyState from '../../components/EmptyState'

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQ_LABELS = {
  once_daily:  'Una vez al día',
  twice_daily: 'Dos veces al día',
  three_daily: 'Tres veces al día',
  every_4h:    'Cada 4 horas',
  every_6h:    'Cada 6 horas',
  every_8h:    'Cada 8 horas',
  every_12h:   'Cada 12 horas',
  as_needed:   'Según necesidad',
  weekly:      'Semanal',
}

const WINDOW_LABELS = { 30: '30 min', 60: '1 hora', 120: '2 horas' }

function daysFromNow(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MedicationList() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [, setSearchParams] = useSearchParams()
  const [medications, setMedications] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)

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

  async function handleDelete(id) {
    await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    setMedications(prev => prev.filter(m => m.id !== id))
  }

  // Opens the edit form via URL param → MedicationTabs auto-switches to Hoy tab
  function openEdit(medId) {
    setSearchParams({ edit: medId })
  }

  function openAdd() {
    setSearchParams({ add: '1' })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            Todos los medicamentos
          </h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
            {loading ? '…' : `${medications.length} medicamento${medications.length !== 1 ? 's' : ''} registrado${medications.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(74,124,89,0.3)',
              flexShrink: 0,
            }}
            title="Agregar medicamento"
          >
            <Plus size={20} color="white" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => <SkeletonMedCard key={i} />)}
        </div>
      ) : medications.length === 0 ? (
        <EmptyState
          icon="💊"
          title="Sin medicamentos aún"
          description="Agrega los medicamentos del familiar para mantener un control preciso."
          actionLabel={isAdmin ? '+ Agregar medicamento' : undefined}
          onAction={isAdmin ? openAdd : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {medications.map(med => {
            const times = med.scheduled_times?.length
              ? med.scheduled_times
              : med.time ? [med.time] : []
            const stock = stockMap[med.id]
            const days  = stock ? daysFromNow(stock.estimated_end_date) : null
            const stockDot = stock
              ? (days == null ? '#9CA3AF' : days <= 3 ? '#DC2626' : days <= 7 ? '#D97706' : '#16A34A')
              : null

            return (
              <div
                key={med.id}
                style={{
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #EDE5D8',
                  borderLeft: `4px solid ${stockDot ?? '#4A7C59'}`,
                  padding: '14px 14px 14px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + stock dot */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    {stockDot && (
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        backgroundColor: stockDot, flexShrink: 0,
                      }} />
                    )}
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                      💊 {med.name}
                    </span>
                  </div>

                  {/* Dosis + frecuencia */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {med.dosage && (
                      <span style={{ fontSize: 12, color: '#6B7280' }}>{med.dosage}</span>
                    )}
                    {med.frequency && (
                      <span style={{
                        background: '#EBF3EE', color: '#4A7C59',
                        padding: '2px 8px', borderRadius: 6,
                        fontSize: 11, fontWeight: 600,
                      }}>
                        {FREQ_LABELS[med.frequency] ?? med.frequency}
                      </span>
                    )}
                  </div>

                  {/* Horarios */}
                  {times.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {times.map((t, i) => (
                        <span key={i} style={{
                          background: '#F0F8F4', color: '#2D6A4F',
                          padding: '2px 8px', borderRadius: 6,
                          fontSize: 11, fontWeight: 600,
                        }}>
                          ⏰ {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ventana de tiempo */}
                  {med.time_window_minutes && (
                    <span style={{
                      fontSize: 11, color: '#9CA3AF',
                    }}>
                      Ventana: {WINDOW_LABELS[med.time_window_minutes] ?? `${med.time_window_minutes} min`}
                    </span>
                  )}

                  {/* Notas */}
                  {med.notes && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0', lineHeight: 1.4 }}>
                      {med.notes}
                    </p>
                  )}

                  {/* Stock badge */}
                  {stock && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: stockDot,
                        background: days != null && days <= 3 ? '#FEF2F2'
                          : days != null && days <= 7 ? '#FFFBEB' : '#F0FDF4',
                        padding: '3px 8px', borderRadius: 20,
                        border: `1px solid ${stockDot}40`,
                      }}>
                        📦 {stock.pills_remaining} dosis
                        {days != null && ` · ${days <= 0 ? 'Agotado' : `${days}d`}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Admin actions */}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(med.id)}
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        border: '1px solid #EDE5D8', background: 'white',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Editar"
                    >
                      <Pencil size={14} color="#6B7280" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: med.id, name: med.name })}
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        border: '1px solid #FCA5A5', background: '#FEF2F2',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Eliminar"
                    >
                      <Trash size={14} color="#D63031" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null) }}
        >
          <div style={{
            background: 'white', borderRadius: 20, padding: '28px 24px',
            maxWidth: 340, width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700,
              color: '#1A1A1A', marginBottom: 6,
            }}>
              ¿Eliminar {confirmDelete.name}?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              Se eliminará el medicamento y todo su historial. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: '1.5px solid #EDE5D8', background: 'white',
                  color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { handleDelete(confirmDelete.id); setConfirmDelete(null) }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: 'none', background: '#D63031',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(214,48,49,0.3)',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
