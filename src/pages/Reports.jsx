import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useFamilyPlan } from '../contexts/FamilyPlanContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { fetchPdfReportData, generatePdfReport, SECTIONS } from '../utils/generatePdfReport'

const CONCERN_KEYWORDS = ['dolor', 'caída', 'se cayó', 'fiebre', 'triste', 'deprimido', 'sin apetito', 'no comió', 'confundido', 'desorientado', 'peor', 'mal', 'llora', 'angustia']

// Estas dos constantes gobiernan SOLO el boton de PDF de abajo -- el panel
// "Analisis de bienestar" de mas arriba (deteccion de CONCERN_KEYWORDS, con
// frases como "Considera una consulta medica") es intencionalmente ajeno al
// PDF. Ver generatePdfReport.js: nunca infiere ni evalua, mismo principio
// que rige a Milo.
const PDF_SECTIONS = [
  SECTIONS.COVER, SECTIONS.ADHERENCE, SECTIONS.MEDICATIONS,
  SECTIONS.FAMILY_NOTES, SECTIONS.MEDICAL_DIARY, SECTIONS.PAST_EVENTS,
  SECTIONS.VOICE_MEMORIES,
]
const PDF_WINDOW_DAYS = 30

export default function Reports() {
  const { user } = useAuth()
  const { profile, ownerId } = useFamily()
  // Plan Gratis (después de la prueba): 1 reporte PDF al mes (src/lib/plans.js).
  const { familyCanEdit } = useFamilyPlan()
  const [medications, setMedications] = useState([])
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfDone, setPdfDone] = useState(false)
  const [pdfError, setPdfError] = useState('')

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

  async function handleGeneratePdf() {
    setGeneratingPdf(true)
    setPdfError('')
    setPdfDone(false)
    try {
      const exportId = ownerId ?? user.id
      if (!familyCanEdit) {
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
        const { count } = await supabase.from('activity_log')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', exportId).eq('type', 'pdf_report')
          .gte('created_at', monthStart.toISOString())
        if ((count ?? 0) >= 1) {
          setPdfError('En el plan Gratis puedes generar 1 reporte al mes y ya lo usaste. Con el plan Familiar son ilimitados.')
          return
        }
      }
      const data = await fetchPdfReportData(exportId, { sections: PDF_SECTIONS, windowDays: PDF_WINDOW_DAYS })
      await generatePdfReport(data, { sections: PDF_SECTIONS, windowDays: PDF_WINDOW_DAYS, patientName: profile?.name })
      setPdfDone(true)
      // Se registra para contar el límite mensual del plan Gratis.
      supabase.rpc('log_activity', {
        p_type: 'pdf_report', p_description: 'Generó el reporte para el médico',
        p_owner_id: exportId, p_actor_name: user?.user_metadata?.full_name ?? null,
      }).then(() => {}, () => {})
    } catch (err) {
      setPdfError('Error al generar el PDF: ' + (err.message ?? 'Intenta de nuevo.'))
    } finally {
      setGeneratingPdf(false)
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
          <p className="text-sm text-gray-400 mb-5">Detección automática de patrones en medicamentos y notas</p>

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
                    <p className="text-sm text-gray-500 mt-0.5">Sin datos de confirmación esta semana. Usa el Control de medicamentos para registrar las dosis.</p>
                  ) : (
                    <p className="text-sm text-gray-600 mt-0.5">
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
                    <p className="text-sm text-gray-600 mt-0.5">Sin palabras de alerta detectadas en notas recientes. ¡Todo bien!</p>
                  ) : (
                    <p className="text-sm text-gray-700 mt-0.5">
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
                  <p className="text-sm text-gray-600 mt-0.5">
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
              <h3 className="font-semibold text-gray-900">Reporte para el médico (PDF)</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Perfil del paciente, medicamentos, adherencia, notas de familia, diario médico, eventos y memorias de voz de los últimos {PDF_WINDOW_DAYS} días. Ideal para llevar al médico o guardar como archivo.
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
                  { n: notes.length,       label: `Notas (${PDF_WINDOW_DAYS}d)` },
                  { n: events.length,      label: 'Eventos' },
                  { n: `${adherence7 ?? '—'}${adherence7 != null ? '%' : ''}`, label: 'Adherencia' },
                ].map(({ n, label }) => (
                  <div key={label} className="bg-[#F7F6F2] rounded-xl p-3">
                    <p className="text-xl font-bold text-gray-900">{n}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <button onClick={handleGeneratePdf} disabled={generatingPdf}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {generatingPdf
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando PDF...</>
                  : <><span>📄</span> Descargar reporte PDF</>}
              </button>
              {pdfDone && (
                <p className="text-sm mt-2 px-3 py-2 rounded-lg" style={{ color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  ✓ PDF descargado correctamente
                </p>
              )}
              {pdfError && (
                <p className="text-sm mt-2 px-3 py-2 rounded-lg" style={{ color: '#D63031', background: '#FFF0F0', border: '1px solid #FFBABA' }}>
                  ⚠ {pdfError}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
