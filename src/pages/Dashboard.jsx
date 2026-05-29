import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate as useNav } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { AlertTriangle, CheckIcon, User, XIcon, Pill, ClipboardCheck, Chat, Calendar, Receipt, Users, Camera, Heart, Clock, Menu } from '../components/Icons'
import { geminiGenerate } from '../lib/gemini'
import TrialBanner from '../components/TrialBanner'
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
  if (diff <= 30) return 'pendiente'
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
      boxShadow: '0 2px 8px rgba(74,124,89,0.06)',
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
              border: mine ? '1px solid #4A7C59' : '1px solid #E5E7EB',
              cursor: 'pointer', fontSize: 13, lineHeight: 1,
              transition: 'all 0.15s',
            }}>
            <span>{emoji}</span>
            {count > 0 && <span style={{ fontSize: 11, color: mine ? '#4A7C59' : '#6B7280', fontWeight: 600 }}>{count}</span>}
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

function PhotoCard({ evt, onTap }) {
  const name = evt.uploaderName ? evt.uploaderName.split(' ')[0] : null
  return (
    <div onClick={onTap} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid #EDE5D8',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      cursor: 'pointer',
    }}>
      <img
        src={evt.fileUrl}
        alt={evt.caption ?? 'Foto familiar'}
        style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
      />
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>📸</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {name ? `${name} subió una foto` : 'Nueva foto'}
          </p>
          {evt.caption && (
            <p style={{
              fontSize: 11, color: '#9CA3AF', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {evt.caption}
            </p>
          )}
        </div>
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
        <span style={{ fontSize: 14, fontWeight: 700, color: '#4A7C59', flexShrink: 0 }}>
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
                  <div style={{ width: 20, height: 20, border: '2px solid #4A7C59', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
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
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: '#4A7C59', color: 'white', fontWeight: 700, fontSize: 13, cursor: (attachSaving || attachStamping) ? 'default' : 'pointer', opacity: (attachSaving || attachStamping) ? 0.6 : 1 }}
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

function PhotoDetailContent({ evt }) {
  const time = evt.timestamp ? fmtTimestamp(evt.timestamp) : null
  return (
    <div>
      {evt.fileUrl && (
        <img src={evt.fileUrl} alt={evt.caption ?? 'Foto'} style={{ width: '100%', borderRadius: 12, maxHeight: 320, objectFit: 'cover', marginBottom: 16 }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {evt.caption && (
          <p style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{evt.caption}</p>
        )}
        {evt.uploaderName && <DetailRow icon="👤" label="Subida por" value={evt.uploaderName} />}
        {time && <DetailRow icon="🕐" label="Hora" value={time} />}
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
          <p style={{ fontSize: 22, fontWeight: 700, color: '#4A7C59', margin: 0 }}>
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

function EventDetailSheet({ evt, onClose }) {
  if (!evt) return null
  const TITLES = {
    MED_CONFIRMED: 'Medicamento',
    VOICE_MEMORY: 'Memoria de voz',
    NOTE: 'Nota',
    PHOTO: 'Foto',
    EXPENSE: 'Gasto',
    SOS_ALERT: 'Alerta SOS',
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
          {evt.type === 'PHOTO' && <PhotoDetailContent evt={evt} />}
          {evt.type === 'EXPENSE' && <ExpenseDetail evt={evt} />}
          {evt.type === 'SOS_ALERT' && <SosDetail evt={evt} />}
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
  if (evt.type === 'PHOTO') return <div><PhotoCard evt={evt} onTap={() => onTap(evt)} />{bar}</div>
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
          background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
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
  { id: 'familia', emoji: '👥', label: 'Familia',      types: ['PHOTO', 'CAREGIVER_CARD'] },
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
  PHOTO:             { icon: '📸', color: '#4A7C59', label: e => `Foto${e.uploaderName ? ` de ${e.uploaderName.split(' ')[0]}` : ' familiar'}` },
  EXPENSE:           { icon: '💰', color: '#4A7C59', label: e => e.description ?? 'Gasto registrado' },
  SOS_ALERT:         { icon: '🚨', color: '#D63031', label: () => 'Alerta de emergencia' },
  APPOINTMENT:       { icon: '📅', color: '#3B82F6', label: e => e.appointmentTitle ?? 'Cita médica' },
  APPOINTMENT_PROOF: { icon: '✅', color: '#15803D', label: e => `Cita: ${e.appointmentTitle ?? 'médica'}` },
  NOTE:              { icon: '📝', color: '#6B7280', label: () => 'Nota registrada' },
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
  const birth = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
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
  return (
    <div
      onClick={to ? () => navigate(to) : onClick}
      style={{
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        padding: '16px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: isClickable ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        boxSizing: 'border-box',
        minHeight: 130,
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: 'rgba(74,124,89,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={20} color="#4A7C59" strokeWidth={1.75} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#2d3748', margin: 0, lineHeight: 1.25 }}>{title}</p>
        {subtitle && (
          <p style={{ fontSize: 12, color: '#718096', margin: '4px 0 0', lineHeight: 1.4 }}>{subtitle}</p>
        )}
      </div>
      {status && (
        <div style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center',
          gap: 4, padding: '3px 9px', borderRadius: 20, background: s.bg,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{status}</span>
        </div>
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
  PHOTO:             { icon: '📸', label: e => e.caption || (e.uploaderName ? `Foto de ${e.uploaderName.split(' ')[0]}` : 'Foto familiar'), sub: () => null },
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
          {evt.resolved ? 'Emergencia resuelta' : 'Emergencia SOS'}
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
    .filter(e => ['VOICE_MEMORY', 'PHOTO', 'NOTE', 'EXPENSE', 'APPOINTMENT', 'APPOINTMENT_PROOF'].includes(e.type))
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { profile, ownerId, memberRole } = useFamily()
  const isFamiliar = memberRole === 'familiar'
  const isAdmin = memberRole === null || ownerId === user?.id
  const { refresh: refreshSub } = useSubscription()
  const [searchParams, setSearchParams] = useSearchParams()

  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [expandedAudio, setExpandedAudio] = useState(null)
  const [medTotal, setMedTotal] = useState(0)
  const [showSOS, setShowSOS] = useState(false)
  const [sosSent, setSosSent] = useState(false)
  const [sosConfirming, setSosConfirming] = useState(false)
  const [aiCards, setAiCards] = useState({})
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [reactions, setReactions] = useState({})
  const [sosLocation, setSosLocation] = useState(null)
  const [adminConfirmEvt, setAdminConfirmEvt] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [chatCount, setChatCount] = useState(0)
  const [patientProfileIncomplete, setPatientProfileIncomplete] = useState(false)
  const [patientProfile, setPatientProfile] = useState(null)
  const [dailyMood, setDailyMood] = useState(null)
  const [savingMood, setSavingMood] = useState(false)
  const [weekShifts, setWeekShifts] = useState([])
  // Initialized to today's key so today is expanded; past days start collapsed
  const [expandedDays, setExpandedDays] = useState(() => new Set([new Date().toISOString().split('T')[0]]))
  const [selectedDayTab, setSelectedDayTab] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setCheckoutSuccess(true)
      refreshSub()
      setSearchParams({}, { replace: true })
      setTimeout(() => setCheckoutSuccess(false), 6000)
    }
  }, [])

  const now = new Date()
  const todayKey = now.toISOString().split('T')[0]
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().split('T')[0]
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split('T')[0]
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 6)
  const sevenAgoKey = sevenAgo.toISOString().split('T')[0]
  const tabDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  })

  const fullName = user?.user_metadata?.full_name ?? user?.email ?? 'Cuidador'
  const firstName = fullName.split(' ')[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isSundayEvening = now.getDay() === 0 && now.getHours() >= 17

  const h = now.getHours()
  const timeGreeting = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const timeIcon = h < 12 ? '☀️' : h < 19 ? '🌤️' : '🌙'

  useEffect(() => {
    if (user && ownerId) fetchTimeline()
  }, [user, ownerId])

  useEffect(() => {
    if (user) track('session_start', { user_id: user.id })
  }, [user?.id])

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('created_at', todayKey + 'T00:00:00Z')
      .then(({ count }) => setChatCount(count ?? 0))
  }, [ownerId, todayKey])

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('patient_profiles')
      .select('nombre_completo, diagnostico_principal, fecha_nacimiento')
      .eq('owner_id', ownerId)
      .maybeSingle()
      .then(({ data: pp }) => {
        setPatientProfile(pp ?? null)
        setPatientProfileIncomplete(!pp?.nombre_completo)
      })
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
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
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

    const patientName = profile?.name ?? 'el familiar'

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
      { data: photoMemories },
      { data: expenses },
      { data: events },
      { data: sosAlerts },
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
        .select('*, user_profiles(full_name)')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('memories')
        .select('*')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase.from('care_expenses')
        .select('*')
        .eq('user_id', ownerId)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('events')
        .select('*, appointment_proofs(*)')
        .eq('user_id', ownerId)
        .gte('date', sevenAgoKey)
        .order('date', { ascending: true })
        .limit(20),

      supabase.from('emergency_alerts')
        .select('*')
        .in('user_id', allFamilyIds)
        .gte('created_at', sevenAgoKey + 'T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setMedTotal((meds ?? []).length)

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
      pastDays.push(d.toISOString().split("T")[0])
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
      const dk = new Date(ts).toISOString().split('T')[0]
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
      const dateKey = mem.created_at.split('T')[0]
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

    // ── Photo memories ──
    for (const photo of (photoMemories ?? [])) {
      const dateKey = photo.created_at.split('T')[0]
      allEvents.push({
        id: `photo-${photo.id}`,
        type: 'PHOTO',
        timestamp: new Date(photo.created_at),
        dateKey,
        fileUrl: photo.file_url,
        fileType: photo.file_type,
        uploaderName: photo.uploader_name ?? null,
        caption: photo.caption ?? null,
      })
    }

    // ── Expenses ──
    for (const exp of (expenses ?? [])) {
      const ts = exp.created_at ?? (exp.date ? exp.date + 'T12:00:00' : todayKey)
      const dateKey = ts.split('T')[0]
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

    // ── Appointments: upcoming + past attended (with proof photos) ──
    for (const ev of (events ?? [])) {
      const evDate = ev.date
      const evTime = ev.time
      const proof  = ev.appointment_proofs?.[0] ?? null

      if (evDate >= todayKey) {
        // Upcoming — show as a forward-looking appointment card
        allEvents.push({
          id: `evt-${ev.id}`,
          type: 'APPOINTMENT',
          timestamp: new Date(`${evDate}T${evTime ?? '09:00'}:00`),
          dateKey: evDate,
          appointmentTitle: ev.title,
          appointmentTime: evTime ?? null,
        })
      } else if (proof) {
        // Past appointment with a proof — surface it in the timeline
        allEvents.push({
          id: `proof-${proof.id}`,
          type: 'APPOINTMENT_PROOF',
          timestamp: new Date(`${evDate}T${evTime ?? '09:00'}:00`),
          dateKey: evDate,
          appointmentTitle: ev.title,
          appointmentTime: evTime ?? null,
          proofPhotoUrl: proof.photo_url ?? null,
          proofNotes: proof.notes ?? null,
        })
      }
    }

    // ── SOS alerts ──
    for (const alert of (sosAlerts ?? [])) {
      const dateKey = alert.created_at.split('T')[0]
      allEvents.push({
        id: `sos-${alert.id}`,
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
      const dk = new Date(ts).toISOString().split('T')[0]
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
    }
    setConfirming(null)
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
    return d.toISOString().split('T')[0]
  })

  const todaySection = sections.find(s => s.dateKey === todayKey)
  const pendingCount = todaySection?.events.filter(e => e.type === 'MED_PENDING').length ?? 0
  const confirmedTodayCount = todaySection?.events.filter(e => e.type === 'MED_CONFIRMED').length ?? 0

  // Next pending medication for the meds card
  const nextPendingMed = todaySection?.events.find(e => e.type === 'MED_PENDING') ?? null

  // Last voice/photo memory across any day
  const lastMemory = sections.flatMap(s => s.events).find(e => e.type === 'VOICE_MEMORY' || e.type === 'PHOTO') ?? null

  const nextAppointment = sections.flatMap(s => s.events).find(e => e.type === 'APPOINTMENT') ?? null

  // Recent events from today (non-pending, non-AI) for "Últimas novedades"
  const recentEvents = (todaySection?.events ?? [])
    .filter(e => !['MED_PENDING', 'CAREGIVER_CARD'].includes(e.type))
    .slice(0, 3)

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
  let medCardStatus, medCardStatusType, medCardSubtitle
  if (nextPendingMed) {
    medCardStatus = nextPendingMed.medTime ? `A las ${fmtTime(nextPendingMed.medTime)}` : 'Pendiente hoy'
    medCardStatusType = 'warning'
    medCardSubtitle = `${pendingCount} medicamento${pendingCount !== 1 ? 's' : ''} por dar`
  } else if (confirmedTodayCount > 0) {
    medCardStatus = 'Todo dado hoy'
    medCardStatusType = 'ok'
    medCardSubtitle = `${confirmedTodayCount} dosis confirmada${confirmedTodayCount !== 1 ? 's' : ''}`
  } else {
    medCardStatus = 'Sin pendientes'
    medCardStatusType = 'info'
    medCardSubtitle = medTotal > 0 ? 'Aún no hay dosis' : 'Sin meds configurados'
  }

  const medsPulsing = !loading && nextPendingMed?.medStatus === 'tarde'
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
    memSubtitle = lastMemory.type === 'VOICE_MEMORY' ? 'Memoria de voz' : 'Foto familiar'
  } else {
    memStatus = 'Sin memorias aún'
    memStatusType = 'info'
    memSubtitle = 'Toca para grabar'
  }

  // Chat card status
  const chatStatus = chatCount > 0
    ? `${chatCount} mensaje${chatCount !== 1 ? 's' : ''} hoy`
    : 'Sin mensajes nuevos'

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
      <TrialBanner />
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
      <div style={{ padding: '12px 16px 96px', maxWidth: 600 }}>

        {/* ════ ZONA 1 — Paciente + Estado del día ══════════════════════ */}
        <Link to="/paciente/perfil" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #4A7C59 0%, #2E5240 100%)',
            borderRadius: 20, padding: '16px 20px',
            boxShadow: '0 4px 20px rgba(74,124,89,0.3)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '0 0 10px', letterSpacing: '0.03em' }}>
              {timeIcon} {timeGreeting}, {firstName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {profile?.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={profile.name}
                  style={{
                    width: 54, height: 54, borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid rgba(201,136,42,0.5)', flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,255,255,0.15)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: 'rgba(255,255,255,0.85)',
                }}>
                  {(patientProfile?.nombre_completo || profile?.name)?.charAt(0) ?? '👴'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {(patientProfile?.nombre_completo || profile?.name) ? (
                  <>
                    <p style={{
                      color: 'white', fontSize: 17, fontWeight: 800,
                      fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {patientProfile?.nombre_completo || profile?.name}
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      {calcAge(patientProfile?.fecha_nacimiento) !== null && (
                        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                          {calcAge(patientProfile?.fecha_nacimiento)} años
                        </span>
                      )}
                      {patientProfile?.diagnostico_principal && (
                        <span style={{
                          color: 'rgba(255,255,255,0.55)', fontSize: 12,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 180,
                        }}>
                          · {patientProfile.diagnostico_principal}
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: '4px 0 0' }}>
                      Cuida hoy: {todayShift?.caregiver_name ?? firstName}
                    </p>
                  </>
                ) : (
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 600, margin: 0, textDecoration: 'underline' }}>
                    + Agregar perfil del paciente →
                  </p>
                )}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18, flexShrink: 0 }}>›</span>
            </div>
            {patientProfileIncomplete && (
              <div style={{
                marginTop: 12, padding: '9px 13px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 11,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: 12, fontWeight: 700, margin: 0 }}>
                    Completa el perfil del paciente
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '1px 0 0' }}>
                    Diagnóstico, alergias y médico tratante
                  </p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>›</span>
              </div>
            )}
          </div>
        </Link>

        {/* AI motivational cards */}
        {Object.keys(aiCards).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {aiCards.morning && <AiCard type="morning" text={aiCards.morning} />}
            {aiCards.evening && <AiCard type="evening" text={aiCards.evening} />}
            {aiCards.burnout && <AiCard type="burnout" text={aiCards.burnout} />}
            {aiCards.weekly  && <AiCard type="weekly"  text={aiCards.weekly} />}
          </div>
        )}

        {/* Estado del día */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '14px 16px',
          marginBottom: 20, border: '1px solid #EDE5D8',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px',
          }}>
            Estado del día
          </p>
          {dailyMood ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>
                {dailyMood === 'good' ? '😊' : dailyMood === 'regular' ? '😐' : '😔'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', margin: 0 }}>
                  {dailyMood === 'good' ? 'Buen día' : dailyMood === 'regular' ? 'Día regular' : 'Día difícil'}
                </p>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
                  Registrado hoy
                  {!isFamiliar && (
                    <button
                      onClick={() => setDailyMood(null)}
                      style={{
                        background: 'none', border: 'none', color: '#C9882A',
                        fontSize: 12, cursor: 'pointer', marginLeft: 8, padding: 0,
                      }}
                    >
                      Cambiar
                    </button>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 10px' }}>
                ¿Cómo estuvo {profile?.name ?? 'el paciente'} hoy?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { mood: 'good',    emoji: '😊', label: 'Buen día', color: '#15803D' },
                  { mood: 'regular', emoji: '😐', label: 'Regular',  color: '#92400E' },
                  { mood: 'hard',    emoji: '😔', label: 'Difícil',  color: '#DC2626' },
                ].map(({ mood, emoji, label, color }) => (
                  <button
                    key={mood}
                    onClick={() => saveMood(mood)}
                    disabled={savingMood || isFamiliar}
                    style={{
                      flex: 1, padding: '10px 4px', borderRadius: 12,
                      border: '1.5px solid #f0ede8', background: 'white',
                      cursor: savingMood || isFamiliar ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      opacity: savingMood ? 0.6 : 1, transition: 'border-color 0.15s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2d3748' }}>{label}</span>
                  </button>
                ))}
              </div>
              {isFamiliar && (
                <p style={{ fontSize: 11, color: '#C9B99A', margin: '8px 0 0', textAlign: 'center' }}>
                  El administrador o cuidador registra el estado del día
                </p>
              )}
            </div>
          )}
        </div>

        {/* ════ 2-col grid — SOS y Otras funciones span 2 ════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '0 16px', marginBottom: 24 }}>

          {/* SOS — ancho completo */}
          <button
            onClick={prepareSOS}
            style={{
              gridColumn: 'span 2',
              border: 'none', cursor: 'pointer',
              background: 'rgba(220,38,38,0.06)',
              borderRadius: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'rgba(220,38,38,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={22} color="#DC2626" strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', margin: 0 }}>Emergencia SOS</p>
              <p style={{ fontSize: 12, color: '#718096', margin: '3px 0 0' }}>
                {sosSent ? 'Alerta enviada — familia notificada' : 'Toca para alertar a toda la familia'}
              </p>
            </div>
            <div style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 20,
              background: sosSent ? '#DCFCE7' : '#FEE2E2',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sosSent ? '#15803D' : '#DC2626', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: sosSent ? '#15803D' : '#DC2626', whiteSpace: 'nowrap' }}>
                {sosSent ? 'Enviada' : 'Urgente'}
              </span>
            </div>
          </button>

          {/* Fila 1: Medicamentos | Cuidado de hoy */}
          <DashCard Icon={Pill}           title="Medicamentos"       subtitle={medCardSubtitle}                                                                                         status={medCardStatus}  statusType={medCardStatusType}  to="/hoy" />
          <DashCard Icon={ClipboardCheck} title="Cuidado de hoy"     subtitle={medTotal > 0 ? `${medTotal} med${medTotal !== 1 ? 's' : ''} programados` : 'Rutina diaria'}              status={careStatus}     statusType={careStatusType}     to="/hoy" />

          {/* Fila 2: Historial | Chat familiar */}
          <DashCard Icon={Clock}          title="Historial"           subtitle={detailSubtitle}                                                                                          status="Ver historial"  statusType={detailStatusType}   to="/historial" />
          <DashCard Icon={Chat}           title="Chat familiar"       subtitle="Mensajes del equipo"                                                                                     status="Ver chat"       statusType="info"                to="/chat" />

          {/* Fila 3: Citas médicas | Cuentas Claras */}
          <DashCard
            Icon={Calendar}
            title="Citas médicas"
            subtitle={nextAppointment?.appointmentTitle ?? 'Sin citas próximas'}
            status={nextAppointment ? (nextAppointment.dateKey === todayKey ? 'Hoy' : nextAppointment.dateKey === tomorrowKey ? 'Mañana' : 'Esta semana') : 'Ver calendario'}
            statusType={nextAppointment ? 'warning' : 'info'}
            to="/calendar"
          />
          <DashCard Icon={Receipt}        title="Cuentas Claras"      subtitle="Control de gastos"                                                                                       status="Ver gastos"     statusType="info"                to="/gastos" />

          {/* Fila 4: Perfil del paciente | Mi equipo */}
          <DashCard Icon={User}           title="Perfil del paciente" subtitle="Diagnósticos y alergias"                                                                                 status="Ver perfil"     statusType="info"                to="/paciente/perfil" />
          <DashCard Icon={Users}          title="Mi equipo"           subtitle="Cuidadores y familiares"                                                                                 status="Ver equipo"     statusType="info"                to="/familia" />

          {/* Fila 5: Videollamada | Modo Hospital */}
          <DashCard Icon={Camera}         title="Videollamada"        subtitle="Conectar con la familia"                                                                                 status="Próximamente"   statusType="info"                onClick={() => {}} />
          <DashCard Icon={Heart}          title="Modo Hospital"       subtitle="Gestión en internación"                                                                                  status="Próximamente"   statusType="info"                onClick={() => {}} />

          {/* Otras funciones — ancho completo */}
          <Link
            to="/mas"
            style={{
              gridColumn: 'span 2',
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'white', borderRadius: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              padding: '16px 18px', textDecoration: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'rgba(74,124,89,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Menu size={22} color="#4A7C59" strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#2d3748', margin: 0 }}>Otras funciones</p>
              <p style={{ fontSize: 12, color: '#718096', margin: '3px 0 0' }}>Álbum, Memorias, Reportes, Directorio, Ajustes</p>
            </div>
            <div style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 20, background: '#F3F4F6',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6B7280', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>Ver todo</span>
            </div>
          </Link>
        </div>

        {/* Sign out */}
        <div style={{ marginTop: 8, paddingBottom: 8, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={async () => {
              localStorage.removeItem('fc_active_context')
              localStorage.removeItem('fc_member_owner_id')
              try { await signOut() } catch { }
              window.location.href = '/login'
            }}
            style={{
              background: 'none', border: '1px solid #EDE5D8',
              color: '#9CA3AF', fontSize: 13, fontWeight: 600,
              borderRadius: 12, padding: '10px 24px', cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </button>
        </div>
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
        <EventDetailSheet evt={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </Layout>
  )
}
