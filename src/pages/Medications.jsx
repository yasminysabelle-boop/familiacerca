import { useEffect, useRef, useState } from 'react'
import PaywallModal from '../components/PaywallModal'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import { Plus, XIcon, Pencil, Trash, Bell, CheckIcon } from '../components/Icons'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { track } from '../lib/analytics'
import { getTodayPR } from '../lib/utils'
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

const CLAUDE_PROXY  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`  // fallback
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

const MED_STATUS = {
  programado: { dot: '⚪', label: 'Programado', color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
  pendiente:  { dot: '🟢', label: 'A tiempo',   color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' },
  dar_pronto: { dot: '🟡', label: 'Dar pronto', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  tarde:      { dot: '🔴', label: 'Tarde',      color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
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

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
}

// ── Styles ────────────────────────────────────────────────────────────────────

const emptyForm  = { name: '', dosage: '', frequency: '', notes: '', form: 'Tableta', quantityPerDose: 1, minStock: 7 }
const emptyStock = { totalPills: '', renewalMethod: '', pharmacyName: '', refillsRemaining: '', lastMailDate: '' }

const fieldStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1.5px solid #EDE5D8', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', appearance: 'none', WebkitAppearance: 'none',
}
const onFocus = e => { e.target.style.borderColor = '#0d6b63'; e.target.style.boxShadow = '0 0 0 3px rgba(13,107,99,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Medications() {
  const { user } = useAuth()
  const { ownerId, memberRole, profile } = useFamily()
  const { canEdit, trialExpired } = useSubscription()
  const navigate = useNavigate()
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
  const [dadosExpandido,     setDadosExpandido]     = useState(false)
  const [adminModal,         setAdminModal]         = useState(null)
  const [adminSaving,        setAdminSaving]        = useState(false)
  const [adminPhotoBlob,     setAdminPhotoBlob]     = useState(null)
  const [adminPhotoPreview,  setAdminPhotoPreview]  = useState(null)
  const [adminError,         setAdminError]         = useState('')
  const [omisionModal,       setOmisionModal]       = useState(null)
  const [omisionReason,      setOmisionReason]      = useState('')
  const [omisionSaving,      setOmisionSaving]      = useState(false)
  const [omisionError,       setOmisionError]       = useState('')
  const [toastMsg,           setToastMsg]           = useState('')
  const [omissionsByMedId,   setOmissionsByMedId]   = useState({})
  const [previewPhotoUrl,    setPreviewPhotoUrl]     = useState(null)
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
  const [confirmDialog,   setConfirmDialog]   = useState(null)
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
    const reader = new FileReader()
    reader.onload = ev => setAddPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
    processPhoto(file, addPhotoType)
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

  async function processPhoto(file, type) {
    setAddStep('ai-processing')
    setAddAiError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setAddAiError('Función no disponible. Ingresa los datos manualmente.')
      setAddStep('form')
      return
    }
    try {
      const b64  = await toBase64(file)
      const mime = file.type || 'image/jpeg'
      const res  = await fetch(GEMINI_VISION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image_base64: b64, media_type: mime, prompt: type === 'box' ? BOX_PROMPT : RX_PROMPT }),
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

  function handleAdminFileSelect(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setAdminPhotoBlob(f)
    const r = new FileReader()
    r.onload = ev => setAdminPhotoPreview(ev.target.result)
    r.readAsDataURL(f)
    e.target.value = ''
  }
  function adminOpenCamera() {
    adminCameraRef.current?.click()
  }
  function adminOpenGallery() {
    adminGalleryRef.current?.click()
  }

  async function handleAdministrar() {
    if (!adminModal?.id || adminSaving) return
    const med = adminModal
    const _sched = firstTimeMed(med)
    if (_sched) {
      const [_hh, _mm] = _sched.split(':').map(Number)
      const _window = med.time_window_minutes ?? 60
      const _now = new Date()
      const _nowMins = _now.getHours() * 60 + _now.getMinutes()
      const _schedMins = _hh * 60 + _mm
      // Handle midnight wrap: if current time is before scheduled time on the clock,
      // the dose was scheduled the previous day and elapsed time wraps around 24h.
      const _late = _nowMins >= _schedMins
        ? _nowMins - _schedMins
        : 24 * 60 - _schedMins + _nowMins
      if (_late >= _window) {
        setAdminError('La ventana clínica ha vencido. Esta dosis no puede administrarse. Continúa con la próxima dosis a su hora habitual.')
        return
      }
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
    let photoUrl = null
    if (adminPhotoBlob) {
      const path = `${ownerId}/${today}/${med.id}.jpg`
      const { error: sErr } = await supabase.storage.from('confirmations')
        .upload(path, adminPhotoBlob, { upsert: true, contentType: adminPhotoBlob.type || 'image/jpeg' })
      if (!sErr) {
        const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }
    const { error: logErr } = await supabase.from('medication_logs').upsert({
      medication_id: med.id, user_id: ownerId, status: 'confirmed',
      log_date: today, confirmed_by_name: displayName, given_by_name: displayName,
      confirmed_at: confirmedAt, scheduled_at: scheduledAt,
      photo_url: photoUrl, given_on_time: givenOnTime, minutes_late: minutesLate,
    }, { onConflict: 'medication_id,log_date,user_id' })
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
      next[med.id][today].push({ medication_id: med.id, log_date: today, status: 'confirmed', confirmed_by_name: displayName, confirmed_at: confirmedAt, photo_url: photoUrl, given_on_time: givenOnTime, minutes_late: minutesLate })
      return next
    })
    track('medication_administered', { medication_name: med.name })
    setAdminSaving(false); setAdminModal(null); setAdminPhotoBlob(null); setAdminPhotoPreview(null)
    showToast('Medicamento registrado correctamente ✅')
  }

  async function handleOmitir() {
    if (!omisionModal || !omisionReason || omisionSaving) return
    setOmisionSaving(true); setOmisionError('')
    const med = omisionModal
    const scheduledTime = firstTimeMed(med)
    let scheduledAt = null
    if (scheduledTime) {
      const [hh, mm] = scheduledTime.split(':').map(Number)
      const d = new Date(); d.setHours(hh, mm, 0, 0); scheduledAt = d.toISOString()
    }
    await supabase.from('medication_omissions').insert({
      medication_id: med.id, owner_id: ownerId, scheduled_at: scheduledAt,
      reason: omisionReason, omitted_by: user.id, omitted_by_name: displayName,
    })
    await supabase.from('medication_logs').upsert({
      medication_id: med.id, user_id: ownerId, status: 'missed',
      log_date: today, confirmed_by_name: displayName, confirmed_at: new Date().toISOString(),
    }, { onConflict: 'medication_id,log_date,user_id' })
    setLogsByMedId(prev => {
      const next = { ...prev }
      if (!next[med.id]) next[med.id] = {}
      if (!next[med.id][today]) next[med.id][today] = []
      next[med.id][today] = next[med.id][today].filter(l => l.status !== 'missed')
      next[med.id][today].push({ medication_id: med.id, log_date: today, status: 'missed', confirmed_by_name: displayName, confirmed_at: new Date().toISOString() })
      return next
    })
    setOmisionSaving(false); setOmisionModal(null); setOmisionReason('')
    showToast('Omisión registrada ✓')
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

      {/* Fila delgada de acción — fuera del scroll (sin título propio, el Layout ya lo muestra) */}
      {isAdmin && (
        <div style={{ padding: '16px 16px 0', maxWidth: 600, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={openAdd}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(13,107,99,0.3)',
            }}
          >
            <Plus size={20} color="white" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Tab bar — pills sueltos, fuera del scroll, siempre visible */}
      <div style={{ padding: '16px 16px 0', maxWidth: 600 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['hoy', 'todos', 'stock', 'recetas'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '10px 0', cursor: 'pointer',
                borderRadius: 999,
                border: activeTab === tab ? 'none' : '1.5px solid #EDE5D8',
                background: activeTab === tab ? '#143C32' : 'transparent',
                color: activeTab === tab ? 'white' : '#6B7280',
                fontWeight: 700,
                fontSize: 11,
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {tab === 'hoy' ? '💊 Hoy' : tab === 'todos' ? '💊 Lista' : tab === 'stock' ? '📦 Inventario' : '📄 Recetas'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', borderRadius: 14, border: '1px solid #EDE5D8', padding: '12px 14px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#EBF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#0d6b63" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 1 }}>Recordatorios de medicamentos</p>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>Activa las notificaciones para no olvidar ninguna dosis.</p>
            </div>
            <button onClick={requestAndSubscribe} style={{ padding: '7px 16px', borderRadius: 999, background: '#E9826E', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              Activar
            </button>
          </div>
        )}

        {/* ── Hoy: 3 secciones ─────────────────────────────────────────────── */}
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

            {/* ── Avatares de participantes hoy ── */}
            {todayContributors.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex' }}>
                  {todayContributors.slice(0, 4).map((name, i) => {
                    const colors = ['#0d6b63','#2D6A4F','#16A34A','#059669']
                    return (
                      <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: colors[i % 4], color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: i > 0 ? -8 : 0, border: '2px solid #F0FDF4', flexShrink: 0 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: 12, color: '#15803D', fontWeight: 600, margin: 0 }}>
                  {todayContributors.length === 1
                    ? `${todayContributors[0].split(' ')[0]} participó hoy`
                    : `${todayContributors.slice(0, 2).map(n => n.split(' ')[0]).join(' y ')} participaron hoy`}
                </p>
              </div>
            )}

            {/* ── Sección 1: PENDIENTES ──────────────────────────────────── */}
            {pendientesMeds.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px 2px' }}>
                  🟢 Pendientes ({pendientesMeds.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendientesMeds.map(med => {
                    const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
                    const firstT = times.length ? [...times].sort()[0] : null
                    const sCfg = MED_STATUS[calcMedStatus(firstT, med.time_window_minutes ?? 60)]
                    return (
                      <div key={med.id} style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', borderLeft: '4px solid #0d6b63', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: times.length ? 8 : 0 }}>
                          <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#EFF6F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💊</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                              {med.name}{med.dosage ? <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 13 }}> · {med.dosage}</span> : null}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: sCfg.color, background: sCfg.bg, border: `1px solid ${sCfg.border}`, padding: '3px 10px', borderRadius: 999 }}>
                              {sCfg.dot} {sCfg.label}
                            </span>
                            {isAdmin && (
                              <button onClick={() => openEdit(med)} style={{ padding: 5, border: 'none', background: '#F3F4F6', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <Pencil size={13} color="#6B7280" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </div>
                        {times.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                            {times.map((t, i) => <span key={i} style={{ background: '#F0F8F4', color: '#2D6A4F', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>⏰ {t}</span>)}
                            {med.time_window_minutes && <span style={{ fontSize: 11, color: '#9CA3AF' }}>ventana {med.time_window_minutes} min</span>}
                          </div>
                        )}
                        {!isFamiliar && (
                          <button onClick={() => { setAdminModal(med); setAdminPhotoBlob(null); setAdminPhotoPreview(null); setAdminError('') }} style={{ width: '100%', padding: '10px', borderRadius: 999, border: 'none', background: '#E9826E', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,130,110,0.35)' }}>
                            ✅ Administrar
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Sección 2: DOSIS OLVIDADAS ─────────────────────────────── */}
            {retrasadosMeds.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px 2px' }}>
                  ❌ Dosis olvidadas ({retrasadosMeds.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {retrasadosMeds.map(med => {
                    const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
                    const firstT = times.length ? [...times].sort()[0] : null
                    const timeLabel = firstT ? (() => {
                      const [h, m] = firstT.split(':').map(Number)
                      return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
                    })() : null
                    const medLabel = [med.name, med.dosage].filter(Boolean).join(' ')
                    const waText = encodeURIComponent(
                      `⚠️ Dosis olvidada: ${medLabel}${timeLabel ? `. Hora programada: ${timeLabel}` : ''}. La dosis no fue administrada en el horario establecido. Por favor indique el procedimiento a seguir.`
                    )
                    return (
                      <div key={med.id} style={{ background: '#FEF2F2', borderRadius: 16, border: '1.5px solid #FCA5A5', borderLeft: '4px solid #DC2626', padding: '14px', boxShadow: '0 2px 8px rgba(214,48,49,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', margin: '0 0 2px' }}>
                              ❌ {med.name}{med.dosage ? <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 13 }}> · {med.dosage}</span> : null}
                            </p>
                            {timeLabel && (
                              <p style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, margin: 0 }}>
                                ⏰ Programado: {timeLabel} — ventana clínica vencida
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: '#DC2626', padding: '3px 8px', borderRadius: 6 }}>Olvidada</span>
                            {isAdmin && (
                              <button onClick={() => openEdit(med)} style={{ padding: 5, border: 'none', background: 'rgba(255,255,255,0.7)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Pencil size={13} color="#DC2626" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                            ⚠️ <strong>Dosis olvidada</strong> — No administres esta dosis. Continúa con la próxima dosis a su hora habitual. Si es un medicamento crítico o el paciente presenta síntomas, notifica al médico de inmediato.
                          </p>
                        </div>
                        <a
                          href={`https://wa.me/?text=${waText}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '10px', borderRadius: 10, background: '#25D366', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: '0 2px 8px rgba(37,211,102,0.25)' }}
                        >
                          📱 Notificar al médico por WhatsApp
                        </a>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Todo listo — banner personalizado */}
            {pendientesMeds.length === 0 && retrasadosMeds.length === 0 && administradosMeds.length > 0 && (() => {
              const patientFirst = profile?.name?.split(' ')[0] ?? 'el familiar'
              const lastTime = lastAdminLog?.confirmed_at
                ? new Date(lastAdminLog.confirmed_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : null
              const lastBy = lastAdminLog?.confirmed_by_name?.split(' ')[0]
              let mainMsg
              if (todayContributors.length === 1) {
                mainMsg = `${todayContributors[0].split(' ')[0]} confirmó todas las dosis de ${patientFirst} hoy. 💙`
              } else if (todayContributors.length > 1) {
                mainMsg = `Participaron hoy: ${todayContributors.map(n => n.split(' ')[0]).join(' y ')}`
              } else {
                mainMsg = `Todas las dosis de ${patientFirst} registradas hoy.`
              }
              return (
                <div style={{ padding: '20px 16px', background: '#F0FDF4', borderRadius: 16, border: '1px solid #BBF7D0' }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#15803D', margin: 0, textAlign: 'center' }}>✓ ¡Todo en orden hoy! {patientFirst} recibió sus cuidados</p>
                  <p style={{ fontSize: 13, color: '#0d6b63', margin: '6px 0 0', textAlign: 'center' }}>{mainMsg}</p>
                  {lastTime && lastBy && (
                    <p style={{ fontSize: 11, color: '#6B7280', margin: '6px 0 0', textAlign: 'center' }}>
                      Última administración: {lastBy} · {lastTime}
                    </p>
                  )}
                </div>
              )
            })()}

            {/* ── Sección 3: ADMINISTRADOS (colapsada) ──────────────────── */}
            {administradosMeds.length > 0 && (
              <div>
                <button onClick={() => setDadosExpandido(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 12, background: 'white', border: '1px solid #BBF7D0', cursor: 'pointer', marginBottom: dadosExpandido ? 8 : 0, WebkitTapHighlightColor: 'transparent' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#15803D', flex: 1, textAlign: 'left' }}>✅ Administrados hoy ({administradosMeds.length})</span>
                  <span style={{ fontSize: 16, color: '#9CA3AF', display: 'inline-block', transform: dadosExpandido ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
                </button>
                {dadosExpandido && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {administradosMeds.map(med => {
                      const todayLog    = (logsByMedId[med.id]?.[today] ?? []).find(l => l.status === 'confirmed' || l.status === 'missed')
                      const isOmitted   = todayLog?.status === 'missed'
                      const isAutoMissed = isOmitted && todayLog?.confirmed_by_name === 'Sistema automático'
                      const confTime    = todayLog?.confirmed_at ? new Date(todayLog.confirmed_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null
                      const byName      = todayLog?.confirmed_by_name?.split(' ')[0]
                      const scheduledTime = firstTimeMed(med)
                      const omissionData  = omissionsByMedId[med.id]?.[today]
                      const stockDoc      = stockByMedId[med.id]
                      return (
                        <div key={med.id} style={{ background: isAutoMissed ? '#FEF2F2' : isOmitted ? '#FFFBEB' : '#F0FDF4', borderRadius: 16, border: isAutoMissed ? '1px solid #FCA5A5' : isOmitted ? '1px solid #FDE68A' : '1px solid #BBF7D0', borderLeft: isAutoMissed ? '4px solid #DC2626' : isOmitted ? '4px solid #D97706' : '4px solid #22C55E', padding: '16px' }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: isAutoMissed ? '#FCA5A5' : isOmitted ? '#FDE68A' : '#BBF7D0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                            }}>{isAutoMissed ? '❌' : isOmitted ? '⚠️' : '✅'}</span>
                            <p style={{ fontSize: 14, fontWeight: 700, color: isAutoMissed ? '#991B1B' : isOmitted ? '#92400E' : '#15803D', margin: 0, flex: 1 }}>
                              {med.name}{med.dosage ? <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 12 }}> · {med.dosage}</span> : null}
                            </p>
                            {isAdmin && (
                              <button onClick={() => openEdit(med)} style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <Pencil size={12} color="#9CA3AF" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                          {/* Detail rows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 42 }}>
                            {scheduledTime && <span style={{ fontSize: 11, color: '#6B7280' }}>📅 Programado: {scheduledTime}</span>}
                            {confTime && <span style={{ fontSize: 11, color: '#0d6b63', fontWeight: 600 }}>🕐 {isOmitted ? 'Registrado:' : 'Administrado:'} {confTime}</span>}
                            {byName && !isAutoMissed && <span style={{ fontSize: 11, color: '#6B7280' }}>👤 Por: {byName}</span>}
                            {isAutoMissed && <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>❌ Ventana clínica vencida — marcado por el sistema</span>}
                            {isOmitted && !isAutoMissed && omissionData?.reason && (
                              <span style={{ fontSize: 11, color: '#92400E' }}>⚠ Motivo: {omissionData.reason}</span>
                            )}
                            {isOmitted && !isAutoMissed && !omissionData?.reason && (
                              <span style={{ fontSize: 11, color: '#92400E' }}>⚠ Dosis omitida</span>
                            )}
                            {!isOmitted && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: todayLog?.given_on_time === false ? '#D97706' : '#15803D' }}>
                                {todayLog?.given_on_time === false && todayLog?.minutes_late
                                  ? `⚠️ Fuera de ventana (${todayLog.minutes_late} min)`
                                  : '✅ Administrado a tiempo'}
                              </span>
                            )}
                            {med.notes && <span style={{ fontSize: 11, color: '#6B7280' }}>📝 {med.notes}</span>}
                            {/* Photo action buttons */}
                            {(todayLog?.photo_url || stockDoc?.prescription_photo_url || stockDoc?.box_photo_url) && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                {todayLog?.photo_url && (
                                  <button onClick={() => setPreviewPhotoUrl(todayLog.photo_url)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BBF7D0', background: 'white', fontSize: 11, fontWeight: 600, color: '#15803D', cursor: 'pointer' }}>
                                    📷 Ver evidencia
                                  </button>
                                )}
                                {stockDoc?.prescription_photo_url && (
                                  <button onClick={() => setPreviewPhotoUrl(stockDoc.prescription_photo_url)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #DBEAFE', background: 'white', fontSize: 11, fontWeight: 600, color: '#1D4ED8', cursor: 'pointer' }}>
                                    📄 Ver receta
                                  </button>
                                )}
                                {stockDoc?.box_photo_url && (
                                  <button onClick={() => setPreviewPhotoUrl(stockDoc.box_photo_url)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E0E7FF', background: 'white', fontSize: 11, fontWeight: 600, color: '#4338CA', cursor: 'pointer' }}>
                                    📦 Ver caja
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Mensaje emocional de cierre */}
            <div style={{ padding: '16px', background: '#F8F4ED', borderRadius: 16, border: '1px solid #EDE5D8' }}>
              <p style={{ fontSize: 13, color: '#143C32', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
                Cada pequeño cuidado cuenta. Gracias por estar pendiente de {profile?.name?.split(' ')[0] ?? 'tu familiar'}.
              </p>
            </div>
          </div>
        )}

        </>)}

        {activeTab === 'todos' && (
          <div style={{ padding: '0 0 96px' }}>
            <MedicationListTab
              medications={medications}
              stockByMedId={stockByMedId}
              isAdmin={isAdmin}
              isCuidador={memberRole === 'cuidador'}
              onEditMed={openEdit}
              onDeleteMed={handleDelete}
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
              ownerId={ownerId}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          </div>
        )}

      </div>

      {/* ── Confirm delete dialog ─────────────────────────────────────────── */}
      {confirmDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }} onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null) }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar este medicamento?</p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

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
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div style={{ width: '100%', maxHeight: '94vh', background: 'white', borderRadius: '24px 24px 0 0', padding: '24px 20px 96px', overflowY: 'auto', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)' }}>

            {/* Sheet header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                {addStep === 'method'       ? 'Agregar medicamento'
                  : addStep === 'ai-processing' ? 'Analizando imagen…'
                  : addStep === 'ai-confirm'    ? 'Verificar datos'
                  : editId                      ? 'Editar medicamento'
                  : 'Nuevo medicamento'}
              </h3>
              <button onClick={closeForm} style={{ padding: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
                <XIcon size={20} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>

            {/* ── STEP: method selection ─────────────────────────────────── */}
            {addStep === 'method' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 4px', lineHeight: 1.5 }}>
                  ¿Cómo quieres cargar la información del medicamento?
                </p>
                {[
                  { icon: '📷', title: 'Foto de la caja', desc: 'La IA lee nombre, dosis, cantidad y vencimiento', action: () => { setAddPhotoType('box'); photoInputRef.current?.click(); setAddStep('photo-box') } },
                  { icon: '📄', title: 'Foto de la receta', desc: 'La IA extrae el medicamento indicado por el médico', action: () => { setAddPhotoType('prescription'); photoInputRef.current?.click(); setAddStep('photo-rx') } },
                  { icon: '✍️', title: 'Ingresar manualmente', desc: 'Llena los campos tú mismo', action: () => setAddStep('form') },
                ].map(opt => (
                  <button
                    key={opt.title}
                    onClick={opt.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '16px', borderRadius: 16, border: '1.5px solid #EDE5D8',
                      background: 'white', cursor: 'pointer', textAlign: 'left',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EBF3EE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                      {opt.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{opt.title}</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0', lineHeight: 1.4 }}>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── STEP: AI processing spinner ────────────────────────────── */}
            {addStep === 'ai-processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #EDE5D8', borderTopColor: '#0d6b63', animation: 'spin 0.9s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Analizando con IA…</p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: '6px 0 0' }}>Extrayendo información del medicamento</p>
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
                    <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 14px' }}>
                      <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>⚠️ {addAiError}</p>
                    </div>
                  ) : addAiExtracted ? (
                    <>
                      {/* Warnings from AI */}
                      {warnings.length > 0 && (
                        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {warnings.map((w, i) => (
                            <p key={i} style={{ fontSize: 12, color: '#C2410C', margin: 0 }}>⚠️ {w}</p>
                          ))}
                        </div>
                      )}

                      {/* Always: review notice */}
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 16 }}>👁️</span>
                        <p style={{ fontSize: 12, color: '#92400E', fontWeight: 600, margin: 0 }}>
                          Revisa los datos antes de continuar — la IA puede cometer errores
                        </p>
                      </div>

                      {isMulti ? (
                        /* ── Multiple meds: checkbox selection ────────── */
                        <>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
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
                                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                                    border: checked ? '1.5px solid #0d6b63' : '1px solid #EDE5D8',
                                    background: checked ? '#F0FDF4' : 'white',
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
                                    style={{ marginTop: 3, accentColor: '#0d6b63', width: 16, height: 16, flexShrink: 0 }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                                      💊 {med.name?.value ?? '(sin nombre)'}
                                      {hasLowConf && <span style={{ marginLeft: 6, fontSize: 11, color: '#D97706', fontWeight: 600 }}>⚠️ revisar</span>}
                                    </p>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                                      {med.strength?.value && (
                                        <span style={{ fontSize: 11, background: '#EBF3EE', color: '#0d6b63', padding: '1px 7px', borderRadius: 6 }}>{med.strength.value}</span>
                                      )}
                                      {med.form?.value && (
                                        <span style={{ fontSize: 11, background: '#F3F4F6', color: '#6B7280', padding: '1px 7px', borderRadius: 6 }}>{FORM_MAP[med.form.value] ?? med.form.value}</span>
                                      )}
                                      {med.frequency?.value && (
                                        <span style={{ fontSize: 11, background: '#F3F4F6', color: '#6B7280', padding: '1px 7px', borderRadius: 6 }}>
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
                              padding: '13px', borderRadius: 14, border: 'none',
                              background: selectedMedIndices.size === 0 ? '#C0CCC5' : 'linear-gradient(135deg, #0d6b63, #3A6347)',
                              color: 'white', fontWeight: 700, fontSize: 14,
                              cursor: selectedMedIndices.size === 0 ? 'not-allowed' : 'pointer',
                              boxShadow: selectedMedIndices.size === 0 ? 'none' : '0 6px 20px rgba(13,107,99,0.3)',
                            }}
                          >
                            Agregar {selectedMedIndices.size} medicamento{selectedMedIndices.size !== 1 ? 's' : ''} →
                          </button>
                        </>
                      ) : (
                        /* ── Single med: editable fields with confidence ─ */
                        meds.length === 1 && (
                          <div style={{ background: '#F0F9F4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '16px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                              ✅ La IA encontró lo siguiente
                            </p>
                            {fields.map(f => {
                              const fieldData  = meds[0][f.key]
                              const value      = fieldData?.value ?? ''
                              const confidence = fieldData?.confidence
                              const lowConf    = confidence != null && confidence < 0.7
                              return (
                                <div key={f.key} style={{ marginBottom: 10 }}>
                                  <label style={{ ...labelStyle, color: lowConf ? '#D97706' : '#0d6b63' }}>
                                    {lowConf ? '⚠️ ' : ''}{f.label}
                                    {confidence != null && (
                                      <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
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
                                      borderColor: lowConf ? '#FDE68A' : '#BBF7D0',
                                      background:  lowConf ? '#FFFBEB' : 'white',
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
                      style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                    >
                      Volver
                    </button>
                    {(!isMulti || !addAiExtracted) && (
                      <button
                        onClick={applyAiAndContinue}
                        style={{ flex: 2, padding: '13px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #0d6b63, #3A6347)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 20px rgba(13,107,99,0.3)' }}
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
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 12 }}>▼</span>
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
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 12 }}>▼</span>
                  </div>
                </div>

                {showTimePickers && (
                  <div>
                    <label style={labelStyle}>{isInterval ? 'Hora de inicio' : scheduledTimes.length > 1 ? 'Horarios' : 'Hora'}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {scheduledTimes.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {scheduledTimes.length > 1 && <span style={{ fontSize: 12, color: '#9CA3AF', width: 18, flexShrink: 0 }}>{i + 1}.</span>}
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
                <div style={{ borderTop: '1px solid #F8F4ED', paddingTop: 20 }}>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
                    📦 Stock y Renovación
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 16px' }}>
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
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
                      Se mostrará alerta 🔴 cuando queden menos de estas dosis
                    </p>
                  </div>
                </div>

                {saveError && (
                  <p style={{ color: '#B91C1C', fontSize: 13, margin: '0', textAlign: 'center', padding: '8px', background: '#FEF2F2', borderRadius: 10 }}>
                    {saveError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={closeForm} style={{ flex: 1, padding: '13px', border: '1.5px solid #EDE5D8', borderRadius: 14, background: 'white', color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
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
          style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget && !adminSaving) { setAdminModal(null); setAdminPhotoBlob(null); setAdminPhotoPreview(null) } }}
        >
          <div style={{ width: '100%', maxHeight: '90vh', background: 'white', borderRadius: '24px 24px 0 0', padding: '24px 20px 80px', overflowY: 'auto', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)' }}>
            <input ref={adminCameraRef}  type="file" accept="image/*" capture="environment" onChange={handleAdminFileSelect} style={{ display: 'none' }} />
            <input ref={adminGalleryRef} type="file" accept="image/*"                       onChange={handleAdminFileSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>💊 {adminModal.name}</p>
                {adminModal.dosage && <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>{adminModal.dosage}</p>}
              </div>
              <button onClick={() => { if (!adminSaving) { setAdminModal(null); setAdminPhotoBlob(null); setAdminPhotoPreview(null) } }} style={{ padding: 8, borderRadius: 10, background: '#F3F4F6', border: 'none', cursor: 'pointer' }}>
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            <div style={{ background: '#F9F5F1', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 20 }}>
              <div>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Programado</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '2px 0 0' }}>{firstTimeMed(adminModal) ?? '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Hora actual</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0d6b63', margin: '2px 0 0' }}>{new Date().toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>📷 Foto de evidencia (opcional)</p>
            <div style={{ border: '2px dashed #EDE5D8', borderRadius: 14, overflow: 'hidden', marginBottom: 12, background: '#FDFAF7' }}>
              {adminPhotoPreview ? (
                <>
                  <img src={adminPhotoPreview} alt="Evidencia" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
                  <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
                    <button onClick={adminOpenCamera} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid #0d6b63', background: '#EBF3EE', color: '#0d6b63', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📷 Cambiar</button>
                    <button onClick={() => { setAdminPhotoBlob(null); setAdminPhotoPreview(null) }} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid #EDE5D8', background: 'white', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>Quitar</button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '18px 16px', display: 'flex', gap: 8 }}>
                  <button onClick={adminOpenCamera} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #0d6b63', background: '#EBF3EE', color: '#0d6b63', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📷 Tomar foto</button>
                  <button onClick={adminOpenGallery} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #C0CCC5', background: '#FDFAF7', color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖼 Galería</button>
                </div>
              )}
            </div>

            {adminError && <div style={{ background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}><p style={{ fontSize: 12, color: '#D63031', margin: 0 }}>⚠️ {adminError}</p></div>}

            <button
              onClick={handleAdministrar}
              disabled={adminSaving}
              style={{ width: '100%', padding: '16px', borderRadius: 999, border: 'none', background: adminSaving ? '#C0CCC5' : '#E9826E', color: 'white', fontWeight: 800, fontSize: 16, cursor: adminSaving ? 'not-allowed' : 'pointer', boxShadow: adminSaving ? 'none' : '0 6px 20px rgba(233,130,110,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {adminSaving
                ? <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} /> Guardando...</>
                : '✅ Confirmar administración'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Omisión ─────────────────────────────────────────────────── */}
      {omisionModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget && !omisionSaving) { setOmisionModal(null); setOmisionReason('') } }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 380, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>Registrar omisión</p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>💊 {omisionModal.name}</p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Motivo *</label>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <select
                value={omisionReason}
                onChange={e => setOmisionReason(e.target.value)}
                style={{ width: '100%', padding: '11px 32px 11px 14px', borderRadius: 12, border: `1.5px solid ${omisionReason ? '#0d6b63' : '#EDE5D8'}`, background: '#FDFAF7', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="">Seleccionar motivo...</option>
                <option value="Paciente rechazó el medicamento">Paciente rechazó el medicamento</option>
                <option value="No había medicamento disponible">No había medicamento disponible</option>
                <option value="Indicación médica">Indicación médica</option>
                <option value="Olvido del cuidador">Olvido del cuidador</option>
                <option value="Otro">Otro</option>
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 12 }}>▼</span>
            </div>
            {omisionError && <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 12px' }}>⚠️ {omisionError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setOmisionModal(null); setOmisionReason('') }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleOmitir} disabled={!omisionReason || omisionSaving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: !omisionReason || omisionSaving ? '#C0CCC5' : '#DC2626', color: 'white', fontWeight: 700, fontSize: 14, cursor: !omisionReason || omisionSaving ? 'not-allowed' : 'pointer' }}>
                {omisionSaving ? 'Guardando...' : 'Registrar omisión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: '#1A1A1A', color: 'white', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
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

    </Layout>
  )
}
