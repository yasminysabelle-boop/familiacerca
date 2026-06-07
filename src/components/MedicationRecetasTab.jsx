import { useState } from 'react'
import { supabase } from '../lib/supabase'
import EvidencePhoto from './EvidencePhoto'
import { Pencil, Trash, XIcon } from './Icons'

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

const STATUS_CFG = {
  active:    { label: '🟢 Activo',     color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  paused:    { label: '⏸ Pausado',    color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  suspended: { label: '🔴 Suspendido', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MedicationRecetasTab({ medications = [], stockByMedId = {}, ownerId, isAdmin, onEdit, onDelete }) {
  const [docPhotoUrl,    setDocPhotoUrl]    = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [togglingId,     setTogglingId]     = useState(null)
  const [deletingId,     setDeletingId]     = useState(null)
  // Optimistic local overrides so toggles / doc uploads feel instant
  const [localStatus, setLocalStatus] = useState({})
  const [localDocs,   setLocalDocs]   = useState({})

  function getDocUrl(medId, field) {
    if (medId in localDocs && field in localDocs[medId]) return localDocs[medId][field]
    return stockByMedId[medId]?.[field] ?? null
  }

  async function saveDocPhoto(medId, field, url) {
    await supabase.from('medication_stock').update({ [field]: url })
      .eq('medication_id', medId).eq('user_id', ownerId)
    setLocalDocs(prev => ({ ...prev, [medId]: { ...(prev[medId] ?? {}), [field]: url } }))
  }

  async function removeDocPhoto(medId, field) {
    await supabase.from('medication_stock').update({ [field]: null })
      .eq('medication_id', medId).eq('user_id', ownerId)
    setLocalDocs(prev => ({ ...prev, [medId]: { ...(prev[medId] ?? {}), [field]: null } }))
  }

  async function toggleStatus(med) {
    const cur = localStatus[med.id] ?? med.status ?? 'active'
    const next = cur === 'active' ? 'paused' : 'active'
    setLocalStatus(prev => ({ ...prev, [med.id]: next }))
    setTogglingId(med.id)
    await supabase.from('medications').update({ status: next }).eq('id', med.id)
    setTogglingId(null)
  }

  async function confirmDelete(medId) {
    setDeletingId(medId)
    await onDelete(medId)
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  if (medications.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>💊</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Sin medicamentos registrados</p>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>Agrega medicamentos usando el botón + de arriba.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0 96px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {medications.map(med => {
        const stock  = stockByMedId[med.id]
        const status = localStatus[med.id] ?? med.status ?? 'active'
        const sCfg   = STATUS_CFG[status] ?? STATUS_CFG.active
        const times  = med.scheduled_times?.length ? med.scheduled_times : med.time ? [med.time] : []
        const freqLabel = FREQ_LABELS[med.frequency] ?? med.frequency ?? '—'
        const days = stock ? daysFromNow(stock.estimated_end_date) : null
        const pct  = stock?.total_pills > 0
          ? Math.max(0, Math.min(100, Math.round((stock.pills_remaining / stock.total_pills) * 100)))
          : null
        const urgColor = days == null ? '#9CA3AF' : days <= 3 ? '#DC2626' : days <= 7 ? '#D97706' : '#16A34A'

        const rxUrl  = getDocUrl(med.id, 'prescription_photo_url')
        const boxUrl = getDocUrl(med.id, 'box_photo_url')

        return (
          <div key={med.id} style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: status === 'suspended' ? 0.6 : 1 }}>

            {/* ── Header: name + status + edit ── */}
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #F5F0E8' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>
                    💊 {med.name}
                    {med.dosage && <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 13 }}> · {med.dosage}</span>}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                    {[med.form, med.quantity_per_dose && med.quantity_per_dose !== 1 ? `${med.quantity_per_dose} u/dosis` : null].filter(Boolean).join(' · ') || null}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sCfg.color, background: sCfg.bg, border: `1px solid ${sCfg.border}`, padding: '3px 8px', borderRadius: 6 }}>
                    {sCfg.label}
                  </span>
                  {isAdmin && (
                    <button onClick={() => onEdit(med)} style={{ padding: 6, border: 'none', background: '#F3F4F6', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={13} color="#6B7280" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>

              {/* Frequency + window */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: times.length ? 6 : 0 }}>
                <span style={{ fontSize: 11, background: '#F0F8F4', color: '#2D6A4F', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                  🔄 {freqLabel}
                </span>
                {med.time_window_minutes && (
                  <span style={{ fontSize: 11, color: '#9CA3AF', padding: '2px 0' }}>ventana {med.time_window_minutes} min</span>
                )}
              </div>
              {times.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {times.map((t, i) => (
                    <span key={i} style={{ background: '#F0F8F4', color: '#2D6A4F', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>⏰ {t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            {med.notes && (
              <div style={{ padding: '10px 16px', background: '#FDFAF7', borderBottom: '1px solid #F5F0E8' }}>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>📝 <em>{med.notes}</em></p>
              </div>
            )}

            {/* ── Stock info ── */}
            {stock && (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #F5F0E8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pct !== null ? 6 : 0 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {fmtDate(stock.start_date) ? `Inicio: ${fmtDate(stock.start_date)}` : 'Sin fecha inicio'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: urgColor }}>
                    {days != null
                      ? days <= 0 ? '¡Agotado!' : `${days} días restantes`
                      : `${stock.pills_remaining ?? '?'} unidades`}
                  </span>
                </div>
                {pct !== null && (
                  <div style={{ height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct > 30 ? '#22C55E' : pct > 10 ? '#F59E0B' : '#EF4444', transition: 'width 0.5s ease' }} />
                  </div>
                )}
                {stock.estimated_end_date && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Vence estimado: {fmtDate(stock.estimated_end_date)}</p>
                )}
              </div>
            )}

            {/* ── Documentos ── */}
            <div style={{ padding: '12px 16px', borderBottom: isAdmin ? '1px solid #F5F0E8' : 'none' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Documentos
              </p>
              {!stock ? (
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                  {isAdmin ? 'Configura el stock para subir documentos.' : 'Sin documentos.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Prescription */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>📄 Receta médica</p>
                    {rxUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setDocPhotoUrl(rxUrl)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #DBEAFE', background: '#EFF6FF', fontSize: 11, fontWeight: 600, color: '#1D4ED8', cursor: 'pointer' }}>
                          📄 Ver receta
                        </button>
                        {isAdmin && (
                          <>
                            <EvidencePhoto onPhotoCapture={url => saveDocPhoto(med.id, 'prescription_photo_url', url)} bucket="care-photos" pathPrefix={`${ownerId}/med-docs/${med.id}-rx`} label="Reemplazar" />
                            <button onClick={() => removeDocPhoto(med.id, 'prescription_photo_url')} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', fontSize: 11, color: '#DC2626', cursor: 'pointer' }}>🗑</button>
                          </>
                        )}
                      </div>
                    ) : isAdmin ? (
                      <EvidencePhoto onPhotoCapture={url => saveDocPhoto(med.id, 'prescription_photo_url', url)} bucket="care-photos" pathPrefix={`${ownerId}/med-docs/${med.id}-rx`} label="⬆️ Subir receta" />
                    ) : (
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Sin receta guardada</p>
                    )}
                  </div>

                  {/* Box photo */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>📦 Foto de la caja</p>
                    {boxUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setDocPhotoUrl(boxUrl)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E0E7FF', background: '#EEF2FF', fontSize: 11, fontWeight: 600, color: '#4338CA', cursor: 'pointer' }}>
                          📦 Ver caja
                        </button>
                        {isAdmin && (
                          <>
                            <EvidencePhoto onPhotoCapture={url => saveDocPhoto(med.id, 'box_photo_url', url)} bucket="care-photos" pathPrefix={`${ownerId}/med-docs/${med.id}-box`} label="Reemplazar" />
                            <button onClick={() => removeDocPhoto(med.id, 'box_photo_url')} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', fontSize: 11, color: '#DC2626', cursor: 'pointer' }}>🗑</button>
                          </>
                        )}
                      </div>
                    ) : isAdmin ? (
                      <EvidencePhoto onPhotoCapture={url => saveDocPhoto(med.id, 'box_photo_url', url)} bucket="care-photos" pathPrefix={`${ownerId}/med-docs/${med.id}-box`} label="⬆️ Subir caja" />
                    ) : (
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Sin foto guardada</p>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* ── Acciones admin ── */}
            {isAdmin && (
              <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleStatus(med)}
                  disabled={togglingId === med.id}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${status === 'active' ? '#FDE68A' : '#BBF7D0'}`, background: status === 'active' ? '#FFFBEB' : '#F0FDF4', fontSize: 12, fontWeight: 600, color: status === 'active' ? '#D97706' : '#15803D', cursor: 'pointer' }}
                >
                  {togglingId === med.id ? '...' : status === 'active' ? '⏸ Pausar' : '▶ Reactivar'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(med.id)}
                  style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #FCA5A5', background: 'white', fontSize: 12, color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Trash size={14} color="#DC2626" strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Confirm delete dialog ── */}
      {confirmDeleteId && (() => {
        const med = medications.find(m => m.id === confirmDeleteId)
        if (!med) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 310, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }} onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null) }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>🗑️</p>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar {med.name}?</p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>Esta acción no se puede deshacer. Se eliminarán todos los registros del medicamento.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => confirmDelete(med.id)} disabled={deletingId === med.id} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: deletingId === med.id ? '#C0CCC5' : '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}>
                  {deletingId === med.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Doc photo lightbox ── */}
      {docPhotoUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setDocPhotoUrl(null)}>
          <button onClick={() => setDocPhotoUrl(null)} style={{ position: 'absolute', top: 20, right: 20, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XIcon size={18} color="white" strokeWidth={2} />
          </button>
          <img src={docPhotoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
