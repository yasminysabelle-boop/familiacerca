import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import EmptyState from '../components/EmptyState'
import VoiceInput from '../components/VoiceInput'
import CameraCapture from '../components/CameraCapture'
import { submitAppointmentProof } from '../lib/appointmentProof'

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const emptyForm = { title: '', date: '', time: '', description: '', type: 'appointment', status: 'programada', contact_id: '' }

const EVENT_TYPES = [
  { value: 'appointment', label: 'Cita médica',  color: 'bg-blue-100 text-blue-800' },
  { value: 'medication',  label: 'Medicamento',  color: 'bg-primary-light text-primary' },
  { value: 'therapy',     label: 'Terapia',       color: 'bg-accent-light text-accent' },
  { value: 'other',       label: 'Otro',          color: 'bg-gray-100 text-gray-800' },
]
const typeStyle = t => EVENT_TYPES.find(x => x.value === t)?.color ?? 'bg-gray-100 text-gray-800'
const typeLabel = t => EVENT_TYPES.find(x => x.value === t)?.label ?? t

const STATUS_OPTIONS = [
  { value: 'programada', label: 'Programada', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'realizada',  label: 'Realizada',  color: '#16A34A', bg: '#F0FDF4' },
  { value: 'cancelada',  label: 'Cancelada',  color: '#DC2626', bg: '#FEF2F2' },
]
const statusInfo = s => STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0]

export default function Calendar() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const today    = new Date()

  const isAdmin = user?.id === ownerId
  const isFamiliar = memberRole === 'familiar'

  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [events, setEvents]     = useState([])
  const [medicalContacts, setMedicalContacts] = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [editEvent, setEditEvent]   = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef        = useRef(null)
  const yearListRef      = useRef(null)
  const fetchEventsIdRef = useRef(0)  // stale-request guard

  // Computed on component mount so it's fresh on every page load (not module load)
  const yearRange = useMemo(
    () => Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - 5 + i),
    []
  )

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    function onDown(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showPicker])

  // Scroll selected year into view when picker opens
  useEffect(() => {
    if (!showPicker || !yearListRef.current) return
    const el = yearListRef.current.querySelector(`[data-year="${year}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [showPicker])

  // Attachment state
  const [attachFiles, setAttachFiles]     = useState([])   // {file, preview, name, isImage}
  const [existingUrls, setExistingUrls]   = useState([])   // already-saved URLs
  const [attachError, setAttachError]     = useState('')

  // Appointment proof modal
  const [proofEvent, setProofEvent]       = useState(null)
  const [proofPhoto, setProofPhoto]       = useState(null)
  const [proofPreview, setProofPreview]   = useState(null)
  const [proofNote, setProofNote]         = useState('')
  const [proofSaving, setProofSaving]     = useState(false)
  const [proofUploadError, setProofUploadError] = useState('')
  const [showProofCamera, setShowProofCamera] = useState(false)

  useEffect(() => { if (user && ownerId) fetchEvents() }, [user, ownerId, year, month])

  // Médicos guardados en el directorio, para el selector "¿Con quién es?"
  useEffect(() => {
    if (!ownerId) return
    supabase.from('directory_contacts').select('id, name, specialty')
      .eq('owner_id', ownerId).eq('kind', 'medico').order('name')
      .then(({ data }) => setMedicalContacts(data ?? []))
  }, [ownerId])

  async function fetchEvents() {
    const myId = ++fetchEventsIdRef.current
    setLoadError('')
    try {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const end   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const { data, error } = await supabase
        .from('events').select('*, directory_contacts(name, specialty, phone)').eq('user_id', ownerId)
        .gte('date', start).lte('date', end).order('date')
      if (error) throw error
      if (fetchEventsIdRef.current !== myId) return // family or month changed mid-flight

      setEvents(data ?? [])
    } catch {
      if (fetchEventsIdRef.current !== myId) return
      setLoadError('No se pudieron cargar los eventos. Verifica tu conexión.')
    }
  }

  function canActOn(ev) { return isAdmin || ev.created_by_user_id === user?.id }

  function openEdit(ev) {
    setEditEvent(ev)
    setExistingUrls(ev.attachments ?? [])
    setAttachFiles([])
    setAttachError('')
    setForm({ title: ev.title, date: ev.date, time: ev.time ?? '', description: ev.description ?? '', type: ev.type, status: ev.status ?? 'programada', contact_id: ev.contact_id ?? '' })
    setShowForm(true)
  }

  function resetForm() {
    setForm(emptyForm)
    setAttachFiles([]); setExistingUrls([]); setAttachError('')
  }

  function handleChange(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })) }

  function pickAttachment() {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = 'image/*,application/pdf,.doc,.docx'
    el.multiple = true
    el.addEventListener('change', e => {
      const files = Array.from(e.target.files ?? [])
      const items = files.map(f => ({
        file: f,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        name: f.name,
        isImage: f.type.startsWith('image/'),
      }))
      setAttachFiles(prev => [...prev, ...items])
    }, { once: true })
    el.click()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.date || !form.title.trim()) return
    setSaving(true); setAttachError('')

    // Upload pending attachment files
    const newUrls = []
    for (const af of attachFiles) {
      const safeName = af.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage
        .from('event-attachments').upload(path, af.file, { upsert: true, contentType: af.file.type })
      if (upErr) {
        setAttachError('Algunos archivos no se pudieron subir.')
      } else {
        const { data: { publicUrl } } = supabase.storage.from('event-attachments').getPublicUrl(path)
        newUrls.push(publicUrl)
      }
    }
    const allAttachments = [...existingUrls, ...newUrls]

    const payload = { ...form, time: form.time || null, contact_id: form.contact_id || null, attachments: allAttachments }
    if (editEvent) {
      await supabase.from('events').update(payload).eq('id', editEvent.id)
    } else {
      await supabase.from('events').insert({ ...payload, user_id: ownerId, created_by_user_id: user.id })
    }
    resetForm(); setShowForm(false); setEditEvent(null); setSaving(false)
    fetchEvents()
  }

  async function handleDelete(id) {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(ev => ev.id !== id)); setSelected(null)
  }

  function prevMonth() { month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1) }
  function nextMonth() { month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1) }

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells       = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  function eventsOnDay(day) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === ds)
  }

  function pickCamera() {
    setShowProofCamera(true)
  }

  function handleProofCapture(blob) {
    setShowProofCamera(false)
    setProofPhoto(blob); setProofPreview(URL.createObjectURL(blob))
  }

  function pickGallery() {
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'
    el.addEventListener('change', e => {
      const f = e.target.files?.[0]; if (!f) return
      setProofPhoto(f); setProofPreview(URL.createObjectURL(f))
    }, { once: true })
    el.click()
  }

  async function submitProof() {
    if (!proofPhoto && !proofNote) return
    setProofSaving(true); setProofUploadError('')

    try {
      await submitAppointmentProof(proofEvent.id, user.id, { file: proofPhoto, notes: proofNote || null })
    } catch (err) {
      // Si falla solo la foto pero hay nota, reintenta sin la foto para no
      // perder la nota — mismo comportamiento que tenía el flujo viejo.
      if (proofPhoto && proofNote) {
        try {
          await submitAppointmentProof(proofEvent.id, user.id, { notes: proofNote })
          setProofUploadError('No se pudo subir la foto. La cita se guardó sin imagen.')
        } catch {
          setProofUploadError('No se pudo guardar. Intenta de nuevo.')
          setProofSaving(false)
          return
        }
      } else {
        console.error('[Calendar] submitProof failed:', err)
        setProofUploadError('No se pudo guardar. Intenta de nuevo.')
        setProofSaving(false)
        return
      }
    }

    setProofEvent(null); setProofPhoto(null); setProofPreview(null); setProofNote('')
    setProofSaving(false); fetchEvents()
  }

  const selectedEvents = selected ? eventsOnDay(selected) : []

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Calendario</h2>
            <p className="text-gray-500 mt-1">Citas médicas y eventos importantes</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditEvent(null); resetForm(); setShowForm(!showForm) }}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors"
            >
              + Agregar evento
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-green-100 p-6 mb-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{editEvent ? 'Editar evento' : 'Nuevo evento'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <VoiceInput
                  value={form.title}
                  onChange={v => setForm(prev => ({ ...prev, title: v }))}
                  placeholder="ej. Cita con el cardiólogo"
                  rows={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input
                  type="date" name="date" required
                  value={form.date} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" name="time" value={form.time} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select name="type" value={form.type} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Con quién es?</label>
                <select name="contact_id" value={form.contact_id} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Otro / sin especificar</option>
                  {medicalContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.specialty ? ` — ${c.specialty}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <VoiceInput
                  value={form.description}
                  onChange={v => setForm(prev => ({ ...prev, description: v }))}
                  placeholder="Notas adicionales"
                  rows={1}
                />
              </div>

              {/* Status pills */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, status: opt.value }))}
                      style={{
                        padding: '6px 16px', borderRadius: 20,
                        border: `1.5px solid ${form.status === opt.value ? opt.color : '#E5E7EB'}`,
                        background: form.status === opt.value ? opt.bg : 'white',
                        color: form.status === opt.value ? opt.color : '#6B7280',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document attachments */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Documentos adjuntos</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {existingUrls.map((url, i) => {
                    const isImg = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
                    return (
                      <div key={url} style={{ position: 'relative' }}>
                        {isImg ? (
                          <img src={url} alt="adjunto" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #EDE5D8' }} />
                        ) : (
                          <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid #EDE5D8', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            <span style={{ fontSize: 22 }}>📄</span>
                            <span style={{ fontSize: 9, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 56, textAlign: 'center' }}>
                              {url.split('/').pop()?.slice(0, 10)}
                            </span>
                          </div>
                        )}
                        <button type="button" onClick={() => setExistingUrls(prev => prev.filter((_, j) => j !== i))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#DC2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ✕
                        </button>
                      </div>
                    )
                  })}
                  {attachFiles.map((af, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      {af.isImage ? (
                        <img src={af.preview} alt={af.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #EDE5D8' }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid #EDE5D8', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <span style={{ fontSize: 22 }}>📄</span>
                          <span style={{ fontSize: 9, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 56, textAlign: 'center' }}>
                            {af.name.slice(0, 10)}
                          </span>
                        </div>
                      )}
                      <button type="button" onClick={() => setAttachFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#DC2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={pickAttachment}
                    style={{ width: 64, height: 64, borderRadius: 8, border: '2px dashed #D1D5DB', background: '#F9FAFB', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 11, gap: 2 }}>
                    <span style={{ fontSize: 20 }}>📎</span>
                    Adjuntar
                  </button>
                </div>
                {attachError && <p className="text-xs text-orange-600 mt-1">⚠ {attachError}</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Guardando...' : editEvent ? 'Guardar cambios' : 'Guardar'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditEvent(null); resetForm() }}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-green-100 p-5">
            <div className="flex items-center justify-between mb-4" style={{ position: 'relative' }}>
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">←</button>

              {/* Clickable month+year — opens grid+year picker */}
              <button
                onClick={() => setShowPicker(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: showPicker ? '#F3F4F6' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  padding: '5px 12px', borderRadius: 10,
                  fontWeight: 700, fontSize: 15, color: '#1A1A1A',
                  transition: 'background 0.15s',
                }}
              >
                {MONTHS[month]} {year}
                <span style={{
                  fontSize: 9, color: '#9CA3AF',
                  display: 'inline-block',
                  transform: showPicker ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}>▼</span>
              </button>

              {showPicker && (
                <div
                  ref={pickerRef}
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 50,
                    background: 'white', borderRadius: 16,
                    border: '1px solid #EDE5D8',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    padding: 14, width: 272,
                  }}
                >
                  {/* Month grid 3×4 */}
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 2px' }}>
                    Mes
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 14 }}>
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        onClick={() => { setMonth(i); setShowPicker(false) }}
                        style={{
                          padding: '7px 4px', borderRadius: 8, border: 'none',
                          background: i === month ? '#087F70' : 'transparent',
                          color: i === month ? 'white' : '#374151',
                          fontWeight: i === month ? 700 : 400,
                          fontSize: 12, cursor: 'pointer',
                          transition: 'background 0.12s',
                        }}
                      >
                        {m.slice(0, 3)}
                      </button>
                    ))}
                  </div>

                  <div style={{ height: 1, background: '#F3F4F6', margin: '0 0 12px' }} />

                  {/* Year list scrollable */}
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 2px' }}>
                    Año
                  </p>
                  <div
                    ref={yearListRef}
                    style={{ maxHeight: 150, overflowY: 'auto', scrollbarWidth: 'thin' }}
                  >
                    {yearRange.map(y => (
                      <button
                        key={y}
                        data-year={y}
                        onClick={() => { setYear(y); setShowPicker(false) }}
                        style={{
                          display: 'block', width: '100%',
                          padding: '7px 12px', border: 'none',
                          background: y === year ? '#E8F6F3' : 'transparent',
                          color: y === year ? '#087F70' : '#374151',
                          fontWeight: y === year ? 700 : 400,
                          fontSize: 13, textAlign: 'center',
                          cursor: 'pointer', borderRadius: 8,
                          transition: 'background 0.12s',
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">→</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dayEvents = eventsOnDay(day)
                const isToday    = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const isSelected = day === selected
                return (
                  <button key={i} onClick={() => setSelected(day === selected ? null : day)}
                    className={`relative p-1.5 rounded-lg text-sm text-center transition-colors min-h-[2.5rem] flex flex-col items-center
                      ${isSelected ? 'bg-primary text-white' : isToday ? 'bg-primary-light text-primary font-bold' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {day}
                    {dayEvents.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-accent'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Events panel */}
          <div className="bg-white rounded-xl border border-green-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              {selected ? `${selected} de ${MONTHS[month]}` : 'Próximos eventos'}
            </h3>
            {loadError ? (
              <div className="text-center py-6">
                <p className="text-sm text-red-600 mb-3">{loadError}</p>
                <button onClick={fetchEvents} className="text-sm font-semibold text-primary underline">Reintentar</button>
              </div>
            ) : (selected ? selectedEvents : events.slice(0, 5)).length === 0 ? (
              <EmptyState
                icon="📅"
                title="Sin citas programadas"
                description="Agrega una cita médica para hacer seguimiento."
                actionLabel={isAdmin ? '+ Agregar cita' : undefined}
                onAction={isAdmin ? () => { setEditEvent(null); resetForm(); setShowForm(true) } : undefined}
              />
            ) : (
              <ul className="space-y-4">
                {(selected ? selectedEvents : events.slice(0, 5)).map(ev => {
                  const si = statusInfo(ev.status ?? 'programada')
                  const evAttachments = ev.attachments ?? []
                  return (
                    <li key={ev.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${typeStyle(ev.type)}`}>
                              {typeLabel(ev.type)}
                            </span>
                            <span style={{
                              display: 'inline-block', fontSize: 11, padding: '2px 8px',
                              borderRadius: 12, fontWeight: 600,
                              background: si.bg, color: si.color,
                            }}>
                              {si.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{ev.title}</p>
                          {ev.time && <p className="text-xs text-gray-400 mt-0.5">⏰ {ev.time}</p>}
                          {ev.directory_contacts?.name && (
                            <p className="text-xs text-gray-400">👨‍⚕️ {ev.directory_contacts.name}{ev.directory_contacts.specialty ? ` — ${ev.directory_contacts.specialty}` : ''}</p>
                          )}
                          {ev.description && <p className="text-xs text-gray-400">{ev.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isAdmin && (
                            <button onClick={() => openEdit(ev)}
                              className="text-gray-300 hover:text-gray-600 transition-colors text-xs p-0.5" title="Editar">✏️</button>
                          )}
                          {canActOn(ev) && (
                            <button onClick={() => setConfirmDialog({ onConfirm: () => handleDelete(ev.id) })}
                              className="text-gray-200 hover:text-red-500 transition-colors text-xs p-0.5" title="Eliminar">✕</button>
                          )}
                        </div>
                      </div>

                      {/* Attachment thumbnails */}
                      {evAttachments.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {evAttachments.map((url, i) => {
                            const isImg = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
                            return isImg ? (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="adjunto" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #EDE5D8' }} />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noreferrer"
                                style={{ width: 40, height: 40, borderRadius: 6, border: '1px solid #EDE5D8', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                                <span style={{ fontSize: 18 }}>📄</span>
                              </a>
                            )
                          })}
                        </div>
                      )}

                      {/* Proof section */}
                      {ev.attended ? (
                        <div className="flex items-center gap-2 mt-2">
                          {ev.proof_photo_url && (
                            <img src={ev.proof_photo_url} alt="Comprobante" className="w-12 h-12 rounded-lg object-cover border border-green-200" />
                          )}
                          <div>
                            <p className="text-xs text-primary font-semibold">✓ Asistencia confirmada</p>
                            {ev.proof_notes && <p className="text-xs text-gray-400">{ev.proof_notes}</p>}
                          </div>
                        </div>
                      ) : !isFamiliar ? (
                        <button onClick={() => { setProofEvent(ev); setProofPhoto(null); setProofPreview(null); setProofNote('') }}
                          className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors rounded-xl px-3 py-2.5 w-full mt-1 shadow-sm">
                          📎 Adjuntar comprobante
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.52)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: '28px 24px',
            maxWidth: 340, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 10 }}>
              ¿Eliminar este registro?
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment proof modal */}
      {proofEvent && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 p-4 pb-24">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-0.5">Prueba de asistencia</h3>
            <p className="text-sm text-gray-500 mb-4">{proofEvent.title}</p>

            <div className="w-full mb-3 border-2 border-dashed border-green-200 rounded-xl overflow-hidden">
              {proofPreview ? (
                <div>
                  <img src={proofPreview} className="w-full h-40 object-cover" alt="Prueba" />
                  <div className="flex gap-2 px-3 py-2.5">
                    <button type="button" onClick={pickCamera}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg border border-primary text-primary bg-green-50 hover:bg-green-100 transition-colors">
                      📷 Tomar foto
                    </button>
                    <button type="button" onClick={pickGallery}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors">
                      🖼 Elegir de galería
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-5 px-4">
                  <span className="text-3xl">📷</span>
                  <p className="text-xs text-gray-400 text-center">Foto de la cita (sala de espera, receta...)</p>
                  <div className="flex gap-2 w-full">
                    <button type="button" onClick={pickCamera}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-primary text-primary bg-green-50 hover:bg-green-100 transition-colors">
                      📷 Tomar foto
                    </button>
                    <button type="button" onClick={pickGallery}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors">
                      🖼 Elegir de galería
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4">
              <VoiceInput
                value={proofNote}
                onChange={setProofNote}
                placeholder="Notas de la cita (diagnóstico, instrucciones...)..."
                rows={2}
              />
            </div>

            {proofUploadError && (
              <p className="text-xs text-orange-600 mb-3 px-1">⚠ {proofUploadError}</p>
            )}
            <div className="flex gap-3">
              <button onClick={submitProof} disabled={proofSaving || (!proofPhoto && !proofNote)}
                className="flex-1 py-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
                {proofSaving ? 'Guardando...' : '✓ Confirmar asistencia'}
              </button>
              <button onClick={() => setProofEvent(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showProofCamera && (
        <CameraCapture
          guidance="📋 Encuadra el comprobante de la cita"
          onCapture={handleProofCapture}
          onCancel={() => setShowProofCamera(false)}
          onManualFallback={() => { setShowProofCamera(false); pickGallery() }}
          deniedTitle="No pudimos abrir la cámara"
          deniedDescription="Necesitamos permiso de cámara para tomar la foto. Puedes elegir una desde tu galería."
          deniedButtonLabel="Elegir de galería"
        />
      )}

    </Layout>
  )
}
