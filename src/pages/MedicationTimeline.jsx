import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function isOverdue(time, status) {
  if (!time || status === 'confirmed' || status === 'missed') return false
  const [h, m] = time.split(':').map(Number)
  const scheduled = new Date()
  scheduled.setHours(h, m, 0, 0)
  return Date.now() > scheduled.getTime() + 30 * 60 * 1000
}

function StatusBadge({ status, overdue }) {
  if (status === 'confirmed') return <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">✓ Confirmado</span>
  if (status === 'missed')    return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">✗ Perdido</span>
  if (overdue)                return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">⚠ Retrasado +30 min</span>
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
}

async function stampImage(file, confirmerName) {
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
      const dateStr = now.toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
      const timeStr = now.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const stamp = `${dateStr} · ${timeStr} · Confirmado por: ${confirmerName} · FamiliaCerca ✓`
      const fs = Math.max(11, Math.round(img.naturalWidth * 0.022))
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${fs}px Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(stamp, img.naturalWidth / 2, img.naturalHeight - barH / 2, img.naturalWidth - 16)

      URL.revokeObjectURL(objUrl)
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.92)
    }
    img.src = objUrl
  })
}

export default function MedicationTimeline() {
  const { user } = useAuth()
  const fileRef = useRef(null)
  const [medications, setMedications] = useState([])
  const [todayLogs, setTodayLogs] = useState({})
  const [history, setHistory] = useState([])
  const [confirming, setConfirming] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [stamping, setStamping] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')
  const [saving, setSaving] = useState(false)
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Familiar'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (user) { fetchToday(); fetchHistory() }
  }, [user])

  async function fetchToday() {
    const [{ data: meds }, { data: logs }] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', user.id).order('time'),
      supabase.from('medication_logs').select('*').eq('user_id', user.id).eq('log_date', today),
    ])
    setMedications(meds ?? [])
    const map = {}
    logs?.forEach(l => { map[l.medication_id] = l })
    setTodayLogs(map)
  }

  async function fetchHistory() {
    const since = new Date(); since.setDate(since.getDate() - 6)
    const { data } = await supabase
      .from('medication_logs')
      .select('*, medications(name)')
      .eq('user_id', user.id)
      .gte('log_date', since.toISOString().split('T')[0])
      .order('log_date', { ascending: false })
    setHistory(data ?? [])
  }

  function openConfirm(med) {
    setConfirming(med); setPhotoFile(null); setPhotoPreview(null); setConfirmNote(''); setStamping(false)
  }

  async function handlePhotoChange(e) {
    const f = e.target.files?.[0]; if (!f) return
    setStamping(true)
    const stamped = await stampImage(f, displayName)
    setPhotoFile(stamped)
    setPhotoPreview(URL.createObjectURL(stamped))
    setStamping(false)
  }

  async function submitConfirm() {
    if (!photoFile) { alert('Se requiere una foto como prueba de confirmación'); return }
    setSaving(true)
    const path = `${user.id}/${today}/${confirming.id}.jpg`
    await supabase.storage.from('confirmations').upload(path, photoFile, { upsert: true, contentType: 'image/jpeg' })
    const { data: { publicUrl } } = supabase.storage.from('confirmations').getPublicUrl(path)

    await supabase.from('medication_logs').upsert({
      medication_id: confirming.id,
      user_id: user.id,
      status: 'confirmed',
      photo_url: publicUrl,
      confirmed_by_name: displayName,
      scheduled_time: confirming.time,
      confirmed_at: new Date().toISOString(),
      notes: confirmNote || null,
      log_date: today,
    }, { onConflict: 'medication_id,log_date,user_id' })

    setConfirming(null); setSaving(false)
    fetchToday(); fetchHistory()
  }

  async function markMissed(med) {
    await supabase.from('medication_logs').upsert({
      medication_id: med.id,
      user_id: user.id,
      status: 'missed',
      log_date: today,
      scheduled_time: med.time,
      confirmed_by_name: displayName,
    }, { onConflict: 'medication_id,log_date,user_id' })
    fetchToday(); fetchHistory()
  }

  const overdueCount = medications.filter(m => isOverdue(m.time, todayLogs[m.id]?.status)).length

  const historyByDate = history.reduce((acc, l) => {
    if (!acc[l.log_date]) acc[l.log_date] = []
    acc[l.log_date].push(l); return acc
  }, {})

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Control de medicamentos</h2>
          <p className="text-gray-500 mt-1">Confirmaciones con foto sellada y línea de tiempo</p>
        </div>

        {overdueCount > 0 && (
          <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl flex gap-3 items-start">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-orange-800 text-sm">
                {overdueCount} medicamento{overdueCount > 1 ? 's' : ''} con más de 30 minutos de retraso
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Confirma la dosis o márcala como perdida para informar a la familia
              </p>
            </div>
          </div>
        )}

        {/* Today */}
        <div className="bg-white rounded-xl border border-green-100 p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Hoy — {new Date().toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>

          {medications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin medicamentos registrados. Agrégalos en la sección Medicamentos.</p>
          ) : (
            <div className="space-y-3">
              {medications.map(med => {
                const log = todayLogs[med.id]
                const overdue = isOverdue(med.time, log?.status)
                return (
                  <div key={med.id} className={`rounded-xl border overflow-hidden transition-colors ${
                    log?.status === 'confirmed' ? 'bg-green-50 border-green-200' :
                    log?.status === 'missed'    ? 'bg-red-50 border-red-200' :
                    overdue                     ? 'bg-orange-50 border-orange-200' :
                                                  'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          log?.status === 'confirmed' ? 'bg-primary text-white' :
                          log?.status === 'missed'    ? 'bg-red-500 text-white' :
                          overdue                     ? 'bg-orange-400 text-white' :
                                                        'bg-gray-300 text-white'
                        }`}>
                          {log?.status === 'confirmed' ? '✓' : log?.status === 'missed' ? '✗' : '💊'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {med.time && <span className="text-xs text-gray-500">⏰ {med.time}</span>}
                            {med.dosage && <span className="text-xs text-gray-500">{med.dosage}</span>}
                            <StatusBadge status={log?.status} overdue={overdue} />
                          </div>
                        </div>
                      </div>
                      {!log && (
                        <div className="flex gap-1.5 flex-shrink-0 ml-3">
                          <button onClick={() => openConfirm(med)}
                            className="px-3 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg transition-colors">
                            📷 Confirmar
                          </button>
                          <button onClick={() => markMissed(med)}
                            className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors">
                            No dada
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sealed proof card */}
                    {log?.status === 'confirmed' && log?.photo_url && (
                      <div className="border-t border-green-200">
                        <img src={log.photo_url} className="w-full" alt="Prueba sellada" />
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50">
                          <span className="text-sm">🔒</span>
                          <span className="text-xs font-semibold text-primary">Prueba sellada · No editable</span>
                          {log.confirmed_by_name && (
                            <span className="text-xs text-gray-400 ml-auto">
                              {log.confirmed_by_name} · {new Date(log.confirmed_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 7-day history */}
        <div className="bg-white rounded-xl border border-green-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-5">Línea de tiempo — últimos 7 días</h3>
          {Object.keys(historyByDate).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin historial todavía.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(historyByDate).map(([date, logs]) => {
                const confirmed = logs.filter(l => l.status === 'confirmed').length
                const missed    = logs.filter(l => l.status === 'missed').length
                const pct = logs.length ? Math.round((confirmed / logs.length) * 100) : 0
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">
                        {new Date(date + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </p>
                      <span className={`text-xs font-semibold ${pct >= 80 ? 'text-primary' : pct >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                        {pct}% · {confirmed}✓ {missed}✗
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {logs.map(log => (
                        <div key={log.id} className="group relative">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold cursor-default transition-transform hover:scale-110 ${
                            log.status === 'confirmed' ? 'bg-primary text-white' :
                            log.status === 'missed'    ? 'bg-red-500 text-white' :
                                                         'bg-gray-200 text-gray-500'
                          }`}>
                            {log.status === 'confirmed' ? '✓' : '✗'}
                          </div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            {log.medications?.name}
                            {log.scheduled_time && ` · ${log.scheduled_time}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h3 className="font-bold text-gray-900 mb-0.5">Confirmar medicamento</h3>
              <p className="text-sm text-gray-500">{confirming.name}{confirming.dosage ? ` · ${confirming.dosage}` : ''}</p>
            </div>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            <button type="button" onClick={() => !stamping && fileRef.current?.click()} disabled={stamping}
              className="w-full border-y border-dashed border-green-200 hover:bg-gray-50 disabled:cursor-default transition-colors">
              {stamping ? (
                <div className="h-36 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium">Aplicando sello de tiempo...</p>
                </div>
              ) : photoPreview ? (
                <div>
                  <img src={photoPreview} className="w-full max-h-52 object-cover" alt="Prueba sellada" />
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50">
                    <span className="text-xs">🔒</span>
                    <span className="text-xs font-semibold text-primary">Sello aplicado · No editable</span>
                  </div>
                </div>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <span className="text-3xl">📷</span>
                  <p className="text-sm font-medium">Toca para tomar foto</p>
                  <p className="text-xs">Solo cámara · Requerida para confirmar</p>
                </div>
              )}
            </button>

            <div className="px-6 pt-4 pb-6">
              <textarea value={confirmNote} onChange={e => setConfirmNote(e.target.value)} rows={2}
                placeholder="Nota opcional (ej. tomó bien, sin problemas...)"
                className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />

              <div className="flex gap-3">
                <button onClick={submitConfirm} disabled={saving || !photoFile || stamping}
                  className="flex-1 py-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
                  {saving ? 'Guardando...' : '✓ Confirmar dosis'}
                </button>
                <button onClick={() => setConfirming(null)}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
