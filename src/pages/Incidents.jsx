import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import EvidencePhoto from '../components/EvidencePhoto'
import { Plus, XIcon, CheckIcon } from '../components/Icons'

const INCIDENT_TYPES = [
  { value: 'caida',        emoji: '🤕', label: 'Caída' },
  { value: 'golpe',        emoji: '💥', label: 'Golpe' },
  { value: 'fiebre',       emoji: '🌡️', label: 'Fiebre' },
  { value: 'presion_alta', emoji: '🩺', label: 'Presión alta' },
  { value: 'desorientado', emoji: '😵', label: 'Desorientado' },
  { value: 'agresivo',     emoji: '😤', label: 'Agresivo' },
  { value: 'no_comio',     emoji: '🍽️', label: 'No quiso comer' },
  { value: 'otro',         emoji: '📝', label: 'Otro' },
]

function toLocalDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toLocalDateTimeInput(d = new Date()) {
  return `${toLocalDateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayLabel(dateKey) {
  const today     = toLocalDateKey()
  const yesterday = toLocalDateKey(new Date(Date.now() - 86400000))
  if (dateKey === today)     return 'Hoy'
  if (dateKey === yesterday) return 'Ayer'
  const d   = new Date(dateKey + 'T12:00:00')
  const raw = d.toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function typeInfo(val) {
  return INCIDENT_TYPES.find(t => t.value === val) ?? { emoji: '📝', label: val }
}

export default function Incidents() {
  const { user } = useAuth()
  const { ownerId, memberRole } = useFamily()
  const isFamiliar = memberRole === 'familiar'

  const [incidents, setIncidents]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [lightbox, setLightbox]     = useState(null)

  const [form, setForm] = useState({
    type: null,
    datetime: toLocalDateTimeInput(),
    description: '',
    photo_url: null,
  })

  useEffect(() => {
    if (user && ownerId) fetchIncidents()
  }, [user, ownerId])

  async function fetchIncidents() {
    setLoading(true)
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('owner_id', ownerId)
      .order('recorded_at', { ascending: false })
    setIncidents(data ?? [])
    setLoading(false)
  }

  function openModal() {
    setForm({ type: null, datetime: toLocalDateTimeInput(), description: '', photo_url: null })
    setSaveError('')
    setShowModal(true)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
  }

  async function handleSave() {
    if (!form.type || saving) return
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('incidents').insert({
      owner_id:    ownerId,
      user_id:     user.id,
      type:        form.type,
      description: form.description.trim() || null,
      photo_url:   form.photo_url || null,
      recorded_at: form.datetime ? new Date(form.datetime).toISOString() : new Date().toISOString(),
    })
    setSaving(false)
    if (error) { setSaveError('No se pudo guardar. Intenta de nuevo.'); return }
    setShowModal(false)
    fetchIncidents()
  }

  // Group incidents by local date
  const grouped = incidents.reduce((acc, inc) => {
    const key = toLocalDateKey(new Date(inc.recorded_at))
    if (!acc[key]) acc[key] = []
    acc[key].push(inc)
    return acc
  }, {})
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const selectedType = INCIDENT_TYPES.find(t => t.value === form.type)

  return (
    <Layout>
      <div style={{ padding: '16px 16px 100px', maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(145deg, #2D4A1E 0%, #3D6128 100%)',
          borderRadius: 20, padding: '18px 20px',
          marginBottom: 20,
          boxShadow: '0 4px 20px rgba(45,74,30,0.25)',
        }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '0 0 4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Registro de incidentes
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', fontFamily: 'Georgia, serif', margin: '0 0 4px' }}>
            Incidentes
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
            {incidents.length > 0 ? `${incidents.length} incidente${incidents.length !== 1 ? 's' : ''} registrado${incidents.length !== 1 ? 's' : ''}` : 'Sin incidentes registrados'}
          </p>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#4A7C59', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : dateKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🩺</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#2D4A1E', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
              Sin incidentes registrados
            </p>
            <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>
              Registra caídas, fiebre, cambios de conducta y otros eventos importantes.
            </p>
          </div>
        ) : (
          dateKeys.map(dateKey => (
            <div key={dateKey} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 8px', paddingLeft: 2 }}>
                {dayLabel(dateKey)}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[dateKey].map(inc => {
                  const t = typeInfo(inc.type)
                  return (
                    <div key={inc.id} style={{
                      background: 'white', borderRadius: 16,
                      border: '1px solid #EDE5D8',
                      padding: '14px 16px',
                      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: '#FEF2F2', border: '1px solid #FCA5A5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                      }}>
                        {t.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{t.label}</p>
                          <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{fmtTime(inc.recorded_at)}</span>
                        </div>
                        {inc.description && (
                          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {inc.description}
                          </p>
                        )}
                        {inc.photo_url && (
                          <button
                            onClick={() => setLightbox(inc.photo_url)}
                            style={{ marginTop: 8, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            <img
                              src={inc.photo_url}
                              alt="Evidencia"
                              style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #EDE5D8' }}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating + button */}
      {!isFamiliar && (
        <button
          onClick={openModal}
          style={{
            position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 20,
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #2D4A1E, #4A7C59)',
            boxShadow: '0 4px 16px rgba(45,74,30,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 30,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Plus size={24} color="white" strokeWidth={2.5} />
        </button>
      )}

      {/* New incident modal */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            width: '100%', maxWidth: 520,
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '24px 20px calc(32px + env(safe-area-inset-bottom))',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', margin: 0 }}>
                Registrar incidente
              </h3>
              <button onClick={closeModal} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <XIcon size={16} color="#6B7280" strokeWidth={2} />
              </button>
            </div>

            {/* Type selector */}
            <p style={{ fontSize: 12, fontWeight: 700, color: '#2D4A1E', margin: '0 0 10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Tipo de incidente
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
              {INCIDENT_TYPES.map(t => {
                const isSelected = form.type === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 4px', borderRadius: 14,
                      border: isSelected ? '2px solid #2D4A1E' : '1.5px solid #E5DDD2',
                      background: isSelected ? '#EAF0E6' : 'white',
                      cursor: 'pointer', transition: 'all 0.15s',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{t.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#2D4A1E' : '#6B7280', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Date & time */}
            <p style={{ fontSize: 12, fontWeight: 700, color: '#2D4A1E', margin: '0 0 8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Fecha y hora
            </p>
            <input
              type="datetime-local"
              value={form.datetime}
              onChange={e => setForm(f => ({ ...f, datetime: e.target.value }))}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid #E5DDD2', fontSize: 14, color: '#1A1A1A',
                background: 'white', outline: 'none', boxSizing: 'border-box',
                marginBottom: 16,
              }}
            />

            {/* Description */}
            <p style={{ fontSize: 12, fontWeight: 700, color: '#2D4A1E', margin: '0 0 8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Descripción (opcional)
            </p>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 300) }))}
              placeholder="¿Qué pasó? ¿Cómo reaccionó?"
              rows={3}
              style={{
                width: '100%', borderRadius: 10, border: '1.5px solid #E5DDD2',
                padding: '10px 12px', fontSize: 14, color: '#1A1A1A', lineHeight: 1.6,
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box', marginBottom: 4,
              }}
            />
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 16px', textAlign: 'right' }}>{form.description.length}/300</p>

            {/* Photo */}
            <p style={{ fontSize: 12, fontWeight: 700, color: '#2D4A1E', margin: '0 0 8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Foto (opcional)
            </p>
            {form.photo_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <img src={form.photo_url} alt="Preview" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #EDE5D8' }} />
                <button
                  onClick={() => setForm(f => ({ ...f, photo_url: null }))}
                  style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#DC2626', cursor: 'pointer', fontWeight: 600 }}
                >
                  Quitar foto
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <EvidencePhoto
                  onPhotoCapture={url => setForm(f => ({ ...f, photo_url: url }))}
                  label="Agregar foto"
                  bucket="care-photos"
                  pathPrefix={`incidents/${ownerId}`}
                />
              </div>
            )}

            {/* Error */}
            {saveError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>
                {saveError}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!form.type || saving}
              style={{
                width: '100%', padding: '15px', borderRadius: 16, border: 'none',
                background: !form.type || saving ? '#D1D5DB' : 'linear-gradient(135deg, #2D4A1E, #3D6128)',
                color: 'white', fontWeight: 700, fontSize: 15,
                cursor: !form.type || saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: form.type && !saving ? '0 4px 16px rgba(45,74,30,0.35)' : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {saving ? 'Guardando...' : (
                <><CheckIcon size={16} color="white" strokeWidth={2.5} /> Guardar incidente</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <img src={lightbox} alt="Evidencia" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  )
}
