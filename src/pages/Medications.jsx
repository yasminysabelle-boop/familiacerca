import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Plus, XIcon, Pencil, Trash, Bell, CheckIcon } from '../components/Icons'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { track } from '../lib/analytics'
import MedicationStockTab from '../components/MedicationStockTab'

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

const CLAUDE_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`
const AI_MODEL     = 'claude-sonnet-4-6'

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

const emptyForm  = { name: '', dosage: '', frequency: '', notes: '' }
const emptyStock = { totalPills: '', renewalMethod: '', pharmacyName: '', refillsRemaining: '', lastMailDate: '' }

const fieldStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1.5px solid #EDE5D8', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', appearance: 'none', WebkitAppearance: 'none',
}
const onFocus = e => { e.target.style.borderColor = '#4A7C59'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Medications() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const { canEdit } = useSubscription()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { permission, supported, requestAndSubscribe } = usePushNotifications()

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const isAdmin   = user?.id === ownerId
  const isFamiliar = memberRole === 'familiar'

  function canActOn(med) {
    if (isAdmin) return true
    if (memberRole === 'cuidador' && med.created_by_user_id === user?.id) return true
    return false
  }

  // ── Medication list state ──────────────────────────────────────────────────
  const [medications,  setMedications]  = useState([])
  const [stockByMedId, setStockByMedId] = useState({})
  const [loading,      setLoading]      = useState(true)
  const [stockTabMed,  setStockTabMed]  = useState(null) // open stock sheet

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
    setLoading(true)
    const { data } = await supabase
      .from('medications').select('*').eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    const meds = data ?? []
    setMedications(meds)
    setLoading(false)
    if (meds.length) fetchStockData(meds)
  }

  async function fetchStockData(meds) {
    if (!meds.length) return
    const { data } = await supabase
      .from('medication_stock').select('*').eq('user_id', ownerId)
      .in('medication_id', meds.map(m => m.id))
    const map = {}
    ;(data ?? []).forEach(s => { map[s.medication_id] = s })
    setStockByMedId(map)
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
    setForm(emptyForm); setScheduledTimes(['']); setEditId(null)
    setStockForm(emptyStock); setAddPhotoFile(null); setAddPhotoPreview(null)
    setAddAiExtracted(null); setAddAiError(''); setAddPhotoType(null)
    setSaveError(null)
    setAddStep('method'); setShowForm(true)
  }

  function openEdit(med) {
    setForm({ name: med.name, dosage: med.dosage ?? '', frequency: med.frequency ?? '', notes: med.notes ?? '' })
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
    setEditId(med.id); setAddStep('form')
    setSaveError(null); setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setAddStep(null); setEditId(null)
    setForm(emptyForm); setScheduledTimes(['']); setSaveError(null)
    setStockForm(emptyStock); setEditStockRecord(null); setAddPhotoFile(null); setAddPhotoPreview(null)
    setAddAiExtracted(null); setAddAiError(''); setAddPhotoType(null)
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
      const prompt = type === 'box'
        ? `Analyze this medication box photo. Extract ONLY in JSON:
{"name":"medication name","dosage":"strength+form e.g. 500mg","total_pills":number_or_null,"expiry_date":"MM/YYYY or null","notes":"other info or null"}
Return ONLY valid JSON.`
        : `Analyze this prescription. Extract the main medication in JSON:
{"name":"medication name","dosage":"strength and form","frequency":"one of: once_daily|twice_daily|three_daily|every_8h|every_12h|as_needed|weekly","total_pills":number_or_null,"notes":"doctor instructions or null"}
Return ONLY valid JSON.`

      const res  = await fetch(CLAUDE_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          model: AI_MODEL, max_tokens: 512,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            { type: 'text', text: prompt },
          ]}],
        }),
      })
      if (!res.ok) throw new Error(`Claude API ${res.status}`)
      const data = await res.json()
      const text = data.content?.[0]?.text ?? ''
      const match = text.match(/\{[\s\S]*\}/)
      const parsed = match ? JSON.parse(match[0]) : JSON.parse(text)
      setAddAiExtracted(parsed)
    } catch (err) {
      console.error(err)
      setAddAiError('No se pudo leer la imagen. Puedes corregir manualmente.')
      setAddAiExtracted(null)
    }
    setAddStep('ai-confirm')
  }

  function applyAiAndContinue() {
    if (addAiExtracted) {
      const freq = addAiExtracted.frequency
      setForm(prev => ({
        ...prev,
        name:      addAiExtracted.name      || prev.name,
        dosage:    addAiExtracted.dosage    || prev.dosage,
        frequency: freq                     || prev.frequency,
        notes:     addAiExtracted.notes     || prev.notes,
      }))
      if (freq) handleFrequencyChange(freq)
      if (addAiExtracted.total_pills) {
        setStockForm(prev => ({ ...prev, totalPills: String(addAiExtracted.total_pills) }))
      }
    }
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
      const today = new Date().toISOString().split('T')[0]

      const stockOps = [
        supabase.from('medication_stock').upsert({
          medication_id:  savedId,
          user_id:        ownerId,
          total_pills:    totalPills,
          pills_remaining: pillsRemaining,
          doses_per_day:  dosesPerDay,
          start_date:     editStockRecord?.start_date ?? today,
          estimated_end_date: days > 0 ? end.toISOString().split('T')[0] : null,
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
    closeForm()
    fetchAll()
  }

  async function handleDelete(id) {
    await supabase.from('medications').delete().eq('id', id).eq('user_id', ownerId)
    setMedications(prev => prev.filter(m => m.id !== id))
    setStockByMedId(prev => { const n = { ...prev }; delete n[id]; return n })
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div style={{ padding: '16px 16px 0', maxWidth: 600 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
              Medicamentos
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Registro de medicamentos del familiar</p>
          </div>
          {!isFamiliar && (
            <button
              onClick={openAdd}
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(74,124,89,0.3)',
              }}
            >
              <Plus size={20} color="white" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Push banner */}
        {supported && permission !== 'granted' && permission !== 'denied' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', borderRadius: 14, border: '1px solid #EDE5D8', padding: '12px 14px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#EBF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#4A7C59" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 1 }}>Recordatorios de medicamentos</p>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>Activa las notificaciones para no olvidar ninguna dosis.</p>
            </div>
            <button onClick={requestAndSubscribe} style={{ padding: '7px 14px', borderRadius: 10, background: 'linear-gradient(135deg, #4A7C59, #3A6347)', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              Activar
            </button>
          </div>
        )}

        {/* Medication list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#4A7C59', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : medications.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💊</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>Sin medicamentos</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>Agrega los medicamentos del familiar para mantener un control preciso.</p>
            {!isFamiliar && (
              <button onClick={openAdd} style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #4A7C59, #3A6347)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                + Agregar medicamento
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {medications.map(med => {
              const opt    = FREQ_OPTIONS.find(o => o.value === med.frequency)
              const times  = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
              const stock  = stockByMedId[med.id]
              const days   = stock ? daysFromNow(stock.estimated_end_date) : null
              const stockColor = days == null ? '#9CA3AF'
                : days <= 1 ? '#DC2626' : days <= 3 ? '#D97706' : days <= 7 ? '#C9882A' : '#16A34A'
              const stockBg = days == null ? '#F3F4F6'
                : days <= 1 ? '#FEF2F2' : days <= 3 ? '#FEF3C7' : days <= 7 ? '#FFFBEB' : '#F0FDF4'

              // Stock dot: red ≤3, yellow ≤7, green >7 (null = no stock data → no dot)
              const pills = stock?.pills_remaining ?? null
              const stockDot = pills === null
                ? null
                : pills <= 3 ? '#EF4444'
                : pills <= 7 ? '#EAB308'
                : '#22C55E'

              return (
                <div
                  key={med.id}
                  style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', borderLeft: `4px solid ${stockDot ?? '#4A7C59'}`, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        {stockDot !== null && (
                          <div style={{
                            width: 12, height: 12, borderRadius: '50%',
                            backgroundColor: stockDot, flexShrink: 0,
                          }} />
                        )}
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                          💊 {med.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {med.dosage && <span style={{ fontSize: 12, color: '#6B7280' }}>{med.dosage}</span>}
                        {(opt?.label ?? med.frequency) && (
                          <span style={{ background: '#EBF3EE', color: '#4A7C59', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                            {opt?.label ?? med.frequency}
                          </span>
                        )}
                      </div>
                      {times.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          {times.map((t, i) => (
                            <span key={i} style={{ background: '#F0F8F4', color: '#2D6A4F', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                              ⏰ {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {med.notes && (
                        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.4 }}>{med.notes}</p>
                      )}
                      {/* Stock chip */}
                      <button
                        onClick={() => setStockTabMed(med)}
                        style={{
                          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 20, border: `1px solid ${stockColor}40`,
                          background: stockBg, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>📦</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: stockColor }}>
                          {stock
                            ? days == null ? 'Ver stock' : days <= 0 ? 'Agotado' : `${days} día${days !== 1 ? 's' : ''}`
                            : 'Configurar stock'}
                        </span>
                        {stock && (
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                            · {stock.pills_remaining}/{stock.total_pills} 💊
                          </span>
                        )}
                      </button>
                    </div>

                    {canActOn(med) && (
                      <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                        <button onClick={() => openEdit(med)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #EDE5D8', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar">
                          <Pencil size={14} color="#6B7280" strokeWidth={1.5} />
                        </button>
                        <button onClick={() => setConfirmDialog({ onConfirm: () => handleDelete(med.id) })} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #EDE5D8', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar">
                          <Trash size={14} color="#D63031" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
                <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #EDE5D8', borderTopColor: '#4A7C59', animation: 'spin 0.9s linear infinite' }} />
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
            {addStep === 'ai-confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {addPhotoPreview && (
                  <img src={addPhotoPreview} alt="Foto" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 14 }} />
                )}
                {addAiError ? (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>⚠️ {addAiError}</p>
                  </div>
                ) : addAiExtracted ? (
                  <div style={{ background: '#F0F9F4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '16px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                      ✅ La IA encontró lo siguiente
                    </p>
                    {/* Editable extracted fields */}
                    {[
                      { key: 'name',       label: 'Nombre', placeholder: 'Nombre del medicamento' },
                      { key: 'dosage',     label: 'Dosis',  placeholder: 'Ej: 500mg' },
                      { key: 'total_pills',label: 'Cantidad de pastillas', placeholder: 'Número', type: 'number' },
                      { key: 'expiry_date',label: 'Vencimiento',           placeholder: 'MM/YYYY' },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom: 10 }}>
                        <label style={{ ...labelStyle, color: '#4A7C59' }}>{f.label}</label>
                        <input
                          type={f.type ?? 'text'}
                          value={addAiExtracted[f.key] ?? ''}
                          onChange={e => setAddAiExtracted(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ ...fieldStyle, borderColor: '#BBF7D0', background: 'white' }}
                          onFocus={onFocus} onBlur={onBlur}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAddStep('method')} style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Volver
                  </button>
                  <button onClick={applyAiAndContinue} style={{ flex: 2, padding: '13px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #4A7C59, #3A6347)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 20px rgba(74,124,89,0.3)' }}>
                    {addAiExtracted ? 'Continuar →' : 'Ingresar manual →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: Main form ───────────────────────────────────────── */}
            {addStep === 'form' && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Medication fields */}
                <div>
                  <label style={labelStyle}>Nombre del medicamento *</label>
                  <input name="med_name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ej. Metformina" autoComplete="off" style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <div>
                  <label style={labelStyle}>Dosis</label>
                  <input name="dosage" value={form.dosage} onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))} placeholder="ej. 500mg" style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
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
                <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 20 }}>
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

                  {/* Renewal method */}
                  <label style={{ ...labelStyle, marginTop: 16 }}>¿Cómo consigues este medicamento normalmente?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {RENEWAL_METHODS.map(m => {
                      const active = stockForm.renewalMethod === m.value
                      return (
                        <button
                          key={m.value} type="button"
                          onClick={() => setStockForm(p => ({ ...p, renewalMethod: active ? '' : m.value }))}
                          style={{
                            padding: '11px 8px', borderRadius: 12,
                            border: `1.5px solid ${active ? '#4A7C59' : '#EDE5D8'}`,
                            background: active ? '#EBF3EE' : 'white',
                            color: active ? '#2D6A4F' : '#6B7280',
                            fontWeight: 600, fontSize: 13, cursor: 'pointer',
                            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                        >
                          {m.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Pharmacy fields */}
                  {stockForm.renewalMethod === 'pharmacy' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                      <div>
                        <label style={labelStyle}>Nombre de la farmacia</label>
                        <input value={stockForm.pharmacyName} onChange={e => setStockForm(p => ({ ...p, pharmacyName: e.target.value }))} placeholder="Ej: Farmacia del Ahorro, CVS..." style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                      </div>
                      <div>
                        <label style={labelStyle}>¿Cuántos refills quedan?</label>
                        <input type="number" inputMode="numeric" min="0" value={stockForm.refillsRemaining} onChange={e => setStockForm(p => ({ ...p, refillsRemaining: e.target.value }))} placeholder="Ej: 3 (0 = necesita cita)" style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                      </div>
                    </div>
                  )}

                  {/* Mail date */}
                  {stockForm.renewalMethod === 'mail' && (
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Fecha del último envío</label>
                      <input type="date" value={stockForm.lastMailDate} onChange={e => setStockForm(p => ({ ...p, lastMailDate: e.target.value }))} style={fieldStyle} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  )}
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
                  <button
                    type="submit" disabled={saving || !canEdit}
                    onClick={!canEdit ? (e) => { e.preventDefault(); navigate('/pricing') } : undefined}
                    style={{
                      flex: 2, padding: '13px', borderRadius: 14, border: 'none',
                      background: (saving || !canEdit) ? '#C0CCC5' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                      color: 'white', fontWeight: 700, fontSize: 14,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow: saving ? 'none' : '0 6px 20px rgba(74,124,89,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {saving ? (
                      <>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                        Guardando...
                      </>
                    ) : editId ? 'Guardar cambios' : 'Guardar medicamento'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
