import { useState } from 'react'
import { supabase } from '../lib/supabase'
import EvidencePhoto from './EvidencePhoto'
import { ChevronLeft, FileText, Image as ImageIcon, CheckIcon, Pencil } from './Icons'

const FREQ_LABELS = {
  once_daily:  'Una vez al día',
  twice_daily: 'Dos veces al día',
  three_daily: 'Tres veces al día',
  every_4h:    'Cada 4 horas',
  every_6h:    'Cada 6 horas',
  every_8h:    'Cada 8 horas',
  every_12h:   'Cada 12 horas',
  as_needed:   'Según necesidad',
  weekly:      'Semanal',
}

const SERIF = "'Fraunces', Georgia, serif"
const SANS  = "'Plus Jakarta Sans', system-ui, sans-serif"

function fmtTime12(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DocRow({ label, url, uploadedAt, field, ownerId, medId, isAdmin, onSave, onDelete, onView }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 16, boxShadow: '0 6px 14px -8px #087F7022', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 64, borderRadius: 12, flexShrink: 0, position: 'relative',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: url ? '#F1EDE3' : '#F1EDE3',
          border: url ? 'none' : '1.5px dashed #C7CDBF',
        }}>
          {url ? (
            <>
              <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 999, background: '#087F70', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px -2px #087F7088' }}>
                <CheckIcon size={10} color="#FFFFFF" strokeWidth={3} />
              </div>
            </>
          ) : (
            field === 'prescription_photo_url'
              ? <FileText size={20} color="#8A97A3" strokeWidth={1.8} />
              : <ImageIcon size={20} color="#8A97A3" strokeWidth={1.8} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14.5, color: '#1E2C3A', margin: 0, fontFamily: SANS }}>{label}</p>
          {url ? (
            <button onClick={() => onView(url)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, color: '#087F70', fontWeight: 700, marginTop: 2, fontFamily: SANS }}>
              Subida{uploadedAt ? ` · ${uploadedAt}` : ''} · Ver documento
            </button>
          ) : (
            <p style={{ fontSize: 12.5, color: '#6B7A88', margin: '2px 0 0', fontFamily: SANS }}>Aún no subida</p>
          )}
        </div>
      </div>
      {isAdmin && (
        <div style={{ marginTop: 12 }}>
          <EvidencePhoto
            onPhotoCapture={photoUrl => onSave(field, photoUrl)}
            bucket="care-photos"
            pathPrefix={`${ownerId}/med-docs/${medId}-${field === 'prescription_photo_url' ? 'rx' : 'box'}`}
            alwaysExpanded
            renderOptions={({ onCamera, onGallery }) => (
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={onCamera} style={{ flex: 1, border: 'none', cursor: 'pointer', padding: 10, borderRadius: 13, fontSize: 12.5, fontWeight: 700, fontFamily: SANS, color: '#087F70', background: '#A8E5D6' }}>
                  {url ? 'Volver a tomar foto' : 'Tomar foto'}
                </button>
                <button type="button" onClick={onGallery} style={{ flex: 1, border: 'none', cursor: 'pointer', padding: 10, borderRadius: 13, fontSize: 12.5, fontWeight: 700, fontFamily: SANS, color: '#5C6B78', background: '#F1EDE3' }}>
                  Elegir de galería
                </button>
              </div>
            )}
          />
          {url && (
            <button onClick={() => onDelete(field)} style={{ marginTop: 8, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 11.5, color: '#D9534F', fontWeight: 600, fontFamily: SANS }}>
              Quitar documento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// MedicationDetail — overlay de solo-una-pantalla sobre /medications (sin ruta nueva)
export default function MedicationDetail({ med, stock, ownerId, isAdmin, onClose, onEdit, onDelete, onStatusChange, onDocsChange }) {
  const [status, setStatus] = useState(med.status ?? 'active')
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [docs, setDocs] = useState({
    prescription_photo_url: stock?.prescription_photo_url ?? null,
    box_photo_url: stock?.box_photo_url ?? null,
  })
  const [previewUrl, setPreviewUrl] = useState(null)

  const times = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
  const timesLabel = times.map(fmtTime12).filter(Boolean).join(' y ')
  const freqLabel = FREQ_LABELS[med.frequency] ?? med.frequency ?? '—'
  const scheduleLine = [freqLabel, timesLabel, med.notes].filter(Boolean).join(' · ')
  const docsUpdatedAt = fmtDate(stock?.updated_at)

  async function togglePausado() {
    if (!isAdmin || toggling) return
    const next = status === 'active' ? 'paused' : 'active'
    setToggling(true)
    setStatus(next)
    await supabase.from('medications').update({ status: next }).eq('id', med.id)
    onStatusChange?.(med.id, next)
    setToggling(false)
  }

  async function saveDoc(field, url) {
    setDocs(prev => ({ ...prev, [field]: url }))
    await supabase.from('medication_stock').update({ [field]: url }).eq('medication_id', med.id).eq('user_id', ownerId)
    onDocsChange?.(med.id, field, url)
  }

  async function deleteDoc(field) {
    setDocs(prev => ({ ...prev, [field]: null }))
    await supabase.from('medication_stock').update({ [field]: null }).eq('medication_id', med.id).eq('user_id', ownerId)
    onDocsChange?.(med.id, field, null)
  }

  async function confirmDelete() {
    setDeleting(true)
    await onDelete(med.id)
    setDeleting(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 260, background: '#F8F4ED', overflowY: 'auto', fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 20px 8px' }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 14, border: 'none', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px -8px #087F7055', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={19} color="#334155" strokeWidth={2.2} />
        </button>
        <div style={{ fontWeight: 800, fontSize: 19, color: '#1E2C3A' }}>Detalle del medicamento</div>
      </div>

      <div style={{ padding: '14px 20px 40px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 22, padding: 20, boxShadow: '0 6px 14px -8px #087F7033' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#1E2C3A' }}>
                {med.name}{med.dosage ? ` ${med.dosage}` : ''}{med.form ? ` · ${med.form}` : ''}
              </div>
              {scheduleLine && (
                <div style={{ fontSize: 13.5, color: '#6B7A88', marginTop: 6, lineHeight: 1.5 }}>{scheduleLine}</div>
              )}
            </div>
            <span style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              color: status === 'active' ? '#FFFFFF' : '#5C6B78',
              background: status === 'active' ? '#087F70' : '#E7E2D6',
            }}>
              {status === 'active' ? 'Activo' : 'Pausado'}
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => onEdit(med)}
              style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(51,65,85,0.12)', background: '#FDFAF7', borderRadius: 12, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
            >
              <Pencil size={13} color="#334155" strokeWidth={2} /> Editar
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: '#7D8A9A', textTransform: 'uppercase', margin: '22px 0 10px', paddingLeft: 2 }}>
          Documentos
        </div>

        <DocRow
          label="Receta médica" field="prescription_photo_url"
          url={docs.prescription_photo_url} uploadedAt={docsUpdatedAt}
          ownerId={ownerId} medId={med.id} isAdmin={isAdmin}
          onSave={saveDoc} onDelete={deleteDoc} onView={setPreviewUrl}
        />
        <DocRow
          label="Foto de la caja" field="box_photo_url"
          url={docs.box_photo_url} uploadedAt={docsUpdatedAt}
          ownerId={ownerId} medId={med.id} isAdmin={isAdmin}
          onSave={saveDoc} onDelete={deleteDoc} onView={setPreviewUrl}
        />

        {isAdmin && (
          <>
            <button
              onClick={togglePausado}
              disabled={toggling}
              style={{ width: '100%', marginTop: 24, border: 'none', cursor: toggling ? 'default' : 'pointer', padding: 15, borderRadius: 16, fontSize: 14.5, fontWeight: 700, fontFamily: SANS, color: '#C4664F', background: '#FBEAE4', opacity: toggling ? 0.7 : 1 }}
            >
              {status === 'active' ? 'Pausar medicamento' : 'Reanudar medicamento'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setConfirmingDelete(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#D9534F', fontFamily: SANS }}>
                Eliminar medicamento
              </button>
            </div>
          </>
        )}
      </div>

      {/* Confirmar eliminación */}
      {confirmingDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }} onClick={e => { if (e.target === e.currentTarget && !deleting) setConfirmingDelete(false) }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🗑️</p>
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, fontWeight: 700, color: '#1E2C3A', marginBottom: 8 }}>¿Eliminar {med.name}?</p>
            <p style={{ fontSize: 13, color: '#6B7A88', lineHeight: 1.6, marginBottom: 24 }}>Esta acción no se puede deshacer. Se eliminarán todos los registros del medicamento.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmingDelete(false)} disabled={deleting} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7A88', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: deleting ? '#C0CCC5' : '#D9534F', color: 'white', fontWeight: 700, fontSize: 14, cursor: deleting ? 'not-allowed' : 'pointer', boxShadow: deleting ? 'none' : '0 4px 16px rgba(217,83,79,0.3)' }}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox de documento */}
      {previewUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="" style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
