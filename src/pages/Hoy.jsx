import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { CheckIcon, MoreVertical, Pencil, Plus, Trash, XIcon } from '../components/Icons'
import { getLocation, mapsUrl } from '../lib/gps'
import { track } from '../lib/analytics'

const TIME_GROUPS = [
  { id: 0, label: 'Mañana',      icon: '🌅', range: [0, 12] },
  { id: 1, label: 'Tarde',       icon: '☀️',  range: [12, 18] },
  { id: 2, label: 'Noche',       icon: '🌙', range: [18, 24] },
  { id: 3, label: 'Sin horario', icon: '💊', range: null },
]

const CARE_MOMENTS = [
  { id: 'morning',   label: 'Mañana',            icon: '🌅', overdueHour: 14,   color: '#D97706', bg: '#FFFBEB' },
  { id: 'afternoon', label: 'Tarde',              icon: '☀️',  overdueHour: 20,   color: '#C4623A', bg: '#FDF0EB' },
  { id: 'night',     label: 'Noche',              icon: '🌙', overdueHour: null, color: '#6366F1', bg: '#EEF2FF' },
  { id: 'asneeded',  label: 'Cuando se necesita', icon: '🔔', overdueHour: null, color: '#6B7280', bg: '#F9FAFB' },
]

const CARE_ITEMS = [
  { key: 'morning_bath',    label: 'Baño / ducha',           icon: '🛁', moment: 'morning' },
  { key: 'morning_clothes', label: 'Cambio de ropa',         icon: '👕', moment: 'morning' },
  { key: 'morning_dental',  label: 'Higiene bucal',          icon: '🦷', moment: 'morning' },
  { key: 'breakfast',       label: 'Desayuno',               icon: '🍳', moment: 'morning' },
  { key: 'lunch',           label: 'Almuerzo',               icon: '🍽️', moment: 'afternoon' },
  { key: 'rest',            label: 'Siesta / descanso',      icon: '😴', moment: 'afternoon' },
  { key: 'exercise',        label: 'Ejercicio / caminata',   icon: '🚶', moment: 'afternoon' },
  { key: 'dinner',          label: 'Cena',                   icon: '🍲', moment: 'night' },
  { key: 'night_dental',    label: 'Higiene bucal',          icon: '🦷', moment: 'night' },
  { key: 'bed_sheets',      label: 'Cambio de ropa de cama', icon: '🛏️', moment: 'night', weekly: true },
  { key: 'diaper',          label: 'Cambio de pañal',        icon: '🧷', moment: 'asneeded' },
  { key: 'bathroom',        label: 'Visita al baño',         icon: '🚿', moment: 'asneeded' },
  { key: 'pain',            label: 'Dolor / malestar',       icon: '😣', moment: 'asneeded' },
  { key: 'incident',        label: 'Caída o incidente',      icon: '⚠️', moment: 'asneeded' },
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
  const isAdmin = memberRole === null
  const isCuidador = memberRole === 'cuidador'
  function canActOn(med) {
    if (isFamiliar) return false
    if (isAdmin) return true
    if (isCuidador && med.created_by_user_id === user?.id) return true
    return false
  }
  const [adminWarningMed, setAdminWarningMed] = useState(null)

  // Care checklist state
  const [careLogs, setCareLogs] = useState({})
  const [careToggling, setCareToggling] = useState(null)

  // Bottom sheet for proof photo
  const [proofSheet, setProofSheet] = useState(null)
  const [proofUploading, setProofUploading] = useState(false)
  const [proofStamping, setProofStamping] = useState(false)
  const [proofPreview, setProofPreview] = useState(null)
  const [proofBlob, setProofBlob] = useState(null)
  const [proofGps, setProofGps] = useState(null)
  const [uploadError, setUploadError] = useState('')

  // Tick every 30 s so countdown displays stay current
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Use LOCAL date to avoid UTC midnight rollover showing yesterday's
  // confirmed-in-the-evening logs as today's pre-confirmed medications.
  function toLocalDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const today = toLocalDate()
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'

  // Monday of the current week — used to fetch weekly care items
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return toLocalDate(d)
  })()

  useEffect(() => {
    if (user && ownerId) fetchData()
  }, [user, ownerId])

  async function fetchData() {
    setLoading(true)
    setLoadError('')
    try {
      const [
        { data: meds,      error: e1 },
        { data: todayLogs, error: e2 },
        { data: careRows },
      ] = await Promise.all([
        supabase.from('medications').select('*').eq('user_id', ownerId),
        supabase.from('medication_logs').select('*').eq('user_id', ownerId).eq('log_date', today),
        supabase.from('daily_care_logs').select('*').eq('user_id', ownerId).gte('log_date', weekStart),
      ])
      if (e1 || e2) throw e1 ?? e2
      setMedications(meds ?? [])
      const map = {}
      ;(todayLogs ?? []).forEach(l => { map[l.medication_id] = l })
      setLogs(map)

      // Build care map — weekly items use the most recent entry this week;
      // daily items only count for today.
      const cmap = {}
      for (const row of (careRows ?? [])) {
        const item = CARE_ITEMS.find(i => i.key === row.item_key)
        if (!item) continue
        if (item.weekly) {
          if (!cmap[row.item_key] || row.log_date > cmap[row.item_key].log_date) cmap[row.item_key] = row
        } else if (row.log_date === today) {
          cmap[row.item_key] = row
        }
      }
      setCareLogs(cmap)
    } catch {
      setLoadError('No se pudieron cargar los datos. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmMed(med) {
    setConfirming(med.id)
    try {
      const loc = await getLocation({ force: true })
      const confirmedAt = new Date().toISOString()
      await supabase.from('medication_logs').upsert({
        medication_id: med.id,
        user_id: ownerId,
        status: 'confirmed',
        log_date: today,
        confirmed_by_name: displayName,
        confirmed_at: confirmedAt,
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
        address: loc?.address ?? null,
      }, { onConflict: 'medication_id,log_date,user_id' })
      track('medication_marked_given', { medication_name: med.name, has_location: !!loc })
      setLogs(prev => ({
        ...prev,
        [med.id]: {
          status: 'confirmed',
          confirmed_by_name: displayName,
          confirmed_at: confirmedAt,
          latitude: loc?.latitude ?? null,
          longitude: loc?.longitude ?? null,
          address: loc?.address ?? null,
          photo_url: null,
        },
      }))
      openProofSheet(med)
    } finally {
      setConfirming(null)
    }
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

  async function toggleCareItem(item) {
    if (isFamiliar || careToggling) return
    const existing = careLogs[item.key]
    setCareToggling(item.key)
    try {
      if (existing) {
        await supabase.from('daily_care_logs').delete().eq('id', existing.id)
        setCareLogs(prev => { const n = { ...prev }; delete n[item.key]; return n })
      } else {
        const { data, error } = await supabase
          .from('daily_care_logs')
          .upsert({
            user_id: ownerId,
            item_key: item.key,
            log_date: today,
            checked_at: new Date().toISOString(),
            checked_by: displayName,
          }, { onConflict: 'user_id,item_key,log_date' })
          .select()
          .single()
        if (!error && data) setCareLogs(prev => ({ ...prev, [item.key]: data }))
      }
    } finally {
      setCareToggling(null)
    }
  }

  function isCareItemOverdue(item) {
    if (careLogs[item.key] || item.moment === 'asneeded' || item.weekly) return false
    const overdueHour = CARE_MOMENTS.find(m => m.id === item.moment)?.overdueHour
    if (!overdueHour) return false
    return new Date().getHours() >= overdueHour
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
    const [stamped, loc] = await Promise.all([
      stampProof(f, displayName),
      getLocation({ force: true }),
    ])
    setProofBlob(stamped)
    setProofPreview(URL.createObjectURL(stamped))
    setProofGps(loc)
    setProofStamping(false)
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
    } catch {
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

  // Care checklist derived values
  const requiredItems = CARE_ITEMS.filter(i => i.moment !== 'asneeded')
  const completedRequired = requiredItems.filter(i => !!careLogs[i.key]).length
  const todayTimeline = Object.values(careLogs)
    .filter(l => l.log_date === today)
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at))

  return (
    <Layout>

      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Add medication button */}
        {!isFamiliar && (
          <Link
            to="/medications?add=1"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 0', borderRadius: 14, marginBottom: 14,
              background: 'linear-gradient(135deg, #C4623A, #A85130)',
              color: 'white', fontWeight: 700, fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(196,98,58,0.3)',
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
              <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? '#16A34A' : '#C4623A' }}>
                {total > 0 ? Math.round((confirmedCount / total) * 100) : 0}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: allDone ? '#BBF7D0' : '#F5EEE6' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${total ? (confirmedCount / total) * 100 : 0}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                  : 'linear-gradient(90deg, #C4623A, #D4A853)',
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
                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>
                  Agrega foto de prueba — {minLeft} min restantes
                </p>
                <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>{med.name}</p>
              </div>
              <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>📷 Agregar</span>
            </div>
          )
        })}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : loadError ? (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#D63031', marginBottom: 12 }}>{loadError}</p>
            <button onClick={fetchData} style={{ padding: '10px 24px', borderRadius: 12, background: '#C4623A', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
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
                    background: 'linear-gradient(135deg, #C4623A, #A85130)',
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

                        const timingStatus = calcularEstadoMedicamento(med._firstTime, isConfirmed)
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
                                if (isEarly) return
                                if (!isConfirmed && isAdmin) { setAdminWarningMed(med); return }
                                isConfirmed ? unconfirmMed(med) : confirmMed(med)
                              }}
                              disabled={isWorking || isEarly || isFamiliar}
                              style={{
                                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                border: `2px solid ${isConfirmed ? '#22C55E' : isFamiliar ? '#E5E7EB' : '#D1D5DB'}`,
                                background: isConfirmed ? '#22C55E' : isFamiliar ? '#F9FAFB' : 'white',
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
                                  border: '2px solid #D1D5DB', borderTopColor: '#C4623A',
                                  animation: 'spin 0.6s linear infinite',
                                }} />
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
                              <div style={{ textAlign: 'right' }}>
                                {hasPhoto ? (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, color: '#16A34A',
                                    background: '#DCFCE7', padding: '3px 8px', borderRadius: 6,
                                    display: 'block',
                                  }}>
                                    ✅ Con prueba
                                  </span>
                                ) : proofExpired ? (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, color: '#92400E',
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

                            {!isConfirmed && isEarly && earlyLabel && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: '#6B7280',
                                background: '#F3F4F6', padding: '3px 8px', borderRadius: 6,
                                whiteSpace: 'nowrap',
                              }}>
                                🕐 {earlyLabel}
                              </span>
                            )}
                            {!isConfirmed && timingStatus === 'tarde' && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: '#B45309',
                                background: '#FFFBEB', padding: '3px 8px', borderRadius: 6,
                                whiteSpace: 'nowrap',
                              }}>
                                ⚠ Tarde
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

            {/* ── Cuidado de hoy ──────────────────────────────────── */}
            <div style={{ marginTop: 28 }}>

              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <p style={{
                  fontSize: 16, fontWeight: 700, color: '#1A1A1A',
                  fontFamily: 'Georgia, serif', margin: 0,
                }}>
                  Cuidado de hoy
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: completedRequired === requiredItems.length ? '#16A34A' : '#C4623A',
                  background: completedRequired === requiredItems.length ? '#DCFCE7' : '#FDF0EB',
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {completedRequired}/{requiredItems.length}
                </span>
              </div>

              {isFamiliar && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F9FAFB', border: '1px solid #E5E7EB',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 14,
                }}>
                  <span style={{ fontSize: 16 }}>👁️</span>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                    Solo puedes ver el cuidado registrado por el cuidador.
                  </p>
                </div>
              )}

              {/* Checklist grouped by moment */}
              {CARE_MOMENTS.map(moment => {
                const items = CARE_ITEMS.filter(i => i.moment === moment.id)
                return (
                  <div key={moment.id} style={{ marginBottom: 14 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#9CA3AF',
                      marginBottom: 6, paddingLeft: 2,
                    }}>
                      {moment.icon} {moment.label}
                    </p>
                    <div style={{
                      background: 'white', borderRadius: 16,
                      border: '1px solid #EDE5D8', overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}>
                      {items.map((item, idx) => {
                        const isChecked  = !!careLogs[item.key]
                        const isOverdue  = isCareItemOverdue(item)
                        const isToggling = careToggling === item.key
                        const log        = careLogs[item.key]
                        const checkedTime = log?.checked_at
                          ? new Date(log.checked_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })
                          : null

                        return (
                          <div
                            key={item.key}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '13px 14px',
                              background: isChecked ? moment.bg : 'white',
                              borderBottom: idx < items.length - 1
                                ? `1px solid ${isChecked ? moment.color + '25' : '#F5EEE6'}`
                                : 'none',
                              transition: 'background 0.2s',
                              opacity: isToggling ? 0.55 : 1,
                            }}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleCareItem(item)}
                              disabled={isFamiliar || !!careToggling}
                              style={{
                                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                border: `2px solid ${isChecked ? moment.color : isOverdue ? '#FCA5A5' : '#D1D5DB'}`,
                                background: isChecked ? moment.color : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: isFamiliar ? 'default' : 'pointer',
                                padding: 0, transition: 'all 0.2s',
                              }}
                              aria-label={isChecked ? 'Desmarcar' : 'Marcar'}
                            >
                              {isChecked && !isToggling && (
                                <CheckIcon size={13} color="white" strokeWidth={2.5} />
                              )}
                              {isToggling && (
                                <div style={{
                                  width: 10, height: 10, borderRadius: '50%',
                                  border: `2px solid ${isChecked ? 'rgba(255,255,255,0.4)' : '#D1D5DB'}`,
                                  borderTopColor: isChecked ? 'white' : moment.color,
                                  animation: 'spin 0.6s linear infinite',
                                }} />
                              )}
                            </button>

                            {/* Icon + text */}
                            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.3,
                                color: isChecked ? '#9CA3AF' : isOverdue ? '#DC2626' : '#1A1A1A',
                                textDecoration: isChecked ? 'line-through' : 'none',
                              }}>
                                {item.label}
                                {item.weekly && (
                                  <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF', marginLeft: 6 }}>
                                    · semanal
                                  </span>
                                )}
                              </p>
                              {isChecked && checkedTime && (
                                <p style={{ fontSize: 10, color: moment.color, margin: '2px 0 0', fontWeight: 600 }}>
                                  ✓ {checkedTime}
                                  {log?.checked_by ? ` · ${log.checked_by.split(' ')[0]}` : ''}
                                  {item.weekly && log?.log_date !== today ? ' · esta semana' : ''}
                                </p>
                              )}
                            </div>

                            {/* Overdue / done badges */}
                            {isChecked && (
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                color: '#16A34A', background: '#DCFCE7',
                                padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                              }}>
                                ✓ Listo
                              </span>
                            )}
                            {isOverdue && !isChecked && (
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                color: '#92400E', background: '#FEF3C7',
                                padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                              }}>
                                Pendiente
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Timeline of today's completed care items */}
              {todayTimeline.length > 0 && (
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: '#9CA3AF',
                    marginBottom: 6, paddingLeft: 2,
                  }}>
                    Línea de tiempo del día
                  </p>
                  <div style={{
                    background: 'white', borderRadius: 16,
                    border: '1px solid #EDE5D8', overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}>
                    {todayTimeline.map((log, i) => {
                      const ci  = CARE_ITEMS.find(x => x.key === log.item_key)
                      const mom = CARE_MOMENTS.find(m => m.id === ci?.moment)
                      return (
                        <div
                          key={log.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '11px 14px',
                            borderBottom: i < todayTimeline.length - 1 ? '1px solid #F5EEE6' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{ci?.icon ?? '✓'}</span>
                          <p style={{ flex: 1, fontSize: 13, color: '#1A1A1A', margin: 0, fontWeight: 500 }}>
                            {ci?.label ?? log.item_key}
                          </p>
                          <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                            {new Date(log.checked_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {log.checked_by && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, flexShrink: 0,
                              color: mom?.color ?? '#C4623A',
                              background: mom ? `${mom.color}18` : '#FDF0EB',
                              padding: '2px 7px', borderRadius: 6,
                            }}>
                              {log.checked_by.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
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
            <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.6, marginBottom: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 14px' }}>
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
                onClick={() => { const m = adminWarningMed; setAdminWarningMed(null); confirmMed(m) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D97706', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(217,119,6,0.3)' }}
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
                    <p style={{ fontSize: 13, color: minLeft <= 5 ? '#D97706' : '#6B7280', marginTop: 4 }}>
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
                <p style={{ fontSize: 12, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
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
                    border: '3px solid #EDE5D8', borderTopColor: '#C4623A',
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
                      style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid #C4623A', background: '#FDF0EB', color: '#C4623A', fontSize: 12, fontWeight: 700, cursor: proofUploading ? 'not-allowed' : 'pointer' }}>
                      📷 Tomar foto
                    </button>
                    <button type="button" onClick={openGallery} disabled={proofUploading}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid #D4C4B8', background: '#FDFAF7', color: '#6B7280', fontSize: 12, fontWeight: 700, cursor: proofUploading ? 'not-allowed' : 'pointer' }}>
                      🖼 De galería
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: '#FDF0EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 26 }}>📷</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Se sellará automáticamente con fecha y hora</p>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <button type="button" onClick={openCamera}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #C4623A', background: '#FDF0EB', color: '#C4623A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      📷 Tomar foto
                    </button>
                    <button type="button" onClick={openGallery}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #D4C4B8', background: '#FDFAF7', color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
                  ? 'linear-gradient(135deg, #C4623A, #A85130)'
                  : '#D4C4B8',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: proofBlob && !proofUploading ? 'pointer' : 'not-allowed',
                boxShadow: proofBlob && !proofUploading ? '0 6px 20px rgba(196,98,58,0.3)' : 'none',
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
