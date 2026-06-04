import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, MoreVertical, Pencil, Plus, Trash, XIcon } from '../components/Icons'
import { getLocation, mapsUrl } from '../lib/gps'
import { track } from '../lib/analytics'
import EvidencePhoto from '../components/EvidencePhoto'
import { detectMedicationWindow } from '../utils/medicationDatabase'

const TIME_GROUPS = [
  { id: 0, label: 'Mañana',      icon: '🌅', range: [0, 12] },
  { id: 1, label: 'Tarde',       icon: '☀️',  range: [12, 18] },
  { id: 2, label: 'Noche',       icon: '🌙', range: [18, 24] },
  { id: 3, label: 'Sin horario', icon: '💊', range: null },
]

function groupIndex(timeStr) {
  if (!timeStr) return 3
  const h = parseInt(timeStr.split(':')[0], 10)
  if (h < 12) return 0
  if (h < 18) return 1
  return 2
}

async function stampProof(file, confirmerName) {
  return new Promise(resolve => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const barH = Math.max(44, Math.round(img.naturalHeight * 0.07))
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, img.naturalHeight - barH, img.naturalWidth, barH)
      const now = new Date()
      const stamp = `${now.toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })} · ${now.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })} · ${confirmerName} · FamiliaCerca ✓`
      const fs = Math.max(11, Math.round(img.naturalWidth * 0.022))
      ctx.fillStyle = 'white'
      ctx.font = `bold ${fs}px Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
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

// Returns: 'programado' | 'pendiente' | 'dar_pronto' | 'tarde' | 'completado' | 'dado_tarde'
function calcularEstadoMedicamento(scheduledTime, isConfirmed = false, windowMinutes = 60, givenOnTime = null) {
  if (isConfirmed) return givenOnTime === false ? 'dado_tarde' : 'completado'
  if (!scheduledTime) return 'pendiente'
  const [hStr, mStr] = scheduledTime.split(':')
  const h = Math.min(Math.max(parseInt(hStr, 10) || 0, 0), 23)
  const m = Math.min(Math.max(parseInt(mStr, 10) || 0, 0), 59)
  const now = new Date()
  const diffMins = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
  if (diffMins < 0) return 'programado'
  if (diffMins >= windowMinutes) return 'tarde'
  if (diffMins >= windowMinutes - 15) return 'dar_pronto'
  return 'pendiente'
}

const STATUS_CONFIG = {
  programado: { dot: '⚪', label: 'Programado',  color: '#9CA3AF', bg: '#F3F4F6', border: '#E5E7EB' },
  pendiente:  { dot: '🟢', label: 'Pendiente',   color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' },
  dar_pronto: { dot: '🟡', label: 'Dar pronto',  color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  tarde:      { dot: '🔴', label: 'Tarde',       color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
  completado: { dot: '✅', label: 'Dado',        color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  dado_tarde: { dot: '⚠️', label: 'Dado tarde',  color: '#7A5A18', bg: '#FFFBEB', border: '#FDE68A' },
}

export default function Hoy() {
  const { user } = useAuth()
  const { ownerId, profile, memberRole } = useFamily()
  const navigate = useNavigate()
  const [medications, setMedications] = useState([])
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [menuOpen, setMenuOpen] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)

  const isFamiliar = memberRole === 'familiar'
  const isAdmin = memberRole === null || ownerId === user?.id
  const isCuidador = memberRole === 'cuidador'
  function canActOn(med) {
    return isAdmin
  }
  const [adminWarningMed, setAdminWarningMed] = useState(null)
  const [weekHistory, setWeekHistory] = useState([])

  // New confirmation panel (PARTE 4): shown before confirming
  const [confirmPanel, setConfirmPanel] = useState(null) // { med }
  const [panelUploading, setPanelUploading] = useState(false)
  const [panelStamping, setPanelStamping] = useState(false)
  const [panelPreview, setPanelPreview] = useState(null)
  const [panelBlob, setPanelBlob] = useState(null)
  const [panelGps, setPanelGps] = useState(null)
  const [panelError, setPanelError] = useState('')

  // Legacy proof sheet (post-confirm photo for existing logs without photo)
  const [proofSheet, setProofSheet] = useState(null)
  const [proofUploading, setProofUploading] = useState(false)
  const [proofStamping, setProofStamping] = useState(false)
  const [proofPreview, setProofPreview] = useState(null)
  const [proofBlob, setProofBlob] = useState(null)
  const [proofGps, setProofGps] = useState(null)
  const [uploadError, setUploadError] = useState('')

  // Tick every minute so status badges update automatically (PARTE 6)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Use LOCAL date to avoid UTC midnight rollover showing yesterday's
  // confirmed-in-the-evening logs as today's pre-confirmed medications.
  function toLocalDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const today = toLocalDate()
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  useEffect(() => {
    if (user && ownerId) fetchData()
  }, [user, ownerId])

  async function fetchData() {
    setLoading(true)
    setLoadError('')
    try {
      const histDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (i + 1))
        return toLocalDate(d)
      }).reverse()

      const [
        { data: meds,      error: e1 },
        { data: todayLogs, error: e2 },
        { data: histMedLogs },
      ] = await Promise.all([
        supabase.from('medications').select('*').eq('user_id', ownerId),
        supabase.from('medication_logs').select('*').eq('user_id', ownerId).eq('log_date', today),
        supabase.from('medication_logs').select('medication_id,log_date,status').eq('user_id', ownerId).in('log_date', histDays),
      ])
      if (e1 || e2) throw e1 ?? e2
      setMedications(meds ?? [])
      const map = {}
      ;(todayLogs ?? []).forEach(l => { map[l.medication_id] = l })
      setLogs(map)

      const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      setWeekHistory(histDays.map(date => {
        const d = new Date(date + 'T12:00:00')
        const confirmedIds = new Set(
          (histMedLogs ?? [])
            .filter(l => l.log_date === date && l.status === 'confirmed')
            .map(l => l.medication_id)
        )
        const medFail = (meds ?? []).length > 0
          ? (meds ?? []).filter(m => !confirmedIds.has(m.id)).length
          : 0
        return {
          date,
          dayLabel: DAY_LABELS[d.getDay()],
          dayNum: d.getDate(),
          failures: medFail,
        }
      }))
    } catch (err) {
      console.error(err)
      setLoadError('No se pudieron cargar los datos. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  // Opens the full confirmation panel (PARTE 4)
  function openConfirmPanel(med) {
    if (isFamiliar) return
    setConfirmPanel({ med })
    setPanelPreview(null)
    setPanelBlob(null)
    setPanelGps(null)
    setPanelStamping(false)
    setPanelError('')
  }

  function closeConfirmPanel() {
    setConfirmPanel(null)
    setPanelPreview(null)
    setPanelBlob(null)
    setPanelGps(null)
    setPanelError('')
  }

  async function panelHandleFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setPanelError('')
    setPanelStamping(true)
    try {
      const [stamped, loc] = await Promise.all([
        stampProof(f, displayName),
        getLocation({ force: true }).catch(() => null),
      ])
      setPanelBlob(stamped)
      setPanelPreview(URL.createObjectURL(stamped))
      setPanelGps(loc)
    } catch {
      setPanelError('No se pudo procesar la foto. Intenta de nuevo.')
    } finally {
      setPanelStamping(false)
    }
  }

  function panelOpenCamera() {
    if (panelStamping || panelUploading) return
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'; el.capture = 'environment'
    el.addEventListener('change', panelHandleFile, { once: true })
    el.click()
  }

  function panelOpenGallery() {
    if (panelStamping || panelUploading) return
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'
    el.addEventListener('change', panelHandleFile, { once: true })
    el.click()
  }

  // Main confirm action from panel (PARTE 5)
  async function doConfirmFromPanel() {
    if (!confirmPanel) return
    const med = confirmPanel.med
    setPanelUploading(true)
    setPanelError('')
    try {
      const loc = panelGps ?? await getLocation({ force: true }).catch(() => null)
      const confirmedAt = new Date().toISOString()

      // Calculate timing fields (PARTE 5)
      const scheduledTime = firstTime(med)
      const windowMinutes = med.time_window_minutes ?? detectMedicationWindow(med.name)
      let minutesLate = null
      let givenOnTime = true
      let scheduledAt = null

      if (scheduledTime) {
        const [hh, mm] = scheduledTime.split(':').map(Number)
        const scheduledDate = new Date()
        scheduledDate.setHours(hh, mm, 0, 0)
        scheduledAt = scheduledDate.toISOString()
        minutesLate = Math.round((new Date(confirmedAt) - scheduledDate) / 60000)
        givenOnTime = minutesLate <= windowMinutes
      }

      // Upload photo if taken
      let photoUrl = null
      if (panelBlob) {
        const path = `${ownerId}/${today}/${med.id}.jpg`
        const { error: storageErr } = await supabase.storage
          .from('confirmations')
          .upload(path, panelBlob, { upsert: true, contentType: 'image/jpeg' })
        if (!storageErr) {
          const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      // Save log (PARTE 5)
      const logPayload = {
        medication_id: med.id,
        user_id: ownerId,
        status: 'confirmed',
        log_date: today,
        confirmed_by_name: displayName,
        given_by_name: displayName,
        confirmed_at: confirmedAt,
        scheduled_at: scheduledAt,
        photo_url: photoUrl,
        given_on_time: givenOnTime,
        minutes_late: minutesLate,
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
        address: loc?.address ?? null,
      }

      await supabase.from('medication_logs').upsert(logPayload, { onConflict: 'medication_id,log_date,user_id' })
      track('medication_marked_given', { medication_name: med.name, given_on_time: givenOnTime, has_photo: !!photoUrl })

      setLogs(prev => ({ ...prev, [med.id]: { ...logPayload } }))
      closeConfirmPanel()

      // Offer legacy proof sheet only if no photo was taken and within 30-min window
      if (!photoUrl) openProofSheet(med)
    } catch (err) {
      console.error(err)
      setPanelError('No se pudo registrar. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setPanelUploading(false)
    }
  }

  // Legacy direct confirm (kept for unconfirm flow)
  async function confirmMed(med) {
    if (isFamiliar) return
    openConfirmPanel(med)
  }

  async function unconfirmMed(med) {
    await supabase.from('medication_logs').delete()
      .eq('medication_id', med.id)
      .eq('user_id', ownerId)
      .eq('log_date', today)
    setLogs(prev => { const n = { ...prev }; delete n[med.id]; return n })
  }

  async function handleDeleteMed(id) {
    await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    setMedications(prev => prev.filter(m => m.id !== id))
    setLogs(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function openProofSheet(med) {
    setProofSheet({ med })
    setProofPreview(null)
    setProofBlob(null)
    setProofGps(null)
    setProofStamping(false)
    setUploadError('')
  }

  function openCamera() {
    if (proofStamping || proofUploading) return
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'; el.capture = 'environment'
    el.addEventListener('change', handleProofFile, { once: true })
    el.click()
  }

  function openGallery() {
    if (proofStamping || proofUploading) return
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'
    el.addEventListener('change', handleProofFile, { once: true })
    el.click()
  }

  function closeProofSheet() {
    setProofSheet(null)
    setProofPreview(null)
    setProofBlob(null)
    setProofGps(null)
    setUploadError('')
  }

  async function handleProofFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploadError('')
    setProofStamping(true)
    try {
      const [stamped, loc] = await Promise.all([
        stampProof(f, displayName),
        getLocation({ force: true }).catch(() => null),
      ])
      setProofBlob(stamped)
      setProofPreview(URL.createObjectURL(stamped))
      setProofGps(loc)
    } catch (err) {
      setUploadError('No se pudo procesar la foto. Intenta de nuevo.')
    } finally {
      setProofStamping(false)
    }
  }

  async function submitProofPhoto() {
    if (!proofBlob || !proofSheet) return
    setProofUploading(true)
    setUploadError('')
    try {
      const medId = proofSheet.med.id
      const path = `${ownerId}/${today}/${medId}.jpg`
      const { error: storageError } = await supabase.storage
        .from('confirmations')
        .upload(path, proofBlob, { upsert: true, contentType: 'image/jpeg' })
      if (storageError) throw storageError
      const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)
      const updateFields = {
        photo_url: publicUrl,
        ...(proofGps && {
          latitude:  proofGps.latitude,
          longitude: proofGps.longitude,
          address:   proofGps.address,
        }),
      }
      const { error: dbError } = await supabase.from('medication_logs')
        .update(updateFields)
        .eq('medication_id', medId)
        .eq('user_id', ownerId)
        .eq('log_date', today)
      if (dbError) throw dbError
      setLogs(prev => ({ ...prev, [medId]: { ...prev[medId], ...updateFields } }))
      closeProofSheet()
    } catch (err) {
      console.error(err)
      setUploadError('No se pudo guardar la foto. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setProofUploading(false)
    }
  }

  function firstTime(med) {
    if (med.scheduled_times?.length) return [...med.scheduled_times].sort()[0]
    return med.time ?? null
  }

  const grouped = {}
  for (const med of medications) {
    const t = firstTime(med)
    const g = groupIndex(t)
    if (!grouped[g]) grouped[g] = []
    grouped[g].push({ ...med, _firstTime: t })
  }

  const confirmedCount = medications.filter(m => logs[m.id]?.status === 'confirmed').length
  const total = medications.length
  const allDone = total > 0 && confirmedCount === total

  const pendingProof = medications.filter(med => {
    const log = logs[med.id]
    if (log?.status !== 'confirmed') return false
    if (log?.photo_url) return false
    if (!log?.confirmed_at) return false
    return (Date.now() - new Date(log.confirmed_at).getTime()) < 30 * 60 * 1000
  })

  function fmtMedTime(t) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const hh = h > 12 ? h - 12 : (h === 0 ? 12 : h)
    return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`
  }

  const overdueMeds = !loading
    ? medications.filter(m => {
        if (logs[m.id]?.status === 'confirmed') return false
        const win = m.time_window_minutes ?? detectMedicationWindow(m.name)
        return calcularEstadoMedicamento(firstTime(m), false, win) === 'tarde'
      })
    : []

  const showMedOverdue = !isFamiliar && !loading && overdueMeds.length > 0

  return (
    <Layout>

      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Overdue meds alert */}
        {showMedOverdue && (
          <div style={{
            background: '#FEF2F2', border: '1.5px solid #FCA5A5',
            borderRadius: 14, padding: '12px 16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>❌</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', margin: 0, lineHeight: 1.5 }}>
                {overdueMeds.length} dosis olvidada{overdueMeds.length !== 1 ? 's' : ''} — ventana clínica vencida
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overdueMeds.map(m => {
                const t = firstTime(m)
                const timeLabel = t ? fmtMedTime(t) : null
                const medLabel = [m.name, m.dosage].filter(Boolean).join(' ')
                const waText = encodeURIComponent(
                  `⚠️ Dosis olvidada: ${medLabel}${timeLabel ? `. Hora programada: ${timeLabel}` : ''}. La dosis no fue administrada en el horario establecido. Por favor indique el procedimiento a seguir.`
                )
                return (
                  <div
                    key={m.id}
                    style={{
                      background: '#FFF5F5', border: '1px solid #FCA5A5',
                      borderRadius: 12, padding: '10px 12px',
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', margin: '0 0 6px' }}>
                      💊 {m.name}{timeLabel ? ` · ${timeLabel}` : ''}
                    </p>
                    <p style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.5, margin: '0 0 8px', fontWeight: 500 }}>
                      ⚠️ No administres esta dosis. Continúa con la próxima a su hora habitual. Si es un medicamento crítico o hay síntomas, notifica al médico.
                    </p>
                    <a
                      href={`https://wa.me/?text=${waText}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px', borderRadius: 8, background: '#25D366', color: 'white', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                    >
                      📱 Notificar al médico
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 7-day history */}
        {!isFamiliar && !loading && weekHistory.length > 0 && (
          <div style={{
            background: 'white', borderRadius: 16, padding: '14px 16px',
            border: '1px solid #EDE5D8', marginBottom: 14,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: '0 0 10px' }}>
              Últimos 7 días
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekHistory.map(({ date, dayLabel, dayNum, failures }) => (
                <div key={date} style={{
                  padding: '6px 10px',
                  borderRadius: 10,
                  background: failures === 0 ? '#F0FDF4' : '#FEF2F2',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', minWidth: 52 }}>
                      {dayLabel} {dayNum}
                    </span>
                    <span style={{ fontSize: 13 }}>{failures === 0 ? '✅' : '⚠️'}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: failures === 0 ? '#16A34A' : '#DC2626',
                    }}>
                      {failures === 0 ? 'Todo completado' : `${failures} med${failures !== 1 ? 's' : ''} sin dar`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add medication button */}
        {!isFamiliar && (
          <Link
            to="/medications?add=1"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 0', borderRadius: 14, marginBottom: 14,
              background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
              color: 'white', fontWeight: 700, fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(74,124,89,0.3)',
            }}
          >
            <Plus size={16} color="white" strokeWidth={2.5} />
            Agregar medicamento
          </Link>
        )}

        {/* Progress card */}
        {total > 0 && (
          <div style={{
            background: allDone ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'white',
            borderRadius: 20, padding: '16px 18px',
            border: `1px solid ${allDone ? '#BBF7D0' : '#EDE5D8'}`,
            marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                {allDone ? '¡Todo dado hoy! ✅' : `${confirmedCount} de ${total} medicamentos`}
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? '#16A34A' : '#4A7C59' }}>
                {total > 0 ? Math.round((confirmedCount / total) * 100) : 0}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: allDone ? '#BBF7D0' : '#F5EEE6' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${total ? (confirmedCount / total) * 100 : 0}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                  : 'linear-gradient(90deg, #4A7C59, #C9882A)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            {allDone && (
              <p style={{ fontSize: 12, color: '#16A34A', fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
                {profile?.name ? `${profile.name} tomó todos sus medicamentos hoy 💙` : 'Todos los medicamentos dados hoy 💙'}
              </p>
            )}
          </div>
        )}

        {/* Persistent proof reminders */}
        {pendingProof.filter(med => med.id !== proofSheet?.med?.id).map(med => {
          const log = logs[med.id]
          const minLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(log.confirmed_at).getTime()) / 60000))
          return (
            <div
              key={med.id}
              onClick={() => !isFamiliar && openProofSheet(med)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#FFFBEB', border: '1.5px solid #F59E0B',
                borderRadius: 14, padding: '10px 14px', marginBottom: 10,
                cursor: isFamiliar ? 'default' : 'pointer',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>📷</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#7A5A18', margin: 0 }}>
                  Agrega foto de prueba — {minLeft} min restantes
                </p>
                <p style={{ fontSize: 11, color: '#A07020', margin: '2px 0 0' }}>{med.name}</p>
              </div>
              <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>📷 Agregar</span>
            </div>
          )
        })}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#4A7C59',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : loadError ? (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#D63031', marginBottom: 12 }}>{loadError}</p>
            <button onClick={fetchData} style={{ padding: '10px 24px', borderRadius: 12, background: '#4A7C59', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Medications list */}
            {medications.length === 0 ? (
              <div style={{
                background: 'white', borderRadius: 20, border: '1px solid #EDE5D8',
                padding: '48px 24px', textAlign: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>💊</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
                  Sin medicamentos configurados
                </p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
                  Agrega los medicamentos del familiar para verlos aquí cada día.
                </p>
                <Link
                  to="/medications?add=1"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 20px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                    color: 'white', fontWeight: 700, fontSize: 13,
                    textDecoration: 'none',
                  }}
                >
                  <Plus size={14} color="white" strokeWidth={2.5} />
                  Agregar medicamento
                </Link>
              </div>
            ) : (
              TIME_GROUPS.map(group => {
                const meds = (grouped[group.id] ?? [])
                  .sort((a, b) => (a._firstTime ?? '99:99').localeCompare(b._firstTime ?? '99:99'))
                if (!meds.length) return null
                return (
                  <div key={group.id} style={{ marginBottom: 16 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#9CA3AF',
                      marginBottom: 8, paddingLeft: 2,
                    }}>
                      {group.icon} {group.label}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {meds.map(med => {
                        const log = logs[med.id]
                        const isConfirmed = log?.status === 'confirmed'
                        const isWorking = confirming === med.id
                        const allTimes = med.scheduled_times?.length
                          ? [...med.scheduled_times].sort()
                          : med.time ? [med.time] : []

                        const hasPhoto = !!log?.photo_url
                        const hasGPS   = !!(log?.latitude && log?.longitude)
                        const proofExpired = isConfirmed && !hasPhoto && log?.confirmed_at &&
                          (Date.now() - new Date(log.confirmed_at).getTime()) >= 30 * 60 * 1000

                        // Use the medication's own window (PARTE 6)
                        const windowMinutes = med.time_window_minutes ?? detectMedicationWindow(med.name)
                        const timingStatus = calcularEstadoMedicamento(
                          med._firstTime, isConfirmed, windowMinutes, log?.given_on_time
                        )
                        const statusCfg = STATUS_CONFIG[timingStatus] ?? STATUS_CONFIG.pendiente
                        const isEarly = timingStatus === 'programado'
                        const earlyLabel = (() => {
                          if (!isEarly || !med._firstTime) return null
                          const [hh, mm] = med._firstTime.split(':').map(Number)
                          const d = new Date(); d.setHours(hh, mm, 0, 0)
                          return d.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })
                        })()

                        return (
                          <div
                            key={med.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              background: isConfirmed ? '#F0FDF4' : 'white',
                              borderRadius: 16,
                              border: `1px solid ${isConfirmed ? '#BBF7D0' : '#EDE5D8'}`,
                              padding: '12px 14px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                              transition: 'all 0.25s',
                            }}
                          >
                            <button
                              onClick={() => {
                                if (isFamiliar) return
                                if (isConfirmed) { unconfirmMed(med); return }
                                // REGLA DE ORO: SIEMPRE abre el panel, nunca deshabilitar
                                if (isAdmin) { setAdminWarningMed(med); return }
                                openConfirmPanel(med)
                              }}
                              disabled={isWorking || isFamiliar}
                              style={{
                                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                border: `2px solid ${isConfirmed ? '#22C55E' : statusCfg.border}`,
                                background: isConfirmed ? '#22C55E' : statusCfg.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: isWorking || isFamiliar ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                              }}
                              aria-label={isConfirmed ? 'Desmarcar' : 'Marcar como dado'}
                            >
                              {isConfirmed && <CheckIcon size={14} color="white" strokeWidth={2.5} />}
                              {isWorking && !isConfirmed && (
                                <div style={{
                                  width: 10, height: 10, borderRadius: '50%',
                                  border: '2px solid #D1D5DB', borderTopColor: '#4A7C59',
                                  animation: 'spin 0.6s linear infinite',
                                }} />
                              )}
                              {!isConfirmed && !isWorking && (
                                <span style={{ fontSize: 12, lineHeight: 1 }}>{statusCfg.dot}</span>
                              )}
                            </button>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: 14, fontWeight: 600, margin: 0,
                                color: isConfirmed ? '#9CA3AF' : '#1A1A1A',
                                textDecoration: isConfirmed ? 'line-through' : 'none',
                              }}>
                                {med.name}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                                {med.dosage && (
                                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{med.dosage}</span>
                                )}
                                {allTimes.map(t => (
                                  <span key={t} style={{
                                    fontSize: 11, color: '#9CA3AF',
                                    background: '#F5EEE6', padding: '1px 6px', borderRadius: 4,
                                  }}>
                                    ⏰ {t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {isConfirmed && (
                              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                {hasPhoto ? (
                                  <>
                                    <EvidencePhoto photoUrl={log.photo_url} />
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, color: '#16A34A',
                                      background: '#DCFCE7', padding: '3px 8px', borderRadius: 6,
                                      display: 'block',
                                    }}>
                                      ✅ Con prueba
                                    </span>
                                  </>
                                ) : proofExpired ? (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, color: '#7A5A18',
                                    background: '#FFFBEB', padding: '3px 8px', borderRadius: 6,
                                    display: 'block',
                                  }}>
                                    Sin foto de prueba
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, color: '#16A34A',
                                    background: '#DCFCE7', padding: '3px 8px', borderRadius: 6,
                                    display: 'block',
                                  }}>
                                    ✓ Dado
                                  </span>
                                )}
                                {hasGPS ? (
                                  <a
                                    href={mapsUrl(log.latitude, log.longitude)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ fontSize: 10, color: '#2D86A0', textDecoration: 'none', display: 'block', marginTop: 3 }}
                                  >
                                    📍 Ver mapa
                                  </a>
                                ) : log?.confirmed_by_name && (
                                  <span style={{ fontSize: 9, color: '#9CA3AF', display: 'block', marginTop: 2 }}>
                                    {log.confirmed_by_name.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            )}

                            {!isConfirmed && (
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                color: statusCfg.color,
                                background: statusCfg.bg,
                                border: `1px solid ${statusCfg.border}`,
                                padding: '3px 8px', borderRadius: 6,
                                whiteSpace: 'nowrap',
                              }}>
                                {isEarly && earlyLabel ? `🕐 ${earlyLabel}` : `${statusCfg.dot} ${statusCfg.label}`}
                              </span>
                            )}

                            {(isAdmin || canActOn(med)) && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === med.id ? null : med.id) }}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    border: '1px solid #EDE5D8', background: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                  aria-label="Opciones"
                                >
                                  <MoreVertical size={14} color="#9CA3AF" strokeWidth={2} />
                                </button>
                                {menuOpen === med.id && (
                                  <>
                                    <div
                                      style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                                      onClick={() => setMenuOpen(null)}
                                    />
                                    <div style={{
                                      position: 'absolute', right: 0, top: 32, zIndex: 100,
                                      background: 'white', borderRadius: 12,
                                      border: '1px solid #EDE5D8',
                                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                      minWidth: 180, overflow: 'hidden',
                                    }}>
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          setMenuOpen(null)
                                          navigate(`/medications?edit=${med.id}`)
                                        }}
                                        style={{
                                          width: '100%', padding: '12px 16px',
                                          display: 'flex', alignItems: 'center', gap: 10,
                                          background: 'none', border: 'none', cursor: 'pointer',
                                          color: '#374151', fontSize: 13, fontWeight: 600,
                                          textAlign: 'left',
                                          borderBottom: canActOn(med) ? '1px solid #F3F4F6' : 'none',
                                        }}
                                      >
                                        <Pencil size={14} color="#6B7280" strokeWidth={1.75} />
                                        Editar medicamento
                                      </button>
                                      {canActOn(med) && (
                                        <button
                                          onClick={e => {
                                            e.stopPropagation()
                                            setMenuOpen(null)
                                            setConfirmDialog({ onConfirm: () => handleDeleteMed(med.id) })
                                          }}
                                          style={{
                                            width: '100%', padding: '12px 16px',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#D63031', fontSize: 13, fontWeight: 600,
                                            textAlign: 'left',
                                          }}
                                        >
                                          <Trash size={14} color="#D63031" strokeWidth={1.75} />
                                          Eliminar medicamento
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDialog && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              ¿Eliminar este medicamento?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Panel (PARTE 4) ──────────────────────────── */}
      {confirmPanel && (() => {
        const med = confirmPanel.med
        const windowMinutes = med.time_window_minutes ?? detectMedicationWindow(med.name)
        const schedTime = firstTime(med)
        const status = calcularEstadoMedicamento(schedTime, false, windowMinutes)
        const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente
        const now = new Date()
        const nowStr = now.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        const patientFirstName = profile?.name?.split(' ')[0] ?? 'el paciente'

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget && !panelUploading) closeConfirmPanel() }}
          >
            <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px 20px 96px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 48px rgba(0,0,0,0.25)' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                    💊 {med.name}
                  </p>
                  {med.dosage && <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0' }}>{med.dosage}</p>}
                </div>
                <button onClick={closeConfirmPanel} disabled={panelUploading} style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <XIcon size={16} color="#6B7280" strokeWidth={2} />
                </button>
              </div>

              {/* Status pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 20,
                background: statusCfg.bg, border: `1.5px solid ${statusCfg.border}`,
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 16 }}>{statusCfg.dot}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                {schedTime && (
                  <span style={{ fontSize: 12, color: statusCfg.color, opacity: 0.75 }}>
                    · programado {fmtMedTime(schedTime)} · ventana {windowMinutes} min
                  </span>
                )}
              </div>

              {/* Time info */}
              <div style={{ background: '#F9F5F1', borderRadius: 14, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🕐</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Hora actual: {nowStr}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                    ¿Ya le diste {med.name} a {patientFirstName}?
                  </p>
                </div>
              </div>

              {/* Photo section */}
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', margin: '0 0 10px' }}>
                📷 Foto de evidencia
              </p>
              <div style={{ border: '2px dashed #EDE5D8', borderRadius: 16, overflow: 'hidden', marginBottom: 12, background: panelPreview ? 'transparent' : '#FDFAF7' }}>
                {panelStamping ? (
                  <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#4A7C59', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Aplicando sello...</p>
                  </div>
                ) : panelPreview ? (
                  <>
                    <img src={panelPreview} alt="Evidencia" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                    <div style={{ padding: '8px 12px', background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12 }}>🔒</span>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#15803D', margin: 0, flex: 1 }}>Sello aplicado</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={panelOpenCamera} disabled={panelUploading} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #4A7C59', background: '#EBF3EE', color: '#4A7C59', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📷</button>
                        <button type="button" onClick={panelOpenGallery} disabled={panelUploading} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #C0CCC5', background: '#FDFAF7', color: '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🖼</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 32 }}>📷</span>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
                      Se recomienda foto como evidencia · sellado automático con hora y nombre
                    </p>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <button type="button" onClick={panelOpenCamera} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid #4A7C59', background: '#EBF3EE', color: '#4A7C59', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📷 Tomar foto</button>
                      <button type="button" onClick={panelOpenGallery} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid #C0CCC5', background: '#FDFAF7', color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖼 Galería</button>
                    </div>
                  </div>
                )}
              </div>

              {!panelBlob && (
                <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 }}>
                  La foto no es obligatoria — puedes confirmar sin ella
                </p>
              )}

              {panelError && (
                <div style={{ background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }}>
                  <span>⚠️</span>
                  <p style={{ fontSize: 12, color: '#D63031', margin: 0 }}>{panelError}</p>
                </div>
              )}

              {/* Confirm button — SIEMPRE habilitado (REGLA DE ORO) */}
              <button
                onClick={doConfirmFromPanel}
                disabled={panelUploading || panelStamping}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: 'white', fontWeight: 800, fontSize: 16,
                  cursor: (panelUploading || panelStamping) ? 'not-allowed' : 'pointer',
                  opacity: (panelUploading || panelStamping) ? 0.75 : 1,
                  boxShadow: '0 6px 20px rgba(34,197,94,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 10,
                }}
              >
                {panelUploading ? (
                  <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} /> Guardando...</>
                ) : (
                  <>✅ Confirmar que se dio</>
                )}
              </button>
              <button onClick={closeConfirmPanel} style={{ width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9CA3AF' }}>
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* Admin emergency confirmation dialog */}
      {adminWarningMed && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setAdminWarningMed(null) }}
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
              Esta acción se registrará con tu nombre.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setAdminWarningMed(null) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { const m = adminWarningMed; setAdminWarningMed(null); openConfirmPanel(m) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#C9882A', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(201,136,42,0.3)' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof photo bottom sheet */}
      {proofSheet && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget && !proofUploading) closeProofSheet() }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'white',
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 96px',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                  📷 Foto de prueba
                </p>
                {(() => {
                  const confirmedAt = logs[proofSheet.med.id]?.confirmed_at
                  const minLeft = confirmedAt
                    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 60_000))
                    : 30
                  return (
                    <p style={{ fontSize: 13, color: minLeft <= 5 ? '#C9882A' : '#6B7280', marginTop: 4 }}>
                      {proofSheet.med.name} — {minLeft > 0 ? `${minLeft} min restantes` : 'Tiempo agotado'}
                    </p>
                  )
                })()}
              </div>
              <button
                onClick={closeProofSheet}
                disabled={proofUploading}
                style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: proofUploading ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: proofUploading ? 0.4 : 1 }}
              >
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            {calcularEstadoMedicamento(firstTime(proofSheet.med)) === 'tarde' && (
              <div style={{
                padding: '10px 14px', background: '#FFFBEB', border: '1px solid #F59E0B',
                borderRadius: 12, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <p style={{ fontSize: 12, color: '#7A5A18', margin: 0, lineHeight: 1.5 }}>
                  Dado fuera del horario programado · Foto subida fuera del horario
                </p>
              </div>
            )}

            <div style={{
              width: '100%', border: '2px dashed #EDE5D8',
              borderRadius: 16, overflow: 'hidden', marginBottom: 16,
              background: proofPreview ? 'transparent' : '#FDFAF7',
            }}>
              {proofStamping ? (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '3px solid #EDE5D8', borderTopColor: '#4A7C59',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Aplicando sello...</p>
                </div>
              ) : proofPreview ? (
                <>
                  <img src={proofPreview} alt="Prueba sellada" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
                  <div style={{
                    width: '100%', padding: '10px 14px',
                    background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ fontSize: 14 }}>🔒</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', margin: 0 }}>Sello aplicado</p>
                      {proofGps && (
                        <p style={{ fontSize: 11, color: '#4A7C59', margin: '2px 0 0' }}>
                          📍 {proofGps.address ?? `${proofGps.latitude.toFixed(5)}, ${proofGps.longitude.toFixed(5)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, padding: '8px 12px 12px' }}>
                    <button type="button" onClick={openCamera} disabled={proofUploading}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid #4A7C59', background: '#EBF3EE', color: '#4A7C59', fontSize: 12, fontWeight: 700, cursor: proofUploading ? 'not-allowed' : 'pointer' }}>
                      📷 Tomar foto
                    </button>
                    <button type="button" onClick={openGallery} disabled={proofUploading}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid #C0CCC5', background: '#FDFAF7', color: '#6B7280', fontSize: 12, fontWeight: 700, cursor: proofUploading ? 'not-allowed' : 'pointer' }}>
                      🖼 De galería
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: '#EBF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 26 }}>📷</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Se sellará automáticamente con fecha y hora</p>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <button type="button" onClick={openCamera}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #4A7C59', background: '#EBF3EE', color: '#4A7C59', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      📷 Tomar foto
                    </button>
                    <button type="button" onClick={openGallery}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #C0CCC5', background: '#FDFAF7', color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      🖼 Elegir de galería
                    </button>
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: '#FFF0F0', border: '1px solid #FFBABA',
                borderRadius: 10, padding: '10px 12px', marginBottom: 12,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                <p style={{ fontSize: 12, color: '#D63031', margin: 0, lineHeight: 1.5 }}>
                  {uploadError}
                </p>
              </div>
            )}

            <button
              onClick={submitProofPhoto}
              disabled={!proofBlob || proofUploading || proofStamping}
              style={{
                width: '100%', padding: '14px', marginBottom: 10,
                borderRadius: 14, border: 'none',
                background: proofBlob && !proofUploading
                  ? 'linear-gradient(135deg, #4A7C59, #3A6347)'
                  : '#C0CCC5',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: proofBlob && !proofUploading ? 'pointer' : 'not-allowed',
                boxShadow: proofBlob && !proofUploading ? '0 6px 20px rgba(74,124,89,0.3)' : 'none',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {proofUploading ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2.5px solid rgba(255,255,255,0.4)',
                    borderTopColor: 'white',
                    animation: 'spin 0.7s linear infinite',
                    flexShrink: 0,
                  }} />
                  Guardando...
                </>
              ) : (
                '✓ Guardar foto de prueba'
              )}
            </button>

            <button
              onClick={closeProofSheet}
              style={{
                width: '100%', padding: '12px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#9CA3AF',
              }}
            >
              Omitir por ahora (tienes 30 min)
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
