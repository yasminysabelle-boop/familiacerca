import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams, useNavigate as useNav } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import CareCard from '../components/CareCard'
import { SkeletonDashSummary, SkeletonCard } from '../components/SkeletonLoader'
import SuccessAnimation, { useSuccessAnimation } from '../components/SuccessAnimation'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { AlertTriangle, CheckIcon, User, XIcon, Pill, ClipboardCheck, Chat, Calendar, Receipt, Users, Camera, Clock, MessageCircle, Video, Hospital, Building2, Heart, Bell, ChevronRight, Siren, Zap } from '../components/Icons'
import { geminiGenerate } from '../lib/gemini'
import { getActivitySummary } from '../lib/activitySummary'
import { CARE_ITEMS } from '../lib/careItems'
import { incidentPhrase, incidentTypeInfo } from '../lib/incidentTypes'
import { submitAppointmentProof as saveAppointmentProof } from '../lib/appointmentProof'
import CameraCapture from '../components/CameraCapture'
import TrialBanner from '../components/TrialBanner'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useHospitalMode } from '../contexts/HospitalModeContext'
import HospitalDashboard from '../components/hospital/HospitalDashboard'
import { generateMedicalReport, fetchReportData } from '../utils/generateMedicalReport'
import HospitalModeModal from '../components/hospital/HospitalModeModal'
import CompanionChat from '../components/CompanionChat'
import VideoCallScheduleModal from '../components/VideoCallScheduleModal'
import { getLocation, mapsUrl } from '../lib/gps'
import { track } from '../lib/analytics'

// Mood lookup — handles both stored text values and emoji values
const MOOD_MAP = {
  good:    { emoji: '😊', color: '#22C55E' },
  regular: { emoji: '😐', color: '#C9882A' },
  hard:    { emoji: '😔', color: '#D63031' },
  '😊':   { emoji: '😊', color: '#22C55E' },
  '😐':   { emoji: '😐', color: '#C9882A' },
  '😔':   { emoji: '😔', color: '#D63031' },
}

function getMoodEmoji(val) { return MOOD_MAP[val]?.emoji ?? '🎙️' }
function getMoodColor(val) { return MOOD_MAP[val]?.color ?? '#7C5CBF' }

const MOOD_OPTIONS = [
  { mood: 'good',    emoji: '😊', label: 'Buen día', bg: '#FEF3C7',               border: '#E58B73',                   shadow: '0 3px 0px #E58B73' },
  { mood: 'regular', emoji: '😐', label: 'Regular',  bg: 'rgba(255,255,255,0.18)', border: 'rgba(255,255,255,0.3)',     shadow: '0 3px 0px rgba(255,255,255,0.15)' },
  { mood: 'hard',    emoji: '😔', label: 'Difícil',  bg: 'rgba(239,68,68,0.2)',   border: 'rgba(239,68,68,0.45)',      shadow: '0 3px 0px rgba(239,68,68,0.3)' },
]
const MOOD_FEEDBACK = {
  good: '¡Qué bueno saberlo!', '😊': '¡Qué bueno saberlo!',
  regular: 'Gracias por avisar', '😐': 'Gracias por avisar',
  hard: 'Estamos aquí contigo', '😔': 'Estamos aquí contigo',
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function fmtTimestamp(date) {
  if (!date) return ''
  return date.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function calcularEstadoMedicamento(scheduledTime, isConfirmed = false) {
  if (isConfirmed) return 'completado'
  if (!scheduledTime) return 'pendiente'
  const parts = scheduledTime.split(':')
  const h = Math.min(Math.max(parseInt(parts[0], 10) || 0, 0), 23)
  const m = Math.min(Math.max(parseInt(parts[1], 10) || 0, 0), 59)
  const now = new Date()
  const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
  if (diff < 0)   return 'programado'
  if (diff < 30)  return 'pendiente'
  return 'tarde'
}

function minutesAgo(timeStr, todayKey) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const scheduled = new Date(`${todayKey}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  const diff = Math.floor((Date.now() - scheduled) / 60000)
  if (diff <= 0) return null
  if (diff < 60) return `hace ${diff} min`
  const hrs = Math.floor(diff / 60)
  return `hace ${hrs} hora${hrs !== 1 ? 's' : ''}`
}

function dateLabelFor(dateKey, todayKey, yesterdayKey) {
  if (dateKey === todayKey) return 'Hoy'
  if (dateKey === yesterdayKey) return 'Ayer'
  const d = new Date(dateKey + 'T12:00:00')
  const raw = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// Returns YYYY-MM-DD in the browser's local timezone — avoids UTC midnight
// rollover where toISOString() can return the wrong date for UTC-offset locales.
function toLocalDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeAgo(date) {
  if (!date) return null
  const diff = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diff < 1) return 'ahora mismo'
  if (diff < 60) return `hace ${diff} min`
  const hrs = Math.floor(diff / 60)
  if (hrs < 24) return `hace ${hrs}h`
  if (hrs < 48) return 'ayer'
  return `hace ${Math.floor(hrs / 24)} días`
}

function formatNotified(names) {
  if (!names.length) return 'Tu equipo fue notificado'
  if (names.length === 1) return `Notificado: ${names[0]}`
  return `Notificados: ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

function sortSection(events) {
  return [...events].sort((a, b) => {
    if (a.type === 'MED_PENDING' && b.type !== 'MED_PENDING') return -1
    if (b.type === 'MED_PENDING' && a.type !== 'MED_PENDING') return 1
    return b.timestamp - a.timestamp
  })
}

// ── Card components ───────────────────────────────────────────────────────────

function PendingCard({ evt, confirming, onConfirm, todayKey, isFamiliar }) {
  const busy = confirming === evt.medicationId
  const ago = minutesAgo(evt.medTime, todayKey)
  const medLabel = [evt.medName, evt.medDosage].filter(Boolean).join(' ')
  return (
    <div style={{
      background: '#FFFBEB', borderRadius: 16,
      border: '1.5px solid #FDE68A',
      padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(13,107,99,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#7A5A18', margin: 0, lineHeight: 1.4 }}>
            {medLabel} pendiente
            {ago && <span style={{ fontWeight: 400, color: '#A07020' }}> — {ago}</span>}
          </p>
          {evt.medTime && (
            <p style={{ fontSize: 11, color: '#A07020', marginTop: 2 }}>
              Programado a las {fmtTime(evt.medTime)}
            </p>
          )}
        </div>
      </div>
      {!isFamiliar && (
        <button
          onClick={() => onConfirm(evt)}
          disabled={busy}
          style={{
            marginTop: 10, width: '100%', padding: '9px 0',
            background: busy ? '#C0CCC5' : 'linear-gradient(135deg, #22C55E, #16A34A)',
            color: 'white', fontWeight: 700, fontSize: 13,
            borderRadius: 10, border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.2s',
          }}
        >
          {busy ? 'Guardando...' : (
            <>
              <CheckIcon size={14} color="white" strokeWidth={2.5} />
              Marcar como dado
            </>
          )}
        </button>
      )}
    </div>
  )
}

function MissedCard({ evt }) {
  const medLabel = [evt.medName, evt.medDosage].filter(Boolean).join(' ')
  return (
    <div style={{
      background: '#FFF5F5', borderRadius: 16,
      border: '1px solid #FECACA', padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#D63031', margin: 0 }}>
          {medLabel} — no se dio
        </p>
        {evt.medTime && (
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            Programado a las {fmtTime(evt.medTime)}
          </p>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#D63031', background: '#FFF0F0', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>
        No dado
      </span>
    </div>
  )
}

function ConfirmedCard({ evt, onTap }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  const name = evt.confirmedBy ? evt.confirmedBy.split(' ')[0] : null
  const medLabel = [evt.medName, evt.medDosage].filter(Boolean).join(' ')
  return (
    <div onClick={onTap} style={{ background: '#F0FDF4', borderRadius: 16, border: '1px solid #BBF7D0', padding: '12px 14px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💊</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', margin: 0, lineHeight: 1.4 }}>
            {time && <span style={{ fontWeight: 400, color: '#4B7A5D' }}>{time} — </span>}
            {name ? `${name} dio ${medLabel}` : medLabel}
          </p>
          {evt.latitude && (
            <a href={mapsUrl(evt.latitude, evt.longitude)} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, textDecoration: 'none' }}>
              <span style={{ fontSize: 11 }}>📍</span>
              <span style={{ fontSize: 11, color: '#3B82F6' }}>{evt.address ?? 'Ver ubicación'}</span>
            </a>
          )}
        </div>
        <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
      </div>
    </div>
  )
}

const REACTION_EMOJIS = ['❤️', '👍', '🙏', '😢']

function ReactionBar({ eventKey, reactions, userId, onToggle }) {
  const myReactions = new Set(reactions?.filter(r => r.user_id === userId).map(r => r.emoji) ?? [])
  const counts = {}
  for (const r of (reactions ?? [])) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1

  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
      {REACTION_EMOJIS.map(emoji => {
        const count = counts[emoji] ?? 0
        const mine = myReactions.has(emoji)
        return (
          <button key={emoji} onClick={() => onToggle(eventKey, emoji)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 20,
              background: mine ? '#EBF3EE' : '#F3F4F6',
              border: mine ? '1px solid #0d6b63' : '1px solid #E5E7EB',
              cursor: 'pointer', fontSize: 13, lineHeight: 1,
              transition: 'all 0.15s',
            }}>
            <span>{emoji}</span>
            {count > 0 && <span style={{ fontSize: 11, color: mine ? '#0d6b63' : '#6B7280', fontWeight: 600 }}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

function MemoryCard({ evt, onTap }) {
  const color = getMoodColor(evt.mood)
  const emoji = getMoodEmoji(evt.mood)
  const name = evt.recorderName ? evt.recorderName.split(' ')[0] : null
  return (
    <div
      onClick={onTap}
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid #EDE5D8',
        borderLeft: `3px solid ${color}`,
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🎙️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {name ? `${name} dejó una memoria` : 'Memoria de voz'}
            {evt.mood && <span style={{ marginLeft: 5 }}>{emoji}</span>}
          </p>
          {evt.transcription && (
            <p style={{
              fontSize: 11, color: '#9CA3AF', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {evt.transcription}
            </p>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>▶ Escuchar</span>
      </div>
    </div>
  )
}

function SosCard({ evt, onTap }) {
  const name = evt.triggeredBy ? evt.triggeredBy.split(' ')[0] : 'Familiar'
  return (
    <div onClick={onTap} style={{
      background: evt.resolved ? '#F9FAFB' : '#FFF0F0',
      borderRadius: 16,
      border: `1px solid ${evt.resolved ? '#EDE5D8' : '#FFBABA'}`,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      cursor: 'pointer',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{evt.resolved ? '✅' : '🚨'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: evt.resolved ? '#374151' : '#D63031', margin: 0 }}>
          {evt.resolved ? 'Emergencia resuelta' : `EMERGENCIA — ${name}`}
        </p>
        {evt.address && (
          <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>📍 {evt.address}</p>
        )}
      </div>
      {evt.latitude && evt.longitude && !evt.resolved && (
        <a
          href={mapsUrl(evt.latitude, evt.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            padding: '5px 10px', borderRadius: 8,
            background: '#D63031', color: 'white',
            fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
          }}
        >
          Ver mapa
        </a>
      )}
    </div>
  )
}

function ExpenseCard({ evt, onTap }) {
  const name = evt.paidBy ? evt.paidBy.split(' ')[0] : null
  return (
    <div onClick={onTap} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid #EDE5D8',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      cursor: 'pointer',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💰</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          {name ? `${name} pagó ${evt.description}` : evt.description}
        </p>
      </div>
      {evt.amount != null && (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0d6b63', flexShrink: 0 }}>
          ${Number(evt.amount).toFixed(2)}
        </span>
      )}
    </div>
  )
}

function AppointmentCard({ evt, todayKey, tomorrowKey }) {
  const isToday = evt.dateKey === todayKey
  const isTomorrow = evt.dateKey === tomorrowKey
  const whenLabel = isToday ? 'hoy' : isTomorrow ? 'mañana' : null
  const timeText = evt.appointmentTime
    ? (whenLabel ? `${whenLabel} a las ${fmtTime(evt.appointmentTime)}` : fmtTime(evt.appointmentTime))
    : 'Ver en calendario'
  return (
    <Link
      to="/calendar"
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid #BFDBFE',
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>📅</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          {evt.appointmentTitle}
        </p>
        <p style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>{timeText}</p>
      </div>
      <span style={{ color: '#BBBBBB', fontSize: 14 }}>›</span>
    </Link>
  )
}

function AppointmentProofCard({ evt, onTap }) {
  return (
    <div
      onClick={() => onTap(evt)}
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid #BBF7D0',
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {evt.proofPhotoUrl ? (
        <img
          src={evt.proofPhotoUrl}
          alt="Prueba"
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #D1FAE5' }}
        />
      ) : (
        <span style={{ fontSize: 22, flexShrink: 0 }}>📅</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          {evt.appointmentTitle}
        </p>
        <p style={{ fontSize: 11, color: '#16A34A', marginTop: 2, fontWeight: 600 }}>
          ✓ Asistencia confirmada
          {evt.appointmentTime ? ` · ${fmtTime(evt.appointmentTime)}` : ''}
        </p>
        {evt.proofNotes && (
          <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{evt.proofNotes}</p>
        )}
      </div>
    </div>
  )
}

function CaregiverCard({ evt }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
      borderRadius: 16, border: '1px solid #C4B5FD',
      padding: '14px 16px',
      boxShadow: '0 2px 8px rgba(124,92,191,0.12)',
    }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#5B21B6', margin: '0 0 4px' }}>
        💙 Reconocimiento semanal
      </p>
      <p style={{ fontSize: 13, color: '#6D28D9', lineHeight: 1.5, margin: 0 }}>
        {evt.caregiverName.split(' ')[0]} coordinó{' '}
        <strong>{evt.weekCount} dosis</strong> esta semana.
        El cuidado invisible merece ser visto. 💙
      </p>
    </div>
  )
}

// ── Detail row helper ─────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500, margin: '1px 0 0' }}>{value}</p>
      </div>
    </div>
  )
}

// ── Event detail sheet sub-components ────────────────────────────────────────

function stampImage(file, confirmerName) {
  return new Promise(resolve => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const barH = Math.max(44, Math.round(img.naturalHeight * 0.07))
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, img.naturalHeight - barH, img.naturalWidth, barH)
      const now = new Date()
      const stamp = `${now.toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })} · ${now.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Confirmado por: ${confirmerName} · FamiliaCerca ✓`
      const fs = Math.max(11, Math.round(img.naturalWidth * 0.022))
      ctx.fillStyle = '#ffffff'; ctx.font = `bold ${fs}px Arial, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(stamp, img.naturalWidth / 2, img.naturalHeight - barH / 2, img.naturalWidth - 16)
      URL.revokeObjectURL(objUrl)
      function dataUrlToBlob(dataUrl) {
        const [, b64] = dataUrl.split(',')
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
        return new Blob([bytes], { type: 'image/jpeg' })
      }
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(blob => resolve(blob ?? dataUrlToBlob(canvas.toDataURL('image/jpeg', 0.92))), 'image/jpeg', 0.92)
      } else {
        resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg', 0.92)))
      }
    }
    img.src = objUrl
  })
}

function MedConfirmedDetail({ evt }) {
  const { user } = useAuth()
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const attachFileRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [attachFile, setAttachFile] = useState(null)
  const [attachPreview, setAttachPreview] = useState(null)
  const [attachStamping, setAttachStamping] = useState(false)
  const [attachSaving, setAttachSaving] = useState(false)
  const [attachError, setAttachError] = useState('')
  const [photoUrl, setPhotoUrl] = useState(evt.photoUrl)

  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null

  async function handleAttachPhotoChange(e) {
    const f = e.target.files?.[0]; if (!f) return
    setAttachStamping(true)
    const stamped = await stampImage(f, displayName)
    setAttachFile(stamped)
    setAttachPreview(URL.createObjectURL(stamped))
    setAttachStamping(false)
  }

  async function submitAttachPhoto() {
    if (!attachFile) { setAttachError('Selecciona una foto primero'); return }
    setAttachSaving(true); setAttachError('')
    const path = `${user.id}/${evt.dateKey}/${evt.medicationId}.jpg`
    const { error: upErr } = await supabase.storage.from('confirmations').upload(path, attachFile, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) { setAttachError('No se pudo subir la foto. Verifica tu conexión.'); setAttachSaving(false); return }
    const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)
    await supabase.from('medication_logs').update({
      photo_url: publicUrl,
      confirmed_by_name: displayName,
      confirmed_at: new Date().toISOString(),
    }).eq('id', evt.logId)
    setPhotoUrl(publicUrl)
    setEditing(false); setAttachFile(null); setAttachPreview(null); setAttachSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>💊</span>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            {[evt.medName, evt.medDosage].filter(Boolean).join(' · ')}
          </p>
          <p style={{ fontSize: 12, color: '#22C55E', fontWeight: 600, margin: '3px 0 0' }}>Medicamento dado ✅</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {evt.confirmedBy && <DetailRow icon="👤" label="Dado por" value={evt.confirmedBy} />}
        {time && <DetailRow icon="🕐" label="Hora" value={time} />}
        {evt.latitude && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📍</span>
            <div>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Ubicación</p>
              <a href={mapsUrl(evt.latitude, evt.longitude)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#3B82F6', textDecoration: 'none', fontWeight: 500 }}>
                {evt.address ?? 'Ver en mapa'} →
              </a>
            </div>
          </div>
        )}

        {/* Photo — no-photo warning */}
        {!editing && !photoUrl && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#9A3412' }}>Falta la foto de prueba</span>
            </div>
            <button onClick={() => setEditing(true)} style={{ padding: '6px 12px', background: '#F97316', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              📷 Agregar
            </button>
          </div>
        )}

        {/* Photo — existing proof */}
        {!editing && photoUrl && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Foto de prueba</p>
              <button onClick={() => setEditing(true)} style={{ padding: '4px 10px', background: 'none', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                Cambiar
              </button>
            </div>
            <img src={photoUrl} alt="Prueba" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover' }} />
          </div>
        )}

        {/* Photo — upload form */}
        {editing && (
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 8px' }}>
              {photoUrl ? 'Reemplazar foto de prueba' : 'Agregar foto de prueba'}
            </p>
            <input ref={attachFileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleAttachPhotoChange} />
            <button
              type="button"
              onClick={() => !attachStamping && attachFileRef.current?.click()}
              disabled={attachStamping}
              style={{ width: '100%', border: '1.5px dashed #D1D5DB', borderRadius: 12, background: 'none', cursor: attachStamping ? 'default' : 'pointer', overflow: 'hidden', marginBottom: 10 }}
            >
              {attachStamping ? (
                <div style={{ height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid #0d6b63', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: 12 }}>Aplicando sello...</span>
                </div>
              ) : attachPreview ? (
                <div>
                  <img src={attachPreview} style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} alt="Nueva prueba" />
                  <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '6px 0 8px', margin: 0 }}>Toca para cambiar</p>
                </div>
              ) : photoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoUrl} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', opacity: 0.35 }} alt="Foto actual" />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span style={{ fontSize: 24 }}>📷</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Toca para reemplazar</span>
                  </div>
                </div>
              ) : (
                <div style={{ height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#9CA3AF' }}>
                  <span style={{ fontSize: 28 }}>📷</span>
                  <span style={{ fontSize: 12 }}>Toca para tomar foto</span>
                </div>
              )}
            </button>
            {attachError && (
              <div style={{ marginBottom: 10, padding: '10px 12px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, fontSize: 13, color: '#D63031', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠</span>{attachError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={submitAttachPhoto}
                disabled={attachSaving || attachStamping}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: '#0d6b63', color: 'white', fontWeight: 700, fontSize: 13, cursor: (attachSaving || attachStamping) ? 'default' : 'pointer', opacity: (attachSaving || attachStamping) ? 0.6 : 1 }}
              >
                {attachSaving ? 'Guardando...' : '✓ Guardar foto'}
              </button>
              <button
                onClick={() => { setEditing(false); setAttachFile(null); setAttachPreview(null); setAttachError('') }}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid #E5E7EB', background: 'none', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function VoiceMemoryDetail({ evt }) {
  const color = getMoodColor(evt.mood)
  const emoji = getMoodEmoji(evt.mood)
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🎙️</span>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Memoria de voz</p>
          {evt.mood && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              padding: '2px 10px', borderRadius: 20,
              background: color + '20', fontSize: 13, color, fontWeight: 600,
            }}>
              {emoji}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {evt.recorderName && <DetailRow icon="👤" label="Grabado por" value={evt.recorderName} />}
        {time && <DetailRow icon="🕐" label="Hora" value={time} />}
        {evt.audioUrl && (
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 8px' }}>Reproducir</p>
            <audio src={evt.audioUrl} controls style={{ width: '100%', height: 40, borderRadius: 8 }} />
          </div>
        )}
        {evt.transcription && (
          <div style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
              "{evt.transcription}"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function NoteDetail({ evt }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>📝</span>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Nota</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {evt.noteText && (
          <div style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{evt.noteText}</p>
          </div>
        )}
        {evt.authorName && <DetailRow icon="👤" label="Escrito por" value={evt.authorName} />}
        {time && <DetailRow icon="🕐" label="Hora" value={time} />}
        {evt.photoUrl && (
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 8px' }}>Foto adjunta</p>
            <img src={evt.photoUrl} alt="Adjunto" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover' }} />
          </div>
        )}
      </div>
    </div>
  )
}

function ExpenseDetail({ evt }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>💰</span>
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#0d6b63', margin: 0 }}>
            ${evt.amount != null ? Number(evt.amount).toFixed(2) : '—'}
          </p>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>{evt.description}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {evt.paidBy && <DetailRow icon="👤" label="Registrado por" value={evt.paidBy} />}
        {time && <DetailRow icon="🕐" label="Hora" value={time} />}
        {evt.receiptUrl && (
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 8px' }}>Recibo</p>
            <img src={evt.receiptUrl} alt="Recibo" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover' }} />
          </div>
        )}
      </div>
    </div>
  )
}

function SosDetail({ evt }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        padding: '14px 16px',
        background: evt.resolved ? '#F9FAFB' : '#FFF0F0',
        borderRadius: 16,
        border: `1px solid ${evt.resolved ? '#EDE5D8' : '#FFBABA'}`,
      }}>
        <span style={{ fontSize: 28 }}>{evt.resolved ? '✅' : '🚨'}</span>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: evt.resolved ? '#374151' : '#D63031', margin: 0 }}>
            {evt.resolved ? 'Emergencia resuelta' : 'EMERGENCIA'}
          </p>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
            {evt.resolved ? 'Esta alerta fue atendida' : 'Alerta activa'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {evt.triggeredBy && <DetailRow icon="👤" label="Activado por" value={evt.triggeredBy} />}
        {time && <DetailRow icon="🕐" label="Hora" value={time} />}
        {evt.address && <DetailRow icon="📍" label="Dirección" value={evt.address} />}
        {evt.latitude && evt.longitude && (
          <a
            href={mapsUrl(evt.latitude, evt.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px', borderRadius: 16, marginTop: 4,
              background: evt.resolved ? '#F3F4F6' : 'linear-gradient(135deg, #D63031, #B82020)',
              color: evt.resolved ? '#374151' : 'white',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
              boxShadow: evt.resolved ? 'none' : '0 6px 20px rgba(214,48,49,0.35)',
            }}
          >
            📍 Ver en mapa
          </a>
        )}
      </div>
    </div>
  )
}

function EventDetailSheet({ evt, onClose, onAttachProof, isFamiliar }) {
  if (!evt) return null
  const TITLES = {
    MED_CONFIRMED: 'Medicamento',
    VOICE_MEMORY: 'Memoria de voz',
    NOTE: 'Nota',
    EXPENSE: 'Gasto',
    SOS_ALERT: 'Alerta SOS',
    APPOINTMENT: 'Cita médica',
    APPOINTMENT_PROOF: 'Cita médica',
  }
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'white', borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
        maxHeight: '85vh',
        overflowY: 'auto',
        paddingBottom: 96,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E7EB' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            {TITLES[evt.type] ?? 'Detalle'}
          </p>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#F3F4F6', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <XIcon size={14} color="#6B7280" strokeWidth={2} />
          </button>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          {evt.type === 'MED_CONFIRMED' && <MedConfirmedDetail evt={evt} />}
          {evt.type === 'VOICE_MEMORY' && <VoiceMemoryDetail evt={evt} />}
          {evt.type === 'NOTE' && <NoteDetail evt={evt} />}
          {evt.type === 'EXPENSE' && <ExpenseDetail evt={evt} />}
          {evt.type === 'SOS_ALERT' && <SosDetail evt={evt} />}
          {evt.type === 'APPOINTMENT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                {evt.appointmentTitle}
              </p>
              {evt.appointmentTime && (
                <DetailRow icon="🕐" label="Hora" value={fmtTime(evt.appointmentTime)} />
              )}
              {evt.attended ? (
                <>
                  <DetailRow icon="✅" label="Estado" value="Asistencia confirmada" />
                  {evt.proofNotes && (
                    <DetailRow icon="📝" label="Notas" value={evt.proofNotes} />
                  )}
                  {evt.proofPhotoUrl && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        Comprobante
                      </p>
                      <img
                        src={evt.proofPhotoUrl}
                        alt="Comprobante de cita"
                        style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 260, border: '1px solid #D1FAE5' }}
                      />
                    </div>
                  )}
                </>
              ) : !isFamiliar ? (
                <button
                  onClick={() => onAttachProof?.(evt)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px', borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg, #087F70, #0d6b63)',
                    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(8,127,112,0.3)',
                  }}
                >
                  📎 Adjuntar comprobante
                </button>
              ) : (
                <DetailRow icon="🕓" label="Estado" value="Pendiente de asistencia" />
              )}
            </div>
          )}
          {evt.type === 'APPOINTMENT_PROOF' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                {evt.appointmentTitle}
              </p>
              {evt.appointmentTime && (
                <DetailRow icon="🕐" label="Hora" value={fmtTime(evt.appointmentTime)} />
              )}
              <DetailRow icon="✅" label="Estado" value="Asistencia confirmada" />
              {evt.proofNotes && (
                <DetailRow icon="📝" label="Notas" value={evt.proofNotes} />
              )}
              {evt.proofPhotoUrl && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Foto de prueba
                  </p>
                  <img
                    src={evt.proofPhotoUrl}
                    alt="Prueba de cita"
                    style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 260, border: '1px solid #D1FAE5' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Timeline event dispatcher ─────────────────────────────────────────────────

function TimelineEvent({ evt, confirming, expandedAudio, onConfirm, onToggleAudio, todayKey, tomorrowKey, reactions, userId, onReact, onTap, isFamiliar }) {
  const bar = evt.type !== 'MED_PENDING' && evt.type !== 'CAREGIVER_CARD' && evt.type !== 'MED_MISSED' && (
    <ReactionBar eventKey={evt.id} reactions={reactions?.[evt.id]} userId={userId} onToggle={onReact} />
  )
  if (evt.type === 'MED_PENDING') {
    return <PendingCard evt={evt} confirming={confirming} onConfirm={onConfirm} todayKey={todayKey} isFamiliar={isFamiliar} />
  }
  if (evt.type === 'MED_MISSED') return <MissedCard evt={evt} />
  if (evt.type === 'MED_CONFIRMED') return <div><ConfirmedCard evt={evt} onTap={() => onTap(evt)} />{bar}</div>
  if (evt.type === 'VOICE_MEMORY') {
    return (
      <div>
        <MemoryCard evt={evt} onTap={() => onTap(evt)} />
        {bar}
      </div>
    )
  }
  if (evt.type === 'EXPENSE') return <div><ExpenseCard evt={evt} onTap={() => onTap(evt)} />{bar}</div>
  if (evt.type === 'APPOINTMENT') {
    return <div><AppointmentCard evt={evt} todayKey={todayKey} tomorrowKey={tomorrowKey} />{bar}</div>
  }
  if (evt.type === 'APPOINTMENT_PROOF') {
    return <div><AppointmentProofCard evt={evt} onTap={() => onTap(evt)} />{bar}</div>
  }
  if (evt.type === 'SOS_ALERT') return <div><SosCard evt={evt} onTap={() => onTap(evt)} />{bar}</div>
  if (evt.type === 'CAREGIVER_CARD') return <CaregiverCard evt={evt} />
  return null
}

function EmptyState({ profile }) {
  return (
    <div style={{
      background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
      padding: '48px 24px', textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>
        {profile ? '💊' : '🌱'}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
        {profile ? 'Todo tranquilo por aquí' : 'Bienvenido a FamiliaCerca'}
      </p>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20, lineHeight: 1.6 }}>
        {profile
          ? 'El historial de cuidado aparecerá aquí. Agrega medicamentos para comenzar.'
          : 'Configura el perfil familiar para comenzar a registrar el cuidado.'}
      </p>
      <Link
        to={profile ? '/medications' : '/onboarding'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
          color: 'white', fontWeight: 700, fontSize: 13,
          textDecoration: 'none',
        }}
      >
        {profile ? '+ Agregar medicamento' : '+ Configurar familiar'}
      </Link>
    </div>
  )
}

// ── Category groups for expanded timeline ────────────────────────────────────

const CATEGORY_GROUPS = [
  { id: 'meds',    emoji: '💊', label: 'Medicamentos', types: ['MED_PENDING', 'MED_CONFIRMED', 'MED_MISSED'] },
  { id: 'citas',   emoji: '📅', label: 'Citas',        types: ['APPOINTMENT', 'APPOINTMENT_PROOF'] },
  { id: 'familia', emoji: '👥', label: 'Familia',      types: ['CAREGIVER_CARD'] },
  { id: 'notas',   emoji: '💬', label: 'Notas',        types: ['VOICE_MEMORY', 'NOTE'] },
  { id: 'gastos',  emoji: '💰', label: 'Gastos',       types: ['EXPENSE'] },
  { id: 'alertas', emoji: '🚨', label: 'Alertas',      types: ['SOS_ALERT'] },
]

// ── Collapsible day section ───────────────────────────────────────────────────

function DaySection({
  section, isExpanded, onToggle, medTotal,
  confirming, expandedAudio, onConfirm, onToggleAudio,
  todayKey, tomorrowKey, reactions, userId, onReact, onTap, isFamiliar,
}) {
  const confirmedCount = section.events.filter(e => e.type === 'MED_CONFIRMED').length
  const pendingCount   = section.events.filter(e => e.type === 'MED_PENDING').length
  const missedCount    = section.events.filter(e => e.type === 'MED_MISSED').length

  // Status based on medication coverage for this day
  let status = 'none'
  if (medTotal > 0) {
    if (missedCount === 0 && pendingCount === 0 && confirmedCount >= medTotal) status = 'green'
    else if (confirmedCount > 0) status = 'yellow'
    else if (missedCount > 0) status = 'red'
    else status = 'red'
  }

  const STATUS_STYLE = {
    green:  { dot: '🟢', border: '#22C55E', bg: '#F0FDF4' },
    yellow: { dot: '🟡', border: '#F59E0B', bg: '#FFFBEB' },
    red:    { dot: '🔴', border: '#D63031', bg: '#FFF0F0' },
    none:   { dot: '',   border: '#EDE5D8', bg: 'white'   },
  }
  const ss = STATUS_STYLE[status]

  // Last update time for collapsed subtitle
  const lastTs = section.events.length > 0
    ? section.events.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).timestamp
    : null
  const lastUpdateText = (() => {
    if (!lastTs) return null
    const now = new Date()
    const isToday = lastTs.toDateString() === now.toDateString()
    if (isToday) {
      return lastTs.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    return lastTs.toLocaleDateString('es-US', { weekday: 'short', month: 'short', day: 'numeric' })
  })()
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Tappable header — card style when collapsed, plain label when expanded */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          textAlign: 'left', cursor: 'pointer', border: 'none',
          borderRadius: isExpanded ? 0 : 12,
          padding: isExpanded ? '0 2px 8px' : '11px 14px',
          background: isExpanded ? 'none' : ss.bg,
          borderLeft: isExpanded ? 'none' : `3px solid ${ss.border}`,
          boxShadow: isExpanded ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
          transition: 'background 0.2s ease, box-shadow 0.2s ease, padding 0.2s ease',
        }}
      >
        {ss.dot && (
          <span style={{ fontSize: 10, flexShrink: 0, lineHeight: 1 }}>{ss.dot}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isExpanded ? '#9CA3AF' : '#374151',
            display: 'block',
            transition: 'color 0.2s ease',
          }}>
            {section.label}
          </span>
          {!isExpanded && lastUpdateText && (
            <span style={{
              fontSize: 11, color: '#9CA3AF',
              display: 'block', marginTop: 2,
            }}>
              última actualización {lastUpdateText}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 14, color: '#9AADA3', flexShrink: 0,
          display: 'inline-block',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.25s ease',
        }}>›</span>
      </button>

      {/* Collapsible content — CSS grid trick for smooth height animation */}
      <div style={{
        display: 'grid',
        gridTemplateRows: isExpanded ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            paddingTop: 2,
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'translateY(0)' : 'translateY(-6px)',
            transition: isExpanded
              ? 'opacity 0.22s ease 0.08s, transform 0.22s ease 0.08s'
              : 'opacity 0.12s ease, transform 0.12s ease',
          }}>
            {section.events.length === 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 4px',
              }}>
                <span style={{ fontSize: 16, opacity: 0.4 }}>🗓️</span>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Sin actividad registrada</p>
              </div>
            ) : CATEGORY_GROUPS.map(group => {
              const groupEvts = section.events.filter(e => group.types.includes(e.type))
              if (groupEvts.length === 0) return null
              return (
                <div key={group.id} style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    paddingBottom: 6, marginBottom: 8,
                    borderBottom: '1px solid #F3F4F6',
                  }}>
                    <span style={{ fontSize: 13 }}>{group.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {group.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#9AADA3' }}>{groupEvts.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupEvts.map(evt => (
                      <TimelineEvent
                        key={evt.id}
                        evt={evt}
                        confirming={confirming}
                        expandedAudio={expandedAudio}
                        onConfirm={onConfirm}
                        onToggleAudio={onToggleAudio}
                        todayKey={todayKey}
                        tomorrowKey={tomorrowKey}
                        reactions={reactions}
                        userId={userId}
                        onReact={onReact}
                        onTap={onTap}
                        isFamiliar={isFamiliar}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AI helpers ────────────────────────────────────────────────────────────────

function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const wk = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}

const AI_CARD_CONFIGS = {
  morning: { gradient: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)', border: '#FDE68A',   icon: '🌅', label: 'Tu momento del día',  textColor: '#5A4010' },
  evening: { gradient: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)', border: '#C4B5FD',   icon: '🌙', label: 'Resumen del día',      textColor: '#5B21B6' },
  burnout: { gradient: 'linear-gradient(135deg, #FEE2E2, #FFF5F5)', border: '#FECACA',   icon: '💙', label: 'Un mensaje para ti',   textColor: '#7F1D1D' },
  weekly:  { gradient: 'linear-gradient(135deg, #D1FAE5, #ECFDF5)', border: '#6EE7B7',   icon: '🌿', label: 'Resumen semanal',      textColor: '#064E3B' },
}

function AiCard({ type, text }) {
  const c = AI_CARD_CONFIGS[type]
  if (!c) return null
  return (
    <div style={{
      background: c.gradient, borderRadius: 16,
      border: `1px solid ${c.border}`,
      padding: '14px 16px', marginBottom: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: c.textColor, opacity: 0.7,
        margin: '0 0 6px',
      }}>
        {c.icon} {c.label} · IA
      </p>
      <p style={{ fontSize: 13, color: c.textColor, lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  )
}

// ── Dashboard Status Cards ────────────────────────────────────────────────────

function StatusCard({ icon, title, subtitle, status, statusType, to, onClick, pulse }) {
  const styles = {
    ok:      { bg: '#F0FDF4', border: '#86EFAC', statusColor: '#15803D', statusIcon: '✅' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', statusColor: '#7A5A18', statusIcon: '⚠️' },
    urgent:  { bg: '#FFF0F0', border: '#FECACA', statusColor: '#D63031', statusIcon: '🔴' },
    info:    { bg: '#FFFFFF', border: '#C8BEB4', statusColor: '#6B7280', statusIcon: '💙' },
  }
  const s = styles[statusType ?? 'info']
  const inner = (
    <div style={{
      background: s.bg, borderRadius: 20,
      border: `1.5px solid ${s.border}`,
      padding: '16px 12px 12px',
      display: 'flex', flexDirection: 'column', gap: 5,
      minHeight: 140, boxSizing: 'border-box',
      boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
      WebkitTapHighlightColor: 'transparent',
      overflow: 'hidden', minWidth: 0,
    }}>
      <span style={{ fontSize: 34, lineHeight: 1, display: 'block' }}>{icon}</span>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
      {subtitle && (
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{subtitle}</p>
      )}
      <p style={{ fontSize: 11, fontWeight: 700, color: s.statusColor, margin: 'auto 0 0', paddingTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {s.statusIcon} {status}
      </p>
    </div>
  )
  const navigate = useNav()
  return (
    <div
      onClick={to ? () => navigate(to) : onClick}
      style={{ cursor: 'pointer', borderRadius: 20 }}
      className={pulse ? 'animate-card-pulse' : undefined}
    >
      {inner}
    </div>
  )
}

function EmergencyCard({ onPress, sosSent }) {
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', borderRadius: 20, border: 'none',
        background: sosSent
          ? 'linear-gradient(135deg, #B91C1C 0%, #7F1D1D 100%)'
          : 'linear-gradient(135deg, #D63031 0%, #991B1B 100%)',
        padding: '20px 22px',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer', marginBottom: 20,
        boxShadow: '0 6px 24px rgba(214,48,49,0.35)',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
      }}
      aria-label="Botón de emergencia SOS"
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {!sosSent && (
          <span style={{
            position: 'absolute', inset: -5, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            animation: 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
            pointerEvents: 'none',
          }} />
        )}
        <span style={{ fontSize: 40, lineHeight: 1, position: 'relative', zIndex: 1 }}>🆘</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: 0 }}>
          {sosSent ? '🚨 Alerta enviada' : 'Emergencia'}
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', margin: '3px 0 0', fontWeight: 500 }}>
          {sosSent ? 'La familia ha sido notificada' : 'Toca para alertar a toda la familia'}
        </p>
      </div>
      <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>›</span>
    </button>
  )
}

const RECENT_EVENT_CONFIG = {
  MED_CONFIRMED:     { icon: '💊', color: '#15803D', label: e => `${e.medName ?? 'Medicamento'} dado${e.confirmedBy ? ` por ${e.confirmedBy.split(' ')[0]}` : ''}` },
  VOICE_MEMORY:      { icon: '🎙️', color: '#7C5CBF', label: e => `Memoria de voz${e.recorderName ? ` de ${e.recorderName.split(' ')[0]}` : ''}` },
  EXPENSE:           { icon: '💰', color: '#0d6b63', label: e => e.description ?? 'Gasto registrado' },
  SOS_ALERT:         { icon: '🚨', color: '#D63031', label: () => 'Alerta de emergencia' },
  APPOINTMENT:       { icon: '📅', color: '#3B82F6', label: e => e.appointmentTitle ?? 'Cita médica' },
  APPOINTMENT_PROOF: { icon: '✅', color: '#15803D', label: e => `Cita: ${e.appointmentTitle ?? 'médica'}` },
  NOTE:              { icon: '📝', color: '#6B7280', label: () => 'Nota registrada' },
  INCIDENT:          { icon: '🤕', color: '#DC2626', label: e => incidentTypeInfo(e.incidentType).label },
}

function RecentEventRow({ evt, onTap }) {
  const c = RECENT_EVENT_CONFIG[evt.type] ?? { icon: '📌', color: '#9CA3AF', label: () => 'Evento' }
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : ''
  return (
    <div
      onClick={() => onTap(evt)}
      style={{
        background: 'white', borderRadius: 14,
        border: '1px solid #EDE5D8',
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: c.color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>
        {c.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0, lineHeight: 1.3 }}>
          {c.label(evt)}
        </p>
        {time && (
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{time}</p>
        )}
      </div>
      <span style={{ fontSize: 16, color: '#D4C0B0', flexShrink: 0 }}>›</span>
    </div>
  )
}

function calcAge(dateStr) {
  if (!dateStr) return null
  const age = Math.floor((Date.now() - new Date(dateStr)) / (365.25 * 24 * 60 * 60 * 1000))
  if (age < 1 || age > 130) return null
  return age
}

// ── Unified DashCard ─────────────────────────────────────────────────────────

const DASH_STATUS = {
  ok:      { color: '#15803D', bg: '#DCFCE7' },
  warning: { color: '#92400E', bg: '#FEF3C7' },
  urgent:  { color: '#DC2626', bg: '#FEE2E2' },
  info:    { color: '#6B7280', bg: '#F3F4F6' },
}

function DashCard({ Icon, title, subtitle, status, statusType, to, onClick }) {
  const navigate = useNav()
  const s = DASH_STATUS[statusType ?? 'info']
  const isClickable = !!(to || onClick)
  const [pressed, setPressed] = useState(false)
  return (
    <div
      onClick={to ? () => navigate(to) : onClick}
      onPointerDown={() => isClickable && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: 'white',
        borderRadius: 16,
        border: '0.5px solid #E8E4DC',
        boxShadow: pressed ? 'none' : '0 2px 0px #E0DBD2',
        transform: pressed ? 'translateY(2px)' : 'none',
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: isClickable ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        boxSizing: 'border-box',
        minHeight: 130,
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#EAF0E6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={20} color="#0d6b63" strokeWidth={1.75} />
        </div>
        {status && (
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            gap: 4, padding: '3px 8px', borderRadius: 20, background: s.bg,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{status}</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#2d3748', margin: 0, lineHeight: 1.25 }}>{title}</p>
        {subtitle && (
          <p style={{ fontSize: 12, color: '#718096', margin: '4px 0 0', lineHeight: 1.4 }}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}

function VideoCallDashCard({ onInstant, onSchedule, starting, error }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      style={{
        background: 'white', borderRadius: 16,
        border: '0.5px solid #E8E4DC',
        boxShadow: '0 2px 0px #E0DBD2',
        padding: '14px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        boxSizing: 'border-box', minHeight: 130,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#EAF0E6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Camera size={20} color="#0d6b63" strokeWidth={1.75} />
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#2d3748', margin: 0, lineHeight: 1.25 }}>Videollamada</p>
        <p style={{ fontSize: 12, color: '#718096', margin: '4px 0 0' }}>Conectar con la familia</p>
      </div>
      <button
        onClick={onInstant}
        disabled={starting}
        onPointerDown={() => !starting && setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 10, border: 'none',
          background: starting ? '#C0CCC5' : 'linear-gradient(135deg, #0d6b63, #3A6347)',
          color: 'white', fontWeight: 700, fontSize: 12,
          cursor: starting ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          transform: pressed ? 'translateY(1px)' : 'none',
          boxShadow: starting ? 'none' : '0 3px 10px rgba(13,107,99,0.3)',
          transition: 'all 0.1s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {starting ? (
          <>
            <div style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Iniciando...
          </>
        ) : '📹 Iniciar ahora'}
      </button>
      <button
        onClick={onSchedule}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: '#9CA3AF', padding: 0, textAlign: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Ver programadas →
      </button>
      {error && (
        <p style={{ fontSize: 10, color: '#DC2626', margin: 0, textAlign: 'center', lineHeight: 1.3 }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Care Day Detail components ────────────────────────────────────────────────

function CareDaySection({ title, emoji, count, children }) {
  if (count === 0) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingBottom: 6, marginBottom: 10,
        borderBottom: '1px solid #F3F4F6',
      }}>
        <span style={{ fontSize: 13 }}>{emoji}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#9CA3AF',
          background: '#F3F4F6', borderRadius: 10, padding: '1px 7px', marginLeft: 2,
        }}>
          {count}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function MedDetailRow({ evt, isToday, confirming, onConfirm, isFamiliar }) {
  const medLabel = [evt.medName, evt.medDosage].filter(Boolean).join(' · ')
  const isConfirmed = evt.type === 'MED_CONFIRMED'
  const isPending = evt.type === 'MED_PENDING'
  const sc = isConfirmed
    ? { icon: '✅', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', label: evt.confirmedBy ? evt.confirmedBy.split(' ')[0] : 'Dado' }
    : (isPending && isToday)
      ? { icon: '⏳', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', label: 'Pendiente' }
      : { icon: '❌', color: '#DC2626', bg: '#FFF5F5', border: '#FECACA', label: 'No dado' }
  const timeStr = isConfirmed
    ? (evt.timestamp ? fmtTimestamp(evt.timestamp) : null)
    : evt.medTime ? fmtTime(evt.medTime) : null
  const busy = confirming === evt.medicationId
  return (
    <div style={{
      background: sc.bg, borderRadius: 12, border: `1px solid ${sc.border}`,
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>💊</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0, lineHeight: 1.3 }}>
          {medLabel}
        </p>
        {timeStr && (
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
            {isConfirmed ? `Dado a las ${timeStr}` : `Programado ${timeStr}`}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ fontSize: 15 }}>{sc.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: sc.color }}>{sc.label}</span>
      </div>
      {isPending && isToday && !isFamiliar && (
        <button
          onClick={() => onConfirm(evt)}
          disabled={busy}
          style={{
            padding: '6px 11px', borderRadius: 8, border: 'none',
            background: busy ? '#C0CCC5' : '#22C55E',
            color: 'white', fontSize: 11, fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          {busy ? '...' : 'Dar'}
        </button>
      )}
    </div>
  )
}

const CARE_ROW_CONFIG = {
  VOICE_MEMORY:      { icon: '🎙️', label: e => e.recorderName ? `Memoria de ${e.recorderName.split(' ')[0]}` : 'Memoria de voz', sub: e => e.transcription ? `"${e.transcription.slice(0, 50)}${e.transcription.length > 50 ? '…' : ''}"` : null },
  NOTE:              { icon: '📝', label: e => e.noteText ? e.noteText.slice(0, 45) + (e.noteText.length > 45 ? '…' : '') : 'Nota', sub: e => e.authorName ? `Por ${e.authorName.split(' ')[0]}` : null },
  EXPENSE:           { icon: '💰', label: e => e.description || 'Gasto', sub: e => e.amount != null ? `$${Number(e.amount).toFixed(2)}` : null },
  APPOINTMENT:       { icon: '📅', label: e => e.appointmentTitle || 'Cita médica', sub: e => e.appointmentTime ? `Programada ${fmtTime(e.appointmentTime)}` : 'Próxima cita' },
  APPOINTMENT_PROOF: { icon: '✅', label: e => e.appointmentTitle || 'Cita médica', sub: () => 'Asistencia confirmada' },
}

function CareEventRow({ evt, onTap }) {
  const cfg = CARE_ROW_CONFIG[evt.type]
  if (!cfg) return null
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  const tappable = evt.type !== 'APPOINTMENT'
  return (
    <div
      onClick={tappable ? () => onTap(evt) : undefined}
      style={{
        background: 'white', borderRadius: 12, border: '1px solid #EDE5D8',
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: tappable ? 'pointer' : 'default',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: evt.type === 'APPOINTMENT' ? '#EFF6FF' : '#F0FDF4',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>
        {cfg.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cfg.label(evt)}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
          {time && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{time}</span>}
          {cfg.sub(evt) && (
            <span style={{ fontSize: 11, color: evt.type === 'APPOINTMENT_PROOF' ? '#15803D' : '#6B7280', fontWeight: evt.type === 'APPOINTMENT_PROOF' ? 600 : 400 }}>
              {cfg.sub(evt)}
            </span>
          )}
        </div>
      </div>
      {tappable && <span style={{ fontSize: 14, color: '#D4C0B0', flexShrink: 0 }}>›</span>}
    </div>
  )
}

function AlertDetailRow({ evt, onTap }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  return (
    <div
      onClick={() => onTap(evt)}
      style={{
        background: evt.resolved ? '#F9FAFB' : '#FFF0F0',
        borderRadius: 12,
        border: `1px solid ${evt.resolved ? '#E5E7EB' : '#FECACA'}`,
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{evt.resolved ? '✅' : '🚨'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: evt.resolved ? '#374151' : '#D63031', margin: 0 }}>
          {evt.resolved ? 'Emergencia resuelta' : 'SOS Familiar'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {evt.triggeredBy && <span style={{ fontSize: 11, color: '#6B7280' }}>{evt.triggeredBy.split(' ')[0]}</span>}
          {time && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{time}</span>}
        </div>
      </div>
      <span style={{ fontSize: 14, color: '#D4C0B0', flexShrink: 0 }}>›</span>
    </div>
  )
}

function CareDayDetail({ section, todayKey, confirming, onConfirm, isFamiliar, onTap }) {
  const events = section?.events ?? []
  const isToday = section?.dateKey === todayKey

  const medEvents = events
    .filter(e => ['MED_CONFIRMED', 'MED_PENDING', 'MED_MISSED'].includes(e.type))
    .sort((a, b) => {
      const order = { MED_CONFIRMED: 0, MED_PENDING: 1, MED_MISSED: 2 }
      return (order[a.type] - order[b.type]) || (a.timestamp - b.timestamp)
    })

  const careEvents = events
    .filter(e => ['VOICE_MEMORY', 'NOTE', 'EXPENSE', 'APPOINTMENT', 'APPOINTMENT_PROOF'].includes(e.type))
    .sort((a, b) => b.timestamp - a.timestamp)

  const alertEvents = events
    .filter(e => e.type === 'SOS_ALERT')
    .sort((a, b) => b.timestamp - a.timestamp)

  if (medEvents.length === 0 && careEvents.length === 0 && alertEvents.length === 0) {
    return (
      <div style={{
        background: 'white', borderRadius: 16, border: '1px solid #EDE5D8',
        padding: '32px 16px', textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <span style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>🗓️</span>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Sin actividad registrada este día</p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16, border: '1px solid #EDE5D8',
      padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <CareDaySection title="Medicamentos" emoji="💊" count={medEvents.length}>
        {medEvents.map(evt => (
          <MedDetailRow
            key={evt.id}
            evt={evt}
            isToday={isToday}
            confirming={confirming}
            onConfirm={onConfirm}
            isFamiliar={isFamiliar}
          />
        ))}
      </CareDaySection>
      <CareDaySection title="Cuidado" emoji="🏥" count={careEvents.length}>
        {careEvents.map(evt => (
          <CareEventRow key={evt.id} evt={evt} onTap={onTap} />
        ))}
      </CareDaySection>
      <CareDaySection title="Alertas" emoji="🚨" count={alertEvents.length}>
        {alertEvents.map(evt => (
          <AlertDetailRow key={evt.id} evt={evt} onTap={onTap} />
        ))}
      </CareDaySection>
    </div>
  )
}

function QuickCard({ emoji, label, subtitle, statusColor, onClick, index, size = 'standard' }) {
  const [pressed, setPressed] = useState(false)
  const isLarge = size === 'large'
  const isSmall = size === 'small'
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        borderRadius: isSmall ? 12 : 14,
        border: '0.5px solid #E8E4DC',
        background: 'white',
        boxShadow: pressed ? 'none' : '0 1px 0px #E8E4DC',
        transform: pressed ? 'translateY(1px)' : 'none',
        padding: isLarge ? '16px 14px' : isSmall ? '10px 10px' : '14px 12px',
        cursor: 'pointer', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: isSmall ? 4 : 6,
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        animation: `fadeInUp 0.4s ease ${index * 0.08}s both`,
      }}
    >
      <span style={{ fontSize: isLarge ? 26 : isSmall ? 18 : 22 }}>{emoji}</span>
      <div>
        <p style={{ margin: 0, fontSize: isLarge ? 14 : isSmall ? 11 : 13, fontWeight: 700, color: '#1E2D26', lineHeight: 1.2 }}>{label}</p>
        {subtitle && (
          <p style={{ margin: isSmall ? '2px 0 0' : '3px 0 0', fontSize: isSmall ? 10 : 11, color: statusColor ?? '#9CA3AF', fontWeight: statusColor ? 600 : 400 }}>
            {subtitle}
          </p>
        )}
      </div>
    </button>
  )
}

function AttentionCard({ medName, medDosage, medTime, windowLabel, isExpired, onConfirm, onLate }) {
  return (
    <section aria-label="Necesita tu atención" style={{ background: '#FBEAE4', borderRadius: 26, overflow: 'hidden', boxShadow: '0 8px 24px -12px rgba(233,130,110,0.45)' }}>
      <div style={{ padding: '18px 18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
          <Bell size={19} color="#E9826E" strokeWidth={2} />
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: '#E9826E' }}>Necesita tu atención</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(233,130,110,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pill size={34} color="#E9826E" strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medName}{medDosage ? ` ${medDosage}` : ''}</p>
            <p style={{ margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#64748B' }}>
              <Clock size={15} color="#64748B" strokeWidth={2} /> Hoy {medTime}
            </p>
            <p style={{ margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#E9826E' }}>
              {isExpired
                ? <><Clock size={13} color="#E9826E" strokeWidth={2.4} /> ¿Se administró? Puedes registrarlo</>
                : <><AlertTriangle size={13} color="#E9826E" strokeWidth={2.4} /> Pendiente de confirmar</>}
            </p>
          </div>
          <button onClick={isExpired ? onLate : onConfirm} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, borderRadius: 15, background: '#E9826E', padding: '13px 17px', border: 'none', cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: 14.5, boxShadow: '0 8px 18px -6px rgba(233,130,110,0.7)', WebkitTapHighlightColor: 'transparent' }}>
            {isExpired ? 'Registrar' : 'Confirmar'} <CheckIcon size={17} color="white" strokeWidth={2.6} />
          </button>
        </div>
      </div>
      {windowLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(233,130,110,0.25)', padding: '13px 18px' }}>
          <Calendar size={15} color="#64748B" strokeWidth={1.9} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#64748B' }}>Ventana: {windowLabel}</span>
          <ChevronRight size={18} color="#C9A597" strokeWidth={2.2} />
        </div>
      )}
    </section>
  )
}

// Compartido entre la lista visible y el resumen narrado por IA (Fase 2) —
// misma función, mismos textos, para que nunca puedan divergir.
const ACTIVITY_ACTIONS = {
  MED_CONFIRMED:     evt => `confirmó ${evt.medName ?? 'medicamento'}`,
  VOICE_MEMORY:      () => 'grabó una memoria de voz',
  NOTE:              () => 'escribió una nota',
  EXPENSE:           () => 'registró un gasto',
  APPOINTMENT:       evt => `agregó una cita${evt.appointmentTitle ? `: ${evt.appointmentTitle}` : ''}`,
  APPOINTMENT_PROOF: () => 'confirmó una cita',
  CARE_LOG:          () => 'completó una rutina',
  INCIDENT:          evt => `registró ${incidentPhrase(evt.incidentType)}`,
}
function activityActor(evt, firstName) {
  return (evt.confirmedBy ?? evt.uploaderName ?? evt.recorderName ?? evt.authorName ?? firstName ?? 'Alguien').split(' ')[0]
}
function activityAction(evt) {
  return (ACTIVITY_ACTIONS[evt.type] ?? (() => 'registró actividad'))(evt)
}

function RecentActivity({ items, onViewAll, onSelect, firstName, summaryText, summaryEmpty, summaryStale }) {
  return (
    <section aria-label="Actividad reciente" style={{ borderRadius: 26, background: 'white', padding: 20, boxShadow: '0 6px 24px -12px rgba(51,65,85,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: '#334155' }}>
          <Heart size={19} color="#087F70" strokeWidth={2} /> Actividad reciente
        </h2>
        <button onClick={onViewAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#087F70', fontWeight: 700, padding: 0, WebkitTapHighlightColor: 'transparent' }}>Ver todo</button>
      </div>
      {(summaryEmpty || summaryText) && (
        <div style={{ background: '#EAF7F3', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#087F70', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Resumen del día</p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
            {summaryEmpty ? 'Aún no hay registros del día.' : summaryText}
          </p>
          {!summaryEmpty && summaryStale && (
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#7C8698', lineHeight: 1.4, fontStyle: 'italic' }}>
              Este resumen es de hoy, generado más temprano. Mañana Milo lo actualiza con lo último.
            </p>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <div style={{ padding: '6px 0 2px' }}>
          <p style={{ color: '#7C8698', fontSize: 13, margin: '0 0 4px', fontWeight: 500 }}>Aún no hay actividad reciente</p>
          <p style={{ color: '#B0A898', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            Cuando alguien confirme un medicamento,<br />suba una foto o escriba una nota,<br />aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
          {items.map((evt, i) => {
            const actor = activityActor(evt, firstName)
            const ACTIVITY_SUB = {
              MED_CONFIRMED:     'Dosis confirmada',
              EXPENSE:           evt.description ?? '',
              APPOINTMENT_PROOF: evt.appointmentTitle ?? '',
            }
            const meta = { text: activityAction(evt), sub: ACTIVITY_SUB[evt.type] ?? '' }
            const isNote = evt.type === 'NOTE'
            const time = evt.timestamp ? timeAgo(evt.timestamp instanceof Date ? evt.timestamp : new Date(evt.timestamp)) : ''
            const avatarLetter = actor.charAt(0).toUpperCase()
            const isFirst = i === 0
            const isLast = i === items.length - 1
            return (
              <li key={evt.id ?? i} onClick={() => onSelect?.(evt)} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: `${isFirst ? 0 : 13}px 0 ${isLast ? 0 : 13}px`, borderBottom: isLast ? 'none' : '1px solid #EEF2F6', cursor: onSelect ? 'pointer' : 'default' }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #A8E5D6, #087F70)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>
                  {avatarLetter}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.3 }}>
                    <span style={{ fontWeight: 700 }}>{actor}</span> {meta.text}
                  </p>
                  {meta.sub && (
                    <p style={{ margin: '3px 0 0', fontSize: 14, fontStyle: isNote ? 'italic' : 'normal', color: isNote ? '#475569' : '#94A3B8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isNote ? `"${meta.sub}"` : meta.sub}</p>
                  )}
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>{time}</p>
                </div>
                {isNote ? (
                  <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#EEF2F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Chat size={16} color="#94A3B8" strokeWidth={1.9} />
                  </span>
                ) : (
                  <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#E3F4EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckIcon size={16} color="#087F70" strokeWidth={2.6} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PetsCard({ onOpen, patientFirstName }) {
  return (
    <section aria-label="Asistente Milo y Luna" onClick={onOpen} style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, background: '#EAE7FA', padding: '16px 18px', boxShadow: '0 8px 24px -12px rgba(117,102,216,0.4)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 'none', width: 74, height: 66, borderRadius: 16, overflow: 'hidden', background: '#DDD8F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/images/milo-luna.webp" alt="Milo el perro y Luna la gata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 600, color: '#5B4FC0', lineHeight: 1.2 }}>Milo y Luna están aquí para ayudar</p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#6E64A8', lineHeight: 1.3 }}>
            {patientFirstName ? `¿Necesitas algo sobre el cuidado de ${patientFirstName}?` : '¿Necesitas algo sobre el cuidado de tu familiar?'}
          </p>
          <button onClick={(e) => { e.stopPropagation(); onOpen() }} style={{ marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, background: '#7566D8', padding: '10px 16px', border: 'none', cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: 13.5, boxShadow: '0 8px 16px -6px rgba(117,102,216,0.6)', WebkitTapHighlightColor: 'transparent' }}>
            <MessageCircle size={16} color="white" strokeWidth={2} /> Hablar con Milo y Luna
          </button>
        </div>
        <ChevronRight size={20} color="#8E82D6" strokeWidth={2.2} />
      </div>
    </section>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { profile, ownerId, memberRole, families, hasMultiple, needsSelector, switchFamily, activeFamilyLabel, activePatientName } = useFamily()
  const navigate = useNav()
  const isFamiliar = memberRole === 'familiar'
  const isAdmin = memberRole === null || ownerId === user?.id
  const { isHospitalMode } = useHospitalMode()
  const [showHospitalModal, setShowHospitalModal] = useState(false)
  const [showVideoCallModal, setShowVideoCallModal] = useState(false)
  const [startingInstantCall, setStartingInstantCall] = useState(false)
  const [instantCallError, setInstantCallError] = useState('')
  const [renewalAlerts, setRenewalAlerts] = useState([])
  const { sub, loading: subLoading, refresh: refreshSub } = useSubscription()
  const [searchParams, setSearchParams] = useSearchParams()

  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const { trigger: medSuccessTrigger, fire: fireMedSuccess } = useSuccessAnimation()
  const { containerRef: pullRef, onTouchStart: pullStart, onTouchMove: pullMove, onTouchEnd: pullEnd, PullIndicator } = usePullToRefresh(fetchTimeline)
  const [expandedAudio, setExpandedAudio] = useState(null)
  const [medTotal, setMedTotal] = useState(0)
  const [medsList, setMedsList]  = useState([])
  const [totalStock, setTotalStock] = useState(0)
  const [showAllTools, setShowAllTools] = useState(false)
  const [showSOS, setShowSOS] = useState(false)
  const [sosSent, setSosSent] = useState(false)
  const [sosConfirming, setSosConfirming] = useState(false)
  const [aiCards, setAiCards] = useState({})
  const [activitySummaryText, setActivitySummaryText] = useState(null)
  const [activitySummaryStale, setActivitySummaryStale] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [reactions, setReactions] = useState({})
  const [sosLocation, setSosLocation] = useState(null)
  const [adminConfirmEvt, setAdminConfirmEvt] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [attachingProof, setAttachingProof] = useState(null)
  const [proofError, setProofError] = useState('')
  const [chatCount, setChatCount] = useState(0)
  const [patientProfileIncomplete, setPatientProfileIncomplete] = useState(false)
  const [patientProfile, setPatientProfile] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [careLogsToday, setCareLogsToday] = useState({})
  const [dailyMood, setDailyMood] = useState(null)
  const [careRecordMood, setCareRecordMood] = useState(null)
  const [savingMood, setSavingMood] = useState(false)
  const [pressedMood, setPressedMood] = useState(null)
  const [pressedSOS, setPressedSOS] = useState(false)
  const [weekShifts, setWeekShifts] = useState([])
  const [familyCount, setFamilyCount] = useState(1)
  const { permission, notifActivated, requestAndSubscribe } = usePushNotifications()
  const [notifDismissed, setNotifDismissed] = useState(() => !!localStorage.getItem('notif_dismissed'))
  function dismissNotifBanner() { localStorage.setItem('notif_dismissed', '1'); setNotifDismissed(true) }
  const [familyNames, setFamilyNames] = useState([])
  const [familyMembers, setFamilyMembers] = useState([])

  // Tracks scheduled appointment reminder timeouts by event id to prevent duplicates
  const apptReminderTimeouts = useRef(new Map())
  const apptReminderScheduled = useRef(new Set())
  // Initialized to today's key so today is expanded; past days start collapsed
  const [expandedDays, setExpandedDays] = useState(() => new Set([new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })]))
  const [selectedDayTab, setSelectedDayTab] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' }))
  const [showCompanion, setShowCompanion] = useState(false)
  const [showFamilySwitcher, setShowFamilySwitcher] = useState(false)
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [notifMessages, setNotifMessages] = useState([])
  const [notifNotes, setNotifNotes] = useState([])

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setCheckoutSuccess(true)
      refreshSub()
      setSearchParams({}, { replace: true })
      setTimeout(() => setCheckoutSuccess(false), 6000)
    }
  }, [])

  // Deep-link from "Todo el cuidado" → Modo emergencia: opens the same SOS confirm flow
  useEffect(() => {
    if (searchParams.get('sos') === '1') {
      setSearchParams({}, { replace: true })
      prepareSOS()
    }
  }, [])

  // Auto-open family switcher when user has multiple families and no stored preference
  useEffect(() => {
    if (needsSelector && hasMultiple) setShowFamilySwitcher(true)
  }, [needsSelector, hasMultiple])

  const now = new Date()
  const todayKey     = toLocalDateKey(now)
  const yesterday    = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = toLocalDateKey(yesterday)
  const tomorrow     = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey  = toLocalDateKey(tomorrow)
  const sevenAgo     = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 6)
  const sevenAgoKey  = toLocalDateKey(sevenAgo)
  const tabDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - i)
    return toLocalDateKey(d)
  })
  // UTC ISO strings for DB queries: midnight in local timezone → correct UTC boundary
  const todayStartISO   = new Date(now.getFullYear(),     now.getMonth(),     now.getDate()).toISOString()
  const sevenAgoStartISO = new Date(sevenAgo.getFullYear(), sevenAgo.getMonth(), sevenAgo.getDate()).toISOString()

  const fullName = user?.user_metadata?.full_name ?? user?.email ?? 'Cuidador'
  const firstName = fullName.split(' ')[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isSundayEvening = now.getDay() === 0 && now.getHours() >= 17

  useEffect(() => {
    if (user && ownerId) fetchTimeline()
  }, [user, ownerId])

  // Clear all appointment reminder timeouts on unmount
  useEffect(() => {
    return () => {
      for (const tid of apptReminderTimeouts.current.values()) clearTimeout(tid)
    }
  }, [])

  useEffect(() => {
    if (user) track('session_start', { user_id: user.id })
  }, [user?.id])

  useEffect(() => {
    if (!ownerId || !user) return
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .neq('user_id', user.id)
      .gte('created_at', todayStartISO)
      .then(({ count }) => setChatCount(count ?? 0))
  }, [ownerId, user?.id, todayKey])

  useEffect(() => {
    if (!ownerId || !user) return
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase
        .from('chat_messages')
        .select('id, message, user_name, created_at')
        .eq('owner_id', ownerId)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('notes')
        .select('id, title, content, created_at, created_by_user_id')
        .eq('user_id', ownerId)
        .neq('created_by_user_id', user.id)
        .not('created_by_user_id', 'is', null)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(async ([{ data: msgs }, { data: nts }]) => {
      setNotifMessages(msgs ?? [])
      const rows = nts ?? []
      const authorIds = [...new Set(rows.map(n => n.created_by_user_id).filter(Boolean))]
      let authorMap = {}
      if (authorIds.length) {
        const { data: profiles } = await supabase
          .from('user_profiles').select('id, full_name').in('id', authorIds)
        ;(profiles ?? []).forEach(p => { authorMap[p.id] = p.full_name })
      }
      setNotifNotes(rows.map(n => ({ ...n, authorName: authorMap[n.created_by_user_id] ?? 'Cuidador' })))
    })
  }, [ownerId, user?.id])

  useEffect(() => {
    if (!ownerId) return
    setPatientProfile(null)
    supabase
      .from('patient_profiles')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle()
      .then(({ data: pp }) => {
        setPatientProfile(pp ?? null)
        setPatientProfileIncomplete(!pp?.nombre_completo)
      })
  }, [ownerId])

  useEffect(() => {
    function onPatientUpdated(e) {
      if (!ownerId) return
      // Camino rápido: la URL ya viene en el evento (subida de foto) — no hace
      // falta ida y vuelta a la base de datos, se aplica en el mismo tick.
      if (e?.detail?.ownerId === ownerId && e.detail.photoUrl) {
        setPatientProfile(prev => prev ? { ...prev, photo_url: e.detail.photoUrl } : prev)
        return
      }
      // Camino lento: otros cambios del perfil (nombre, diagnóstico, etc.) que
      // no traen detail — sí hace falta refetch.
      supabase.from('patient_profiles').select('*').eq('owner_id', ownerId).maybeSingle()
        .then(({ data: pp }) => {
          setPatientProfile(pp ?? null)
          setPatientProfileIncomplete(!pp?.nombre_completo)
        })
    }
    window.addEventListener('patientProfileUpdated', onPatientUpdated)
    return () => window.removeEventListener('patientProfileUpdated', onPatientUpdated)
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('daily_moods')
      .select('mood')
      .eq('owner_id', ownerId)
      .eq('log_date', todayKey)
      .maybeSingle()
      .then(({ data }) => setDailyMood(data?.mood ?? null))
  }, [ownerId, todayKey])

  useEffect(() => {
    if (!ownerId) return
    ;(async () => {
      const { data: membersData } = await supabase
        .from('family_members')
        .select('member_user_id, role, member_email')
        .eq('user_id', ownerId)
      const memberIds = [...new Set([ownerId, ...(membersData ?? []).map(m => m.member_user_id).filter(Boolean)])]
      const { data: profilesData } = memberIds.length
        ? await supabase.from('user_profiles').select('id, full_name, last_seen').in('id', memberIds)
        : { data: [] }
      // Sort by role priority (admin=0 > cuidador=1 > familiar/null=2), then first-occurrence dedup per member_user_id
      const _rolePri = r => r === 'admin' ? 0 : r === 'cuidador' ? 1 : 2
      const _sorted = [...(membersData ?? [])]
        .filter(m => m.member_user_id && m.member_user_id !== ownerId)
        .sort((a, b) => _rolePri(a.role) - _rolePri(b.role))
      const _seenMembers = new Set()
      const uniqueMembersData = _sorted.filter(m => {
        if (_seenMembers.has(m.member_user_id)) return false
        _seenMembers.add(m.member_user_id)
        return true
      })
      const ownerProfile = (profilesData ?? []).find(p => p.id === ownerId)
      const members = [
        { id: ownerId, full_name: ownerProfile?.full_name ?? fullName ?? null, email: null, role: 'admin', last_seen: ownerProfile?.last_seen ?? null },
        ...uniqueMembersData.map(m => {
          const p = (profilesData ?? []).find(x => x.id === m.member_user_id)
          return {
            id: m.member_user_id,
            full_name: p?.full_name ?? null,
            email: m.member_email ?? null,
            role: m.role ?? 'familiar',
            last_seen: p?.last_seen ?? null,
          }
        }),
      ]
      setFamilyMembers(members)
      setFamilyCount(members.length)
      setFamilyNames(members.map(m => m.full_name?.split(' ')?.[0] || m.email?.split('@')?.[0] || 'Usuario'))
    })()
  }, [ownerId, fullName])

  useEffect(() => {
    if (!ownerId) return
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i)
      return d.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
    })
    supabase
      .from('care_shifts')
      .select('shift_date, caregiver_name')
      .eq('owner_id', ownerId)
      .in('shift_date', days)
      .then(({ data }) => setWeekShifts(data ?? []))
  }, [ownerId, todayKey])

  // Schedule daily browser notifications (fires when app is open/in background)
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const patientName = patientProfile?.nombre_completo || profile?.name || 'el familiar'

    function msUntil(targetH, targetM) {
      const n = new Date()
      const t = new Date(n)
      t.setHours(targetH, targetM, 0, 0)
      if (t <= n) t.setDate(t.getDate() + 1)
      return t - n
    }

    // 7:30am — morning ritual
    const morningTimer = setTimeout(() => {
      new Notification('Buenos días 🌅', {
        body: `Hoy toca dar medicamentos. ${firstName} cuida hoy.`,
        icon: '/icon-192.png',
        tag: 'morning-ritual',
      })
    }, msUntil(7, 30))

    // 9pm — evening tranquility
    const eveningTimer = setTimeout(() => {
      const todaySec = sections.find(s => s.dateKey === todayKey)
      const confirmed = todaySec?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0
      const pending = todaySec?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
      const body = pending > 0
        ? `Faltó ${pending} medicamento${pending !== 1 ? 's' : ''} hoy. Mañana es un nuevo día 💙`
        : `Todo en orden hoy 💙 — ${confirmed} medicamento${confirmed !== 1 ? 's' : ''} dado${confirmed !== 1 ? 's' : ''}, ${firstName} estuvo con ${patientName}`
      new Notification('FamiliaCerca', {
        body,
        icon: '/icon-192.png',
        tag: 'evening-summary',
      })
    }, msUntil(21, 0))

    return () => {
      clearTimeout(morningTimer)
      clearTimeout(eveningTimer)
    }
  }, [profile?.name, firstName, sections, todayKey])

  async function generateAiCards({ confirmedCount, pendingCount, patientName, caregiverName, caregiverNames, weekCount, isSunday }) {
    const newCards = {}
    const wk = weekKey()
    const uid = user?.id ?? 'anon'
    const h = new Date().getHours()

    if (h >= 7 && h < 19) {
      const k = `fc_ai_morning_${uid}_${todayKey}`
      const cached = localStorage.getItem(k)
      if (cached) {
        newCards.morning = cached
      } else {
        const text = await geminiGenerate(
          `Eres un asistente emocional cálido para cuidadores familiares. ${caregiverName} cuida a ${patientName}. Es por la mañana. Escribe un mensaje breve de aliento en español (máximo 2 oraciones, sin asteriscos) para comenzar el día con energía.`,
          100
        )
        if (text) { localStorage.setItem(k, text); newCards.morning = text }
      }
    }

    if (h >= 20) {
      const k = `fc_ai_evening_${uid}_${todayKey}`
      const cached = localStorage.getItem(k)
      if (cached) {
        newCards.evening = cached
      } else {
        const status = pendingCount > 0
          ? `faltaron ${pendingCount} medicamento(s) por dar`
          : `se dieron ${confirmedCount} medicamento(s) correctamente`
        const text = await geminiGenerate(
          `Eres un asistente emocional cálido para cuidadores familiares. Hoy ${status} para ${patientName}. Escribe un resumen emocional cálido del día en español (máximo 2 oraciones, sin asteriscos) que reconozca el esfuerzo del cuidador.`,
          110
        )
        if (text) { localStorage.setItem(k, text); newCards.evening = text }
      }
    }

    if (caregiverNames.length >= 5) {
      const unique = new Set(caregiverNames.filter(Boolean))
      if (unique.size === 1) {
        const k = `fc_ai_burnout_${uid}_${todayKey}`
        const cached = localStorage.getItem(k)
        if (cached) {
          newCards.burnout = cached
        } else {
          const solo = [...unique][0].split(' ')[0]
          const text = await geminiGenerate(
            `Eres un asistente emocional para cuidadores familiares. ${solo} ha estado cuidando solo/a varios días consecutivos. Escribe un mensaje breve y compasivo en español (máximo 2 oraciones, sin asteriscos) que reconozca el agotamiento y sugiera pedir apoyo familiar sin culpa.`,
            120
          )
          if (text) { localStorage.setItem(k, text); newCards.burnout = text }
        }
      }
    }

    if (isSunday) {
      const k = `fc_ai_weekly_${uid}_${wk}`
      const cached = localStorage.getItem(k)
      if (cached) {
        newCards.weekly = cached
      } else {
        const text = await geminiGenerate(
          `Eres un asistente emocional para cuidadores familiares. Esta semana la familia administró ${weekCount} dosis de medicamentos a ${patientName}. Escribe un resumen semanal cálido en español (máximo 2 oraciones, sin asteriscos) que celebre el esfuerzo familiar.`,
          120
        )
        if (text) { localStorage.setItem(k, text); newCards.weekly = text }
      }
    }

    if (Object.keys(newCards).length > 0) setAiCards(newCards)
  }

  useEffect(() => {
    if (loading || !ownerId || !profile) return
    const todaySec = sections.find(s => s.dateKey === todayKey)
    const confirmedCount = todaySec?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0
    const pendingCount = todaySec?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
    const allConfirmed = sections.flatMap(s => s.events.filter(e => e.type === 'MED_CONFIRMED'))
    const caregiverNames = allConfirmed.map(e => e.confirmedBy).filter(Boolean)
    generateAiCards({
      confirmedCount,
      pendingCount,
      patientName: profile.name ?? 'el familiar',
      caregiverName: firstName,
      caregiverNames,
      weekCount: allConfirmed.length,
      isSunday: now.getDay() === 0,
    })
  }, [loading, ownerId, profile?.name])

  async function fetchTimeline() {
    setLoading(true)
    setTimelineError('')
    // Safety net: if any Supabase query hangs on slow mobile, unblock after 12 s
    const timeoutTimer = setTimeout(() => {
      setTimelineError('No se pudo cargar el historial. Verifica tu conexión.')
      setLoading(false)
    }, 12000)
    try {
    // Get all family member IDs for shared data queries
    const { data: familyMembers } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', ownerId)

    const allFamilyIds = [
      ownerId,
      ...(familyMembers ?? []).map(m => m.member_user_id).filter(Boolean),
    ]

    const [
      { data: meds },
      { data: todayLogs },
      { data: confirmedLogs },
      { data: voiceMemories },
      { data: expenses },
      { data: events },
      { data: sosAlerts },
      { data: careLogsData },
      { data: incidents },
      { data: careRecordToday },
    ] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', ownerId),

      supabase.from('medication_logs').select('*')
        .eq('user_id', ownerId).eq('log_date', todayKey),

      supabase.from('medication_logs')
        .select('*, medications(name, dosage)')
        .eq('user_id', ownerId)
        .gte('log_date', sevenAgoKey)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: false })
        .limit(60),

      supabase.from('voice_diary')
        .select('*')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoStartISO)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('care_expenses')
        .select('*')
        .eq('user_id', ownerId)
        .gte('created_at', sevenAgoStartISO)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('events')
        .select('*')
        .eq('user_id', ownerId)
        .gte('date', sevenAgoKey)
        .order('date', { ascending: true })
        .limit(20),

      supabase.from('emergency_alerts')
        .select('*')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoStartISO)
        .order('created_at', { ascending: false })
        .limit(10),

      supabase.from('daily_care_logs')
        .select('item_key, status')
        .eq('user_id', ownerId)
        .eq('log_date', todayKey),

      supabase.from('notes')
        .select('*')
        .eq('user_id', ownerId)
        .eq('is_incident', true)
        .gte('created_at', sevenAgoStartISO)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('care_records')
        .select('mood, recorded_at')
        .eq('owner_id', ownerId)
        .gte('recorded_at', new Date(todayKey + 'T00:00:00').toISOString())
        .lte('recorded_at', new Date(todayKey + 'T23:59:59').toISOString())
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setMedTotal((meds ?? []).length)
    setMedsList(meds ?? [])
    setCareRecordMood(careRecordToday?.mood ?? null)

    const careLogMap = {}
    ;(careLogsData ?? []).forEach(r => { if (r.status !== 'no_completado') careLogMap[r.item_key] = true })
    setCareLogsToday(careLogMap)

    const todayLogMap = {}
    ;(todayLogs ?? []).forEach(l => { todayLogMap[l.medication_id] = l })

    const allEvents = []

    // ── Pending medications (scheduled time passed, not confirmed) ──
    for (const med of (meds ?? [])) {
      if (todayLogMap[med.id]?.status === 'confirmed') continue
      const times = med.scheduled_times?.length
        ? [...med.scheduled_times].sort()
        : (med.time ? [med.time] : [])
      const pastTimes = times.filter(t => {
        const [th, tm] = t.split(':').map(Number)
        return th * 60 + tm <= nowMinutes
      })
      if (pastTimes.length > 0 || times.length === 0) {
        allEvents.push({
          id: `pending-${med.id}`,
          type: 'MED_PENDING',
          timestamp: times[0]
            ? new Date(`${todayKey}T${times[0]}:00`)
            : new Date(`${todayKey}T00:00:00`),
          dateKey: todayKey,
          medicationId: med.id,
          medName: med.name,
          medDosage: med.dosage,
          medTime: times[0] ?? null,
          allTimes: times,
          medStatus: calcularEstadoMedicamento(times[0] ?? null),
        })
      }
    }

    // ── Missed medications for past days (no confirmation found) ──
    const pastDays = []
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      pastDays.push(toLocalDateKey(d))
    }
    const confirmedByDay = {}
    for (const log of (confirmedLogs ?? [])) {
      if (!confirmedByDay[log.log_date]) confirmedByDay[log.log_date] = new Set()
      confirmedByDay[log.log_date].add(log.medication_id)
    }
    for (const dayKey of pastDays) {
      for (const med of (meds ?? [])) {
        if (confirmedByDay[dayKey]?.has(med.id)) continue
        const times = med.scheduled_times?.length
          ? [...med.scheduled_times].sort()
          : (med.time ? [med.time] : [])
        allEvents.push({
          id: `missed-${dayKey}-${med.id}`,
          type: "MED_MISSED",
          timestamp: times[0]
            ? new Date(`${dayKey}T${times[0]}:00`)
            : new Date(`${dayKey}T08:00:00`),
          dateKey: dayKey,
          medicationId: med.id,
          medName: med.name,
          medDosage: med.dosage,
          medTime: times[0] ?? null,
        })
      }
    }

    // ── Confirmed medication logs ──
    for (const log of (confirmedLogs ?? [])) {
      if (!log.medications) continue
      allEvents.push({
        id: `log-${log.id}`,
        type: 'MED_CONFIRMED',
        timestamp: new Date(log.confirmed_at ?? `${log.log_date}T12:00:00`),
        dateKey: log.log_date,
        logId: log.id,
        medicationId: log.medication_id,
        medName: log.medications.name,
        medDosage: log.medications.dosage,
        confirmedBy: log.confirmed_by_name,
        latitude: log.latitude ?? null,
        longitude: log.longitude ?? null,
        address: log.address ?? null,
        photoUrl: log.photo_url ?? null,
      })
    }

    // ── Missed medications for past days (generates entries for days with no activity) ──
    const confirmedByDate = {}
    for (const log of (confirmedLogs ?? [])) {
      if (!confirmedByDate[log.log_date]) confirmedByDate[log.log_date] = new Set()
      confirmedByDate[log.log_date].add(log.medication_id)
    }
    const dayMs = 86400000
    const sevenAgoTs = new Date(sevenAgoKey + 'T12:00:00').getTime()
    const yesterdayTs = new Date(yesterdayKey + 'T12:00:00').getTime()
    for (let ts = sevenAgoTs; ts <= yesterdayTs; ts += dayMs) {
      const dk = toLocalDateKey(new Date(ts))
      const confirmedOnDay = confirmedByDate[dk] ?? new Set()
      for (const med of (meds ?? [])) {
        if (confirmedOnDay.has(med.id)) continue
        const times = med.scheduled_times?.length
          ? [...med.scheduled_times].sort()
          : (med.time ? [med.time] : [])
        if (times.length === 0) continue
        allEvents.push({
          id: `missed-${dk}-${med.id}`,
          type: 'MED_MISSED',
          timestamp: times[0]
            ? new Date(`${dk}T${times[0]}:00`)
            : new Date(`${dk}T12:00:00`),
          dateKey: dk,
          medicationId: med.id,
          medName: med.name,
          medDosage: med.dosage,
          medTime: times[0] ?? null,
        })
      }
    }

    // ── Voice memories ──
    for (const mem of (voiceMemories ?? [])) {
      const dateKey = toLocalDateKey(new Date(mem.created_at))
      allEvents.push({
        id: `mem-${mem.id}`,
        type: 'VOICE_MEMORY',
        timestamp: new Date(mem.created_at),
        dateKey,
        audioUrl: mem.audio_url,
        transcription: mem.transcription,
        recorderName: mem.user_profiles?.full_name ?? null,
        mood: mem.mood ?? null,
      })
    }

    // ── Expenses ──
    for (const exp of (expenses ?? [])) {
      const ts = exp.created_at ?? (exp.date ? exp.date + 'T12:00:00' : todayKey)
      const dateKey = toLocalDateKey(new Date(ts))
      allEvents.push({
        id: `exp-${exp.id}`,
        type: 'EXPENSE',
        timestamp: new Date(ts),
        dateKey,
        amount: exp.amount,
        description: exp.description ?? exp.category ?? 'Gasto',
        paidBy: exp.paid_by ?? null,
        receiptUrl: exp.receipt_url ?? null,
      })
    }

    // ── Appointments: upcoming + past attended (con foto de comprobante) ──
    // proof_photo_url/proof_notes/attended viven directo en events desde la
    // fusión de appointment_proofs (ver supabase/merge_appointment_proofs_into_events.sql).
    for (const ev of (events ?? [])) {
      const evDate = ev.date
      const evTime = ev.time

      if (evDate >= todayKey) {
        // Hoy o futura — se muestra como cita próxima, ya sea que tenga
        // comprobante o no (attended se resuelve dentro del detalle).
        allEvents.push({
          id: `evt-${ev.id}`,
          type: 'APPOINTMENT',
          timestamp: new Date(`${evDate}T${evTime ?? '09:00'}:00`),
          dateKey: evDate,
          appointmentId: ev.id,
          appointmentTitle: ev.title,
          appointmentTime: evTime ?? null,
          status: ev.status ?? 'programada',
          attended: ev.attended ?? false,
          proofPhotoUrl: ev.proof_photo_url ?? null,
          proofNotes: ev.proof_notes ?? null,
        })
      } else if (ev.attended) {
        // Pasada y con comprobante — se surfacea en el timeline
        allEvents.push({
          id: `proof-${ev.id}`,
          type: 'APPOINTMENT_PROOF',
          timestamp: new Date(`${evDate}T${evTime ?? '09:00'}:00`),
          dateKey: evDate,
          appointmentId: ev.id,
          appointmentTitle: ev.title,
          appointmentTime: evTime ?? null,
          proofPhotoUrl: ev.proof_photo_url ?? null,
          proofNotes: ev.proof_notes ?? null,
        })
      }
    }

    // ── SOS alerts ──
    for (const alert of (sosAlerts ?? [])) {
      const dateKey = toLocalDateKey(new Date(alert.created_at))
      allEvents.push({
        id: `sos-${alert.id}`,
        sosAlertId: alert.id,
        type: 'SOS_ALERT',
        timestamp: new Date(alert.created_at),
        dateKey,
        triggeredBy: alert.triggered_by_name,
        latitude: alert.latitude ?? null,
        longitude: alert.longitude ?? null,
        address: alert.address ?? null,
        resolved: alert.resolved ?? false,
      })
    }

    // ── Incidents (caídas, fiebre, presión alta, agresividad... — notas marcadas is_incident) ──
    for (const inc of (incidents ?? [])) {
      const dateKey = toLocalDateKey(new Date(inc.created_at))
      allEvents.push({
        id: `incident-${inc.id}`,
        type: 'INCIDENT',
        timestamp: new Date(inc.created_at),
        dateKey,
        incidentType: inc.incident_type,
        incidentDescription: inc.content,
        photoUrl: inc.photo_url,
      })
    }

    // ── Caregiver recognition (Sunday evenings) ──
    if (isSundayEvening) {
      allEvents.push({
        id: 'caregiver-card',
        type: 'CAREGIVER_CARD',
        timestamp: new Date(`${todayKey}T17:00:00`),
        dateKey: todayKey,
        caregiverName: fullName,
        weekCount: (confirmedLogs ?? []).length,
      })
    }

    // Group by date, sort sections newest first
    const dateMap = {}
    for (const evt of allEvents) {
      if (!dateMap[evt.dateKey]) dateMap[evt.dateKey] = []
      dateMap[evt.dateKey].push(evt)
    }

    // Ensure all 7 days appear even when they have no events
    for (let ts = sevenAgoTs; ts <= new Date(todayKey + 'T12:00:00').getTime(); ts += dayMs) {
      const dk = toLocalDateKey(new Date(ts))
      if (!dateMap[dk]) dateMap[dk] = []
    }

    const sortedKeys = Object.keys(dateMap).sort((a, b) => b.localeCompare(a))
    const newSections = sortedKeys.map(dk => ({
      dateKey: dk,
      label: dateLabelFor(dk, todayKey, yesterdayKey),
      events: sortSection(dateMap[dk]),
    }))

    clearTimeout(timeoutTimer)
    setSections(newSections)
    setLoading(false)

    // ── Appointment reminders: schedule a notification 1 hour before each upcoming event ──
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      for (const ev of (events ?? [])) {
        if (!ev.time || !ev.date) continue
        const key = `appt-${ev.id}`
        if (apptReminderScheduled.current.has(key)) continue

        const [hh, mm] = ev.time.split(':').map(Number)
        const apptTs = new Date(`${ev.date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`).getTime()
        const reminderTs = apptTs - 60 * 60 * 1000          // 1 hour before
        const msUntil = reminderTs - Date.now()

        // Only schedule reminders that are in the future and within 8 hours
        if (msUntil < 0 || msUntil > 8 * 60 * 60 * 1000) continue

        apptReminderScheduled.current.add(key)
        const tid = setTimeout(() => {
          const timeLabel = `${hh % 12 || 12}:${String(mm).padStart(2, '0')}${hh >= 12 ? 'pm' : 'am'}`
          navigator.serviceWorker.ready
            .then(reg => reg.showNotification('📅 Cita médica en 1 hora', {
              body: `${ev.title} · ${timeLabel}`,
              icon: '/icon-192.png',
              badge: '/icon-72.png',
              tag: key,
              data: { url: '/calendar' },
              actions: [{ action: 'view', title: 'Ver en calendario' }],
            }))
            .catch(() => {})
        }, msUntil)

        apptReminderTimeouts.current.set(key, tid)
      }
    }

    // Load reactions for all visible event keys
    const eventKeys = allEvents.map(e => e.id)
    if (eventKeys.length) {
      const { data: rxRows } = await supabase
        .from('timeline_reactions')
        .select('event_key, emoji, user_id')
        .eq('owner_id', ownerId)
        .in('event_key', eventKeys)
      const map = {}
      for (const r of (rxRows ?? [])) {
        if (!map[r.event_key]) map[r.event_key] = []
        map[r.event_key].push(r)
      }
      setReactions(map)
    }
    } catch (err) {
      console.error(err)
      clearTimeout(timeoutTimer)
      setTimelineError('No se pudo cargar el historial. Verifica tu conexión.')
      setLoading(false)
    }
  }

  async function toggleReaction(eventKey, emoji) {
    const existing = reactions[eventKey]?.find(r => r.user_id === user.id && r.emoji === emoji)
    if (existing) {
      await supabase.from('timeline_reactions')
        .delete()
        .eq('event_key', eventKey)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
      setReactions(prev => ({
        ...prev,
        [eventKey]: (prev[eventKey] ?? []).filter(r => !(r.user_id === user.id && r.emoji === emoji)),
      }))
    } else {
      await supabase.from('timeline_reactions').insert({
        owner_id: ownerId, event_key: eventKey, user_id: user.id, emoji,
      })
      setReactions(prev => ({
        ...prev,
        [eventKey]: [...(prev[eventKey] ?? []), { event_key: eventKey, user_id: user.id, emoji }],
      }))
    }
  }

  function handleConfirmMed(evt) {
    if (isFamiliar) return
    if (isAdmin) { setAdminConfirmEvt(evt); return }
    quickConfirm(evt)
  }

  function pickProofGallery() {
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'
    el.addEventListener('change', e => {
      const f = e.target.files?.[0]
      if (f) submitAppointmentProof(f)
    }, { once: true })
    el.click()
  }

  async function submitAppointmentProof(file) {
    const evt = attachingProof
    if (!evt) return
    setAttachingProof(null)
    setProofError('')
    try {
      const { photoUrl } = await saveAppointmentProof(evt.appointmentId, user.id, { file })
      setSections(prev => prev.map(section => ({
        ...section,
        events: section.events.map(e =>
          e.id === evt.id ? { ...e, attended: true, proofPhotoUrl: photoUrl } : e
        ),
      })))
    } catch (err) {
      console.error('[appointmentProof] upload failed:', err)
      setProofError('No se pudo subir el comprobante. Intenta de nuevo.')
      setTimeout(() => setProofError(''), 6000)
    }
  }

  async function quickConfirm(evt) {
    setConfirming(evt.medicationId)
    setConfirmError('')
    const { error } = await supabase.from('medication_logs').upsert({
      medication_id: evt.medicationId,
      user_id: ownerId,
      status: 'confirmed',
      log_date: todayKey,
      confirmed_by_name: fullName,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: 'medication_id,log_date,user_id' })

    if (error) {
      setConfirmError(`No se pudo registrar ${evt.medName}. Toca de nuevo.`)
      setTimeout(() => setConfirmError(''), 6000)
    } else {
      const confirmedEvt = {
        id: `log-new-${evt.medicationId}`,
        type: 'MED_CONFIRMED',
        timestamp: new Date(),
        dateKey: todayKey,
        medName: evt.medName,
        medDosage: evt.medDosage,
        confirmedBy: fullName,
      }
      setSections(prev =>
        prev.map(section => {
          if (section.dateKey !== todayKey) return section
          const filtered = section.events.filter(e => e.id !== evt.id)
          return { ...section, events: sortSection([...filtered, confirmedEvt]) }
        })
      )
      fireMedSuccess()
    }
    setConfirming(null)
  }

  useEffect(() => {
    if (!ownerId) return
    async function checkRenewalAlerts() {
      const { data: stocks } = await supabase
        .from('medication_stock')
        .select('medication_id, pills_remaining, total_pills, doses_per_day, estimated_end_date')
        .eq('user_id', ownerId)
      if (!stocks?.length) { setRenewalAlerts([]); return }

      const { data: meds } = await supabase
        .from('medications').select('id, name, dosage')
        .in('id', stocks.map(s => s.medication_id))

      const sevenAgoKey = (() => {
        const d = new Date(); d.setDate(d.getDate() - 7)
        return d.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
      })()
      const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })

      const { data: recentLogs } = await supabase
        .from('medication_logs')
        .select('medication_id')
        .eq('user_id', ownerId)
        .gte('log_date', sevenAgoKey)
        .eq('status', 'confirmed')
      const recentLogIds = new Set((recentLogs ?? []).map(l => l.medication_id))

      const SEVERITY = { exhausted: 0, critical: 1, warning: 2, silent: 3 }
      const alerts = []
      for (const m of (meds ?? [])) {
        const stock = stocks.find(s => s.medication_id === m.id)
        if (!stock) continue
        const pills = stock.pills_remaining ?? 0
        const dpd = Math.max(0.5, parseFloat(stock.doses_per_day) || 1)
        const daysLeft = Math.floor(pills / dpd)
        const endDatePast = stock.estimated_end_date && stock.estimated_end_date < todayKey

        let kind
        if (pills === 0)                                       kind = 'exhausted'
        else if (daysLeft <= 3)                               kind = 'critical'
        else if (daysLeft <= 7)                               kind = 'warning'
        else if (endDatePast && !recentLogIds.has(m.id))     kind = 'silent'
        else                                                   continue

        alerts.push({ ...m, stock, kind, daysLeft, pills })
      }
      alerts.sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind])
      setRenewalAlerts(alerts)
    }
    checkRenewalAlerts()
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('medication_stock')
      .select('pills_remaining')
      .eq('user_id', ownerId)
      .then(({ data }) => {
        const total = (data ?? []).reduce((sum, s) => sum + (Number(s.pills_remaining) || 0), 0)
        setTotalStock(total)
      })
  }, [ownerId])

  async function handleInstantCall() {
    if (!ownerId || startingInstantCall) return
    setStartingInstantCall(true)
    setInstantCallError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ownerId, title: 'Llamada ahora', scheduledAt: new Date().toISOString(), participants: 'all' }),
        }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al iniciar')
      navigate(`/videollamada?id=${body.callId}`)
    } catch (err) {
      setInstantCallError(err.message)
      setStartingInstantCall(false)
    }
  }

  async function prepareSOS() {
    setSosConfirming(true)
    const loc = await getLocation()
    setSosLocation(loc)
  }

  async function triggerSOS() {
    setSosConfirming(false)

    // Log in DB (triggers realtime banner for all family members)
    const { error: insertError } = await supabase.from('emergency_alerts').insert({
      user_id: user.id,
      owner_id: ownerId,
      triggered_by_name: fullName,
      relative_name: profile?.name ?? null,
      latitude: sosLocation?.latitude ?? null,
      longitude: sosLocation?.longitude ?? null,
      address: sosLocation?.address ?? null,
    })
    // Send push notification to ALL family members via edge function
    if (ownerId) {
      const payload = {
        ownerId,
        triggeredByName: fullName,
        latitude: sosLocation?.latitude ?? null,
        longitude: sosLocation?.longitude ?? null,
        address: sosLocation?.address ?? null,
      }
      try {
        await supabase.functions.invoke('send-sos-notification', { body: payload })
      } catch {
        // push best-effort — DB row already inserted, realtime banner will fire
      }
    }

    track('sos_pressed', { has_location: !!sosLocation })
    setSosSent(true)
    setShowSOS(false)
    setTimeout(() => setSosSent(false), 15000)
  }

  async function dismissSOS() {
    if (!activeSosEvent?.sosAlertId) return
    await supabase.from('emergency_alerts').update({ resolved: true }).eq('id', activeSosEvent.sosAlertId)
    setSections(prev => prev.map(s => ({
      ...s,
      events: s.events.map(e => e.id === activeSosEvent.id ? { ...e, resolved: true } : e),
    })))
    setSosSent(false)
  }

  async function handlePDF() {
    if (pdfLoading || !ownerId) return
    setPdfLoading(true)
    try {
      const data = await fetchReportData(ownerId)
      await generateMedicalReport(data, profile?.name)
    } catch (err) {
      console.error('[PDF]', err)
    } finally {
      setPdfLoading(false)
    }
  }

  function toggleDay(dateKey) {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  async function saveMood(mood) {
    if (savingMood || isFamiliar) return
    setSavingMood(true)
    await supabase.from('daily_moods').upsert({
      owner_id: ownerId,
      user_id: user.id,
      log_date: todayKey,
      mood,
    }, { onConflict: 'owner_id,log_date' })
    setDailyMood(mood)
    setSavingMood(false)
  }

  const todayShift = weekShifts.find(s => s.shift_date === todayKey) ?? null
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
  })

  const todaySection = sections.find(s => s.dateKey === todayKey)
  const pendingCount = todaySection?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
  const dailyItems = CARE_ITEMS.filter(i => i.category === 'daily')
  const pendingRoutinesCount = dailyItems.filter(i => !careLogsToday[i.key]).length
  const confirmedTodayCount = todaySection?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0
  const missedTodayCount = todaySection?.events.filter(e => e.type === 'MED_MISSED').length ?? 0

  // Next pending medication for the meds card
  const nextPendingMed = todaySection?.events.find(e => e.type === 'MED_PENDING') ?? null

  const activeSosEvent = sections.flatMap(s => s.events).find(e => e.type === 'SOS_ALERT' && !e.resolved) ?? null
  const hasActiveSOS = !!activeSosEvent
  const lastActivity = sections.flatMap(s => s.events)
    .filter(e => ['MED_CONFIRMED', 'VOICE_MEMORY', 'NOTE', 'EXPENSE'].includes(e.type))
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
  const lastUpdatedBy = lastActivity?.confirmedBy?.split(' ')[0] || lastActivity?.recorderName?.split(' ')[0] || lastActivity?.uploaderName?.split(' ')[0] || null

  // Last voice/photo memory across any day
  const lastMemory = sections.flatMap(s => s.events).find(e => e.type === 'VOICE_MEMORY') ?? null

  const nextAppointment = sections.flatMap(s => s.events).find(e => e.type === 'APPOINTMENT') ?? null

  // Recent activity feed — cross-day, includes care logs, excludes SOS/pending
  const recentActivityItems = (() => {
    const evts = sections
      .flatMap(s => s.events)
      .filter(e => !['MED_PENDING', 'CAREGIVER_CARD', 'SOS_ALERT', 'MED_MISSED'].includes(e.type))
    const careLogEvts = Object.keys(careLogsToday)
      .filter(k => ['sleep', 'nutrition', 'hygiene'].includes(k))
      .map(k => ({ id: `carelog-${k}`, type: 'CARE_LOG', timestamp: new Date(todayKey + 'T12:00:00'), dateKey: todayKey, careLogKey: k }))
    return [...evts, ...careLogEvts]
      .sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0))
      .slice(0, 3)
  })()

  // Fase 2 — resumen narrado: lo "hecho" sale de eventos que ya se muestran
  // en otra parte del Dashboard (nunca una fuente distinta), para que
  // narrativa y pantallas jamás puedan divergir. A diferencia de
  // recentActivityItems (que corta a 3 eventos cruzando varios días solo por
  // espacio en pantalla), aquí se usan TODOS los eventos relevantes de HOY:
  // un incidente no puede perder su lugar en el resumen por "competir" con
  // varias dosis de medicamento confirmadas el mismo día.
  const todayEvents = todaySection?.events ?? []
  const todaysActivityItems = todayEvents
    .filter(e => !['MED_PENDING', 'CAREGIVER_CARD', 'SOS_ALERT', 'MED_MISSED'].includes(e.type))
    .sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0))
  const activityLatestEventAt = todaysActivityItems[0]?.timestamp ?? null
  const activityLatestEventMs = activityLatestEventAt ? activityLatestEventAt.getTime() : null

  const medLabel = e => `${e.medName ?? 'Medicamento'}${e.medDosage ? ` ${e.medDosage}` : ''}`
  const pendingMedLines = todayEvents
    .filter(e => e.type === 'MED_PENDING')
    .map(e => `${medLabel(e)} pendiente${e.medTime ? ` (programado ${fmtTime(e.medTime)})` : ''}`)
  const missedMedLines = todayEvents
    .filter(e => e.type === 'MED_MISSED')
    .map(e => `${medLabel(e)} no se registró a tiempo${e.medTime ? ` (programado ${fmtTime(e.medTime)})` : ''} — puede registrarse aún`)

  // Ánimo del día — care_records.mood es la fuente canónica (registro
  // estructurado del cuidador); daily_moods.mood es respaldo si no hay
  // registro de care_records hoy. Cada tabla usa su propio vocabulario de
  // valores, de ahí el mapa de normalización.
  const MOOD_PHRASES = {
    excelente: 'excelente', bien: 'bueno', regular: 'regular', mal: 'difícil',
    good: 'bueno', hard: 'difícil',
  }
  const canonicalMood = careRecordMood ?? dailyMood ?? null
  const moodLine = canonicalMood ? `El ánimo de hoy fue ${MOOD_PHRASES[canonicalMood] ?? canonicalMood}` : null

  // Rutina diaria — agregado, nunca ítem por ítem (evita spam de "cepillado
  // de dientes", "baño", etc.). careLogsToday ya excluye los placeholders
  // 'no_completado' (ver fix de /cuidado).
  const routinesTotal = dailyItems.length
  const routinesDoneCount = dailyItems.filter(i => careLogsToday[i.key]).length
  const routineLine = routinesTotal === 0
    ? null
    : routinesDoneCount === routinesTotal
      ? 'La rutina diaria de cuidado está al día'
      : `Faltan ${routinesTotal - routinesDoneCount} de ${routinesTotal} cuidados de la rutina diaria`

  // patientName (con ese nombre exacto) solo existe dentro de otros closures
  // más abajo en este componente (otro useEffect y el IIFE del JSX) — aquí
  // arriba hay que resolverlo de nuevo con las variables de nivel de
  // componente que sí están en scope.
  const dashPatientName = patientProfile?.nombre_completo || profile?.name || 'el familiar'

  // Fase 2 — dispara la narración cuando hay algo hecho, pendiente o sin
  // registrar hoy, y cambia alguna de esas cantidades; el cache
  // (care_profiles.activity_summary) evita regenerar si nada cambió. Nunca
  // bloquea: las pantallas se ven normal mientras esto corre en segundo
  // plano. Envuelto en try/catch a propósito: cualquier error aquí degrada a
  // "sin resumen", nunca debe poder tumbar el Dashboard — ese fue exactamente
  // el bug que causó el crash anterior (una variable fuera de scope), así que
  // además de corregir la causa, blindamos el bloque completo.
  // En Modo Hospital, HospitalDashboard reemplaza esta pantalla por completo
  // y nunca lee activitySummaryText — generar el resumen normal sería un
  // costo (llamada a Gemini + escritura en cache) sin ningún efecto visible,
  // así que el resumen se salta mientras el modo esté activo.
  const routinePending = routinesTotal > 0 && routinesDoneCount < routinesTotal
  // Fuente única de "hay algo que narrar hoy" — usada tanto para decidir si
  // se genera el resumen como para el estado vacío que se muestra en
  // pantalla. Antes summaryEmpty (más abajo, prop de RecentActivity) miraba
  // solo todaysActivityItems.length, de antes de que existieran mood/rutina
  // en la narración — un día con solo ánimo/rutina registrados (sin
  // medicamentos, fotos, etc.) generaba el resumen correcto pero la pantalla
  // igual mostraba "Aún no hay registros del día" por encima.
  const hasSignal = todaysActivityItems.length > 0 || pendingMedLines.length > 0 || missedMedLines.length > 0 || !!moodLine || !!routineLine
  useEffect(() => {
    // subLoading incluido a propósito: hasta que el plan no se resuelve no
    // sabemos si aplica el límite de 1/día del plan Gratis — disparar antes
    // arriesgaría una llamada a Gemini de más (o un gate de menos) mientras
    // sub todavía es null.
    if (loading || subLoading || !ownerId || !hasSignal || isHospitalMode) {
      setActivitySummaryText(null)
      setActivitySummaryStale(false)
      return
    }
    let cancelled = false
    try {
      const doneLines = todaysActivityItems.map(e => `${activityActor(e, firstName)} ${activityAction(e)}`)
      if (moodLine) doneLines.push(moodLine)
      if (routineLine && !routinePending) doneLines.push(routineLine)

      const pendingLines = [...pendingMedLines]
      if (routineLine && routinePending) pendingLines.push(routineLine)

      getActivitySummary({
        ownerId,
        patientName: dashPatientName,
        doneLines,
        pendingLines,
        missedLines: missedMedLines,
        plan: sub?.plan,
      })
        .then(result => {
          if (cancelled) return
          setActivitySummaryText(result?.text ?? null)
          setActivitySummaryStale(!!result?.isStale)
        })
        .catch(() => { if (!cancelled) { setActivitySummaryText(null); setActivitySummaryStale(false) } })
    } catch {
      setActivitySummaryText(null)
      setActivitySummaryStale(false)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, subLoading, ownerId, isHospitalMode, hasSignal, activityLatestEventMs, todaysActivityItems.length, pendingMedLines.length, missedMedLines.length, moodLine, routineLine, routinePending, dashPatientName, sub?.plan])

  // Cuidado de hoy card status
  let careStatus, careStatusType
  if (loading) {
    careStatus = 'Cargando...'; careStatusType = 'info'
  } else if (medTotal === 0) {
    careStatus = 'Sin medicamentos'; careStatusType = 'info'
  } else if (pendingCount === 0 && confirmedTodayCount >= medTotal) {
    careStatus = `${confirmedTodayCount} de ${medTotal} dados`; careStatusType = 'ok'
  } else if (pendingCount > 0 && confirmedTodayCount > 0) {
    careStatus = `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`; careStatusType = 'warning'
  } else if (pendingCount > 0) {
    careStatus = `${pendingCount} sin dar hoy`; careStatusType = 'urgent'
  } else {
    careStatus = 'Sin actividad hoy'; careStatusType = 'info'
  }

  // Medicamentos card status
  const _isRetrasado = nextPendingMed?.medStatus === 'tarde'
  const _retrasadoMins = _isRetrasado && nextPendingMed.medTime ? (() => {
    const [h, m] = nextPendingMed.medTime.split(':').map(Number)
    const now = new Date()
    return Math.round((now.getHours() * 60 + now.getMinutes()) - (h * 60 + m))
  })() : null
  const _retrasadoLabel = _retrasadoMins != null
    ? (_retrasadoMins >= 60 ? `${Math.floor(_retrasadoMins/60)}h ${_retrasadoMins % 60}min` : `${_retrasadoMins} min`)
    : null
  const _tomorrowFirst = (() => {
    const times = (medsList ?? [])
      .filter(m => m.frequency !== 'as_needed')
      .flatMap(m => m.scheduled_times?.length ? m.scheduled_times : m.time ? [m.time] : [])
      .sort()
    return times[0] ?? null
  })()

  let medCardStatus, medCardStatusType, medCardSubtitle
  if (nextPendingMed) {
    if (_isRetrasado) {
      medCardStatus = '⚠️ Retrasado'
      medCardStatusType = 'urgent'
      medCardSubtitle = `${nextPendingMed.medName}${_retrasadoLabel ? ` · hace ${_retrasadoLabel}` : ''}`
    } else {
      medCardStatus = `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`
      medCardStatusType = 'warning'
      medCardSubtitle = nextPendingMed.medTime
        ? `Próxima: ${nextPendingMed.medName} · ${fmtTime(nextPendingMed.medTime)}`
        : `${pendingCount} dosis por dar hoy`
    }
  } else if (confirmedTodayCount > 0) {
    medCardStatus = 'Todo dado ✅'
    medCardStatusType = 'ok'
    medCardSubtitle = `${confirmedTodayCount} de ${medTotal} dosis completadas${_tomorrowFirst ? ` · Mañana: ${fmtTime(_tomorrowFirst)}` : ''}`
  } else {
    medCardStatus = medTotal > 0 ? 'Sin dosis aún' : 'Sin meds'
    medCardStatusType = 'info'
    medCardSubtitle = medTotal > 0 ? 'Aún es temprano' : 'Sin medicamentos'
  }

  const medsPulsing = !loading && _isRetrasado
  const carePulsing = !loading && careStatusType === 'urgent'

  const detailSubtitle = loading
    ? 'Cargando...'
    : pendingCount > 0
      ? `Hoy: ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} · ${confirmedTodayCount} dado${confirmedTodayCount !== 1 ? 's' : ''}`
      : confirmedTodayCount > 0
        ? `Hoy: todo al día · ${confirmedTodayCount} dado${confirmedTodayCount !== 1 ? 's' : ''}`
        : 'Sin actividad registrada hoy'
  const detailStatusType = loading ? 'info' : pendingCount > 0 ? 'warning' : confirmedTodayCount > 0 ? 'ok' : 'info'

  // Memorias card status
  let memStatus, memStatusType, memSubtitle
  if (lastMemory) {
    const memDay = lastMemory.dateKey === todayKey ? 'hoy' : lastMemory.dateKey === yesterdayKey ? 'ayer' : 'esta semana'
    memStatus = `Última ${memDay}`
    memStatusType = 'ok'
    memSubtitle = 'Memoria de voz'
  } else {
    memStatus = 'Sin memorias aún'
    memStatusType = 'info'
    memSubtitle = 'Toca para grabar'
  }

  // Chat card status
  const chatStatus = chatCount > 0
    ? `${chatCount} mensaje${chatCount !== 1 ? 's' : ''} hoy`
    : 'Sin mensajes nuevos'

  if (isHospitalMode) {
    return (
      <Layout>
        <HospitalModeModal open={showHospitalModal} onClose={() => setShowHospitalModal(false)} />
        <HospitalDashboard
          onManageMode={() => setShowHospitalModal(true)}
          onSOS={prepareSOS}
          onVideoCall={() => navigate('/videollamada')}
        />
        {sosConfirming && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
            onClick={e => { if (e.target === e.currentTarget) setSosConfirming(false) }}
          >
            <div style={{
              width: '100%', maxWidth: 480,
              background: 'white', borderRadius: '24px 24px 0 0',
              padding: '28px 24px 96px',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                  background: '#FFF0F0', border: '2px solid #FFBABA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>🚨</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
                  ¿Activar emergencia?
                </h3>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                  Todos los miembros de la familia recibirán una alerta inmediata.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={triggerSOS} style={{ width: '100%', padding: '14px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #D63031, #B82020)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Sí, es una emergencia real
                </button>
                <button onClick={() => setSosConfirming(false)} style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Cancelar — fue un error
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  return (
    <Layout>
      {checkoutSuccess && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#15803D', color: 'white',
          borderRadius: 14, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          🎉 ¡Suscripción activada! Gracias por confiar en FamiliaCerca.
        </div>
      )}

      {confirmError && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#D63031', color: 'white',
          borderRadius: 14, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          ⚠️ {confirmError}
        </div>
      )}
      <div
        ref={pullRef}
        onTouchStart={pullStart}
        onTouchMove={pullMove}
        onTouchEnd={pullEnd}
        style={{ background: '#F8F4ED', minHeight: '100svh', paddingBottom: 80, overflowY: 'auto', width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box', margin: '0 auto' }}
      >
        <PullIndicator />
        <style>{`
          @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          @keyframes sos-ring  { 0%,100%{box-shadow:0 0 0 3px rgba(228,91,76,0.35)} 50%{box-shadow:0 0 0 9px rgba(228,91,76,0)} }
        `}</style>

        {/* ═══ HEADER ═══ */}
        <div style={{ background: '#F8F4ED', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Left: Logo */}
          <img
            src="/logo.png"
            alt="FamiliaCerca"
            style={{ height: 38, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          />
          {/* Center: Patient selector */}
          <button
            onClick={() => setShowFamilySwitcher(true)}
            style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(20,60,50,0.06)', border: 'none', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(patientProfile?.nombre_completo || activePatientName || profile?.name || 'Paciente').split(' ')[0]}
            </span>
            <span style={{ fontSize: 10, color: '#6D7B74', lineHeight: 1 }}>▼</span>
          </button>
          {/* Right: Bell + user avatar */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              {(() => {
                const totalBadge = notifMessages.length + notifNotes.length
                return (
                  <button
                    onClick={() => setShowNotifSheet(true)}
                    aria-label={`Notificaciones${totalBadge > 0 ? `, ${totalBadge} sin leer` : ''}`}
                    style={{ position: 'relative', background: 'white', border: 'none', cursor: 'pointer', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', flexShrink: 0, boxShadow: '0 2px 8px rgba(20,35,30,0.08)' }}
                  >
                    <Bell size={20} color="#334155" strokeWidth={2} />
                    {totalBadge > 0 && (
                      <span style={{ position: 'absolute', top: -2, right: -2, background: '#E9826E', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        {totalBadge > 9 ? '9+' : totalBadge}
                      </span>
                    )}
                  </button>
                )
              })()}
              {/* User avatar */}
              {(() => {
                const avatarUrl = user?.user_metadata?.avatar_url
                const initial = firstName?.charAt(0)?.toUpperCase() ?? 'U'
                return avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={firstName}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 8px rgba(20,35,30,0.08)', flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => navigate('/ajustes')}
                  />
                ) : (
                  <div
                    onClick={() => navigate('/ajustes')}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #E58B73, #C9882A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'white', flexShrink: 0, cursor: 'pointer', border: '2px solid white', boxShadow: '0 2px 8px rgba(20,35,30,0.08)' }}
                  >
                    {initial}
                  </div>
                )
              })()}
            </div>
        </div>

        {/* Banners */}
        <TrialBanner />
        {notifActivated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 16px 0', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 14 }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>✅</span>
            <p style={{ flex: 1, fontSize: 13, color: '#15803D', margin: 0, fontWeight: 600 }}>Notificaciones activadas</p>
          </div>
        )}
        {permission !== 'granted' && !notifDismissed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 16px 0', padding: '10px 14px', background: 'white', border: '1px solid #EDE5D8', borderRadius: 16, boxShadow: '0 2px 8px rgba(20,35,30,0.05)' }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>🔔</span>
            <p style={{ flex: 1, fontSize: 13, color: '#143C32', margin: 0, fontWeight: 500, lineHeight: 1.3 }}>Activa las notificaciones para estar al tanto</p>
            <button onClick={requestAndSubscribe} style={{ padding: '6px 13px', borderRadius: 9, background: '#E9826E', color: 'white', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>Activar</button>
            <button onClick={dismissNotifBanner} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex' }} aria-label="Cerrar">
              <XIcon size={14} color="#9CA3AF" strokeWidth={2} />
            </button>
          </div>
        )}
        {hasActiveSOS && (
          <div style={{ margin: '12px 16px 0', background: 'linear-gradient(135deg,#7F1D1D,#991B1B)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 4px 24px rgba(185,28,28,0.4)', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeInUp 0.3s ease both' }}>
            <span style={{ fontSize: 26, flexShrink: 0, animation: 'sos-ring 1.4s ease-in-out infinite' }}>🚨</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'white' }}>Alerta SOS activa</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {activeSosEvent?.triggeredBy ? `Activada por ${activeSosEvent.triggeredBy.split(' ')[0]}` : 'Emergencia familiar'}
              </p>
            </div>
            <button onClick={dismissSOS} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.18)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Resolver
            </button>
          </div>
        )}
        {renewalAlerts.map(med => {
          const { kind, daysLeft, pills } = med
          const medName = med.name?.trim() ?? med.name
          const patientFirst = (patientProfile?.nombre_completo || activePatientName || 'el paciente').split(' ')[0]
          const urgent = kind === 'exhausted' || kind === 'critical'
          const title =
            kind === 'exhausted' ? `${medName} se agotó` :
            kind === 'critical'  ? `${medName} por agotarse — quedan ${pills} pastilla${pills === 1 ? '' : 's'} (~${daysLeft} día${daysLeft === 1 ? '' : 's'})` :
            kind === 'warning'   ? `${medName}: renovar pronto — quedan ${pills} pastillas` :
            `¿${patientFirst} está tomando ${medName}? No hay registros recientes`
          const subtitle =
            kind === 'silent'
              ? `Fecha estimada vencida · ${pills} pastillas disponibles`
              : `${pills} pastilla${pills === 1 ? '' : 's'} · toca para renovar`
          const borderColor = urgent ? '#FCA5A5' : '#FDE68A'
          const bgColor     = urgent ? '#FEF2F2' : '#FFFBEB'
          const textColor   = urgent ? '#DC2626' : '#7A5A18'
          const btnBg       = urgent ? '#DC2626' : '#C9882A'
          const emoji       = urgent ? '🚨' : kind === 'warning' ? '🔔' : '🟡'
          return (
            <div key={med.id} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 16px 0', padding: '12px 14px', borderRadius: 16, border: `1.5px solid ${borderColor}`, background: bgColor, boxShadow: '0 2px 8px rgba(20,35,30,0.05)' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: textColor, margin: 0, lineHeight: 1.3 }}>{title}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{subtitle}</p>
              </div>
              <button onClick={() => navigate('/medications')} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', flexShrink: 0, background: btnBg, color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {kind === 'silent' ? 'Ver' : 'Renovar'}
              </button>
            </div>
          )
        })}

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 104 }}>
          {(() => {
            const profilePhoto = patientProfile?.photo_url || patientProfile?.foto_url || profile?.photo_url || null
            const patientName = patientProfile?.nombre_completo || profile?.name || 'Agregar paciente'
            const isCritical     = hasActiveSOS || (_isRetrasado && _retrasadoMins != null && _retrasadoMins >= 720)
            const isPendingToday = !isCritical && (pendingCount > 0 || _isRetrasado)

            const recentMembers = familyMembers.filter(m => m.last_seen && Date.now() - new Date(m.last_seen).getTime() < 24 * 60 * 60 * 1000)
            const participacion = recentMembers.length >= 2 ? 'Alta' : recentMembers.length === 1 ? 'Moderada' : 'Baja'

            const PALETTE = ['#0B4F4A', '#C9882A', '#7C3AED', '#E58B73', '#0EA5E9']

            const pendingMedWindowMinutes = nextPendingMed
              ? (medsList.find(m => m.id === nextPendingMed.medicationId)?.time_window_minutes ?? 60)
              : null
            const pendingMedWindowLabel = (nextPendingMed?.medTime && pendingMedWindowMinutes != null) ? (() => {
              const [ph, pm] = nextPendingMed.medTime.split(':').map(Number)
              const toHHMM = mins => {
                const wrapped = ((mins % 1440) + 1440) % 1440
                return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
              }
              const start = toHHMM(ph * 60 + pm - pendingMedWindowMinutes)
              const end = toHHMM(ph * 60 + pm + pendingMedWindowMinutes)
              return `${fmtTime(start)} · ${fmtTime(end)}`
            })() : null
            // Ventana clínica real (scheduled + time_window_minutes) ya vencida — política A1/B
            const isPendingMedWindowExpired = (nextPendingMed?.medTime && pendingMedWindowMinutes != null) ? (() => {
              const [ph, pm] = nextPendingMed.medTime.split(':').map(Number)
              const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
              return (nowMins - (ph * 60 + pm)) >= pendingMedWindowMinutes
            })() : false

            return (
              <>
                {/* ══════════════════════════════════════════
                    HERO — CareCard (paleta app: teal/coral emergencia/gold — ver CLAUDE.md)
                    ══════════════════════════════════════════ */}
                <CareCard
                  name={patientName.split(' ')[0]}
                  photoUrl={profilePhoto}
                  status={isCritical ? 'critical' : isPendingToday ? 'warning' : 'ok'}
                  medsUpToDate={pendingCount === 0}
                  routineUpToDate={pendingRoutinesCount === 0}
                  familyCount={familyCount}
                  onClick={() => navigate('/paciente/perfil')}
                  onMedsClick={() => navigate('/medications')}
                  onRoutineClick={() => navigate('/cuidado')}
                  onFamilyClick={() => navigate('/familia')}
                />

                {/* ══ ATENCIÓN — medicamento pendiente (v0: AttentionCard) ══ */}
                {nextPendingMed && (
                  <AttentionCard
                    medName={nextPendingMed.medName}
                    medDosage={nextPendingMed.medDosage}
                    medTime={fmtTime(nextPendingMed.medTime)}
                    windowLabel={pendingMedWindowLabel}
                    isExpired={isPendingMedWindowExpired}
                    onConfirm={() => handleConfirmMed(nextPendingMed)}
                    onLate={() => navigate('/medications')}
                  />
                )}

                {/* ══ ACTIVIDAD RECIENTE (v0: RecentActivity) ══ */}
                <RecentActivity
                  items={loading ? [] : recentActivityItems}
                  onViewAll={() => navigate('/historial')}
                  onSelect={setSelectedEvent}
                  firstName={firstName}
                  summaryText={loading ? null : activitySummaryText}
                  summaryEmpty={!loading && !hasSignal}
                  summaryStale={!loading && activitySummaryStale}
                />

                {/* ══ MILO Y LUNA (v0: PetsCard) ══ */}
                <PetsCard onOpen={() => setShowCompanion(true)} patientFirstName={patientName.split(' ')[0]} />

                {/* ════════════════════════════════════
                    ACCIONES RÁPIDAS + MÁS HERRAMIENTAS — directo sobre el fondo crema
                    ════════════════════════════════════ */}
                <div>
                  <p style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: '#334155' }}>
                    <Zap size={18} color="#087F70" filled /> Acciones rápidas
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 11 }}>
                    {[
                      { Icon: Pill,          label: 'Medicamentos', onClick: () => navigate('/medications'),  circleBg: '#E3F4EF', iconColor: '#087F70', bold: false },
                      { Icon: Siren,         label: 'Emergencia',   onClick: prepareSOS,                      circleBg: 'rgba(217,83,79,0.12)', iconColor: '#D9534F', bold: true },
                      { Icon: MessageCircle, label: 'Chat familiar', onClick: () => navigate('/chat'),        circleBg: '#E3F4EF', iconColor: '#087F70', bold: false },
                      { Icon: Video,         label: 'Videollamada', onClick: () => navigate('/videollamada'), circleBg: '#E3F4EF', iconColor: '#087F70', bold: false },
                    ].map(({ Icon, label, onClick, circleBg, iconColor, bold }) => (
                      <button
                        key={label} onClick={onClick}
                        style={{
                          background: 'white', border: '1px solid rgba(51,65,85,0.05)',
                          borderRadius: 20, padding: '15px 6px 12px', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                          boxShadow: '0 5px 18px -10px rgba(51,65,85,0.18)',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <span style={{
                          width: 44, height: 44, borderRadius: 14,
                          background: circleBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={23} color={iconColor} strokeWidth={1.9} />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: bold ? 700 : 600, color: bold ? '#334155' : '#475569', lineHeight: 1.2, textAlign: 'center' }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ════════════════════════════════════
                    TODO EL CUIDADO — 4 destacadas + Ver todas → /mas
                    ════════════════════════════════════ */}
                {(() => {
                  const featuredTools = [
                    { Icon: Users,    label: 'Equipo',   onClick: () => navigate('/familia'),          circleBg: '#EFF6F0', iconColor: '#0d6b63' },
                    { Icon: Building2, label: 'Hospital', onClick: () => setShowHospitalModal(true),   circleBg: '#FEF0ED', iconColor: '#E9826E' },
                    { Icon: Calendar, label: 'Citas',    onClick: () => navigate('/calendar'),         circleBg: '#FFF8EC', iconColor: '#D99A18' },
                  ]
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: '#334155' }}>Todo el cuidado</p>
                        <button onClick={() => navigate('/mas')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#087F70', fontWeight: 700, padding: 0, WebkitTapHighlightColor: 'transparent' }}>Ver todas</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11 }}>
                        {featuredTools.map(({ Icon, label, onClick, circleBg, iconColor }) => (
                          <button
                            key={label} onClick={onClick}
                            style={{
                              background: 'white', border: '1px solid rgba(51,65,85,0.05)',
                              borderRadius: 20, padding: '15px 6px 12px', cursor: 'pointer',
                              width: '100%', minWidth: 0, boxSizing: 'border-box',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                              boxShadow: '0 5px 18px -10px rgba(51,65,85,0.18)',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            <span style={{
                              width: 44, height: 44, borderRadius: 14,
                              background: circleBg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <Icon size={22} color={iconColor} strokeWidth={1.9} />
                            </span>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#475569', lineHeight: 1.3, textAlign: 'center' }}>{label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </>
            )
          })()}
        </div>

        <HospitalModeModal open={showHospitalModal} onClose={() => setShowHospitalModal(false)} />
        <CompanionChat externalOpen={showCompanion} onExternalClose={() => setShowCompanion(false)} bottomOffset={80} />
      </div>

      {/* ── SOS confirm dialog ────────────────────────────────────────────── */}
      {sosConfirming && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setSosConfirming(false) }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '28px 24px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setSosConfirming(false)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#F3F4F6', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <XIcon size={14} color="#6B7280" strokeWidth={2} />
              </button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                background: '#FFF0F0', border: '2px solid #FFBABA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={28} color="#D63031" strokeWidth={1.5} />
              </div>
              <h3 style={{
                fontSize: 20, fontWeight: 700, color: '#1A1A1A',
                fontFamily: 'Georgia, serif', margin: '0 0 8px',
              }}>
                ¿Activar emergencia?
              </h3>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                Todos los miembros de la familia recibirán una alerta inmediata
                {profile?.name ? ` sobre ${profile.name}` : ''}.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={triggerSOS}
                style={{
                  width: '100%', padding: '14px', borderRadius: 16, border: 'none',
                  background: 'linear-gradient(135deg, #D63031, #B82020)',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(214,48,49,0.35)',
                }}
              >
                Sí, es una emergencia real
              </button>
              <button
                onClick={() => setSosConfirming(false)}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14,
                  border: '1px solid #EDE5D8', background: 'white',
                  color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancelar — fue un error
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin emergency confirmation dialog ────────────────────────────── */}
      {adminConfirmEvt && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setAdminConfirmEvt(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              Confirmar como administrador
            </p>
            <p style={{ fontSize: 13, color: '#7A5A18', lineHeight: 1.6, marginBottom: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 14px' }}>
              Confirmando como administrador — solo en caso de emergencia
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              {adminConfirmEvt.medName} · Esta acción se registrará con tu nombre.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setAdminConfirmEvt(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { const evt = adminConfirmEvt; setAdminConfirmEvt(null); quickConfirm(evt) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#C9882A', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(201,136,42,0.3)' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailSheet
          evt={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onAttachProof={evt => { setSelectedEvent(null); setAttachingProof(evt) }}
          isFamiliar={isFamiliar}
        />
      )}
      {attachingProof && (
        <CameraCapture
          guidance="📋 Encuadra el comprobante de la cita"
          onCapture={submitAppointmentProof}
          onCancel={() => setAttachingProof(null)}
          onManualFallback={pickProofGallery}
          deniedTitle="No pudimos abrir la cámara"
          deniedDescription="Necesitamos permiso de cámara para tomar la foto. Puedes elegir una desde tu galería."
          deniedButtonLabel="Elegir de galería"
        />
      )}
      {proofError && (
        <div style={{
          position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16, zIndex: 250,
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '12px 16px', fontSize: 13, color: '#DC2626', textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {proofError}
        </div>
      )}
      <VideoCallScheduleModal open={showVideoCallModal} onClose={() => setShowVideoCallModal(false)} />
      <SuccessAnimation visible={medSuccessTrigger > 0} key={medSuccessTrigger} />

      {/* ── Notifications Bottom Sheet ───────────────────────────────────────── */}
      {showNotifSheet && createPortal(
        <>
          <div
            onClick={() => setShowNotifSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 500 }}
          />
          <div style={{
            position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 501,
            background: 'white', borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            maxHeight: '75vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Sheet header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #F8F4ED', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E2D26' }}>🔔 Notificaciones</p>
              <button
                onClick={() => setShowNotifSheet(false)}
                style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#6B7280', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 20px' }}>

              {/* ── MENSAJES ── */}
              <div style={{ padding: '14px 20px 8px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em' }}>
                  💬 MENSAJES
                </p>
                {notifMessages.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', padding: '4px 0' }}>No hay mensajes nuevos</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {notifMessages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => { setShowNotifSheet(false); navigate('/chat') }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0',
                          textAlign: 'left', borderBottom: '1px solid #F5F0E8', width: '100%',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          💬
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#1E2D26' }}>
                            {msg.user_name ?? 'Familiar'}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                            {msg.message}
                          </p>
                        </div>
                        <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                          {timeAgo(new Date(msg.created_at))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── NOTAS DE LA FAMILIA ── */}
              <div style={{ padding: '14px 20px 8px' }}>
                <button
                  onClick={() => { setShowNotifSheet(false); navigate('/paciente/notas-familia') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4, WebkitTapHighlightColor: 'transparent' }}
                >
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em' }}>
                    📓 NOTAS DE LA FAMILIA
                  </p>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>›</span>
                </button>
                {notifNotes.length === 0 ? (
                  <button
                    onClick={() => { setShowNotifSheet(false); navigate('/paciente/notas-familia') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
                  >
                    <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No hay notas sin leer</p>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {notifNotes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => { setShowNotifSheet(false); navigate('/paciente/notas-familia') }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0',
                          textAlign: 'left', borderBottom: '1px solid #F5F0E8', width: '100%',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          📝
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#1E2D26' }}>
                            {note.authorName}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                            {note.title ? `${note.title}: ` : ''}{note.content}
                          </p>
                        </div>
                        <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                          {timeAgo(new Date(note.created_at))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Family Switcher Bottom Sheet ─────────────────────────────────────── */}
      {showFamilySwitcher && createPortal(
        <>
          <div
            onClick={() => setShowFamilySwitcher(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500 }}
          />
          <div style={{
            position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 501,
            background: 'white', borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ padding: '20px 20px 0' }}>
              {/* Header: patient name + close */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    Cuidando a
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: '#1E2D26', fontFamily: 'Georgia, serif' }}>
                    {activePatientName || activeFamilyLabel || 'Mi familiar'}
                  </p>
                </div>
                <button
                  onClick={() => setShowFamilySwitcher(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <XIcon size={18} color="#9CA3AF" strokeWidth={2} />
                </button>
              </div>

              {/* Section 1: Care team */}
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Equipo de cuidado
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '40vh', overflowY: 'auto' }}>
                {familyMembers.map(m => {
                  const isMe = m.id === user?.id
                  const isAdm = m.role === 'admin'
                  const isCuid = m.role === 'cuidador'
                  const roleLabel = isAdm ? 'Admin' : isCuid ? 'Cuidador' : 'Familiar'
                  const roleColor = isAdm ? '#15803D' : isCuid ? '#1D4ED8' : '#D97706'
                  const roleBg = isAdm ? '#DCFCE7' : isCuid ? '#DBEAFE' : '#FEF3C7'
                  const displayName = m.full_name?.trim() || (m.email ? m.email.split('@')[0] : 'Sin nombre')
                  const initial = displayName.charAt(0).toUpperCase()
                  const presence = (() => {
                    if (!m.last_seen) return { dot: '⚫', label: 'Sin actividad', color: '#9CA3AF' }
                    const diffMs = Date.now() - new Date(m.last_seen).getTime()
                    const diffMin = diffMs / 60000
                    const diffH = diffMs / 3600000
                    if (diffMin <= 5) return { dot: '🟢', label: 'En línea', color: '#15803D' }
                    if (diffH <= 24) {
                      const label = diffH < 1 ? `Hace ${Math.round(diffMin)}min` : `Hace ${Math.round(diffH)}h`
                      return { dot: '🟡', label, color: '#D97706' }
                    }
                    const diffDays = Math.floor(diffH / 24)
                    return { dot: '⚫', label: diffDays <= 1 ? 'Hace 1 día' : `Hace ${diffDays} días`, color: '#9CA3AF' }
                  })()
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: isMe ? 'linear-gradient(135deg,#0B4F4A,#0d6b63)' : 'linear-gradient(135deg,#0d6b63,#2D6A4F)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700, color: 'white',
                      }}>
                        {initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1E2D26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName}{isMe && <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 13 }}> · Tú</span>}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: presence.color }}>{presence.dot} {presence.label}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: roleColor, background: roleBg, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                        {roleLabel}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Section 2: Other families (only when user belongs to more than one) */}
              {families.length > 1 && (() => {
                const otherFamilies = families.filter(f => f.ownerId !== ownerId)
                if (!otherFamilies.length) return null
                return (
                  <>
                    <p style={{ margin: '18px 0 10px', fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Otras familias
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {otherFamilies.map(fam => {
                        const isCuid = fam.role === 'cuidador'
                        const famRoleLabel = fam.role === null ? 'Admin' : isCuid ? 'Cuidador' : 'Familiar'
                        const famRoleColor = fam.role === null ? '#15803D' : isCuid ? '#1D4ED8' : '#D97706'
                        const famRoleBg = fam.role === null ? '#DCFCE7' : isCuid ? '#DBEAFE' : '#FEF3C7'
                        const famInitial = (fam.patientName ?? 'F').charAt(0).toUpperCase()
                        return (
                          <button
                            key={fam.ownerId}
                            onClick={() => { switchFamily(fam.ownerId); setShowFamilySwitcher(false) }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 12px', borderRadius: 14,
                              background: '#FDFAF7', border: '1.5px solid #EDE5D8',
                              cursor: 'pointer', textAlign: 'left', width: '100%',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            {fam.patientPhotoUrl ? (
                              <img src={fam.patientPhotoUrl} alt={fam.patientName ?? ''}
                                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #EDE5D8' }} />
                            ) : (
                              <div style={{
                                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg,#9CA3AF,#6B7280)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 15, fontWeight: 700, color: 'white',
                              }}>
                                {famInitial}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1E2D26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fam.patientName ?? 'Mi familiar'}
                              </p>
                              <span style={{ fontSize: 11, fontWeight: 600, color: famRoleColor, background: famRoleBg, borderRadius: 20, padding: '2px 8px' }}>
                                {famRoleLabel}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, color: '#9CA3AF', flexShrink: 0 }}>›</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* Close button */}
              <button
                onClick={() => setShowFamilySwitcher(false)}
                style={{
                  width: '100%', padding: '13px', marginTop: 16,
                  background: '#F5F0E8', border: 'none', borderRadius: 12,
                  cursor: 'pointer', fontSize: 14, color: '#6F7A72', fontWeight: 600,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Cerrar
              </button>
              <div style={{ height: 16 }} />
            </div>
          </div>
        </>,
        document.body
      )}

    </Layout>
  )
}
