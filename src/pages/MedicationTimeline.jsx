import { useEffect, useState } from 'react'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { mapsUrl } from '../lib/gps'
import { CARE_ITEMS } from '../lib/careItems'

const EVENT_CONFIG = {
  med_confirmed:      { icon: '💊', label: 'Medicamento',        color: '#4A7C59', bg: '#F0FDF4', border: '#BBF7D0' },
  hospital_mode_on:   { icon: '🏥', label: 'Hospitalización',    color: '#B91C1C', bg: '#FFF5F5', border: '#FECACA' },
  hospital_discharge: { icon: '🏠', label: 'Alta hospitalaria',  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  doctor_note:        { icon: '📋', label: 'Nota médica',        color: '#7C5CBF', bg: '#F5F3FF', border: '#DDD6FE' },
  appointment:        { icon: '📅', label: 'Cita médica',        color: '#2D86A0', bg: '#F0F9FF', border: '#BAE6FD' },
  caregiver_assigned: { icon: '👤', label: 'Turno asignado',     color: '#C9882A', bg: '#FFFBEB', border: '#FDE68A' },
  sos:                { icon: '🆘', label: 'Alerta SOS',         color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  expense:            { icon: '💰', label: 'Gasto registrado',   color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  care_routine:       { icon: '✅', label: 'Rutina completada',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  care_photo:         { icon: '📸', label: 'Foto de cuidado',    color: '#C9882A', bg: '#FFFBEB', border: '#FDE68A' },
}

const FILTER_OPTIONS = [
  { id: 'all',               label: 'Todo',          icon: '📖' },
  { id: 'med_confirmed',     label: 'Medicamentos',  icon: '💊' },
  { id: 'care_routine',      label: 'Rutinas',       icon: '✅' },
  { id: 'hospital_mode_on',  label: 'Hospital',      icon: '🏥' },
  { id: 'doctor_note',       label: 'Notas',         icon: '📋' },
  { id: 'appointment',       label: 'Citas',         icon: '📅' },
  { id: 'sos',               label: 'SOS',           icon: '🆘' },
  { id: 'expense',           label: 'Gastos',        icon: '💰' },
  { id: 'care_photo',        label: 'Fotos',         icon: '📸' },
  { id: 'caregiver_assigned',label: 'Turnos',        icon: '👤' },
]

const PERIOD_OPTIONS = [
  { id: 'today',     label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7',         label: '7 días' },
  { id: '30',        label: '30 días' },
]

function careItemLabel(key) {
  return CARE_ITEMS.find(i => i.key === key)?.label ?? key
}
function careItemIcon(key) {
  return CARE_ITEMS.find(i => i.key === key)?.icon ?? '✅'
}

function fmtTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'
  const raw = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function EventMetadata({ type, meta }) {
  if (!meta) return null

  if (type === 'med_confirmed') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>
        {meta.med_dosage && (
          <span style={{ fontSize: 11, color: '#6B7280' }}>{meta.med_dosage}</span>
        )}
        {meta.log_date && (
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>📅 {meta.log_date}</span>
        )}
        {meta.photo_url && (
          <img
            src={meta.photo_url}
            alt="Prueba"
            style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, border: '1px solid #BBF7D0' }}
          />
        )}
      </div>
    )
  }

  if (type === 'care_routine') {
    return (
      <p style={{ fontSize: 12, color: '#4A7C59', fontWeight: 600, margin: '4px 0 0' }}>
        {careItemIcon(meta.item_key)} {careItemLabel(meta.item_key)}
        {meta.log_date ? <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · {meta.log_date}</span> : null}
      </p>
    )
  }

  if (type === 'hospital_mode_on') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
        {meta.hospital_name && <span style={{ fontSize: 11, color: '#6B7280' }}>🏥 {meta.hospital_name}</span>}
        {meta.room_number   && <span style={{ fontSize: 11, color: '#6B7280' }}>🚪 Hab. {meta.room_number}</span>}
        {meta.patient_status && <span style={{ fontSize: 11, color: '#6B7280' }}>Estado: {meta.patient_status}</span>}
      </div>
    )
  }

  if (type === 'hospital_discharge') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
        {meta.hospital_name  && <span style={{ fontSize: 11, color: '#6B7280' }}>🏥 {meta.hospital_name}</span>}
        {meta.discharge_date && <span style={{ fontSize: 11, color: '#6B7280' }}>📅 Alta: {meta.discharge_date}</span>}
      </div>
    )
  }

  if (type === 'doctor_note') {
    const text = meta.doctor_notes ?? meta.content
    return text ? (
      <p style={{
        fontSize: 12, color: '#374151', margin: '6px 0 0',
        background: '#F5F3FF', borderRadius: 8, padding: '8px 10px',
        lineHeight: 1.5, fontStyle: 'italic',
      }}>
        "{text}"
      </p>
    ) : null
  }

  if (type === 'appointment') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
        {meta.date && <span style={{ fontSize: 11, color: '#6B7280' }}>📅 {meta.date}</span>}
        {meta.time && <span style={{ fontSize: 11, color: '#6B7280' }}>⏰ {meta.time}</span>}
        {meta.description && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{meta.description}</span>}
      </div>
    )
  }

  if (type === 'caregiver_assigned') {
    return (
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
        📅 {meta.shift_date}
      </p>
    )
  }

  if (type === 'sos') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
        {meta.address && <span style={{ fontSize: 11, color: '#6B7280' }}>📍 {meta.address}</span>}
        {meta.latitude && meta.longitude && (
          <a
            href={mapsUrl(meta.latitude, meta.longitude)}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}
          >
            Ver mapa →
          </a>
        )}
        {meta.resolved && (
          <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Resuelta</span>
        )}
      </div>
    )
  }

  if (type === 'expense') {
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {meta.amount   && <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{fmtCurrency(meta.amount)}</span>}
          {meta.category && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{meta.category}</span>}
          {meta.paid_by  && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Pagó: {meta.paid_by}</span>}
        </div>
        {meta.receipt_photo_url && (
          <img
            src={meta.receipt_photo_url}
            alt="Recibo"
            style={{ marginTop: 8, width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #A7F3D0' }}
          />
        )}
      </div>
    )
  }

  if (type === 'care_photo') {
    return (
      <div style={{ marginTop: 6 }}>
        {meta.caption && (
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 6px' }}>{meta.caption}</p>
        )}
        {meta.file_url && (
          <img
            src={meta.file_url}
            alt={meta.caption ?? 'Foto'}
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid #FDE68A' }}
          />
        )}
      </div>
    )
  }

  return null
}

function EventCard({ event }) {
  const cfg = EVENT_CONFIG[event.type] ?? { icon: '📌', label: event.type, color: '#6B7280', bg: 'white', border: '#EDE5D8' }
  const time = fmtTime(event.created_at)

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 16,
      padding: '13px 15px',
      display: 'flex',
      gap: 12,
    }}>
      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: cfg.color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Type badge + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: cfg.color,
            background: cfg.color + '18',
            padding: '2px 7px', borderRadius: 5,
            letterSpacing: '0.03em',
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', flexShrink: 0 }}>
            {time}
          </span>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 14, fontWeight: 600, color: '#1A1A1A',
          margin: 0, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {event.type === 'care_routine'
            ? `${careItemIcon(event.description)} ${careItemLabel(event.description)}`
            : event.description}
        </p>

        {/* Actor */}
        {event.actor_name && (
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0' }}>
            por {event.actor_name.split(' ')[0]}
          </p>
        )}

        {/* Type-specific metadata */}
        <EventMetadata type={event.type} meta={event.metadata} />
      </div>
    </div>
  )
}

export default function MedicationTimeline() {
  const { ownerId } = useFamily()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [period, setPeriod] = useState('today')

  useEffect(() => {
    if (ownerId) fetchLog()
  }, [ownerId, filterType, period])

  async function fetchLog() {
    setLoading(true)
    setError('')
    try {
      const now = new Date()
      let since, until = null

      if (period === 'today') {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (period === 'yesterday') {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        since = y
        until = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else {
        since = new Date()
        since.setDate(since.getDate() - parseInt(period))
      }

      let q = supabase
        .from('activity_log')
        .select('*')
        .eq('owner_id', ownerId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(300)

      if (filterType !== 'all') q = q.eq('type', filterType)
      if (until) q = q.lt('created_at', until.toISOString())

      const { data, error: err } = await q
      if (err) throw err
      setEvents(data ?? [])
    } catch (e) {
      setError('No se pudo cargar el historial.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Group events by date (YYYY-MM-DD in local timezone)
  const grouped = {}
  for (const evt of events) {
    const d = new Date(evt.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(evt)
  }
  const days = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <Layout>
      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Type filter — horizontal scroll */}
        <div style={{
          display: 'flex', gap: 6,
          overflowX: 'auto', paddingBottom: 4,
          marginBottom: 12,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 20, border: 'none',
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: filterType === opt.id ? '#2D4A1E' : '#F3F4F6',
                color: filterType === opt.id ? 'white' : '#6B7280',
                boxShadow: filterType === opt.id ? '0 2px 8px rgba(45,74,30,0.25)' : 'none',
              }}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {/* Filtros de período */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              style={{
                flex: 1, padding: '9px 0',
                borderRadius: 20, border: 'none',
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: period === opt.id ? '#2D4A1E' : '#F3F4F6',
                color: period === opt.id ? 'white' : '#6B7280',
                boxShadow: period === opt.id ? '0 2px 8px rgba(45,74,30,0.25)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 56 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#4A7C59',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : error ? (
          <div style={{
            background: '#FFF0F0', border: '1px solid #FFBABA',
            borderRadius: 16, padding: '24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: '#D63031', marginBottom: 12 }}>{error}</p>
            <button
              onClick={fetchLog}
              style={{
                padding: '10px 24px', borderRadius: 12, border: 'none',
                background: '#4A7C59', color: 'white', fontWeight: 700,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        ) : days.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
            padding: '56px 24px', textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📖</div>
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700,
              color: '#1A1A1A', marginBottom: 8,
            }}>
              Sin actividad registrada
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
              {filterType !== 'all'
                ? 'No hay eventos de este tipo en el período seleccionado.'
                : 'Los eventos aparecerán aquí a medida que el equipo registre actividad.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {days.map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                {/* Day header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                }}>
                  <p style={{
                    fontSize: 12, fontWeight: 700, color: '#6B7280',
                    textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
                  }}>
                    {dayLabel(dateKey)}
                  </p>
                  <div style={{ flex: 1, height: 1, background: '#EDE5D8' }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                    background: '#F3F4F6', padding: '2px 8px', borderRadius: 10,
                  }}>
                    {dayEvents.length}
                  </span>
                </div>

                {/* Events for this day */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayEvents.map(evt => (
                    <EventCard key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
