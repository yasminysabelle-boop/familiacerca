import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { mapsUrl } from '../lib/gps'
import { CARE_ITEMS } from '../lib/careItems'
import { incidentTypeInfo } from '../lib/incidentTypes'
import { SkeletonEventCard } from '../components/SkeletonLoader'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import {
  ChevronLeft, ChevronRight, Pill, ClipboardCheck, ClipboardList, Hospital, Home,
  Stethoscope, Calendar, Siren, Receipt, Camera, User, AlertTriangle, CheckIcon,
  Bath, Tooth, Shirt, Utensils, Bed, Sparkle, Footsteps, Scissors, Lotus,
} from '../components/Icons'

// ── paleta del sistema (CLAUDE.md) ──────────────────────────────────────────
const TEAL             = '#087F70'
const TEAL_DEEP         = '#055C51'
const TEAL_CHIP         = '#EAF7F3'
const TEAL_INK          = '#08554A'
const CORAL_ACTION      = '#E9826E'
const CORAL_ACTION_INK  = '#8C3A2A'
const CORAL_EMERGENCY   = '#D9534F'
const PEACH             = '#FBEAE4'
const GOLD              = '#D99A18'
const GOLD_INK          = '#7A5510'
const INK               = '#334155'
const INK_2             = '#1E2C3A'
const INK_SOFT          = '#6B7A88'
const INK_FAINT         = '#94A0AD'
const HAIRLINE          = 'rgba(51,65,85,0.09)'
const SHADOW_CARD       = '0 6px 14px -8px #087F7022'
const SHADOW_CORAL      = '0 6px 14px -8px #E9826E44'
const GRADIENT_BRAND    = 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)'
const SERIF             = "'Fraunces', Georgia, serif"

// Tono de categoría — mismo lenguaje que los pills del Chat (teal/coral/gold/cool),
// coral-emergencia reservado solo para SOS (urgencia real).
const CAT = {
  teal:     { bg: TEAL_CHIP,               ink: TEAL_INK,          sel: TEAL },
  coral:    { bg: PEACH,                    ink: CORAL_ACTION_INK,  sel: CORAL_ACTION },
  gold:     { bg: 'rgba(217,154,24,0.15)',  ink: GOLD_INK,          sel: GOLD },
  goldSoft: { bg: 'rgba(217,154,24,0.08)',  ink: GOLD_INK,          sel: GOLD },
  cool:     { bg: 'rgba(168,229,214,0.32)', ink: TEAL_INK,          sel: TEAL_DEEP },
  sos:      { bg: 'rgba(217,83,64,0.14)',   ink: CORAL_EMERGENCY,   sel: CORAL_EMERGENCY },
}

// Íconos SVG por ítem de rutina — mismos keys que careItems.js (que sigue en emoji;
// este mapeo vive solo aquí, ver pendientes).
const ROUTINE_ICON = {
  bath: Bath, dental_morning: Tooth, dental_afternoon: Tooth, dental_night: Tooth,
  clothes: Shirt, breakfast: Utensils, lunch: Utensils, dinner: Utensils,
  bed_sheets: Bed, nail_trim: Sparkle, exercise: Footsteps, haircut: Scissors, home_therapy: Lotus,
}

// Metadatos por tipo de evento — reemplaza EVENT_CONFIG (emoji) del código anterior.
const TYPE_META = {
  med_confirmed:        { label: 'Medicamentos',      Icon: Pill,           cat: 'teal',     route: '/medications' },
  med_missed:            { label: 'Dosis omitidas',    Icon: Pill,           cat: 'coral',    route: '/medications' },
  care_routine:           { label: 'Rutinas',            Icon: ClipboardCheck, cat: 'teal',     route: '/cuidado' },
  care_routine_missed:   { label: 'Rutinas omitidas',   Icon: ClipboardCheck, cat: 'coral',    route: '/cuidado' },
  hospital_mode_on:      { label: 'Hospital',            Icon: Hospital,       cat: 'gold' },
  hospital_discharge:    { label: 'Alta hospitalaria',   Icon: Home,           cat: 'teal' },
  doctor_note:            { label: 'Notas',               Icon: Stethoscope,    cat: 'gold',     route: '/notas' },
  appointment:             { label: 'Citas',                Icon: Calendar,       cat: 'cool',     route: '/calendar' },
  caregiver_assigned:     { label: 'Turnos',              Icon: User,           cat: 'cool' },
  sos:                     { label: 'SOS',                  Icon: Siren,          cat: 'sos' },
  expense:                 { label: 'Gastos',               Icon: Receipt,        cat: 'gold',     route: '/gastos' },
  care_photo:             { label: 'Fotos',                Icon: Camera,         cat: 'goldSoft', route: '/album' },
  incident:                { label: 'Incidentes',           Icon: AlertTriangle,  cat: 'coral' },
}

// Los 13 tipos reales tienen su propio pill (+ "Todo") = 14.
const FILTER_OPTIONS = [
  'all', 'med_confirmed', 'med_missed', 'care_routine', 'care_routine_missed',
  'hospital_mode_on', 'hospital_discharge', 'doctor_note', 'appointment', 'sos',
  'expense', 'care_photo', 'caregiver_assigned', 'incident',
]

const PERIOD_OPTIONS = [
  { id: 'today',     label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7',         label: '7 días' },
  { id: '30',        label: '30 días' },
  { id: 'custom',    label: 'Fecha' },
]

const EVENT_ROUTES = Object.fromEntries(
  Object.entries(TYPE_META).filter(([, m]) => m.route).map(([type, m]) => [type, m.route])
)

function careItemLabel(key) {
  return CARE_ITEMS.find(i => i.key === key)?.label ?? key
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

// Evita mostrar la misma información dos veces (p.ej. dosis ya incluida en la
// descripción, o caption idéntico al título) — corrige la redundancia del diseño anterior.
function secondaryOnly(primary, secondary) {
  if (!secondary) return null
  if (primary && primary.toLowerCase().includes(secondary.toLowerCase())) return null
  return secondary
}

function eventTitle(event) {
  const meta = event.metadata ?? {}
  if (event.type === 'care_routine' || event.type === 'care_routine_missed') {
    return careItemLabel(event.description)
  }
  if (event.type === 'incident') {
    return incidentTypeInfo(event.description).label
  }
  if (event.type === 'med_confirmed' || event.type === 'med_missed') {
    const extra = secondaryOnly(event.description, meta.med_dosage)
    return extra ? `${event.description} · ${extra}` : event.description
  }
  return event.description
}

function eventIcon(event) {
  if (event.type === 'care_routine' || event.type === 'care_routine_missed') {
    return ROUTINE_ICON[event.metadata?.item_key] || ClipboardCheck
  }
  return TYPE_META[event.type]?.Icon || ClipboardList
}

// Placa de foto con carga real + respaldo elegante si la imagen falla.
function PhotoThumb({ url, tone }) {
  const [failed, setFailed] = useState(false)
  const gradient = tone === 'coral' ? 'linear-gradient(150deg,#F0977F,#C4664F)' : 'linear-gradient(150deg,#12A18C,#055C51)'
  if (!url || failed) {
    return (
      <div style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0, marginTop: 1, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Camera size={18} color="rgba(255,255,255,0.85)" strokeWidth={1.8} />
      </div>
    )
  }
  return (
    <img
      src={url} alt="" onError={() => setFailed(true)}
      style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0, marginTop: 1, objectFit: 'cover' }}
    />
  )
}

function eventPhotoUrl(event) {
  const meta = event.metadata ?? {}
  if (event.type === 'expense') return meta.receipt_photo_url
  if (event.type === 'care_photo') return meta.file_url
  return meta.photo_url
}

// Línea de detalle secundaria — una sola por tipo, sin repetir lo que ya dice el título.
function EventDetail({ event }) {
  const meta = event.metadata ?? {}
  const type = event.type

  if (type === 'incident' && meta.description) {
    return <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0', lineHeight: 1.45 }}>{meta.description}</p>
  }
  if (type === 'doctor_note') {
    const text = meta.doctor_notes ?? meta.content
    return text ? <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0', lineHeight: 1.45, fontStyle: 'italic' }}>&ldquo;{text}&rdquo;</p> : null
  }
  if (type === 'appointment') {
    const when = [meta.date, meta.time].filter(Boolean).join(' · ')
    const note = secondaryOnly(event.description, meta.description)
    return (when || note) ? (
      <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0', lineHeight: 1.45 }}>
        {when}{when && note ? ' · ' : ''}{note}
      </p>
    ) : null
  }
  if (type === 'hospital_mode_on') {
    const parts = [meta.hospital_name, meta.room_number ? `Hab. ${meta.room_number}` : null, meta.patient_status].filter(Boolean)
    return parts.length ? <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0' }}>{parts.join(' · ')}</p> : null
  }
  if (type === 'hospital_discharge') {
    const parts = [meta.hospital_name, meta.discharge_date].filter(Boolean)
    return parts.length ? <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0' }}>{parts.join(' · ')}</p> : null
  }
  if (type === 'caregiver_assigned' && meta.shift_date) {
    return <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0' }}>{meta.shift_date}</p>
  }
  if (type === 'sos') {
    return (
      <div style={{ marginTop: 4 }}>
        {meta.address && <p style={{ fontSize: 12, color: INK_SOFT, margin: 0 }}>{meta.address}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: meta.address ? 4 : 0 }}>
          {meta.latitude && meta.longitude && (
            <a href={mapsUrl(meta.latitude, meta.longitude)} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11.5, color: TEAL, textDecoration: 'none', fontWeight: 700 }}>
              Ver mapa →
            </a>
          )}
          {meta.resolved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 800, color: TEAL_DEEP }}>
              <CheckIcon size={11} color={TEAL_DEEP} strokeWidth={2.5} /> Resuelta
            </span>
          )}
        </div>
      </div>
    )
  }
  if (type === 'expense') {
    const parts = [meta.category, meta.paid_by ? `Pagó ${meta.paid_by}` : null].filter(Boolean)
    return parts.length ? <p style={{ fontSize: 11.5, color: INK_FAINT, margin: '3px 0 0' }}>{parts.join(' · ')}</p> : null
  }
  if (type === 'care_photo') {
    const caption = secondaryOnly(event.description, meta.caption)
    return caption ? <p style={{ fontSize: 12, color: INK_SOFT, margin: '4px 0 0', lineHeight: 1.4 }}>{caption}</p> : null
  }
  return null
}

const MISSED_TYPES = new Set(['med_missed', 'care_routine_missed'])

function EventCard({ event, onClick }) {
  const cat = CAT[TYPE_META[event.type]?.cat ?? 'teal']
  const Icon = eventIcon(event)
  const title = eventTitle(event)
  const isMissed = MISSED_TYPES.has(event.type)
  const isIncident = event.type === 'incident'
  const photoUrl = eventPhotoUrl(event)
  const metaLine = event.actor_name ? `${event.actor_name.split(' ')[0]} · ${fmtTime(event.created_at)}` : fmtTime(event.created_at)

  return (
    <div
      onClick={onClick}
      style={{
        background: isIncident ? PEACH : 'white',
        border: isIncident ? `1px solid ${CORAL_ACTION}` : '1px solid transparent',
        borderRadius: 16, padding: '11px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 11,
        boxShadow: isIncident ? 'none' : (isMissed || event.type === 'sos') ? SHADOW_CORAL : SHADOW_CARD,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{
        width: 37, height: 37, borderRadius: 12, flexShrink: 0, marginTop: 1,
        background: isIncident ? 'rgba(255,255,255,0.55)' : cat.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} color={cat.ink} strokeWidth={1.8} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <p style={{
            fontSize: 14, fontWeight: 700, color: INK_2, margin: 0, lineHeight: 1.3, flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {title}
          </p>
          {event.type === 'expense' && event.metadata?.amount != null && (
            <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: GOLD_INK, fontVariantNumeric: 'tabular-nums' }}>
              {fmtCurrency(event.metadata.amount)}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: INK_SOFT, fontWeight: 600, margin: '3px 0 0' }}>{metaLine}</p>
        <EventDetail event={event} />
        {isMissed && (
          <span style={{
            display: 'inline-flex', marginTop: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
            padding: '2px 9px', borderRadius: 999, background: PEACH, color: CORAL_ACTION_INK, width: 'fit-content',
          }}>
            Omitida
          </span>
        )}
      </div>

      {photoUrl && <PhotoThumb url={photoUrl} tone={isMissed || isIncident ? 'coral' : 'teal'} />}
      {onClick && (
        <span style={{ flexShrink: 0, marginTop: 9, color: INK_FAINT }}>
          <ChevronRight size={14} color={INK_FAINT} strokeWidth={2.3} />
        </span>
      )}
    </div>
  )
}

// Marca de agua — mismo asset del CareCard (corazón + 2 figuras). El corazón va
// en teal a opacidad baja; las 2 figuras van "caladas" en el color del fondo real
// (fill sólido, sin atenuar) para que el logo se lea completo — a esta opacidad,
// un simple tono-sobre-tono entre el corazón y las figuras se perdía por completo.
// Nunca detrás de texto: las tarjetas tienen fondo opaco, así que solo asoma en
// el espacio abierto alrededor de ellas.
function WatermarkHeart({ heartOpacity, cutout, width = 230, height = 230, style }) {
  return (
    <svg
      width={width} height={height} viewBox="0 0 100 100"
      style={{ position: 'absolute', pointerEvents: 'none', ...style }}
      aria-hidden="true"
    >
      <path
        d="M50 88C22 68 8 54 8 34 8 22 17 13 29 13c8 0 15 5 21 13 6-8 13-13 21-13 12 0 21 9 21 21 0 20-14 34-42 54Z"
        fill={TEAL} fillOpacity={heartOpacity}
      />
      <circle cx="40" cy="40" r="7" fill={cutout} /><path d="M28 62c0-8 5-13 12-13s12 5 12 13Z" fill={cutout} />
      <circle cx="60" cy="45" r="5.5" fill={cutout} /><path d="M50 62c0-7 4-11 10-11s10 4 10 11Z" fill={cutout} />
    </svg>
  )
}

function toLocalDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MedicationTimeline() {
  const { ownerId, activePatientName, profile } = useFamily()
  const navigate = useNavigate()
  const patientFirstName = (activePatientName || profile?.name || 'tu familiar').split(' ')[0]
  const todayKey = toLocalDateKey()
  const { containerRef: pullRef, onTouchStart: pullStart, onTouchMove: pullMove, onTouchEnd: pullEnd, PullIndicator } = usePullToRefresh(fetchLog)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState('')
  const [expandedDays, setExpandedDays] = useState(new Set([toLocalDateKey()]))

  useEffect(() => {
    if (ownerId) fetchLog()
  }, [ownerId, filterType, period, customDate])

  async function fetchLog() {
    if (period === 'custom' && !customDate) {
      setEvents([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const now = new Date()
      let since, until = null

      if (period === 'custom') {
        since = new Date(customDate + 'T00:00:00')
        until = new Date(customDate + 'T23:59:59.999')
      } else if (period === 'today') {
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

  // Agrupa por día (YYYY-MM-DD local)
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F8F4ED' }}>

        {/* Header propio */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px 13px', borderBottom: `1px solid ${HAIRLINE}`,
          flexShrink: 0, background: '#F8F4ED',
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: 'white', boxShadow: SHADOW_CARD,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ChevronLeft size={17} color={INK} strokeWidth={2.3} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>
              Historia de cuidado
            </h1>
            <p style={{ margin: '2px 0 0', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 14, color: TEAL }}>
              Cuidando a {patientFirstName}
            </p>
          </div>
        </header>

        <div
          ref={pullRef}
          onTouchStart={pullStart}
          onTouchMove={pullMove}
          onTouchEnd={pullEnd}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 96px', maxWidth: 600 }}
        >
          <PullIndicator />

          {/* Filtro por tipo — horizontal scroll, color por categoría */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10,
            scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
          }}>
            {FILTER_OPTIONS.map(id => {
              const meta = id === 'all' ? null : TYPE_META[id]
              const cat = meta ? CAT[meta.cat] : null
              const selected = filterType === id
              const label = id === 'all' ? 'Todo' : meta.label
              const Icon = id === 'all' ? ClipboardList : meta.Icon
              const iconColor = selected ? '#fff' : (cat ? cat.ink : INK_SOFT)
              return (
                <button
                  key={id}
                  onClick={() => setFilterType(id)}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 13px', borderRadius: 999, border: 'none',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                    background: selected ? (cat ? cat.sel : GRADIENT_BRAND) : (cat ? cat.bg : 'white'),
                    color: selected ? '#fff' : (cat ? cat.ink : INK_SOFT),
                    boxShadow: selected ? '0 6px 14px -8px rgba(5,92,81,0.45)' : (cat ? 'none' : SHADOW_CARD),
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={14} color={iconColor} strokeWidth={2} />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Filtros de período */}
          <div style={{ display: 'flex', gap: 6, marginBottom: period === 'custom' ? 10 : 18 }}>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 999, border: 'none',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  background: period === opt.id ? GRADIENT_BRAND : 'white',
                  color: period === opt.id ? '#fff' : INK_SOFT,
                  boxShadow: period === opt.id ? '0 8px 16px -8px #087F7066' : SHADOW_CARD,
                  transition: 'all 0.2s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Selector de fecha — solo visible con período "custom" */}
          {period === 'custom' && (
            <div style={{ marginBottom: 18 }}>
              <input
                type="date"
                value={customDate}
                max={todayKey}
                onChange={e => setCustomDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: 12, border: `1.5px solid ${HAIRLINE}`,
                  fontSize: 14, fontWeight: 600, color: customDate ? INK : INK_FAINT,
                  background: 'white', boxSizing: 'border-box',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              {!customDate && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: INK_FAINT, textAlign: 'center' }}>
                  Elige un día para ver su actividad
                </p>
              )}
            </div>
          )}

          {/* Contenido */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 18, border: `1px solid ${HAIRLINE}`, overflow: 'hidden', boxShadow: SHADOW_CARD }}>
                  <div style={{ padding: '13px 16px', background: '#FDFAF7', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 80, height: 13, borderRadius: 6, background: '#E5E0D8', animation: 'skeletonShimmer 1.4s ease-in-out infinite' }} />
                    <div style={{ flex: 1 }} />
                    <div style={{ width: 50, height: 11, borderRadius: 10, background: '#E5E0D8', animation: 'skeletonShimmer 1.4s ease-in-out infinite' }} />
                  </div>
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...Array(2)].map((_, j) => <SkeletonEventCard key={j} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ background: PEACH, border: `1px solid ${CORAL_ACTION}`, borderRadius: 18, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: CORAL_ACTION_INK, marginBottom: 12 }}>{error}</p>
              <button
                onClick={fetchLog}
                style={{
                  padding: '10px 24px', borderRadius: 12, border: 'none',
                  background: GRADIENT_BRAND, color: 'white', fontWeight: 700,
                  fontSize: 13, cursor: 'pointer', boxShadow: '0 8px 16px -8px #087F7066',
                }}
              >
                Reintentar
              </button>
            </div>
          ) : days.length === 0 ? (
            <div style={{ position: 'relative', background: 'white', borderRadius: 20, padding: '48px 24px', textAlign: 'center', boxShadow: SHADOW_CARD, overflow: 'hidden' }}>
              <WatermarkHeart
                heartOpacity={0.08} cutout="white" width={190} height={190}
                style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px',
                  background: TEAL_CHIP, color: TEAL_INK,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ClipboardList size={24} color={TEAL_INK} strokeWidth={1.8} />
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 800, color: INK_2 }}>Sin eventos</p>
                <p style={{ margin: 0, fontSize: 12.5, color: INK_FAINT, lineHeight: 1.5, maxWidth: 260, marginInline: 'auto' }}>
                  {filterType !== 'all'
                    ? 'No hay eventos de este tipo en este período.'
                    : 'No hay actividad registrada en este período. Las acciones del equipo aparecerán aquí.'}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Ancorada al final de la lista, mayormente en el espacio abierto bajo
                  la última tarjeta — detrás de tarjetas opacas casi no se percibía. */}
              <WatermarkHeart heartOpacity={0.045} cutout="#F8F4ED" width={220} height={220} style={{ right: -36, bottom: -140 }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {days.map(([dateKey, dayEvents]) => {
                  const isExpanded = expandedDays.has(dateKey)
                  const isToday = dateKey === todayKey
                  function toggleDay() {
                    setExpandedDays(prev => {
                      const next = new Set(prev)
                      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey)
                      return next
                    })
                  }
                  return (
                    <div key={dateKey} style={{
                      background: 'white', borderRadius: 18,
                      border: `1px solid ${isToday ? 'rgba(8,127,112,0.18)' : HAIRLINE}`,
                      overflow: 'hidden', boxShadow: SHADOW_CARD,
                    }}>
                      <button
                        onClick={toggleDay}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '13px 16px',
                          background: isToday ? `linear-gradient(135deg, ${TEAL_CHIP} 0%, #F8F4ED 75%)` : '#F8F4ED',
                          border: 'none', cursor: 'pointer',
                          borderBottom: isExpanded ? `1px solid ${isToday ? 'rgba(8,127,112,0.12)' : HAIRLINE}` : 'none',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <p style={{ fontSize: 13.5, fontWeight: 800, color: INK_2, margin: 0 }}>
                            {dayLabel(dateKey)}
                            {isToday && (
                              <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: TEAL_DEEP, background: 'rgba(8,127,112,0.12)', padding: '2px 8px', borderRadius: 6 }}>
                                Hoy
                              </span>
                            )}
                          </p>
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: INK_SOFT, background: HAIRLINE, padding: '3px 9px', borderRadius: 10, flexShrink: 0 }}>
                          {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{
                          flexShrink: 0, color: INK_SOFT, display: 'flex',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.22s ease',
                        }}>
                          <ChevronRight size={15} color={INK_SOFT} strokeWidth={2.2} />
                        </span>
                      </button>

                      <div style={{
                        display: 'grid',
                        gridTemplateRows: isExpanded ? '1fr' : '0fr',
                        transition: 'grid-template-rows 0.28s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{
                            padding: isExpanded ? '10px' : '0 10px',
                            display: 'flex', flexDirection: 'column', gap: 8,
                            opacity: isExpanded ? 1 : 0,
                            transition: isExpanded ? 'opacity 0.2s ease 0.08s' : 'opacity 0.1s ease',
                          }}>
                            {dayEvents.map(evt => (
                              <EventCard
                                key={evt.id}
                                event={evt}
                                onClick={EVENT_ROUTES[evt.type] ? () => navigate(EVENT_ROUTES[evt.type]) : undefined}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
