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
  const { profile, ownerId } = useFamily()
  const [medications, setMedications] = useState([])
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exportingHistory, setExportingHistory] = useState(false)
  const [historyDone, setHistoryDone] = useState(false)
  const [historyError, setHistoryError] = useState('')

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

  async function exportHistory() {
    setExportingHistory(true)
    setHistoryError('')
    setHistoryDone(false)
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]

      const exportId = ownerId ?? user.id
      const [
        { data: meds },
        { data: histNotes },
        { data: histEvents },
        { data: memories },
      ] = await Promise.all([
        supabase.from('medication_logs')
          .select('*, medications(name, dosage)')
          .eq('user_id', exportId)
          .gte('log_date', fromDate)
          .eq('status', 'confirmed')
          .order('log_date', { ascending: false }),
        supabase.from('notes')
          .select('*')
          .eq('user_id', exportId)
          .gte('created_at', fromDate + 'T00:00:00Z')
          .order('created_at', { ascending: false }),
        supabase.from('events')
          .select('*')
          .eq('user_id', exportId)
          .gte('date', fromDate)
          .order('date', { ascending: false }),
        supabase.from('voice_diary')
          .select('*')
          .eq('user_id', exportId)
          .gte('created_at', fromDate + 'T00:00:00Z')
          .order('created_at', { ascending: false }),
      ])

      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()

      doc.setFillColor(196, 98, 58)
      doc.rect(0, 0, pageW, 32, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18); doc.setFont('helvetica', 'bold')
      doc.text('FamiliaCerca — Historial de Cuidado', 14, 14)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      doc.text(`Últimos 30 días · Generado el ${new Date().toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 24)

      let y = 42
      doc.setTextColor(26, 26, 26)

      function sectionTitle(title, emoji) {
        if (y > 260) { doc.addPage(); y = 20 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.setTextColor(196, 98, 58)
        doc.text(`${emoji}  ${title}`, 14, y)
        doc.setTextColor(26, 26, 26)
        y += 6
      }

      if (meds?.length) {
        sectionTitle('Medicamentos administrados', '💊')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Medicamento', 'Dosis', 'Administrado por']],
          body: meds.map(m => [m.log_date, m.medications?.name ?? '—', m.medications?.dosage ?? '—', m.confirmed_by_name ?? '—']),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [196, 98, 58], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 248, 240] },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (histNotes?.length) {
        if (y > 260) { doc.addPage(); y = 20 }
        sectionTitle('Notas', '📝')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Título', 'Contenido']],
          body: histNotes.map(n => [
            n.created_at?.split('T')[0] ?? '—', n.title ?? '—',
            (n.content ?? '').substring(0, 80) + ((n.content?.length ?? 0) > 80 ? '…' : ''),
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [74, 124, 89], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [235, 243, 238] },
          margin: { left: 14, right: 14 },
          columnStyles: { 2: { cellWidth: 90 } },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (histEvents?.length) {
        if (y > 260) { doc.addPage(); y = 20 }
        sectionTitle('Eventos del calendario', '📅')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Evento', 'Hora']],
          body: histEvents.map(ev => [ev.date, ev.title ?? '—', ev.time ?? '—']),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (memories?.length) {
        if (y > 260) { doc.addPage(); y = 20 }
        sectionTitle('Memorias de voz', '🎙️')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Transcripción']],
          body: memories.map(m => [
            m.created_at?.split('T')[0] ?? '—',
            (m.transcription ?? '').substring(0, 100) + ((m.transcription?.length ?? 0) > 100 ? '…' : ''),
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [124, 92, 191], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 243, 255] },
          margin: { left: 14, right: 14 },
          columnStyles: { 1: { cellWidth: 120 } },
        })
      }

      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8); doc.setTextColor(156, 163, 175)
        doc.text(`FamiliaCerca LLC · Página ${i} de ${totalPages}`, 14, doc.internal.pageSize.getHeight() - 8)
      }

      doc.save(`historial-familiacerca-${today}.pdf`)
      setHistoryDone(true)
    } catch (err) {
      setHistoryError('Error al generar el PDF: ' + (err.message ?? 'Intenta de nuevo.'))
    } finally {
      setExportingHistory(false)
    }
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
        <div className="bg-white rounded-xl border border-green-100 p-6 mb-6">
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

        {/* Historial completo export */}
        <div className="bg-white rounded-xl border border-green-100 p-6">
          <div className="flex gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(196,98,58,0.1)' }}>📋</div>
            <div>
              <h3 className="font-semibold text-gray-900">Exportar historial completo (PDF)</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Últimos 30 días: dosis confirmadas, notas, citas y memorias de voz. Para archivo o segunda opinión médica.
              </p>
            </div>
          </div>
          <button
            onClick={exportHistory}
            disabled={exportingHistory}
            className="w-full py-3.5 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            style={{
              background: exportingHistory ? '#C0CCC5' : 'linear-gradient(135deg, #C4623A, #A04D2A)',
              color: 'white',
              border: 'none',
              cursor: exportingHistory ? 'not-allowed' : 'pointer',
              boxShadow: exportingHistory ? 'none' : '0 4px 16px rgba(196,98,58,0.3)',
            }}
          >
            {exportingHistory
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando PDF...</>
              : <><span>📋</span> Exportar historial PDF</>}
          </button>
          {historyDone && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              ✓ PDF descargado correctamente
            </p>
          )}
          {historyError && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ color: '#D63031', background: '#FFF0F0', border: '1px solid #FFBABA' }}>
              ⚠ {historyError}
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}
