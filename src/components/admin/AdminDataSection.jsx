import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import VoiceInput from '../VoiceInput'
import { fetchPdfReportData, generatePdfReport, SECTIONS } from '../../utils/generatePdfReport'

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
  const PDF_SECTIONS = [
    SECTIONS.COVER, SECTIONS.MEDICATIONS, SECTIONS.MEDICATION_LOG,
    SECTIONS.FAMILY_NOTES, SECTIONS.EXPENSES,
  ]
  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const data = await fetchPdfReportData(ownerId, { sections: PDF_SECTIONS, windowDays: 90 })
      await generatePdfReport(data, { sections: PDF_SECTIONS, windowDays: 90, patientName: profile?.name })
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
      <div style={{ background: 'white', borderRadius: 14, padding: '16px', border: '1px solid #E6E3DB' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: exportError ? 12 : 0 }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>📄</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#14303D' }}>Exportar historial médico</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4E6470', lineHeight: 1.5 }}>
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
                background: exporting ? '#5E7480' : '#0C6C9C',
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
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4E6470', lineHeight: 1.5 }}>
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
                      border: '1px solid #E6E3DB', background: 'white',
                      color: '#4E6470', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={confirmText.trim().toUpperCase() !== 'ELIMINAR'}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      background: confirmText.trim().toUpperCase() === 'ELIMINAR' ? '#DC2626' : '#5E7480',
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
              <p style={{ fontSize: 13, color: '#0C6C9C', fontWeight: 700 }}>✓ Cuenta eliminada. Redirigiendo...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
