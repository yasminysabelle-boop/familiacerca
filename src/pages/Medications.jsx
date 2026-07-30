import { useEffect, useRef, useState } from 'react'
import PaywallModal from '../components/PaywallModal'
import { useSearchParams } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import { Plus, XIcon, Pencil, Bell, ChevronLeft, Pill, Camera, FileText, CheckIcon, MapPin, Clock, Heart, User } from '../components/Icons'
import MedicationDetail from '../components/MedicationDetail'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { track } from '../lib/analytics'
import { getTodayPR } from '../lib/utils'
import { getLocation, mapsUrl } from '../lib/gps'
import MedicationStockTab from '../components/MedicationStockTab'
import EvidencePhoto from '../components/EvidencePhoto'
import { SkeletonMedCard } from '../components/SkeletonLoader'
import EmptyState from '../components/EmptyState'
import LoadingButton from '../components/LoadingButton'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { detectMedicationWindow, getMiloSuggestion, WINDOW_OPTIONS } from '../utils/medicationDatabase'
import Layout from '../components/Layout'
import MedicationListTab from '../components/MedicationListTab'
import MedicationStockList from './medications/MedicationStockList'
import MedicationRecetasTab from '../components/MedicationRecetasTab'

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  { value: 'once_daily',  label: 'Una vez al día',    times: 1, interval: null },
  { value: 'twice_daily', label: 'Dos veces al día',  times: 2, interval: null },
  { value: 'three_daily', label: 'Tres veces al día', times: 3, interval: null },
  { value: 'every_4h',    label: 'Cada 4 horas',      times: 1, interval: 4  },
  { value: 'every_6h',    label: 'Cada 6 horas',      times: 1, interval: 6  },
  { value: 'every_8h',    label: 'Cada 8 horas',      times: 1, interval: 8  },
  { value: 'every_12h',   label: 'Cada 12 horas',     times: 1, interval: 12 },
  { value: 'as_needed',   label: 'Según necesidad',   times: 0, interval: null },
  { value: 'weekly',      label: 'Semanal',           times: 1, interval: null },
]

const DOSES_PER_DAY = {
  once_daily: 1, twice_daily: 2, three_daily: 3,
  every_4h: 6,  every_6h: 4,   every_8h: 3,   every_12h: 2,
  as_needed: 1, weekly: 1 / 7,
}

const RENEWAL_METHODS = [
  { value: 'pharmacy',     label: '🏪 Voy a la farmacia' },
  { value: 'mail',         label: '📬 Me lo envían' },
  { value: 'prescription', label: '📄 Tengo la receta' },
  { value: 'manual',       label: '✍️ Lo agrego solo' },
]

const GEMINI_VISION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-vision`

const FORM_MAP = {
  tablet: 'Tableta', capsule: 'Cápsula', syrup: 'Jarabe', drops: 'Gotas',
  injection: 'Inyección', cream: 'Crema', inhaler: 'Inhalador', patch: 'Parche', other: 'Otro',
}

const BOX_PROMPT = `You are extracting visible medication information from an image for a family caregiving app.
Return ONLY valid JSON. Do NOT give medical advice. Do NOT infer missing values. Do NOT guess. If unclear return null and add a warning. Image may be in Spanish from Puerto Rico, Dominican Republic, or Venezuela. The user will review everything before saving.

{"source_type":"box|bottle|blister|unknown","medications":[{"name":{"value":"string or null","confidence":0},"strength":{"value":"string or null","confidence":0},"form":{"value":"tablet|capsule|syrup|drops|cream|injection|inhaler|patch|other|null","confidence":0},"total_units":{"value":null,"confidence":0},"expiry_date":{"value":"MM/YYYY or null","confidence":0}}],"raw_text_detected":"string","warnings":[],"requires_user_review":true}`

const RX_PROMPT = `You are extracting prescription information for a family caregiving app.
Return ONLY valid JSON. Do NOT give medical advice. Do NOT infer missing information. If frequency is unclear return null. Preserve original doctor instructions in Spanish. The user must review before saving. Return ALL medications found in the prescription.

{"source_type":"prescription|unknown","medications":[{"name":{"value":"string or null","confidence":0},"strength":{"value":"string or null","confidence":0},"form":{"value":"tablet|capsule|syrup|drops|cream|injection|inhaler|patch|other|null","confidence":0},"frequency":{"value":"once_daily|twice_daily|three_daily|every_8h|every_12h|as_needed|weekly|null","confidence":0},"frequency_raw":{"value":"string or null","confidence":0},"quantity_per_dose":{"value":null,"confidence":0},"duration":{"value":"string or null","confidence":0},"total_units":{"value":null,"confidence":0},"instructions":{"value":"string or null","confidence":0}}],"raw_text_detected":"string","warnings":[],"requires_user_review":true}`

// ── Hoy-tab helpers ───────────────────────────────────────────────────────────

function calcMedStatus(scheduledTime, windowMinutes = 60) {
  if (!scheduledTime) return 'pendiente'
  const [h, m] = scheduledTime.split(':').map(Number)
  const now = new Date()
  const diffMins = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
  if (diffMins < 0)               return 'programado'
  if (diffMins >= windowMinutes)  return 'tarde'
  if (diffMins >= windowMinutes - 15) return 'dar_pronto'
  return 'pendiente'
}

// Minutos que faltan para la hora programada (negativo si ya pasó)
function minsUntilScheduled(scheduledTime) {
  if (!scheduledTime) return 0
  const [h, m] = scheduledTime.split(':').map(Number)
  const now = new Date()
  return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes())
}

function fmt12h(scheduledTime) {
  const [h, m] = scheduledTime.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

const MED_STATUS = {
  programado: { label: 'Programado', color: '#6B7A88', bg: '#F1EDE3' },
  pendiente:  { label: 'A tiempo',   color: '#087F70', bg: '#EAF7F3' },
  dar_pronto: { label: 'Dar pronto', color: '#A87A0F', bg: '#F6E4B8' },
  tarde:      { label: 'Tarde',      color: '#C4664F', bg: '#FBEAE4' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeScheduledTimes(frequency, startTimes) {
  const opt = FREQ_OPTIONS.find(o => o.value === frequency)
  if (!opt || opt.times === 0) return []
  if (opt.interval) {
    const start = startTimes[0]
    if (!start) return []
    const [h, m] = start.split(':').map(Number)
    const dosesPerDay = 24 / opt.interval
    return Array.from({ length: dosesPerDay }, (_, i) => {
      const total = (h * 60 + m + i * opt.interval * 60) % (24 * 60)
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    })
  }
  return startTimes.filter(Boolean)
}

// Redimensiona a un lado mayor de 1600px y comprime a JPEG antes de subir —
// una foto de cámara real (varios MB, sin tocar) puede colgar el envío en
// redes móviles lentas. Una sola lectura del archivo: el data URL resultante
// sirve tanto para la vista previa como para el base64 que recibe la IA.
function resizeImageToBase64(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
}

// Sella la foto de evidencia con fecha, hora, nombre de quien confirma y marca de FamiliaCerca.
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

// ── Styles ────────────────────────────────────────────────────────────────────

const emptyForm  = { name: '', dosage: '', frequency: '', notes: '', form: 'Tableta', quantityPerDose: 1, minStock: 7 }
const emptyStock = { totalPills: '', renewalMethod: '', pharmacyName: '', refillsRemaining: '', lastMailDate: '' }

const fieldStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 14,
  border: '1.5px solid rgba(51,65,85,0.14)', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', appearance: 'none', WebkitAppearance: 'none',
}
const onFocus = e => { e.target.style.borderColor = '#087F70'; e.target.style.boxShadow = '0 0 0 3px rgba(8,127,112,0.1)' }
const onBlur  = e => { e.target.style.borderColor = 'rgba(51,65,85,0.14)'; e.target.style.boxShadow = 'none' }
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7A88',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Medications() {
  const { user } = useAuth()
  const { ownerId, memberRole, profile, activePatientName } = useFamily()
  const { canEdit, trialExpired } = useSubscription()
  const goBack = useGoBack()
  const [showPaywall, setShowPaywall] = useState(false)
  const { containerRef: pullRef, onTouchStart: pullStart, onTouchMove: pullMove, onTouchEnd: pullEnd, PullIndicator } = usePullToRefresh(fetchAll)
  const [searchParams, setSearchParams] = useSearchParams()
  const { permission, supported, requestAndSubscribe } = usePushNotifications()

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const isAdmin   = user?.id === ownerId
  const isFamiliar = memberRole === 'familiar'

  function canActOn(med) {
    return !isFamiliar
  }

  // ── Medication list state ──────────────────────────────────────────────────
  const [medications,  setMedications]  = useState([])
  const [stockByMedId, setStockByMedId] = useState({})
  const [loading,      setLoading]      = useState(true)
  const [stockTabMed,  setStockTabMed]  = useState(null) // open stock sheet
  const [logsByMedId,  setLogsByMedId]  = useState({})
  const [expandedMedHistorial, setExpandedMedHistorial] = useState(new Set())
  const [expandedHistorialDays, setExpandedHistorialDays] = useState(new Set())
  const [miloSuggestion, setMiloSuggestion] = useState(null)
  const [activeTab,      setActiveTab]      = useState('hoy')
  const [adminModal,         setAdminModal]         = useState(null)
  const [adminSaving,        setAdminSaving]        = useState(false)
  const [adminPhotoBlob,     setAdminPhotoBlob]     = useState(null)
  const [adminPhotoPreview,  setAdminPhotoPreview]  = useState(null)
  const [adminPhotoStamping, setAdminPhotoStamping] = useState(false)
  const [adminGps,           setAdminGps]           = useState(null)
  const [adminError,         setAdminError]         = useState('')
  const [adminConfirmWarningMed, setAdminConfirmWarningMed] = useState(null)
  // Recordatorio de prueba post-confirmación (30 min)
  const [proofSheet,      setProofSheet]      = useState(null) // { med }
  const [proofPreview,    setProofPreview]    = useState(null)
  const [proofBlob,       setProofBlob]       = useState(null)
  const [proofGps,        setProofGps]        = useState(null)
  const [proofStamping,   setProofStamping]   = useState(false)
  const [proofUploading,  setProofUploading]  = useState(false)
  const [proofError,      setProofError]      = useState('')
  // Desconfirmar una dosis ya dada
  const [unconfirmTarget, setUnconfirmTarget] = useState(null) // med
  const [unconfirming,    setUnconfirming]    = useState(false)
  const [toastMsg,           setToastMsg]           = useState('')
  const [omissionsByMedId,   setOmissionsByMedId]   = useState({})
  const [previewPhotoUrl,    setPreviewPhotoUrl]     = useState(null)
  const [detailMed,          setDetailMed]           = useState(null)
  const [, setTick] = useState(0)
  const autoMarkedRef   = useRef(new Set())
  const fetchAllIdRef   = useRef(0)   // stale-request guard for fetchAll
  const mountedRef      = useRef(true) // unmount guard for async setState
  const adminCameraRef  = useRef(null)
  const adminGalleryRef = useRef(null)

  // Tick each minute so pending-status badges stay accurate
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Unmount cleanup
  useEffect(() => () => { mountedRef.current = false }, [])

  // Auto-reset at midnight PR: detect date change while PWA is open
  useEffect(() => {
    if (!ownerId) return
    const lastDate = { current: getTodayPR() }
    const id = setInterval(() => {
      const nowDate = getTodayPR()
      if (nowDate !== lastDate.current) {
        lastDate.current = nowDate
        fetchAll()
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [ownerId])

  // ── Form / add-flow state ──────────────────────────────────────────────────
  const [showForm,    setShowForm]    = useState(false)
  const [addStep,     setAddStep]     = useState(null)
  // addStep: 'method' | 'photo-box' | 'photo-rx' | 'ai-processing' | 'ai-confirm' | 'form'
  const [form,            setForm]            = useState(emptyForm)
  const [scheduledTimes,  setScheduledTimes]  = useState([''])
  const [editId,          setEditId]          = useState(null)
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState(null)
  const editOpenedRef = useRef(false)

  // ── AI photo state ─────────────────────────────────────────────────────────
  const [addPhotoType,    setAddPhotoType]    = useState(null) // 'box' | 'prescription'
  const [addPhotoFile,    setAddPhotoFile]    = useState(null)
  const [addPhotoPreview, setAddPhotoPreview] = useState(null)
  const [addAiExtracted,  setAddAiExtracted]  = useState(null)
  const [addAiError,      setAddAiError]      = useState('')
  const [selectedMedIndices, setSelectedMedIndices] = useState(new Set())
  const [addMedQueue,        setAddMedQueue]         = useState([])
  const photoInputRef = useRef(null)

  // ── Stock form state ───────────────────────────────────────────────────────
  const [stockForm, setStockForm] = useState(emptyStock)
  const [editStockRecord, setEditStockRecord] = useState(null)

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && ownerId) fetchAll()
  }, [user, ownerId])

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      openAdd(); setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    const eid = searchParams.get('edit')
    if (!eid || loading) return
    if (editOpenedRef.current) return
    const med = medications.find(m => m.id === eid)
    if (!med) return
    editOpenedRef.current = true
    openEdit(med); setSearchParams({}, { replace: true })
  }, [searchParams, medications, loading])

  // ── Data fetching ──────────────────────────────────────────────────────────
  async function fetchAll() {
    const myId = ++fetchAllIdRef.current
    setLoading(true)
    const { data: medsData } = await supabase
      .from('medications').select('*').eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    if (fetchAllIdRef.current !== myId) return // ownerId changed mid-flight
    const meds = medsData ?? []

    // Fetch stock in the same call so pills_remaining is available on first render
    let stockMap = {}
    if (meds.length) {
      const { data: stockData } = await supabase
        .from('medication_stock').select('*').eq('user_id', ownerId)
        .in('medication_id', meds.map(m => m.id))
      if (fetchAllIdRef.current !== myId) return
      ;(stockData ?? []).forEach(s => { stockMap[s.medication_id] = s })
    }

    setStockByMedId(stockMap)
    // Merge pills_remaining directly onto each med so the dot never flickers
    setMedications(meds.map(m => ({ ...m, pills_remaining: stockMap[m.id]?.pills_remaining ?? null })))

    // Fetch last 7 days of confirmed logs for historial
    if (meds.length) {
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6)
      const sevenAgoKey = sevenAgo.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
      const { data: logsData } = await supabase
        .from('medication_logs')
        .select('medication_id, log_date, status, confirmed_by_name, confirmed_at, photo_url, given_on_time, minutes_late')
        .eq('user_id', ownerId)
        .gte('log_date', sevenAgoKey)
        .in('medication_id', meds.map(m => m.id))
      if (fetchAllIdRef.current !== myId) return
      const logsMap = {}
      ;(logsData ?? []).forEach(log => {
        if (!logsMap[log.medication_id]) logsMap[log.medication_id] = {}
        if (!logsMap[log.medication_id][log.log_date]) logsMap[log.medication_id][log.log_date] = []
        logsMap[log.medication_id][log.log_date].push(log)
      })
      setLogsByMedId(logsMap)

      // Fetch last 7 days of omissions to get reasons for detail and historial views
      const { data: omissionsData } = await supabase
        .from('medication_omissions')
        .select('medication_id, reason, omitted_by_name, scheduled_at')
        .eq('owner_id', ownerId)
        .gte('scheduled_at', sevenAgoKey + 'T00:00:00')
        .in('medication_id', meds.map(m => m.id))
      if (fetchAllIdRef.current !== myId) return
      const omissionsMap = {}
      ;(omissionsData ?? []).forEach(o => {
        if (!o.scheduled_at) return
        const dk = new Date(o.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
        if (!omissionsMap[o.medication_id]) omissionsMap[o.medication_id] = {}
        omissionsMap[o.medication_id][dk] = o
      })
      setOmissionsByMedId(omissionsMap)
    }

    setLoading(false)
  }

  async function fetchStockData(meds) {
    if (!meds.length) return
    const { data } = await supabase
      .from('medication_stock').select('*').eq('user_id', ownerId)
      .in('medication_id', meds.map(m => m.id))
    const map = {}
    ;(data ?? []).forEach(s => { map[s.medication_id] = s })
    setStockByMedId(map)
    setMedications(prev => prev.map(m => ({ ...m, pills_remaining: map[m.id]?.pills_remaining ?? null })))
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  function handleFrequencyChange(val) {
    setForm(prev => ({ ...prev, frequency: val }))
    const opt = FREQ_OPTIONS.find(o => o.value === val)
    if (!opt || opt.times === 0) {
      setScheduledTimes([])
    } else {
      const count = opt.interval ? 1 : opt.times
      setScheduledTimes(prev => {
        const next = [...prev]
        while (next.length < count) next.push('')
        return next.slice(0, count)
      })
    }
  }

  function openAdd() {
    if (!isAdmin) return
    if (trialExpired) { setShowPaywall(true); return }
    setForm(emptyForm); setScheduledTimes(['']); setEditId(null)
    setStockForm(emptyStock); setAddPhotoFile(null); setAddPhotoPreview(null)
    setAddAiExtracted(null); setAddAiError(''); setAddPhotoType(null)
    setSaveError(null)
    setAddStep('method'); setShowForm(true)
  }

  function openEdit(med) {
    setForm({ name: med.name, dosage: med.dosage ?? '', frequency: med.frequency ?? '', notes: med.notes ?? '', form: med.form ?? 'Tableta', quantityPerDose: med.quantity_per_dose ?? 1, minStock: med.min_stock ?? 7 })
    const opt = FREQ_OPTIONS.find(o => o.value === med.frequency)
    if (med.scheduled_times?.length) {
      setScheduledTimes(opt?.interval ? [med.scheduled_times[0]] : med.scheduled_times)
    } else if (med.time) {
      setScheduledTimes([med.time])
    } else {
      setScheduledTimes([''])
    }
    const stock = stockByMedId[med.id] ?? null
    setEditStockRecord(stock)
    if (stock) {
      setStockForm({
        totalPills: String(stock.total_pills ?? ''),
        renewalMethod: stock.renewal_method ?? '',
        pharmacyName: stock.pharmacy_name ?? '',
        refillsRemaining: stock.refills_remaining != null ? String(stock.refills_remaining) : '',
        lastMailDate: stock.last_mail_date ?? '',
      })
    } else {
      setStockForm(emptyStock)
    }
    setEditId(med.id)
    setAddStep('form')
    setSaveError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setAddStep(null); setEditId(null)
    setForm(emptyForm); setScheduledTimes(['']); setSaveError(null)
    setStockForm(emptyStock); setEditStockRecord(null); setAddPhotoFile(null); setAddPhotoPreview(null)
    setAddAiExtracted(null); setAddAiError(''); setAddPhotoType(null)
    setAddMedQueue([]); setSelectedMedIndices(new Set())
  }

  // ── AI photo processing ────────────────────────────────────────────────────
  function handlePhotoChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAddPhotoFile(file)
    resizeImageToBase64(file)
      .then(dataUrl => {
        setAddPhotoPreview(dataUrl)
        processPhoto(dataUrl.split(',')[1], addPhotoType).catch(err => {
          // Red de seguridad: processPhoto ya atrapa sus propios errores, pero si
          // algo se le escapa no debe dejar el sheet colgado en "Analizando…".
          console.error(err)
          setAddAiError('No se pudo leer la imagen. Puedes corregir manualmente.')
          setAddStep('ai-confirm')
        })
      })
      .catch(err => {
        console.error(err)
        setAddAiError('No se pudo procesar la imagen. Puedes ingresar los datos manualmente.')
        setAddStep('form')
      })
  }

  function applyMedToForm(med) {
    const name       = med.name?.value              ?? ''
    const dosage     = med.strength?.value          ?? ''
    const frequency  = med.frequency?.value         ?? ''
    const form_val   = FORM_MAP[med.form?.value]    ?? emptyForm.form
    const notes      = med.instructions?.value      ?? ''
    const qtyPerDose = Number(med.quantity_per_dose?.value ?? 1) || 1

    setForm({ ...emptyForm, name, dosage, frequency, form: form_val, notes, quantityPerDose: qtyPerDose })

    const opt = FREQ_OPTIONS.find(o => o.value === frequency)
    if (!opt || opt.times === 0) {
      setScheduledTimes([])
    } else {
      const count = opt.interval ? 1 : opt.times
      setScheduledTimes(Array(count).fill(''))
    }

    const totalPills = med.total_units?.value
    setStockForm(totalPills ? { ...emptyStock, totalPills: String(totalPills) } : emptyStock)
    setEditStockRecord(null)
  }

  async function processPhoto(base64, type) {
    setAddStep('ai-processing')
    setAddAiError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAddAiError('Función no disponible. Ingresa los datos manualmente.')
        setAddStep('form')
        return
      }
      const res = await fetch(GEMINI_VISION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image_base64: base64, media_type: 'image/jpeg', prompt: type === 'box' ? BOX_PROMPT : RX_PROMPT }),
      })
      if (!res.ok) throw new Error(`Gemini ${res.status}`)
      const parsed = await res.json()
      if (parsed.error) throw new Error(parsed.error)
      if (parsed.medications?.length > 0) {
        setSelectedMedIndices(new Set(parsed.medications.map((_, i) => i)))
      }
      setAddAiExtracted(parsed)
    } catch (err) {
      console.error(err)
      setAddAiError('No se pudo leer la imagen. Puedes corregir manualmente.')
      setAddAiExtracted(null)
    }
    setAddStep('ai-confirm')
  }

  function applyAiAndContinue() {
    if (!addAiExtracted?.medications?.length) { setAddStep('form'); return }
    applyMedToForm(addAiExtracted.medications[0])
    setAddStep('form')
  }

  function applySelectedMeds() {
    if (!addAiExtracted?.medications?.length) return
    const selected = addAiExtracted.medications.filter((_, i) => selectedMedIndices.has(i))
    if (selected.length === 0) return
    applyMedToForm(selected[0])
    setAddMedQueue(selected.slice(1))
    setAddStep('form')
  }

  // ── Save medication + stock ─────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setSaveError(null)
    const scheduled_times = computeScheduledTimes(form.frequency, scheduledTimes)
    const payload = {
      name: form.name, dosage: form.dosage || null,
      frequency: form.frequency || null, notes: form.notes || null,
      scheduled_times, user_id: ownerId,
      form: form.form || 'Tableta',
      quantity_per_dose: form.quantityPerDose || 1,
      min_stock: form.minStock || 7,
      time_window_minutes: 60,
    }
    let savedId = editId, error
    if (editId) {
      ;({ error } = await supabase.from('medications').update(payload).eq('id', editId))
    } else {
      const { data, error: e } = await supabase
        .from('medications').insert({ ...payload, created_by_user_id: user.id })
        .select('id').single()
      error = e; savedId = data?.id
      if (!error) track('medication_added', { name: payload.name, frequency: payload.frequency })
    }
    if (error) { setSaving(false); setSaveError('No se pudo guardar el medicamento.'); return }

    // Save stock if provided
    const totalPills = parseInt(stockForm.totalPills)
    if (savedId && totalPills > 0) {
      const dosesPerDay = DOSES_PER_DAY[form.frequency] ?? 1
      // When editing without changing total, preserve current pills_remaining
      const isRestocking = !editStockRecord || totalPills !== editStockRecord.total_pills
      const pillsRemaining = isRestocking ? totalPills : (editStockRecord.pills_remaining ?? totalPills)
      const days = Math.floor(pillsRemaining / dosesPerDay)
      const end  = new Date(); end.setDate(end.getDate() + days)
      const today = getTodayPR()

      const stockOps = [
        supabase.from('medication_stock').upsert({
          medication_id:  savedId,
          user_id:        ownerId,
          total_pills:    totalPills,
          pills_remaining: pillsRemaining,
          doses_per_day:  dosesPerDay,
          start_date:     editStockRecord?.start_date ?? today,
          estimated_end_date: days > 0 ? end.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' }) : null,
          renewal_method: stockForm.renewalMethod || null,
          pharmacy_name:  stockForm.pharmacyName || null,
          refills_remaining: stockForm.refillsRemaining !== '' ? parseInt(stockForm.refillsRemaining) : null,
          last_mail_date: stockForm.lastMailDate || null,
          alert_7_sent: editStockRecord?.alert_7_sent ?? false,
          alert_3_sent: editStockRecord?.alert_3_sent ?? false,
          alert_1_sent: editStockRecord?.alert_1_sent ?? false,
          needs_renewal_ack: editStockRecord?.needs_renewal_ack ?? false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'medication_id,user_id' }),
      ]
      if (isRestocking) {
        stockOps.push(
          supabase.from('medication_renewals').insert({
            medication_id:  savedId,
            user_id:        ownerId,
            pill_count:     totalPills,
            renewed_by_name: displayName,
          })
        )
      }
      await Promise.all(stockOps)
    }

    setSaving(false)
    if (addMedQueue.length > 0) {
      const [next, ...rest] = addMedQueue
      setAddMedQueue(rest)
      setEditId(null); setSaveError(null)
      applyMedToForm(next)
      setAddStep('form')
    } else {
      closeForm()
    }
    fetchAll()
  }

  async function handleDelete(id) {
    await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    setMedications(prev => prev.filter(m => m.id !== id))
    setStockByMedId(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  // ── Hoy-tab handlers ───────────────────────────────────────────────────────
  function firstTimeMed(med) {
    if (med.scheduled_times?.length) return [...med.scheduled_times].sort()[0]
    return med.time ?? null
  }

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  async function handleAdminFileSelect(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setAdminError('')
    setAdminPhotoStamping(true)
    try {
      const [stamped, loc] = await Promise.all([
        stampProof(f, displayName),
        getLocation({ force: true }).catch(() => null),
      ])
      setAdminPhotoBlob(stamped)
      setAdminPhotoPreview(URL.createObjectURL(stamped))
      setAdminGps(loc)
    } catch {
      setAdminError('No se pudo procesar la foto. Intenta de nuevo.')
    } finally {
      setAdminPhotoStamping(false)
    }
  }
  function adminOpenCamera() {
    if (adminPhotoStamping || adminSaving) return
    adminCameraRef.current?.click()
  }
  function adminOpenGallery() {
    if (adminPhotoStamping || adminSaving) return
    adminGalleryRef.current?.click()
  }

  function openAdminModal(med) {
    setAdminModal(med); setAdminPhotoBlob(null); setAdminPhotoPreview(null)
    setAdminGps(null); setAdminError('')
  }

  // El owner/admin ve un aviso intermedio antes de confirmar — pensado para el caso
  // en que confirma alguien que normalmente no es quien da el medicamento en persona.
  // Los cuidadores van directo al modal.
  function handleTapAdministrar(med) {
    if (isFamiliar) return
    if (isAdmin) { setAdminConfirmWarningMed(med); return }
    openAdminModal(med)
  }

  async function handleAdministrar() {
    if (!adminModal?.id || adminSaving) return
    const med = adminModal
    const _sched = firstTimeMed(med)
    if (_sched && minsUntilScheduled(_sched) > 10) {
      setAdminError(`Aún no se puede administrar. Disponible a las ${fmt12h(_sched)}.`)
      return
    }
    setAdminSaving(true); setAdminError('')
    const confirmedAt = new Date().toISOString()
    const scheduledTime = firstTimeMed(med)
    const windowMinutes = med.time_window_minutes ?? 60
    let minutesLate = null, givenOnTime = true, scheduledAt = null
    if (scheduledTime) {
      const [hh, mm] = scheduledTime.split(':').map(Number)
      const d = new Date(); d.setHours(hh, mm, 0, 0)
      scheduledAt = d.toISOString()
      minutesLate = Math.round((new Date() - d) / 60000)
      givenOnTime = minutesLate <= windowMinutes
    }
    // GPS: reutiliza la ubicación ya capturada al tomar la foto; si no hay foto,
    // la captura ahora. Nunca bloquea — en negación de permiso o error resuelve null.
    const loc = adminGps ?? await getLocation({ force: true }).catch(() => null)

    let photoUrl = null
    if (adminPhotoBlob) {
      const path = `${ownerId}/${today}/${med.id}.jpg`
      const { error: sErr } = await supabase.storage.from('confirmations')
        .upload(path, adminPhotoBlob, { upsert: true, contentType: 'image/jpeg' })
      if (!sErr) {
        const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }
    const logPayload = {
      medication_id: med.id, user_id: ownerId, status: 'confirmed',
      log_date: today, confirmed_by_name: displayName, given_by_name: displayName,
      confirmed_at: confirmedAt, scheduled_at: scheduledAt,
      photo_url: photoUrl, given_on_time: givenOnTime, minutes_late: minutesLate,
      latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null, address: loc?.address ?? null,
    }
    const { error: logErr } = await supabase.from('medication_logs')
      .upsert(logPayload, { onConflict: 'medication_id,log_date,user_id' })
    if (logErr) { setAdminSaving(false); setAdminError('No se pudo registrar. Intenta de nuevo.'); return }
    const stock = stockByMedId[med.id]
    if (stock) {
      const qty = Number(med.quantity_per_dose ?? 1)
      const newRemaining = Math.max(0, stock.pills_remaining - qty)
      const dpd = Math.max(0.5, parseFloat(stock.doses_per_day) || 1)
      const daysLeft = Math.floor(newRemaining / dpd)
      const endDate = daysLeft > 0
        ? new Date(Date.now() + daysLeft * 86400000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
      await supabase.from('medication_stock')
        .update({ pills_remaining: newRemaining, estimated_end_date: endDate, updated_at: new Date().toISOString() })
        .eq('medication_id', med.id).eq('user_id', ownerId)
      setStockByMedId(prev => ({ ...prev, [med.id]: { ...prev[med.id], pills_remaining: newRemaining, estimated_end_date: endDate } }))
    }
    setLogsByMedId(prev => {
      const next = { ...prev }
      if (!next[med.id]) next[med.id] = {}
      if (!next[med.id][today]) next[med.id][today] = []
      next[med.id][today] = next[med.id][today].filter(l => l.status !== 'confirmed')
      next[med.id][today].push({ ...logPayload })
      return next
    })
    track('medication_administered', { medication_name: med.name })
    setAdminSaving(false); setAdminModal(null); setAdminPhotoBlob(null); setAdminPhotoPreview(null); setAdminGps(null)
    showToast('Medicamento registrado correctamente ✅')

    // Recordatorio de prueba: si no se tomó foto, se ofrece el sheet de prueba (30 min)
    if (!photoUrl) openProofSheet(med)
  }

  // ── Recordatorio de prueba post-confirmación (30 min) ─────────────────────────
  function openProofSheet(med) {
    setProofSheet({ med })
    setProofPreview(null); setProofBlob(null); setProofGps(null)
    setProofStamping(false); setProofError('')
  }
  function closeProofSheet() {
    setProofSheet(null)
    setProofPreview(null); setProofBlob(null); setProofGps(null); setProofError('')
  }
  function proofOpenCamera() {
    if (proofStamping || proofUploading) return
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'; el.capture = 'environment'
    el.addEventListener('change', handleProofFile, { once: true })
    el.click()
  }
  function proofOpenGallery() {
    if (proofStamping || proofUploading) return
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'
    el.addEventListener('change', handleProofFile, { once: true })
    el.click()
  }
  async function handleProofFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setProofError(''); setProofStamping(true)
    try {
      const [stamped, loc] = await Promise.all([
        stampProof(f, displayName),
        getLocation({ force: true }).catch(() => null),
      ])
      setProofBlob(stamped)
      setProofPreview(URL.createObjectURL(stamped))
      setProofGps(loc)
    } catch {
      setProofError('No se pudo procesar la foto. Intenta de nuevo.')
    } finally {
      setProofStamping(false)
    }
  }
  async function submitProofPhoto() {
    if (!proofBlob || !proofSheet) return
    setProofUploading(true); setProofError('')
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
        ...(proofGps && { latitude: proofGps.latitude, longitude: proofGps.longitude, address: proofGps.address }),
      }
      const { error: dbError } = await supabase.from('medication_logs')
        .update(updateFields)
        .eq('medication_id', medId).eq('user_id', ownerId).eq('log_date', today)
      if (dbError) throw dbError
      setLogsByMedId(prev => {
        const next = { ...prev }
        const dayLogs = next[medId]?.[today] ?? []
        next[medId] = { ...next[medId], [today]: dayLogs.map(l => l.status === 'confirmed' ? { ...l, ...updateFields } : l) }
        return next
      })
      closeProofSheet()
    } catch (err) {
      console.error(err)
      setProofError('No se pudo guardar la foto. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setProofUploading(false)
    }
  }

  // ── Desconfirmar una dosis ya dada ────────────────────────────────────────────
  async function handleUnconfirm() {
    if (!unconfirmTarget || unconfirming) return
    const med = unconfirmTarget
    setUnconfirming(true)
    await supabase.from('medication_logs').delete()
      .eq('medication_id', med.id).eq('user_id', ownerId).eq('log_date', today)
    setLogsByMedId(prev => {
      const next = { ...prev }
      const dayLogs = next[med.id]?.[today] ?? []
      next[med.id] = { ...next[med.id], [today]: dayLogs.filter(l => l.status !== 'confirmed') }
      return next
    })
    setUnconfirming(false)
    setUnconfirmTarget(null)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const freqOpt     = FREQ_OPTIONS.find(o => o.value === form.frequency)
  const showTimePickers = freqOpt && freqOpt.times > 0
  const isInterval  = freqOpt?.interval != null
  const previewTimes = isInterval && scheduledTimes[0]
    ? computeScheduledTimes(form.frequency, scheduledTimes) : []

  // Estimated end date preview while filling the form
  const stockPreviewDays = (() => {
    const total = parseInt(stockForm.totalPills)
    if (!total || total <= 0 || !form.frequency) return null
    const dpd = DOSES_PER_DAY[form.frequency] ?? 1
    const d   = Math.floor(total / dpd)
    const end = new Date(); end.setDate(end.getDate() + d)
    return { days: d, date: end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) }
  })()

  // ── Hoy-tab derived values ────────────────────────────────────────────────
  const today = getTodayPR()

  const _noLogMeds = medications.filter(med =>
    !(logsByMedId[med.id]?.[today] ?? []).some(l => l.status === 'confirmed' || l.status === 'missed')
  )
  const pendientesMeds = _noLogMeds
    .filter(med => {
      const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
      const firstT = times.length ? [...times].sort()[0] : null
      return calcMedStatus(firstT, med.time_window_minutes ?? 60) !== 'tarde'
    })
    .sort((a, b) => {
      const at = a.scheduled_times?.[0] ?? a.time ?? '99:99'
      const bt = b.scheduled_times?.[0] ?? b.time ?? '99:99'
      return at.localeCompare(bt)
    })
  const retrasadosMeds = _noLogMeds.filter(med => {
    const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
    const firstT = times.length ? [...times].sort()[0] : null
    return calcMedStatus(firstT, med.time_window_minutes ?? 60) === 'tarde'
  })
  // Stable string key: changes whenever the SET of overdue meds changes, even if count stays the same
  const retrasadosMedIds = retrasadosMeds.map(m => m.id).sort().join(',')
  const administradosMeds = medications.filter(med =>
    (logsByMedId[med.id]?.[today] ?? []).some(l => l.status === 'confirmed' || l.status === 'missed')
  )

  // Recordatorio de prueba: confirmadas sin foto, dentro de los primeros 30 min
  const pendingProofMeds = medications.filter(med => {
    const log = (logsByMedId[med.id]?.[today] ?? []).find(l => l.status === 'confirmed')
    if (!log || log.photo_url || !log.confirmed_at) return false
    return (Date.now() - new Date(log.confirmed_at).getTime()) < 30 * 60 * 1000
  })

  // Today's contributors derived from existing logsByMedId state (avatars + personalized banner)
  const todayContributors = [...new Set(
    medications.flatMap(med =>
      (logsByMedId[med.id]?.[today] ?? [])
        .filter(l => l.status === 'confirmed' && l.confirmed_by_name && l.confirmed_by_name !== 'Sistema automático')
        .map(l => l.confirmed_by_name)
    )
  )]
  const lastAdminLog = medications
    .flatMap(med => (logsByMedId[med.id]?.[today] ?? []).filter(l => l.status === 'confirmed' && l.confirmed_by_name !== 'Sistema automático'))
    .sort((a, b) => new Date(b.confirmed_at) - new Date(a.confirmed_at))[0] ?? null

  // Auto-mark medications past their clinical window as missed.
  // Dep key is the sorted ID string so the effect fires whenever the SET changes,
  // even when count stays the same (e.g. med A confirmed → med C enters window).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading || !ownerId || !retrasadosMedIds) return
    const toMark = retrasadosMeds.filter(med => !autoMarkedRef.current.has(med.id))
    if (toMark.length === 0) return
    const todayLocal = getTodayPR()
    for (const med of toMark) {
      autoMarkedRef.current.add(med.id)
      const scheduledTime = firstTimeMed(med)
      let scheduledAt = null
      if (scheduledTime) {
        const [hh, mm] = scheduledTime.split(':').map(Number)
        const d = new Date(); d.setHours(hh, mm, 0, 0); scheduledAt = d.toISOString()
      }
      // Skip if state already has a log for today — avoids duplicate on remount
      const existingLogs = logsByMedId[med.id]?.[todayLocal] ?? []
      if (existingLogs.some(l => l.status === 'confirmed' || l.status === 'missed')) continue
      Promise.all([
        supabase.from('medication_omissions').insert({
          medication_id: med.id, owner_id: ownerId, scheduled_at: scheduledAt,
          reason: 'Venció la ventana clínica (automático)',
          omitted_by: user.id,         // D3: required field — was missing
          omitted_by_name: 'Sistema automático',
        }),
        supabase.from('medication_logs').upsert({
          medication_id: med.id, user_id: ownerId, status: 'missed',
          log_date: todayLocal, confirmed_by_name: 'Sistema automático',
          confirmed_at: new Date().toISOString(), scheduled_at: scheduledAt,
        }, { onConflict: 'medication_id,log_date,user_id', ignoreDuplicates: true }),
      ]).then(() => {
        if (!mountedRef.current) return  // D2: component unmounted before promise resolved
        setLogsByMedId(prev => {
          const next = { ...prev }
          if (!next[med.id]) next[med.id] = {}
          if (!next[med.id][todayLocal]) next[med.id][todayLocal] = []
          if (!next[med.id][todayLocal].some(l => l.status === 'missed' || l.status === 'confirmed')) {
            next[med.id][todayLocal].push({
              medication_id: med.id, log_date: todayLocal, status: 'missed',
              confirmed_at: new Date().toISOString(), confirmed_by_name: 'Sistema automático',
            })
          }
          return next
        })
      })
    }
  }, [loading, ownerId, retrasadosMedIds])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} patientName={profile?.name?.split(' ')[0]} />}

      {/* Header propio — back + título + "Cuidando a X" + agregar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 16px 4px', maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            onClick={goBack}
            style={{ width: 38, height: 38, borderRadius: 14, border: 'none', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px -8px #087F7055', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={19} color="#334155" strokeWidth={2.2} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: 21, color: '#1E2C3A', letterSpacing: '-0.3px' }}>Medicamentos</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500, fontSize: 13.5, color: '#087F70', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Cuidando a {activePatientName || profile?.name || 'tu familiar'}
            </div>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            style={{
              width: 44, height: 44, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 18px -8px #087F7066',
            }}
          >
            <Plus size={20} color="white" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Tab bar — pills sueltos, fuera del scroll, siempre visible */}
      <div style={{ padding: '16px 16px 14px', maxWidth: 600, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['hoy', 'todos', 'stock', 'recetas'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '10px 0', cursor: 'pointer', whiteSpace: 'nowrap',
                borderRadius: 999, border: 'none',
                background: activeTab === tab ? 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)' : '#FFFFFF',
                color: activeTab === tab ? '#FFFFFF' : '#5C6B78',
                fontWeight: 700, fontSize: 13.5,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                boxShadow: activeTab === tab ? '0 8px 16px -8px #087F7066' : '0 4px 10px -6px #087F7022',
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {tab === 'hoy' ? 'Hoy' : tab === 'todos' ? 'Lista' : tab === 'stock' ? 'Inventario' : 'Recetas'}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido scrolleable */}
      <div
        ref={pullRef}
        onTouchStart={pullStart}
        onTouchMove={pullMove}
        onTouchEnd={pullEnd}
        style={{ padding: '0 16px', maxWidth: 600 }}
      >
        <PullIndicator />

        {activeTab === 'hoy' && (<>

        {/* Push banner */}
        {supported && permission !== 'granted' && permission !== 'denied' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', borderRadius: 20, padding: '14px 16px', marginBottom: 14, boxShadow: '0 6px 14px -8px #087F7033' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: '#EAF7F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#087F70" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 1 }}>Recordatorios de medicamentos</p>
              <p style={{ fontSize: 11, color: '#6B7A88' }}>Activa las notificaciones para no olvidar ninguna dosis.</p>
            </div>
            <button onClick={requestAndSubscribe} style={{ padding: '7px 16px', borderRadius: 999, background: '#E9826E', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              Activar
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => <SkeletonMedCard key={i} />)}
          </div>
        ) : medications.length === 0 ? (
          <EmptyState
            icon="💊"
            title="Sin medicamentos aún"
            description="Agrega los medicamentos del familiar."
            actionLabel={isAdmin ? '+ Agregar medicamento' : undefined}
            onAction={isAdmin ? openAdd : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 16 }}>

            {/* ── Banner cálido — 3 estados: al día / pendientes / omitidos sin resolver ── */}
            {(() => {
              const patientFirst = (activePatientName || profile?.name || 'tu familiar').split(' ')[0]
              const totalPending = pendientesMeds.length + retrasadosMeds.length
              const omitidosCount = medications.filter(med =>
                (logsByMedId[med.id]?.[today] ?? []).some(l => l.status === 'missed')
              ).length
              const confirmedCount = medications.filter(med =>
                (logsByMedId[med.id]?.[today] ?? []).some(l => l.status === 'confirmed')
              ).length
              const isAllDone = totalPending === 0 && omitidosCount === 0 && confirmedCount > 0
              const hasPending = totalPending > 0
              const hasOmitidos = omitidosCount > 0

              let title, subtitle
              if (isAllDone) {
                title = `¡${patientFirst} está al día con sus cuidados!`
                subtitle = 'Cada cuidado que das hoy cuenta. Gracias por estar cerca.'
              } else if (hasPending && hasOmitidos) {
                title = `Un paso a la vez con ${patientFirst}`
                subtitle = `${totalPending === 1 ? 'Queda' : 'Quedan'} ${totalPending} ${totalPending === 1 ? 'cuidado' : 'cuidados'} por confirmar. Hay ${omitidosCount} dosis de hoy sin registrar.`
              } else if (hasOmitidos) {
                title = `Hoy hay ${omitidosCount} dosis sin registrar.`
                subtitle = 'Puedes registrarlas si se administraron.'
              } else {
                title = `Un paso a la vez con ${patientFirst}`
                subtitle = `${totalPending === 1 ? 'Queda' : 'Quedan'} ${totalPending} ${totalPending === 1 ? 'cuidado' : 'cuidados'} por confirmar hoy.`
              }

              return (
                <div style={{
                  background: isAllDone ? 'linear-gradient(135deg, #A8E5D6 0%, #F8F4ED 100%)' : 'linear-gradient(135deg, #FBEAE4 0%, #F8F4ED 100%)',
                  borderRadius: 22, padding: '20px 20px',
                  boxShadow: isAllDone ? '0 8px 20px -10px #087F7055' : '0 8px 20px -10px #E9826E44',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 600, fontSize: 17.5, color: '#08554A', lineHeight: 1.35 }}>{title}</div>
                    {isAllDone && <Heart size={17} color="#E9826E" strokeWidth={2} filled />}
                  </div>
                  <div style={{ fontSize: 13.5, color: '#3E5A54', marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>
                </div>
              )
            })()}

            {/* ── Avatares de participantes hoy ── */}
            {todayContributors.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#EAF7F3', borderRadius: 12, border: '1px solid #A8E5D6' }}>
                <div style={{ display: 'flex' }}>
                  {todayContributors.slice(0, 4).map((name, i) => {
                    const colors = ['#087F70','#0A8072','#12A18C','#055C51']
                    return (
                      <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: colors[i % 4], color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: i > 0 ? -8 : 0, border: '2px solid #EAF7F3', flexShrink: 0 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: 12, color: '#08554A', fontWeight: 600, margin: 0 }}>
                  {todayContributors.length === 1
                    ? `${todayContributors[0].split(' ')[0]} participó hoy`
                    : `${todayContributors.slice(0, 2).map(n => n.split(' ')[0]).join(' y ')} participaron hoy`}
                </p>
              </div>
            )}

            {/* ── Recordatorio amable: agregar foto de prueba (30 min) ── */}
            {pendingProofMeds.filter(m => m.id !== proofSheet?.med?.id).map(med => {
              const log = (logsByMedId[med.id]?.[today] ?? []).find(l => l.status === 'confirmed')
              const minLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(log.confirmed_at).getTime()) / 60000))
              return (
                <button
                  key={med.id}
                  onClick={() => openProofSheet(med)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    background: '#FBEAE4', border: 'none', borderRadius: 16,
                    padding: '11px 14px', cursor: 'pointer', width: '100%',
                    boxShadow: '0 4px 12px -8px #E9826E55',
                  }}
                >
                  <span style={{ flexShrink: 0, display: 'flex' }}><Camera size={17} color="#C4664F" strokeWidth={1.9} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#C4664F', margin: 0 }}>
                      Agrega una foto de prueba — {minLeft} min
                    </p>
                    <p style={{ fontSize: 11, color: '#8A5A4A', margin: '2px 0 0' }}>{med.name}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#C4664F', fontWeight: 700, flexShrink: 0 }}>Agregar</span>
                </button>
              )
            })}

            {/* ── Franjas: Mañana / Mediodía / Noche / Según necesidad ── */}
            {(() => {
              const tagged = [
                ...pendientesMeds.map(med => ({ med, kind: 'pendiente' })),
                ...retrasadosMeds.map(med => ({ med, kind: 'atrasado' })),
                ...administradosMeds.map(med => ({ med, kind: 'administrado' })),
              ]
              function bucketFor(med) {
                const t = firstTimeMed(med)
                if (!t) return 'sinHorario'
                const h = parseInt(t.split(':')[0], 10)
                if (h < 12) return 'manana'
                if (h < 18) return 'mediodia'
                return 'noche'
              }
              const buckets = { manana: [], mediodia: [], noche: [], sinHorario: [] }
              tagged.forEach(item => buckets[bucketFor(item.med)].push(item))
              Object.values(buckets).forEach(arr =>
                arr.sort((a, b) => (firstTimeMed(a.med) ?? '99:99').localeCompare(firstTimeMed(b.med) ?? '99:99'))
              )
              const SECTIONS = [
                { key: 'manana', label: 'Mañana' },
                { key: 'mediodia', label: 'Mediodía' },
                { key: 'noche', label: 'Noche' },
                { key: 'sinHorario', label: 'Según necesidad' },
              ]

              return SECTIONS.filter(s => buckets[s.key].length > 0).map(section => (
                <div key={section.key}>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', color: '#7D8A9A', textTransform: 'uppercase', margin: '0 0 10px 2px' }}>
                    {section.label}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {buckets[section.key].map(({ med, kind }) => {

                      // ── PENDIENTE: neutro + botón Administrar coral ──────────
                      if (kind === 'pendiente') {
                        const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
                        const firstT = times.length ? [...times].sort()[0] : null
                        const sCfg = MED_STATUS[calcMedStatus(firstT, med.time_window_minutes ?? 60)]
                        return (
                          <div key={med.id} style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 6px 14px -8px #087F7022' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: times.length ? 8 : 0 }}>
                              <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#EAF7F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Pill size={18} color="#087F70" strokeWidth={1.9} />
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 15.5, fontWeight: 700, color: '#1E2C3A', margin: 0 }}>
                                  {med.name}{med.dosage ? <span style={{ fontWeight: 400, color: '#6B7A88', fontSize: 13 }}> · {med.dosage}</span> : null}
                                </p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: sCfg.color, background: sCfg.bg, padding: '3px 10px', borderRadius: 999 }}>
                                  {sCfg.label}
                                </span>
                                {isAdmin && (
                                  <button onClick={() => openEdit(med)} style={{ padding: 5, border: 'none', background: '#F3F4F6', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <Pencil size={13} color="#7D8A9A" strokeWidth={2} />
                                  </button>
                                )}
                              </div>
                            </div>
                            {times.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                                {times.map((t, i) => (
                                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#EAF7F3', color: '#08554A', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                    <Clock size={10} color="#08554A" strokeWidth={2.2} /> {t}
                                  </span>
                                ))}
                                {med.time_window_minutes && <span style={{ fontSize: 11, color: '#6B7A88' }}>ventana {med.time_window_minutes} min</span>}
                              </div>
                            )}
                            {!isFamiliar && (() => {
                              const notYetOpen = firstT && minsUntilScheduled(firstT) > 10
                              return (
                                <button
                                  onClick={() => !notYetOpen && handleTapAdministrar(med)}
                                  disabled={notYetOpen}
                                  style={{
                                    width: '100%', padding: '10px', borderRadius: 999, border: 'none',
                                    background: notYetOpen ? '#E5E1D6' : '#E9826E',
                                    color: notYetOpen ? '#8A8F85' : 'white',
                                    fontWeight: 700, fontSize: 14,
                                    cursor: notYetOpen ? 'not-allowed' : 'pointer',
                                    boxShadow: notYetOpen ? 'none' : '0 4px 12px rgba(233,130,110,0.35)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  }}
                                >
                                  {notYetOpen
                                    ? <><Clock size={14} color="#8A8F85" strokeWidth={2} /> Disponible a las {fmt12h(firstT)}</>
                                    : <><CheckIcon size={15} color="white" strokeWidth={2.6} /> Administrar</>}
                                </button>
                              )
                            })()}
                          </div>
                        )
                      }

                      // ── ATRASADO: tarjeta melocotón, pregunta amable + Registrar ahora ──
                      if (kind === 'atrasado') {
                        const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
                        const firstT = times.length ? [...times].sort()[0] : null
                        const timeLabel = firstT ? fmt12h(firstT) : null
                        const medLabel = [med.name, med.dosage].filter(Boolean).join(' ')
                        const waText = encodeURIComponent(
                          `${medLabel}${timeLabel ? ` — programado a las ${timeLabel}` : ''} no se registró a tiempo hoy. ¿Alguna indicación?`
                        )
                        return (
                          <div key={med.id} style={{ background: '#FBEAE4', borderRadius: 20, padding: 16, boxShadow: '0 6px 14px -8px #E9826E33' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#F6DAD0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={15} color="#C4664F" strokeWidth={2} />
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 15.5, fontWeight: 700, color: '#1E2C3A', margin: '0 0 2px' }}>
                                  {med.name}{med.dosage ? <span style={{ fontWeight: 400, color: '#6B7A88', fontSize: 13 }}> · {med.dosage}</span> : null}
                                </p>
                                {timeLabel && (
                                  <p style={{ fontSize: 12, color: '#8A5A4A', fontWeight: 600, margin: 0 }}>
                                    Programado: {timeLabel}
                                  </p>
                                )}
                              </div>
                              {isAdmin && (
                                <button onClick={() => openEdit(med)} style={{ padding: 5, border: 'none', background: 'rgba(255,255,255,0.7)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  <Pencil size={13} color="#7D8A9A" strokeWidth={2} />
                                </button>
                              )}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                              <p style={{ fontSize: 12.5, color: '#8A5A4A', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                                Esta dosis no se registró a tiempo. ¿Se administró y no dio tiempo de registrarla?
                              </p>
                            </div>
                            {!isFamiliar && (
                              <button onClick={() => handleTapAdministrar(med)} style={{ width: '100%', padding: '10px', borderRadius: 999, border: 'none', background: '#E9826E', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,130,110,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                                <CheckIcon size={15} color="white" strokeWidth={2.6} /> Registrar ahora
                              </button>
                            )}
                            <a
                              href={`https://wa.me/?text=${waText}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px', borderRadius: 10, border: '1px solid #E9826E', background: 'transparent', color: '#C4664F', fontWeight: 600, fontSize: 12.5, textDecoration: 'none' }}
                            >
                              Notificar al médico
                            </a>
                          </div>
                        )
                      }

                      // ── ADMINISTRADO: check teal ─────────────────────────────
                      const todayLog    = (logsByMedId[med.id]?.[today] ?? []).find(l => l.status === 'confirmed' || l.status === 'missed')
                      const isOmitted   = todayLog?.status === 'missed'
                      const isAutoMissed = isOmitted && todayLog?.confirmed_by_name === 'Sistema automático'
                      const confTime    = todayLog?.confirmed_at ? new Date(todayLog.confirmed_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null
                      const byName      = todayLog?.confirmed_by_name?.split(' ')[0]
                      const scheduledTime = firstTimeMed(med)
                      const omissionData  = omissionsByMedId[med.id]?.[today]
                      const stockDoc      = stockByMedId[med.id]
                      return (
                        <div key={med.id} style={{ background: isOmitted ? '#FBEAE4' : '#EAF7F3', borderRadius: 20, padding: 16, boxShadow: isOmitted ? '0 6px 14px -8px #E9826E33' : '0 6px 14px -8px #087F7022' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            {!isOmitted ? (
                              isFamiliar ? (
                                <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#A8E5D6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CheckIcon size={14} color="#087F70" strokeWidth={2.6} />
                                </span>
                              ) : (
                                <button
                                  onClick={() => setUnconfirmTarget(med)}
                                  aria-label="Desmarcar dosis"
                                  style={{
                                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
                                    background: '#A8E5D6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <CheckIcon size={14} color="#087F70" strokeWidth={2.6} />
                                </button>
                              )
                            ) : (
                              <span style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: '#F6DAD0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Clock size={15} color="#C4664F" strokeWidth={2} />
                              </span>
                            )}
                            <p style={{ fontSize: 14.5, fontWeight: 700, color: isOmitted ? '#1E2C3A' : '#087F70', margin: 0, flex: 1 }}>
                              {med.name}{med.dosage ? <span style={{ fontWeight: 400, color: '#6B7A88', fontSize: 12 }}> · {med.dosage}</span> : null}
                            </p>
                            {isAdmin && (
                              <button onClick={() => openEdit(med)} style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <Pencil size={12} color="#7D8A9A" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 42 }}>
                            {scheduledTime && (
                              <span style={{ fontSize: 11, color: '#6B7A88', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} color="#6B7A88" strokeWidth={2} /> Programado: {scheduledTime}
                              </span>
                            )}
                            {confTime && (
                              <span style={{ fontSize: 11, color: '#087F70', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} color="#6B7A88" strokeWidth={2} /> {isOmitted ? 'Registrado:' : 'Administrado:'} {confTime}
                              </span>
                            )}
                            {byName && !isOmitted && (
                              <span style={{ fontSize: 11, color: '#6B7A88', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <User size={11} color="#6B7A88" strokeWidth={2} /> Por: {byName}
                              </span>
                            )}
                            {isOmitted && (
                              <div style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '8px 10px', marginTop: 2 }}>
                                <p style={{ fontSize: 11.5, color: '#8A5A4A', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                                  Esta dosis no se registró a tiempo. ¿Se administró y no dio tiempo de registrarla?
                                  {!isAutoMissed && omissionData?.reason && ` Motivo registrado: ${omissionData.reason}.`}
                                </p>
                              </div>
                            )}
                            {!isOmitted && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: todayLog?.given_on_time === false ? '#D97706' : '#087F70', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {todayLog?.given_on_time === false && todayLog?.minutes_late
                                  ? `⚠️ Fuera de ventana (${todayLog.minutes_late} min)`
                                  : <><CheckIcon size={11} color="#6B7A88" strokeWidth={2.4} /> Administrado a tiempo</>}
                              </span>
                            )}
                            {isOmitted && !isFamiliar && (
                              <button onClick={() => handleTapAdministrar(med)} style={{ marginTop: 6, width: '100%', padding: '9px', borderRadius: 999, border: 'none', background: '#E9826E', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,130,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <CheckIcon size={14} color="white" strokeWidth={2.4} /> Registrar ahora
                              </button>
                            )}
                            {med.notes && <span style={{ fontSize: 11, color: '#6B7A88' }}>📝 {med.notes}</span>}
                            {(todayLog?.photo_url || stockDoc?.prescription_photo_url || stockDoc?.box_photo_url || (todayLog?.latitude && todayLog?.longitude)) && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                {todayLog?.photo_url && (
                                  <button onClick={() => setPreviewPhotoUrl(todayLog.photo_url)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, border: '1px solid #A8E5D6', background: 'white', fontSize: 11, fontWeight: 600, color: '#087F70', cursor: 'pointer' }}>
                                    <Camera size={11} color="#6B7A88" strokeWidth={2} /> Ver evidencia
                                  </button>
                                )}
                                {stockDoc?.prescription_photo_url && (
                                  <button onClick={() => setPreviewPhotoUrl(stockDoc.prescription_photo_url)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #A8E5D6', background: 'white', fontSize: 11, fontWeight: 600, color: '#087F70', cursor: 'pointer' }}>
                                    📄 Ver receta
                                  </button>
                                )}
                                {stockDoc?.box_photo_url && (
                                  <button onClick={() => setPreviewPhotoUrl(stockDoc.box_photo_url)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #A8E5D6', background: 'white', fontSize: 11, fontWeight: 600, color: '#087F70', cursor: 'pointer' }}>
                                    📦 Ver caja
                                  </button>
                                )}
                                {todayLog?.latitude && todayLog?.longitude && (
                                  <a
                                    href={mapsUrl(todayLog.latitude, todayLog.longitude)}
                                    target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, border: '1px solid #A8E5D6', background: 'white', fontSize: 11, fontWeight: 600, color: '#087F70', textDecoration: 'none' }}
                                  >
                                    <MapPin size={11} color="#087F70" strokeWidth={2} /> Ver ubicación
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}

            {/* Mensaje emocional de cierre */}
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 18px', textAlign: 'center', boxShadow: '0 6px 14px -8px #087F7022' }}>
              <p style={{ fontSize: 13, color: '#6B7A88', margin: 0, lineHeight: 1.55 }}>
                Cada pequeño cuidado cuenta. Gracias por estar pendiente de{' '}
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', color: '#087F70', fontWeight: 600 }}>
                  {(activePatientName || profile?.name || 'tu familiar').split(' ')[0]}
                </span>.
              </p>
            </div>
          </div>
        )}

        </>)}

        {activeTab === 'todos' && (
          <div style={{ padding: '0 0 96px' }}>
            <MedicationListTab
              medications={medications}
              onOpenDetail={setDetailMed}
            />
          </div>
        )}

        {activeTab === 'stock' && (
          <MedicationStockList />
        )}

        {activeTab === 'recetas' && (
          <div style={{ padding: '0 0 96px' }}>
            <MedicationRecetasTab
              medications={medications}
              stockByMedId={stockByMedId}
              onViewDoc={setPreviewPhotoUrl}
            />
          </div>
        )}

      </div>

      {/* ── Stock tab sheet ───────────────────────────────────────────────── */}
      {stockTabMed && (
        <MedicationStockTab
          med={stockTabMed}
          ownerId={ownerId}
          isFamiliar={isFamiliar}
          onClose={() => { setStockTabMed(null); fetchStockData(medications) }}
        />
      )}

      {/* ── Hidden photo input ────────────────────────────────────────────── */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoChosen}
      />

      {/* ── Add / Edit sheet ──────────────────────────────────────────────── */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,32,29,0.45)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div style={{ width: '100%', maxHeight: '94vh', background: '#F8F4ED', borderRadius: '28px 28px 0 0', padding: '24px 20px 96px', overflowY: 'auto', boxShadow: '0 -12px 30px -12px #08554A55' }}>

            {/* Sheet header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: addStep === 'method' ? 8 : 20 }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 19, fontWeight: 800, color: '#1E2C3A', margin: 0 }}>
                {addStep === 'method'       ? 'Agregar medicamento'
                  : addStep === 'ai-processing' ? 'Analizando imagen…'
                  : addStep === 'ai-confirm'    ? 'Verificar datos'
                  : editId                      ? 'Editar medicamento'
                  : 'Nuevo medicamento'}
              </h3>
              <button onClick={closeForm} style={{ width: 32, height: 32, borderRadius: 11, border: 'none', background: '#FFFFFF', boxShadow: '0 4px 10px -6px #087F7033', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <XIcon size={16} color="#6B7A88" strokeWidth={2.2} />
              </button>
            </div>

            {/* ── STEP: method selection ─────────────────────────────────── */}
            {addStep === 'method' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 14, color: '#5C6B78', margin: '0 0 8px', lineHeight: 1.5 }}>
                  Cuéntanos qué medicamento cuida a{' '}
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', color: '#087F70', fontWeight: 600 }}>
                    {(activePatientName || profile?.name || 'tu familiar').split(' ')[0]}
                  </span>, como prefieras.
                </p>
                {[
                  { Icon: Camera,   iconBg: '#A8E5D6', iconColor: '#08554A', title: 'Foto de la caja',       desc: 'La IA lee nombre, dosis, cantidad y vencimiento',   shadow: '#087F7033', action: () => { setAddPhotoType('box'); photoInputRef.current?.click(); setAddStep('photo-box') } },
                  { Icon: FileText, iconBg: '#FBEAE4', iconColor: '#C4664F', title: 'Foto de la receta',     desc: 'La IA extrae el medicamento indicado por el médico', shadow: '#D99A1833', action: () => { setAddPhotoType('prescription'); photoInputRef.current?.click(); setAddStep('photo-rx') } },
                  { Icon: Pencil,   iconBg: '#F6E4B8', iconColor: '#A87A0F', title: 'Ingresar manualmente',  desc: 'Llena los campos tú mismo',                          shadow: '#D99A1833', action: () => setAddStep('form') },
                ].map(opt => (
                  <button
                    key={opt.title}
                    onClick={opt.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: 16, borderRadius: 20, border: 'none',
                      background: 'white', cursor: 'pointer', textAlign: 'left',
                      boxShadow: `0 6px 14px -8px ${opt.shadow}`,
                    }}
                  >
                    <div style={{ width: 46, height: 46, borderRadius: 15, background: opt.iconBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <opt.Icon size={21} color={opt.iconColor} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1E2C3A', margin: 0 }}>{opt.title}</p>
                      <p style={{ fontSize: 12.5, color: '#6B7A88', margin: '2px 0 0', lineHeight: 1.4 }}>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── STEP: AI processing spinner ────────────────────────────── */}
            {addStep === 'ai-processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #EAF7F3', borderTopColor: '#087F70', animation: 'spin 0.9s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: '#1E2C3A', margin: 0 }}>Analizando con IA…</p>
                  <p style={{ fontSize: 13, color: '#6B7A88', margin: '6px 0 0' }}>Extrayendo información del medicamento</p>
                </div>
                {addPhotoPreview && (
                  <img src={addPhotoPreview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 14, opacity: 0.5 }} />
                )}
              </div>
            )}

            {/* ── STEP: AI confirmation ─────────────────────────────────── */}
            {addStep === 'ai-confirm' && (() => {
              const meds     = addAiExtracted?.medications ?? []
              const warnings = addAiExtracted?.warnings    ?? []
              const isMulti  = meds.length > 1
              const boxFields = [
                { key: 'name',        label: 'Nombre del medicamento', placeholder: 'Ej. Metformina' },
                { key: 'strength',    label: 'Concentración',          placeholder: 'Ej. 500mg' },
                { key: 'total_units', label: 'Cantidad de unidades',   placeholder: 'Número',    type: 'number' },
                { key: 'expiry_date', label: 'Vencimiento',            placeholder: 'MM/YYYY' },
              ]
              const rxFields = [
                { key: 'name',              label: 'Nombre del medicamento',       placeholder: 'Ej. Metformina' },
                { key: 'strength',          label: 'Concentración',                placeholder: 'Ej. 50mg' },
                { key: 'frequency_raw',     label: 'Frecuencia (texto de receta)', placeholder: 'Como en la receta' },
                { key: 'quantity_per_dose', label: 'Cantidad por toma',            placeholder: '1', type: 'number' },
                { key: 'instructions',      label: 'Instrucciones del médico',     placeholder: 'Indicaciones especiales' },
              ]
              const fields = addPhotoType === 'box' ? boxFields : rxFields

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {addPhotoPreview && (
                    <img src={addPhotoPreview} alt="Foto" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 14 }} />
                  )}

                  {addAiError ? (
                    <div style={{ background: '#FBEAE4', borderRadius: 20, padding: '12px 14px', boxShadow: '0 6px 14px -8px #D9534F33' }}>
                      <p style={{ fontSize: 13, color: '#C4664F', margin: 0 }}>⚠️ {addAiError}</p>
                    </div>
                  ) : addAiExtracted ? (
                    <>
                      {/* Warnings from AI */}
                      {warnings.length > 0 && (
                        <div style={{ background: '#F6E4B8', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {warnings.map((w, i) => (
                            <p key={i} style={{ fontSize: 12, color: '#8A661A', margin: 0 }}>⚠️ {w}</p>
                          ))}
                        </div>
                      )}

                      {/* Always: review notice */}
                      <div style={{ background: '#F6E4B8', borderRadius: 16, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 16 }}>👁️</span>
                        <p style={{ fontSize: 12, color: '#8A661A', fontWeight: 600, margin: 0 }}>
                          Revisa los datos antes de continuar — la IA puede cometer errores
                        </p>
                      </div>

                      {isMulti ? (
                        /* ── Multiple meds: checkbox selection ────────── */
                        <>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1E2C3A', margin: 0 }}>
                            Encontramos {meds.length} medicamentos en esta receta
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {meds.map((med, i) => {
                              const checked     = selectedMedIndices.has(i)
                              const hasLowConf  = Object.values(med).some(f => f?.confidence != null && f.confidence < 0.7)
                              return (
                                <label
                                  key={i}
                                  style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                    padding: '12px 14px', borderRadius: 16, cursor: 'pointer',
                                    border: checked ? '1.5px solid #087F70' : '1px solid rgba(51,65,85,0.12)',
                                    background: checked ? '#EAF7F3' : 'white',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setSelectedMedIndices(prev => {
                                      const next = new Set(prev)
                                      next.has(i) ? next.delete(i) : next.add(i)
                                      return next
                                    })}
                                    style={{ marginTop: 3, accentColor: '#087F70', width: 16, height: 16, flexShrink: 0 }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1E2C3A', margin: 0 }}>
                                      {med.name?.value ?? '(sin nombre)'}
                                      {hasLowConf && <span style={{ marginLeft: 6, fontSize: 11, color: '#A87A0F', fontWeight: 600 }}>⚠️ revisar</span>}
                                    </p>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                                      {med.strength?.value && (
                                        <span style={{ fontSize: 11, background: '#EAF7F3', color: '#087F70', padding: '1px 7px', borderRadius: 6 }}>{med.strength.value}</span>
                                      )}
                                      {med.form?.value && (
                                        <span style={{ fontSize: 11, background: '#F1EDE3', color: '#6B7A88', padding: '1px 7px', borderRadius: 6 }}>{FORM_MAP[med.form.value] ?? med.form.value}</span>
                                      )}
                                      {med.frequency?.value && (
                                        <span style={{ fontSize: 11, background: '#F1EDE3', color: '#6B7A88', padding: '1px 7px', borderRadius: 6 }}>
                                          {FREQ_OPTIONS.find(o => o.value === med.frequency.value)?.label ?? med.frequency.value}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                          <button
                            onClick={applySelectedMeds}
                            disabled={selectedMedIndices.size === 0}
                            style={{
                              padding: '13px', borderRadius: 16, border: 'none',
                              background: selectedMedIndices.size === 0 ? '#C0CCC5' : 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)',
                              color: 'white', fontWeight: 700, fontSize: 14,
                              cursor: selectedMedIndices.size === 0 ? 'not-allowed' : 'pointer',
                              boxShadow: selectedMedIndices.size === 0 ? 'none' : '0 6px 20px rgba(8,127,112,0.3)',
                            }}
                          >
                            Agregar {selectedMedIndices.size} medicamento{selectedMedIndices.size !== 1 ? 's' : ''} →
                          </button>
                        </>
                      ) : (
                        /* ── Single med: editable fields with confidence ─ */
                        meds.length === 1 && (
                          <div style={{ background: '#EAF7F3', borderRadius: 20, padding: '16px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#087F70', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                              La IA encontró lo siguiente
                            </p>
                            {fields.map(f => {
                              const fieldData  = meds[0][f.key]
                              const value      = fieldData?.value ?? ''
                              const confidence = fieldData?.confidence
                              const lowConf    = confidence != null && confidence < 0.7
                              return (
                                <div key={f.key} style={{ marginBottom: 10 }}>
                                  <label style={{ ...labelStyle, color: lowConf ? '#A87A0F' : '#087F70' }}>
                                    {lowConf ? '⚠️ ' : ''}{f.label}
                                    {confidence != null && (
                                      <span style={{ fontWeight: 400, color: '#6B7A88', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                                        ({Math.round(confidence * 100)}%)
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type={f.type ?? 'text'}
                                    value={String(value)}
                                    onChange={e => setAddAiExtracted(prev => ({
                                      ...prev,
                                      medications: prev.medications.map((m, i) =>
                                        i === 0 ? { ...m, [f.key]: { ...(m[f.key] ?? {}), value: f.type === 'number' ? Number(e.target.value) : e.target.value } } : m
                                      ),
                                    }))}
                                    placeholder={f.placeholder}
                                    style={{
                                      ...fieldStyle,
                                      borderColor: lowConf ? '#F6E4B8' : '#A8E5D6',
                                      background:  lowConf ? '#FCF6E8' : 'white',
                                    }}
                                    onFocus={onFocus}
                                    onBlur={onBlur}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )
                      )}
                    </>
                  ) : null}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setAddStep('method')}
                      style={{ flex: 1, padding: '13px', borderRadius: 16, border: 'none', background: 'white', color: '#5C6B78', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 10px -6px #087F7022' }}
                    >
                      Volver
                    </button>
                    {(!isMulti || !addAiExtracted) && (
                      <button
                        onClick={applyAiAndContinue}
                        style={{ flex: 2, padding: '13px', borderRadius: 14, border: 'none', background: 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 20px rgba(8,127,112,0.3)' }}
                      >
                        {addAiExtracted ? 'Continuar →' : 'Ingresar manual →'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── STEP: Main form ───────────────────────────────────────── */}
            {addStep === 'form' && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Forma farmacéutica */}
                <div>
                  <label style={labelStyle}>Forma farmacéutica</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.form} onChange={e => setForm(p => ({ ...p, form: e.target.value }))} style={{ ...fieldStyle, paddingRight: 32 }} onFocus={onFocus} onBlur={onBlur}>
                      {['Tableta','Cápsula','Jarabe','Gotas','Inyección','Crema','Inhalador','Parche','Supositorio','Otro'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A88', fontSize: 12 }}>▼</span>
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label style={labelStyle}>Nombre del medicamento *</label>
                  <input
                    name="med_name" required value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="ej. Metformina" autoComplete="off"
                    style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                  />
                </div>

                {/* Concentración */}
                <div>
                  <label style={labelStyle}>Concentración</label>
                  <input name="dosage" value={form.dosage} onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))} placeholder="ej. 500 mg, 10 mg/ml" style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>

                {/* Cantidad por toma */}
                <div>
                  <label style={labelStyle}>Cantidad por toma</label>
                  <input type="number" inputMode="decimal" min="0.25" step="0.25" value={form.quantityPerDose} onChange={e => setForm(p => ({ ...p, quantityPerDose: e.target.value }))} placeholder="1" style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <div>
                  <label style={labelStyle}>Frecuencia</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.frequency} onChange={e => handleFrequencyChange(e.target.value)} style={{ ...fieldStyle, paddingRight: 32 }} onFocus={onFocus} onBlur={onBlur}>
                      <option value="">Seleccionar frecuencia...</option>
                      {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A88', fontSize: 12 }}>▼</span>
                  </div>
                </div>

                {showTimePickers && (
                  <div>
                    <label style={labelStyle}>{isInterval ? 'Hora de inicio' : scheduledTimes.length > 1 ? 'Horarios' : 'Hora'}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {scheduledTimes.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {scheduledTimes.length > 1 && <span style={{ fontSize: 12, color: '#6B7A88', width: 18, flexShrink: 0 }}>{i + 1}.</span>}
                          <input type="time" value={t} onChange={e => { const n = [...scheduledTimes]; n[i] = e.target.value; setScheduledTimes(n) }} style={{ ...fieldStyle, flex: 1 }} onFocus={onFocus} onBlur={onBlur} />
                        </div>
                      ))}
                    </div>
                    {previewTimes.length > 0 && (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: '#F0F8F4', borderRadius: 10 }}>
                        <p style={{ fontSize: 11, color: '#2D6A4F', fontWeight: 600, marginBottom: 6 }}>Horarios automáticos ({previewTimes.length} dosis al día):</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {previewTimes.map((t, i) => <span key={i} style={{ background: 'white', color: '#2D6A4F', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #C1E4CC' }}>{t}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Notas adicionales</label>
                  <textarea name="notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Instrucciones especiales, efectos secundarios..." style={{ ...fieldStyle, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }} onFocus={onFocus} onBlur={onBlur} />
                </div>

                {/* ── Stock section ──────────────────────────────────────── */}
                <div style={{ borderTop: '1px solid #F1EDE3', paddingTop: 20 }}>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: '#1E2C3A', margin: '0 0 4px' }}>
                    Stock y renovación
                  </p>
                  <p style={{ fontSize: 11, color: '#6B7A88', margin: '0 0 16px' }}>
                    Opcional — para calcular cuándo se agota y enviar alertas
                  </p>

                  <label style={labelStyle}>Total de pastillas / unidades</label>
                  <input
                    type="number" inputMode="numeric" min="1"
                    value={stockForm.totalPills}
                    onChange={e => setStockForm(p => ({ ...p, totalPills: e.target.value }))}
                    placeholder="Ej: 30, 60, 90..."
                    style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                  />

                  {/* Duration preview */}
                  {stockPreviewDays && (
                    <div style={{ marginTop: 8, padding: '10px 14px', background: '#F0F9F4', borderRadius: 10, border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📅</span>
                      <p style={{ fontSize: 12, color: '#15803D', fontWeight: 600, margin: 0 }}>
                        Duración: {stockPreviewDays.days} días · Se acaba aprox. el {stockPreviewDays.date}
                      </p>
                    </div>
                  )}

                  {/* Stock mínimo para alerta */}
                  <div style={{ marginTop: 16 }}>
                    <label style={labelStyle}>Stock mínimo para alerta</label>
                    <input
                      type="number" inputMode="numeric" min="1"
                      value={form.minStock}
                      onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))}
                      placeholder="7"
                      style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                    />
                    <p style={{ fontSize: 11, color: '#6B7A88', margin: '4px 0 0' }}>
                      Se mostrará una alerta cuando queden menos de estas dosis
                    </p>
                  </div>
                </div>

                {saveError && (
                  <p style={{ color: '#C4664F', fontSize: 13, margin: '0', textAlign: 'center', padding: '8px', background: '#FBEAE4', borderRadius: 12 }}>
                    {saveError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={closeForm} style={{ flex: 1, padding: '13px', border: 'none', borderRadius: 16, background: 'white', color: '#5C6B78', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px -6px #087F7022' }}>
                    Cancelar
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={saving}
                    disabled={!canEdit}
                    loadingText="Guardando..."
                    style={{ flex: 2, padding: '13px' }}
                  >
                    {editId ? 'Guardar cambios' : 'Guardar medicamento'}
                  </LoadingButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Administrar ─────────────────────────────────────────────── */}
      {adminModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(20,32,29,0.45)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget && !adminSaving) { setAdminModal(null); setAdminPhotoBlob(null); setAdminPhotoPreview(null); setAdminGps(null) } }}
        >
          <div style={{ width: '100%', maxHeight: '90vh', background: '#F8F4ED', borderRadius: '28px 28px 0 0', padding: '24px 20px 80px', overflowY: 'auto', boxShadow: '0 -12px 30px -12px #08554A55' }}>
            <input ref={adminCameraRef}  type="file" accept="image/*" capture="environment" onChange={handleAdminFileSelect} style={{ display: 'none' }} />
            <input ref={adminGalleryRef} type="file" accept="image/*"                       onChange={handleAdminFileSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 14, background: '#EAF7F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Pill size={19} color="#087F70" strokeWidth={1.9} />
                </span>
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 19, fontWeight: 800, color: '#1E2C3A', margin: 0 }}>{adminModal.name}</p>
                  {adminModal.dosage && <p style={{ fontSize: 13, color: '#6B7A88', margin: '2px 0 0' }}>{adminModal.dosage}</p>}
                </div>
              </div>
              <button onClick={() => { if (!adminSaving) { setAdminModal(null); setAdminPhotoBlob(null); setAdminPhotoPreview(null); setAdminGps(null) } }} style={{ width: 32, height: 32, borderRadius: 11, background: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XIcon size={16} color="#6B7A88" strokeWidth={2.2} />
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 20, boxShadow: '0 6px 14px -8px #087F7022' }}>
              <div>
                <p style={{ fontSize: 11, color: '#6B7A88', margin: 0 }}>Programado</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1E2C3A', margin: '2px 0 0' }}>{firstTimeMed(adminModal) ?? '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#6B7A88', margin: 0 }}>Hora actual</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#087F70', margin: '2px 0 0' }}>{new Date().toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: '#7D8A9A', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Foto de evidencia (opcional)</p>
            <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, background: 'white', boxShadow: '0 6px 14px -8px #087F7022' }}>
              {adminPhotoStamping ? (
                <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #EAF7F3', borderTopColor: '#087F70', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ fontSize: 12, color: '#6B7A88', margin: 0 }}>Aplicando sello...</p>
                </div>
              ) : adminPhotoPreview ? (
                <>
                  <img src={adminPhotoPreview} alt="Evidencia" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
                  <div style={{ padding: '8px 12px', background: '#EAF7F3', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>🔒</span>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#087F70', margin: 0, flex: 1 }}>Sello aplicado</p>
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
                    <button onClick={adminOpenCamera} style={{ flex: 1, padding: 10, borderRadius: 13, border: 'none', background: '#A8E5D6', color: '#087F70', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cambiar foto</button>
                    <button onClick={() => { setAdminPhotoBlob(null); setAdminPhotoPreview(null); setAdminGps(null) }} style={{ flex: 1, padding: 10, borderRadius: 13, border: 'none', background: '#F1EDE3', color: '#5C6B78', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Quitar</button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 11, color: '#6B7A88', margin: 0, textAlign: 'center' }}>Se sellará automáticamente con fecha y hora</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={adminOpenCamera} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 13, border: 'none', background: '#A8E5D6', color: '#087F70', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      <Camera size={15} color="#087F70" strokeWidth={1.9} /> Tomar foto
                    </button>
                    <button onClick={adminOpenGallery} style={{ flex: 1, padding: 10, borderRadius: 13, border: 'none', background: '#F1EDE3', color: '#5C6B78', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Elegir de galería</button>
                  </div>
                </div>
              )}
            </div>

            {adminError && <div style={{ background: '#FBEAE4', borderRadius: 16, padding: '10px 12px', marginBottom: 12 }}><p style={{ fontSize: 12, color: '#C4664F', margin: 0 }}>⚠️ {adminError}</p></div>}

            <button
              onClick={handleAdministrar}
              disabled={adminSaving || adminPhotoStamping}
              style={{ width: '100%', padding: 16, borderRadius: 999, border: 'none', background: (adminSaving || adminPhotoStamping) ? '#C0CCC5' : '#E9826E', color: 'white', fontWeight: 800, fontSize: 16, cursor: (adminSaving || adminPhotoStamping) ? 'not-allowed' : 'pointer', boxShadow: (adminSaving || adminPhotoStamping) ? 'none' : '0 8px 18px -6px rgba(233,130,110,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {adminSaving
                ? <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} /> Guardando...</>
                : <><CheckIcon size={17} color="white" strokeWidth={2.6} /> Confirmar administración</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Aviso: confirmar como administrador ───────────────────────────── */}
      {adminConfirmWarningMed && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,32,29,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setAdminConfirmWarningMed(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px -16px #08554A55' }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 17, fontWeight: 800, color: '#1E2C3A', marginBottom: 10 }}>
              Confirmar como administrador
            </p>
            <p style={{ fontSize: 13, color: '#8A661A', lineHeight: 1.6, marginBottom: 10, background: '#F6E4B8', borderRadius: 14, padding: '10px 14px' }}>
              Úsalo solo si el cuidador habitual no puede confirmar en este momento.
            </p>
            <p style={{ fontSize: 12, color: '#6B7A88', lineHeight: 1.6, marginBottom: 24 }}>
              Esta acción quedará registrada con tu nombre.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAdminConfirmWarningMed(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#F1EDE3', color: '#5C6B78', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={() => { const m = adminConfirmWarningMed; setAdminConfirmWarningMed(null); openAdminModal(m) }}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#D99A18', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(217,154,24,0.35)' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar desmarcar una dosis ya dada ──────────────────────────── */}
      {unconfirmTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,32,29,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget && !unconfirming) setUnconfirmTarget(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px -16px #08554A55' }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 17, fontWeight: 800, color: '#1E2C3A', marginBottom: 8 }}>
              ¿Desmarcar esta dosis?
            </p>
            <p style={{ fontSize: 13, color: '#6B7A88', lineHeight: 1.6, marginBottom: 24 }}>
              {unconfirmTarget.name} volverá a aparecer como pendiente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setUnconfirmTarget(null)} disabled={unconfirming} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#F1EDE3', color: '#5C6B78', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleUnconfirm}
                disabled={unconfirming}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: unconfirming ? '#C0CCC5' : '#C4664F', color: 'white', fontWeight: 700, fontSize: 14, cursor: unconfirming ? 'not-allowed' : 'pointer' }}
              >
                {unconfirming ? 'Desmarcando...' : 'Desmarcar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: foto de prueba (recordatorio 30 min) ────────────────────── */}
      {proofSheet && (() => {
        const dayLogs = logsByMedId[proofSheet.med.id]?.[today] ?? []
        const confirmedAt = dayLogs.find(l => l.status === 'confirmed')?.confirmed_at
        const minLeft = confirmedAt
          ? Math.max(0, 30 - Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 60000))
          : 30
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(20,32,29,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget && !proofUploading) closeProofSheet() }}
          >
            <div style={{ width: '100%', maxWidth: 480, background: '#F8F4ED', borderRadius: '28px 28px 0 0', padding: '24px 20px 96px', boxShadow: '0 -12px 30px -12px #08554A55' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: '#1E2C3A', margin: 0 }}>Foto de prueba</p>
                  <p style={{ fontSize: 13, color: minLeft <= 5 ? '#C4664F' : '#6B7A88', marginTop: 4 }}>
                    {proofSheet.med.name} — {minLeft > 0 ? `${minLeft} min restantes` : 'Tiempo agotado'}
                  </p>
                </div>
                <button onClick={closeProofSheet} disabled={proofUploading} style={{ width: 32, height: 32, borderRadius: 11, background: '#FFFFFF', border: 'none', cursor: proofUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: proofUploading ? 0.4 : 1 }}>
                  <XIcon size={16} color="#6B7A88" strokeWidth={2.2} />
                </button>
              </div>

              <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: 'white', boxShadow: '0 6px 14px -8px #087F7022' }}>
                {proofStamping ? (
                  <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid #EAF7F3', borderTopColor: '#087F70', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ fontSize: 13, color: '#6B7A88', margin: 0 }}>Aplicando sello...</p>
                  </div>
                ) : proofPreview ? (
                  <>
                    <img src={proofPreview} alt="Prueba sellada" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
                    <div style={{ padding: '10px 14px', background: '#EAF7F3', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🔒</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#087F70', margin: 0 }}>Sello aplicado</p>
                        {proofGps && (
                          <p style={{ fontSize: 11, color: '#087F70', margin: '2px 0 0' }}>
                            📍 {proofGps.address ?? `${proofGps.latitude.toFixed(5)}, ${proofGps.longitude.toFixed(5)}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, padding: '8px 12px 12px' }}>
                      <button type="button" onClick={proofOpenCamera} disabled={proofUploading} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: '#A8E5D6', color: '#087F70', fontSize: 12, fontWeight: 700, cursor: proofUploading ? 'not-allowed' : 'pointer' }}>Tomar foto</button>
                      <button type="button" onClick={proofOpenGallery} disabled={proofUploading} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: '#F1EDE3', color: '#5C6B78', fontSize: 12, fontWeight: 700, cursor: proofUploading ? 'not-allowed' : 'pointer' }}>De galería</button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#EAF7F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={24} color="#087F70" strokeWidth={1.8} />
                    </span>
                    <p style={{ fontSize: 12, color: '#6B7A88', margin: 0 }}>Se sellará automáticamente con fecha y hora</p>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <button type="button" onClick={proofOpenCamera} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#A8E5D6', color: '#087F70', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Tomar foto</button>
                      <button type="button" onClick={proofOpenGallery} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#F1EDE3', color: '#5C6B78', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Elegir de galería</button>
                    </div>
                  </div>
                )}
              </div>

              {proofError && (
                <div style={{ background: '#FBEAE4', borderRadius: 14, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: '#C4664F', margin: 0 }}>⚠️ {proofError}</p>
                </div>
              )}

              <button
                onClick={submitProofPhoto}
                disabled={!proofBlob || proofUploading || proofStamping}
                style={{
                  width: '100%', padding: 14, marginBottom: 10, borderRadius: 14, border: 'none',
                  background: proofBlob && !proofUploading ? 'linear-gradient(148deg,#12A18C 0%,#0A8072 46%,#055C51 100%)' : '#C0CCC5',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  cursor: proofBlob && !proofUploading ? 'pointer' : 'not-allowed',
                  boxShadow: proofBlob && !proofUploading ? '0 8px 18px -6px rgba(8,127,112,0.5)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {proofUploading
                  ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} /> Guardando...</>
                  : 'Guardar foto de prueba'}
              </button>

              <button onClick={closeProofSheet} style={{ width: '100%', padding: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7A88' }}>
                Omitir por ahora {minLeft > 0 ? `(tienes ${minLeft} min)` : ''}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: '#1E2C3A', color: 'white', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px -8px #08554A66', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {toastMsg}
        </div>
      )}

      {/* ── Photo preview lightbox ────────────────────────────────────────── */}
      {previewPhotoUrl && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <button
            onClick={() => setPreviewPhotoUrl(null)}
            style={{ position: 'absolute', top: 20, right: 20, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <XIcon size={18} color="white" strokeWidth={2} />
          </button>
          <img src={previewPhotoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── Detalle del medicamento (overlay, misma página) ──────────────────── */}
      {detailMed && (
        <MedicationDetail
          med={medications.find(m => m.id === detailMed.id) ?? detailMed}
          stock={stockByMedId[detailMed.id]}
          ownerId={ownerId}
          isAdmin={isAdmin}
          onClose={() => setDetailMed(null)}
          onEdit={med => { setDetailMed(null); openEdit(med) }}
          onDelete={handleDelete}
          onStatusChange={(medId, status) => setMedications(prev => prev.map(m => m.id === medId ? { ...m, status } : m))}
          onDocsChange={(medId, field, url) => setStockByMedId(prev => ({ ...prev, [medId]: { ...prev[medId], [field]: url } }))}
        />
      )}

    </Layout>
  )
}
