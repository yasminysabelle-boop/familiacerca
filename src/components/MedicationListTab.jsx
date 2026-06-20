import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import { Pencil, Trash, Plus } from './Icons'
import EmptyState from './EmptyState'

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

export default function MedicationListTab({
  medications = [],
  stockByMedId = {},
  isAdmin = false,
  onEditMed,
  onDeleteMed,
}) {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function handleDelete(id) {
    if (onDeleteMed) {
      await onDeleteMed(id)
    } else {
      await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    }
  }

  if (medications.length === 0) {
    return (
      <div style={{ padding: '16px 0 96px' }}>
        <EmptyState
          icon="💊"
          title="Sin medicamentos aún"
          description="Agrega medicamentos desde el botón + en la pantalla."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0 96px' }}>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12, paddingLeft: 2 }}>
        {medications.length} medicamento{medications.length !== 1 ? 's' : ''} registrado{medications.length !== 1 ? 's' : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {medications.map(med => {
          const times = med.scheduled_times?.length
            ? med.scheduled_times
            : med.time ? [med.time] : []
          const stock = stockByMedId[med.id]
          const days  = stock ? daysFromNow(stock.estimated_end_date) : null
          const stockDotColor = stock
            ? (days == null ? '#9CA3AF' : days <= 3 ? '#DC2626' : days <= 7 ? '#D97706' : '#16A34A')
            : null

          return (
            <div
              key={med.id}
              style={{
                background: 'white',
                borderRadius: 16,
                border: '1px solid #EDE5D8',
                borderLeft: `4px solid ${stockDotColor ?? '#0d6b63'}`,
                padding: '14px 14px 14px 16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  {stockDotColor && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: stockDotColor, flexShrink: 0, display: 'inline-block',
                    }} />
                  )}
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    💊 {med.name}
                  </span>
                </div>

                {/* Dosis + frecuencia */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                  {med.dosage && (
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{med.dosage}</span>
                  )}
                  {med.frequency && (
                    <span style={{
                      background: '#EBF3EE', color: '#0d6b63',
                      padding: '2px 8px', borderRadius: 6,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {FREQ_LABELS[med.frequency] ?? med.frequency}
                    </span>
                  )}
                </div>

                {/* Horarios */}
                {times.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
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

                {/* Ventana + notas */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {med.time_window_minutes && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Ventana: {WINDOW_LABELS[med.time_window_minutes] ?? `${med.time_window_minutes} min`}
                    </span>
                  )}
                  {stock && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: stockDotColor,
                      background: days != null && days <= 3 ? '#FEF2F2'
                        : days != null && days <= 7 ? '#FFFBEB' : '#F0FDF4',
                      padding: '2px 8px', borderRadius: 20,
                      border: `1px solid ${stockDotColor}30`,
                    }}>
                      📦 {stock.pills_remaining} dosis
                      {days != null && ` · ${days <= 0 ? 'Agotado' : `${days}d`}`}
                    </span>
                  )}
                </div>

                {med.notes && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0', lineHeight: 1.4 }}>
                    {med.notes}
                  </p>
                )}
              </div>

              {/* Admin: edit + delete */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
                  <button
                    onClick={() => onEditMed && onEditMed(med)}
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

      {/* Confirm delete */}
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
              color: '#1A1A1A', marginBottom: 8,
            }}>
              ¿Eliminar {confirmDelete.name}?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              Se borrará el medicamento y su historial. Esta acción no se puede deshacer.
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
