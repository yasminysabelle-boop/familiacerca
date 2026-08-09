import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import VoiceInput from '../VoiceInput'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function AdminDataSection() {
  const { user } = useAuth()
  const { ownerId, profile } = useFamily()
  const navigate = useNavigate()

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [deletePhase, setDeletePhase] = useState('idle') // 'idle' | 'confirm' | 'deleting' | 'done'
  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')

  // ── PDF export ──────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const [
        { data: patientData },
        { data: meds },
        { data: logs },
        { data: notesData },
        { data: expenses },
      ] = await Promise.all([
        supabase.from('patient_profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
        supabase.from('medications').select('*').eq('user_id', ownerId).order('name'),
        supabase.from('medication_logs')
          .select('*, medications(name)')
          .eq('user_id', ownerId)
          .gte('log_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0,10))
          .order('log_date', { ascending: false })
          .limit(200),
        supabase.from('notes').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(50),
        supabase.from('care_expenses').select('*').eq('user_id', ownerId).order('date', { ascending: false }).limit(100),
      ])

      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      let y = 20

      // Header
      doc.setFillColor(45, 74, 30)
      doc.rect(0, 0, W, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('FamiliaCerca — Historial Médico Completo', W / 2, 14, { align: 'center' })
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 22, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      y = 38

      // Patient profile
      if (patientData) {
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text(patientData.nombre_completo ? `Perfil de ${patientData.nombre_completo}` : 'Perfil del paciente', 14, y)
        y += 7
        const fields = [
          ['Nombre', patientData.nombre_completo],
          ['Diagnóstico', patientData.diagnostico_principal],
          ['Médico tratante', patientData.medico_tratante ? `${patientData.medico_tratante}${patientData.especialidad_medico ? ` (${patientData.especialidad_medico})` : ''}` : null],
          ['Tipo de sangre', patientData.tipo_sangre],
          ['Alergias', patientData.alergias?.join(', ')],
          ['Seguro', patientData.seguro_compania ? `${patientData.seguro_compania} — ${patientData.seguro_poliza ?? ''}` : null],
        ].filter(([, v]) => v)
        autoTable(doc, {
          startY: y, margin: { left: 14, right: 14 },
          head: [], body: fields,
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } },
          styles: { fontSize: 9 }, theme: 'grid',
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // Medications
      if (meds?.length) {
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Medicamentos activos', 14, y)
        y += 4
        autoTable(doc, {
          startY: y, margin: { left: 14, right: 14 },
          head: [['Medicamento', 'Dosis', 'Frecuencia', 'Horarios']],
          body: meds.map(m => [m.name, m.dosage ?? '—', m.frequency ?? '—', m.scheduled_times?.join(', ') ?? '—']),
          styles: { fontSize: 8 }, headStyles: { fillColor: [45, 74, 30] }, theme: 'striped',
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // Medication logs (last 90 days)
      if (logs?.length) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Registro de medicamentos — últimos 90 días', 14, y)
        y += 4
        autoTable(doc, {
          startY: y, margin: { left: 14, right: 14 },
          head: [['Fecha', 'Medicamento', 'Estado', 'Confirmado por', 'Hora']],
          body: logs.map(l => [
            l.log_date,
            l.medications?.name ?? '—',
            l.status === 'confirmed' ? '✓ Confirmado' : l.status === 'missed' ? '✗ No dado' : 'Pendiente',
            l.confirmed_by_name ?? '—',
            l.confirmed_at ? new Date(l.confirmed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—',
          ]),
          styles: { fontSize: 7 }, headStyles: { fillColor: [45, 74, 30] }, theme: 'striped',
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // Notes
      if (notesData?.length) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Notas', 14, y)
        y += 4
        autoTable(doc, {
          startY: y, margin: { left: 14, right: 14 },
          head: [['Fecha', 'Título', 'Contenido']],
          body: notesData.map(n => [
            new Date(n.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
            n.title ?? '—',
            (n.content ?? '').slice(0, 80) + (n.content?.length > 80 ? '…' : ''),
          ]),
          styles: { fontSize: 7 }, headStyles: { fillColor: [45, 74, 30] }, theme: 'striped',
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // Expenses
      if (expenses?.length) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Gastos del cuidado', 14, y)
        y += 4
        const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
        autoTable(doc, {
          startY: y, margin: { left: 14, right: 14 },
          head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Pagado por']],
          body: [
            ...expenses.map(e => [
              e.date,
              e.category,
              e.description ?? '—',
              `$${Number(e.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
              e.paid_by,
            ]),
            ['', '', 'TOTAL', `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, ''],
          ],
          styles: { fontSize: 7 }, headStyles: { fillColor: [45, 74, 30] }, theme: 'striped',
        })
      }

      const filename = `historial-medico-${(profile?.name ?? 'paciente').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('[AdminDataSection] export error:', err)
      setExportError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  // ── Delete account ──────────────────────────────────────────────────────────
  async function handleDelete() {
    if (confirmText.trim().toUpperCase() !== 'ELIMINAR') return
    setDeletePhase('deleting')
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al eliminar cuenta')
      setDeletePhase('done')
      setTimeout(() => {
        localStorage.clear()
        window.location.href = '/login'
      }, 2500)
    } catch (err) {
      setDeleteError(err.message)
      setDeletePhase('confirm')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Export PDF */}
      <div style={{ background: 'white', borderRadius: 14, padding: '16px', border: '1px solid #EDE5D8' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: exportError ? 12 : 0 }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>📄</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Exportar historial médico</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
              PDF completo con perfil del paciente, medicamentos, registros de dosis (90 días), notas y gastos.
            </p>
            {exportError && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#DC2626', padding: '6px 10px', borderRadius: 8, background: '#FEF2F2' }}>
                {exportError}
              </p>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: exporting ? '#9CA3AF' : '#087F70',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: exporting ? 'default' : 'pointer',
              }}
            >
              {exporting ? 'Generando PDF...' : '⬇ Descargar PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete account */}
      <div style={{
        borderRadius: 14, padding: '16px',
        border: '1.5px solid #FFBABA', background: '#FFF8F8',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>🗑️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#B91C1C' }}>Borrar cuenta y datos</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
              Elimina permanentemente tu cuenta, todos los miembros del equipo, medicamentos, historial, notas, gastos y documentos. Esta acción no se puede deshacer.
            </p>

            {deletePhase === 'idle' && (
              <button
                onClick={() => setDeletePhase('confirm')}
                style={{
                  padding: '9px 18px', borderRadius: 10,
                  border: '1.5px solid #DC2626', background: 'white',
                  color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Eliminar cuenta
              </button>
            )}

            {deletePhase === 'confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.2)',
                }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>
                    Escribe ELIMINAR para confirmar:
                  </p>
                </div>
                <VoiceInput
                  value={confirmText}
                  onChange={setConfirmText}
                  placeholder="Escribe ELIMINAR"
                  rows={1}
                />
                {deleteError && (
                  <p style={{ margin: 0, fontSize: 12, color: '#DC2626', padding: '6px 10px', borderRadius: 8, background: '#FEF2F2' }}>
                    {deleteError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setDeletePhase('idle'); setConfirmText(''); setDeleteError('') }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10,
                      border: '1px solid #EDE5D8', background: 'white',
                      color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={confirmText.trim().toUpperCase() !== 'ELIMINAR'}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      background: confirmText.trim().toUpperCase() === 'ELIMINAR' ? '#DC2626' : '#9CA3AF',
                      color: 'white', fontWeight: 700, fontSize: 13,
                      cursor: confirmText.trim().toUpperCase() === 'ELIMINAR' ? 'pointer' : 'default',
                    }}
                  >
                    Eliminar todo
                  </button>
                </div>
              </div>
            )}

            {deletePhase === 'deleting' && (
              <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>⏳ Eliminando cuenta y datos...</p>
            )}

            {deletePhase === 'done' && (
              <p style={{ fontSize: 13, color: '#087F70', fontWeight: 700 }}>✓ Cuenta eliminada. Redirigiendo...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
