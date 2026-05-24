import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const CONCERN_KEYWORDS = ['dolor', 'caída', 'se cayó', 'fiebre', 'triste', 'deprimido', 'sin apetito', 'no comió', 'confundido', 'desorientado', 'peor', 'mal', 'llora', 'angustia']

export default function Reports() {
  const { user } = useAuth()
  const { profile } = useFamily()
  const [medications, setMedications] = useState([])
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { if (user) fetchData() }, [user])

  async function fetchData() {
    setLoading(true)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sevenDaysAgo  = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [medsR, notesR, eventsR, logsR] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', user.id).order('name'),
      supabase.from('notes').select('*').eq('user_id', user.id).gte('created_at', thirtyDaysAgo.toISOString()).order('created_at', { ascending: false }),
      supabase.from('events').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(15),
      supabase.from('medication_logs').select('*, medications(name)').eq('user_id', user.id).gte('log_date', sevenDaysAgo.toISOString().split('T')[0]).order('log_date', { ascending: false }),
    ])
    setMedications(medsR.data ?? [])
    setNotes(notesR.data ?? [])
    setEvents(eventsR.data ?? [])
    setLogs(logsR.data ?? [])
    setLoading(false)
  }

  // Pattern analysis
  const confirmed7  = logs.filter(l => l.status === 'confirmed').length
  const missed7     = logs.filter(l => l.status === 'missed').length
  const adherence7  = logs.length ? Math.round((confirmed7 / logs.length) * 100) : null
  const concerns    = notes.filter(n =>
    CONCERN_KEYWORDS.some(kw => (n.title + ' ' + n.content).toLowerCase().includes(kw))
  )
  const detectedKws = [...new Set(
    CONCERN_KEYWORDS.filter(kw => notes.some(n => (n.title + ' ' + n.content).toLowerCase().includes(kw)))
  )].slice(0, 5)

  function generatePDF() {
    setGenerating(true)
    const doc = new jsPDF()
    const W = doc.internal.pageSize.getWidth()
    const todayStr = new Date().toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
    let y = 0

    // Header bar
    doc.setFillColor(27, 94, 32)
    doc.rect(0, 0, W, 38, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('FamiliaCerca — Reporte Médico Pre-Cita', 15, 14)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text(`Generado el ${todayStr}`, 15, 22)
    if (profile?.name) doc.text(`Paciente: ${profile.name}${profile.age ? ` · ${profile.age} años` : ''}`, 15, 29)

    y = 48

    // Medical notes from profile
    if (profile?.medical_notes) {
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Notas médicas del perfil', 15, y); y += 6
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(profile.medical_notes, W - 30)
      lines.slice(0, 6).forEach(line => { doc.text(line, 15, y); y += 5 })
      y += 4
    }

    // Medications table
    if (medications.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Medicamentos actuales', 15, y); y += 4
      autoTable(doc, {
        startY: y,
        head: [['Medicamento', 'Dosis', 'Frecuencia', 'Hora']],
        body: medications.map(m => [m.name, m.dosage ?? '—', m.frequency ?? '—', m.time ?? '—']),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [27, 94, 32], fontSize: 8 },
        margin: { left: 15, right: 15 },
      })
      y = doc.lastAutoTable.finalY + 8
    }

    // Adherence summary
    if (logs.length > 0) {
      if (y > 230) { doc.addPage(); y = 20 }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Adherencia a medicamentos (últimos 7 días)', 15, y); y += 6
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text(`${confirmed7} dosis confirmadas · ${missed7} perdidas · Adherencia: ${adherence7}%`, 15, y)
      y += 10
    }

    // Recent notes
    if (notes.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Observaciones recientes (últimos 30 días)', 15, y); y += 4
      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Título', 'Contenido']],
        body: notes.slice(0, 12).map(n => [
          new Date(n.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' }),
          n.title,
          n.content.length > 90 ? n.content.substring(0, 90) + '…' : n.content,
        ]),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [27, 94, 32], fontSize: 8 },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 42 } },
        margin: { left: 15, right: 15 },
      })
      y = doc.lastAutoTable.finalY + 8
    }

    // Appointment history
    if (events.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Historial de citas y eventos', 15, y); y += 4
      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Evento', 'Tipo', 'Hora']],
        body: events.map(e => [
          e.date,
          e.title,
          e.type === 'appointment' ? 'Cita médica' : e.type === 'therapy' ? 'Terapia' : e.type === 'medication' ? 'Medicamento' : 'Otro',
          e.time ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [27, 94, 32], fontSize: 8 },
        margin: { left: 15, right: 15 },
      })
    }

    // Footer
    const pages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFontSize(7.5); doc.setTextColor(150)
      doc.text(`FamiliaCerca · Reporte médico confidencial · Página ${i} de ${pages}`, W / 2, 289, { align: 'center' })
    }

    const fileName = `reporte-${(profile?.name ?? 'familiar').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    setGenerating(false)
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl pb-24">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Reportes y análisis</h2>
          <p className="text-gray-500 mt-1">Bienestar semanal y documentos para el médico</p>
        </div>

        {/* Pattern detection / wellness summary */}
        <div className="bg-white rounded-xl border border-green-100 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-1">Análisis de bienestar — últimos 7 días</h3>
          <p className="text-xs text-gray-400 mb-5">Detección automática de patrones en medicamentos y notas</p>

          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Medication adherence */}
              <div className={`flex gap-3 p-4 rounded-xl ${
                adherence7 === null ? 'bg-gray-50' :
                adherence7 >= 80   ? 'bg-primary-light' :
                adherence7 >= 50   ? 'bg-orange-50' : 'bg-red-50'
              }`}>
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {adherence7 === null ? '📊' : adherence7 >= 80 ? '✅' : adherence7 >= 50 ? '⚠️' : '🚨'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Adherencia a medicamentos</p>
                  {adherence7 === null ? (
                    <p className="text-xs text-gray-500 mt-0.5">Sin datos de confirmación esta semana. Usa el Control de medicamentos para registrar las dosis.</p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {confirmed7} confirmadas · {missed7} perdidas · <strong>{adherence7}%</strong> de adherencia
                      {missed7 >= 3 && <span className="text-red-700 font-semibold"> — Se recomienda informar al médico</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Note patterns */}
              <div className={`flex gap-3 p-4 rounded-xl ${concerns.length > 0 ? 'bg-orange-50' : 'bg-primary-light'}`}>
                <span className="text-xl flex-shrink-0 mt-0.5">{concerns.length > 0 ? '⚠️' : '✅'}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Observaciones en notas</p>
                  {concerns.length === 0 ? (
                    <p className="text-xs text-gray-600 mt-0.5">Sin palabras de alerta detectadas en notas recientes. ¡Todo bien!</p>
                  ) : (
                    <p className="text-xs text-gray-700 mt-0.5">
                      <strong>{concerns.length} nota{concerns.length > 1 ? 's' : ''}</strong> con términos de atención:&nbsp;
                      <span className="italic">{detectedKws.join(', ')}</span>
                      {concerns.length >= 3 && <span className="text-orange-700 font-semibold"> — Considera una consulta médica</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* General activity */}
              <div className="flex gap-3 p-4 rounded-xl bg-gray-50">
                <span className="text-xl flex-shrink-0 mt-0.5">📋</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Resumen de actividad (30 días)</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {medications.length} medicamento{medications.length !== 1 ? 's' : ''} activo{medications.length !== 1 ? 's' : ''} ·&nbsp;
                    {notes.length} nota{notes.length !== 1 ? 's' : ''} registrada{notes.length !== 1 ? 's' : ''} ·&nbsp;
                    {events.length} evento{events.length !== 1 ? 's' : ''} en el calendario
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PDF Report */}
        <div className="bg-white rounded-xl border border-green-100 p-6">
          <div className="flex gap-4 mb-5">
            <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📄</div>
            <div>
              <h3 className="font-semibold text-gray-900">Reporte médico completo (PDF)</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Incluye: perfil del paciente, medicamentos, adherencia, notas de los últimos 30 días e historial de citas. Ideal para llevar al médico.
              </p>
            </div>
          </div>

          {!profile ? (
            <p className="text-sm text-orange-700 bg-orange-50 px-4 py-3 rounded-xl">
              ⚠️ Configura primero el perfil del familiar para incluir su información en el reporte.
            </p>
          ) : loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-5 text-center">
                {[
                  { n: medications.length, label: 'Medicamentos' },
                  { n: notes.length,       label: 'Notas (30d)' },
                  { n: events.length,      label: 'Eventos' },
                  { n: `${adherence7 ?? '—'}${adherence7 != null ? '%' : ''}`, label: 'Adherencia' },
                ].map(({ n, label }) => (
                  <div key={label} className="bg-[#F7F3ED] rounded-xl p-3">
                    <p className="text-xl font-bold text-gray-900">{n}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <button onClick={generatePDF} disabled={generating}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {generating
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando PDF...</>
                  : <><span>📄</span> Descargar reporte PDF</>}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
