import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'
import { useAuth } from '../contexts/AuthContext'
import VoiceRecorder from '../components/VoiceRecorder'

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

  // Historial
  const [notes, setNotes]       = useState([])
  const [authors, setAuthors]   = useState({})
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(null)

  function appendTranscript(text) {
    setContent(prev => prev ? prev + ' ' + text : text)
  }

  async function handleSave() {
    if (!content.trim()) { setSaveError('Agrega un texto o graba algo antes de guardar.'); return }
    setSaving(true); setSaveError('')
    const { error } = await supabase.from('notes').insert({
      user_id: ownerId,
      created_by_user_id: user.id,
      content: content.trim(),
    })
    setSaving(false)
    if (error) { setSaveError('Error al guardar. Intenta de nuevo.'); return }
    setContent(''); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    loadNotes()
  }

  async function loadNotes() {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('id, title, content, created_at, created_by_user_id')
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
      <div style={{ background: '#0B4F4A', padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 20, padding: '4px 2px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
          >
            ←
          </button>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>
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
                color: tab === t.key ? 'white' : 'rgba(255,255,255,0.55)',
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
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1E2D26' }}>
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
                fontSize: 14, color: '#1E2D26', lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', marginBottom: 16,
              }}
            />

            {saveError && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>{saveError}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: 'none',
                background: saving || !content.trim() ? '#9CA3AF' : '#0B4F4A',
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
            <div style={{ background: 'white', borderRadius: 20, padding: '36px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 36, margin: '0 0 12px' }}>📋</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1E2D26', margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>Sin notas aún</p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>Las notas del equipo aparecerán aquí</p>
              <button
                onClick={() => setTab('grabar')}
                style={{ padding: '12px 24px', borderRadius: 14, background: '#0B4F4A', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
              >
                Grabar primera nota
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                      background: 'white', borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      border: `1.5px solid ${isOpen ? '#B7D9C4' : 'transparent'}`,
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
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E2D26' }}>
                            {isOwn ? 'Tú' : authorName}
                          </span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>·</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {new Date(note.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        {note.title && (
                          <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: '#1E2D26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.title}
                          </p>
                        )}
                        <p style={{
                          margin: 0, fontSize: 13, color: '#4B5563', lineHeight: 1.5,
                          ...(isOpen ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                        }}>
                          {note.content}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                        {timeAgoEs(note.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
