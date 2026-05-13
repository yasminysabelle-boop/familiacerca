import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const emptyForm = { title: '', date: '', time: '', description: '', type: 'appointment' }
const EVENT_TYPES = [
  { value: 'appointment', label: 'Cita médica',  color: 'bg-blue-100 text-blue-800' },
  { value: 'medication',  label: 'Medicamento',  color: 'bg-primary-light text-primary' },
  { value: 'therapy',     label: 'Terapia',       color: 'bg-accent-light text-accent' },
  { value: 'other',       label: 'Otro',          color: 'bg-gray-100 text-gray-800' },
]
const typeStyle = t => EVENT_TYPES.find(x => x.value === t)?.color ?? 'bg-gray-100 text-gray-800'
const typeLabel = t => EVENT_TYPES.find(x => x.value === t)?.label ?? t

export default function Calendar() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const fileRef  = useRef(null)
  const today    = new Date()

  const [year, setYear]       = useState(today.getFullYear())
  const [month, setMonth]     = useState(today.getMonth())
  const [events, setEvents]   = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(emptyForm)
  const [saving, setSaving]   = useState(false)

  // Appointment proof modal state
  const [proofEvent, setProofEvent]   = useState(null)
  const [proofPhoto, setProofPhoto]   = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [proofNote, setProofNote]     = useState('')
  const [proofSaving, setProofSaving] = useState(false)
  const [proofs, setProofs]           = useState({}) // eventId -> proof

  useEffect(() => { if (user && ownerId) fetchEvents() }, [user, ownerId, year, month])

  async function fetchEvents() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end   = `${year}-${String(month + 1).padStart(2, '0')}-31`
    const { data } = await supabase
      .from('events').select('*').eq('user_id', ownerId)
      .gte('date', start).lte('date', end).order('date')
    setEvents(data ?? [])

    // Fetch proofs for visible events
    if (data?.length) {
      const ids = data.map(e => e.id)
      const { data: ps } = await supabase
        .from('appointment_proofs').select('*').in('event_id', ids)
      const map = {}; ps?.forEach(p => { map[p.event_id] = p })
      setProofs(map)
    }
  }

  function handleChange(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('events').insert({ ...form, time: form.time || null, user_id: ownerId })
    setForm(emptyForm); setShowForm(false); setSaving(false); fetchEvents()
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

  function handleProofPhoto(e) {
    const f = e.target.files?.[0]; if (!f) return
    setProofPhoto(f); setProofPreview(URL.createObjectURL(f))
  }

  async function submitProof() {
    if (!proofPhoto && !proofNote) return
    setProofSaving(true)

    let photo_url = null
    if (proofPhoto) {
      const ext  = proofPhoto.name.split('.').pop()
      const path = `${user.id}/${proofEvent.id}.${ext}`
      await supabase.storage.from('appointment-proofs').upload(path, proofPhoto, { upsert: true, contentType: proofPhoto.type })
      const { data: { publicUrl } } = supabase.storage.from('appointment-proofs').getPublicUrl(path)
      photo_url = publicUrl
    }

    await supabase.from('appointment_proofs').upsert({
      event_id: proofEvent.id,
      user_id: user.id, // proof uploader stays as the actual user (not owner)
      photo_url,
      notes: proofNote || null,
      attended: true,
    }, { onConflict: 'event_id,user_id' })

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
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors">
            + Agregar evento
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-green-100 p-6 mb-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Nuevo evento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input name="title" required value={form.title} onChange={handleChange}
                  placeholder="ej. Cita con el cardiólogo"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input type="date" name="date" required value={form.date} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input name="description" value={form.description} onChange={handleChange}
                  placeholder="Notas adicionales"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-green-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">←</button>
              <h3 className="font-semibold text-gray-900">{MONTHS[month]} {year}</h3>
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
            {(selected ? selectedEvents : events.slice(0, 5)).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin eventos</p>
            ) : (
              <ul className="space-y-4">
                {(selected ? selectedEvents : events.slice(0, 5)).map(ev => {
                  const proof = proofs[ev.id]
                  return (
                    <li key={ev.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-1 ${typeStyle(ev.type)}`}>
                            {typeLabel(ev.type)}
                          </span>
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{ev.title}</p>
                          {ev.time && <p className="text-xs text-gray-400 mt-0.5">⏰ {ev.time}</p>}
                          {ev.description && <p className="text-xs text-gray-400">{ev.description}</p>}
                        </div>
                        <button onClick={() => handleDelete(ev.id)}
                          className="text-gray-200 hover:text-red-500 transition-colors flex-shrink-0 text-xs p-0.5">✕</button>
                      </div>

                      {/* Proof section */}
                      {proof ? (
                        <div className="flex items-center gap-2 mt-2">
                          {proof.photo_url && (
                            <img src={proof.photo_url} alt="Prueba" className="w-12 h-12 rounded-lg object-cover border border-green-200" />
                          )}
                          <div>
                            <p className="text-xs text-primary font-semibold">✓ Asistencia confirmada</p>
                            {proof.notes && <p className="text-xs text-gray-400">{proof.notes}</p>}
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setProofEvent(ev); setProofPhoto(null); setProofPreview(null); setProofNote('') }}
                          className="text-xs text-gray-400 hover:text-primary transition-colors border border-dashed border-gray-200 hover:border-primary rounded-lg px-2 py-1 w-full text-center mt-1">
                          📷 Marcar como asistido con foto
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Appointment proof modal */}
      {proofEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-0.5">Prueba de asistencia</h3>
            <p className="text-sm text-gray-500 mb-4">{proofEvent.title}</p>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofPhoto} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full mb-3 border-2 border-dashed border-green-200 rounded-xl overflow-hidden hover:border-primary transition-colors">
              {proofPreview ? (
                <img src={proofPreview} className="w-full h-40 object-cover" alt="Prueba" />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <span className="text-3xl">📷</span>
                  <p className="text-sm font-medium">Foto de la cita (sala de espera, receta...)</p>
                </div>
              )}
            </button>

            <textarea value={proofNote} onChange={e => setProofNote(e.target.value)} rows={2}
              placeholder="Notas de la cita (diagnóstico, instrucciones...)..."
              className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />

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

      {/* Hidden file input for proof */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofPhoto} />
    </Layout>
  )
}
