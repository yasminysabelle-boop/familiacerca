import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'
import { useAuth } from '../contexts/AuthContext'
import VoiceRecorder from '../components/VoiceRecorder'
import { INCIDENT_TYPES, incidentTypeInfo } from '../lib/incidentTypes'
import EvidencePhoto from '../components/EvidencePhoto'
import WatermarkHeart from '../components/WatermarkHeart'

function timeAgoEs(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  const h   = Math.floor(diff / 3600000)
  const d   = Math.floor(diff / 86400000)
  if (min < 1)  return 'Ahora mismo'
  if (min < 60) return `Hace ${min}min`
  if (h < 24)   return `Hace ${h}h`
  if (d < 7)    return `Hace ${d}d`
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export default function NotasFamilia() {
  const { ownerId } = useFamily()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('grabar')

  // Grabar nota
  const [content, setContent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved]     = useState(false)
  const [isIncident, setIsIncident]     = useState(false)
  const [incidentType, setIncidentType] = useState(null)
  const [photoUrl, setPhotoUrl]         = useState(null)

  // Historial
  const [notes, setNotes]       = useState([])
  const [authors, setAuthors]   = useState({})
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(null)

  function appendTranscript(text) {
    setContent(prev => prev ? prev + ' ' + text : text)
  }

  function toggleIncident() {
    if (isIncident) { setIsIncident(false); setIncidentType(null); setPhotoUrl(null) }
    else setIsIncident(true)
  }

  async function handleSave() {
    if (!content.trim()) { setSaveError('Agrega un texto o graba algo antes de guardar.'); return }
    if (isIncident && !incidentType) { setSaveError('Elige qué tipo de evento agudo fue.'); return }
    setSaving(true); setSaveError('')
    const { error } = await supabase.from('notes').insert({
      user_id: ownerId,
      created_by_user_id: user.id,
      content: content.trim(),
      is_incident: isIncident,
      incident_type: isIncident ? incidentType : null,
      photo_url: isIncident ? photoUrl : null,
    })
    setSaving(false)
    if (error) { setSaveError('Error al guardar. Intenta de nuevo.'); return }
    setContent(''); setIsIncident(false); setIncidentType(null); setPhotoUrl(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    loadNotes()
  }

  async function loadNotes() {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('id, title, content, created_at, created_by_user_id, is_incident, incident_type, photo_url')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    const rows = data ?? []
    setNotes(rows)
    const authorIds = [...new Set(rows.map(n => n.created_by_user_id).filter(Boolean))]
    if (authorIds.length) {
      const { data: profiles } = await supabase
        .from('user_profiles').select('id, full_name').in('id', authorIds)
      const map = {}
      ;(profiles ?? []).forEach(p => { map[p.id] = p.full_name })
      setAuthors(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'historial') loadNotes()
  }, [tab, ownerId])

  return (
    <div style={{ minHeight: '100vh', background: '#F8F4ED' }}>

      {/* Header + tabs */}
      <div style={{ background: '#075F55', padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 20, padding: '4px 2px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
          >
            ←
          </button>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>
            Notas de la familia
          </h1>
        </div>
        <div style={{ display: 'flex' }}>
          {[
            { key: 'grabar',    label: '🎙️ Grabar nota' },
            { key: 'historial', label: '📋 Historial' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                color: tab === t.key ? 'white' : 'rgba(255,255,255,0.8)',
                borderBottom: tab === t.key ? '2px solid white' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 16px 48px', maxWidth: 480, margin: '0 auto' }}>

        {/* ── GRABAR NOTA ─────────────────────────────────── */}
        {tab === 'grabar' && (
          <div>
            {saved && (
              <div style={{ background: '#DCFCE7', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #BBF7D0' }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#15803D' }}>Nota guardada</p>
              </div>
            )}

            {/* VoiceRecorder — protagonista */}
            <div style={{
              background: 'white', borderRadius: 20,
              padding: '24px 20px', marginBottom: 14,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                🎙️ Graba tu nota de turno
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#9CA3AF' }}>
                El audio se convierte en texto automáticamente
              </p>
              <VoiceRecorder
                mode="transcribe"
                onTranscript={appendTranscript}
                placeholder="Toca el micrófono para empezar"
                language="es-PR"
              />
            </div>

            {/* Textarea — opcional */}
            <textarea
              placeholder="O escribe aquí (opcional) — el texto dictado también aparece aquí"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px', borderRadius: 14,
                border: '1.5px solid #DDD5C8', background: 'white',
                fontSize: 14, color: '#374151', lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', marginBottom: 16,
              }}
            />

            {/* Evento agudo — toggle + subtipo + foto */}
            <button
              onClick={toggleIncident}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 14, marginBottom: isIncident ? 12 : 16,
                border: isIncident ? '1.5px solid #E9826E' : '1.5px solid #DDD5C8',
                background: isIncident ? '#FBEAE4' : 'white',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 20 }}>🩺</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Evento agudo</span>
                <span style={{ display: 'block', fontSize: 11, color: '#9CA3AF' }}>Caída, ER/hospitalización, cambio de conducta...</span>
              </span>
              <span style={{
                width: 40, height: 22, borderRadius: 20, flexShrink: 0, position: 'relative',
                background: isIncident ? '#8C3A2A' : '#D1D5DB', transition: 'background 0.15s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: isIncident ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: 'white',
                  transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </span>
            </button>

            {isIncident && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  {INCIDENT_TYPES.map(t => {
                    const isSelected = incidentType === t.value
                    return (
                      <button
                        key={t.value}
                        onClick={() => setIncidentType(t.value)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '10px 4px', borderRadius: 14,
                          border: isSelected ? '2px solid #8C3A2A' : '1.5px solid #E5DDD2',
                          background: isSelected ? '#FBEAE4' : 'white',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{t.emoji}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#8C3A2A' : '#6B7280', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
                {photoUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={photoUrl} alt="Preview" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #DDD5C8' }} />
                    <button
                      onClick={() => setPhotoUrl(null)}
                      style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#DC2626', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      Quitar foto
                    </button>
                  </div>
                ) : (
                  <EvidencePhoto
                    onPhotoCapture={url => setPhotoUrl(url)}
                    label="Agregar foto"
                    bucket="care-photos"
                    pathPrefix={`notes/${ownerId}`}
                  />
                )}
              </div>
            )}

            {saveError && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>{saveError}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: 'none',
                background: saving || !content.trim() ? '#9CA3AF' : '#087F70',
                color: 'white', fontSize: 15, fontWeight: 700,
                cursor: saving || !content.trim() ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar nota'}
            </button>
          </div>
        )}

        {/* ── HISTORIAL ──────────────────────────────────── */}
        {tab === 'historial' && (
          loading ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 40 }}>Cargando…</p>
          ) : notes.length === 0 ? (
            <div style={{ position: 'relative', background: 'white', borderRadius: 20, padding: '36px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <WatermarkHeart
                heartOpacity={0.08} cutout="white" width={190} height={190}
                style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: 36, margin: '0 0 12px' }}>📋</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '0 0 6px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sin notas aún</p>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>Las notas del equipo aparecerán aquí</p>
                <button
                  onClick={() => setTab('grabar')}
                  style={{ padding: '12px 24px', borderRadius: 14, background: '#087F70', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
                >
                  Grabar primera nota
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Ancorada al final de la lista, en el espacio abierto bajo la
                  última tarjeta — mismo patrón que MedicationTimeline.jsx. */}
              <WatermarkHeart heartOpacity={0.045} cutout="#F8F4ED" width={220} height={220} style={{ right: -36, bottom: -140 }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map(note => {
                const isOpen = expanded === note.id
                const isOwn = note.created_by_user_id === user?.id
                const authorName = note.created_by_user_id
                  ? (authors[note.created_by_user_id]?.split(' ')[0] ?? 'Cuidador')
                  : 'Cuidador'
                return (
                  <div
                    key={note.id}
                    onClick={() => setExpanded(isOpen ? null : note.id)}
                    style={{
                      background: note.is_incident ? '#FBEAE4' : 'white', borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      border: `1.5px solid ${note.is_incident ? '#E9826E' : (isOpen ? '#A8E5D6' : 'transparent')}`,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: isOwn ? '#E8F5E9' : '#FFF3E0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, marginTop: 1,
                      }}>
                        {isOwn ? '👤' : '👥'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>
                            {isOwn ? 'Tú' : authorName}
                          </span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>·</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {new Date(note.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          {note.is_incident && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#8C3A2A', background: '#FBEAE4', padding: '2px 8px', borderRadius: 20 }}>
                              {incidentTypeInfo(note.incident_type).emoji} {incidentTypeInfo(note.incident_type).label}
                            </span>
                          )}
                        </div>
                        {note.title && (
                          <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.title}
                          </p>
                        )}
                        <p style={{
                          margin: 0, fontSize: 13, color: '#4B5563', lineHeight: 1.5,
                          ...(isOpen ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                        }}>
                          {note.content}
                        </p>
                        {isOpen && note.photo_url && (
                          <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                            <EvidencePhoto photoUrl={note.photo_url} />
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                        {timeAgoEs(note.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
