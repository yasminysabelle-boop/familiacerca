import { useEffect, useState } from 'react'
import PaywallModal from '../components/PaywallModal'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { getLocation } from '../lib/gps'
import MicButton from '../components/MicButton'
import { useSpeechToText } from '../hooks/useSpeechToText'
import { Plus, XIcon } from '../components/Icons'

const TAG_OPTIONS = ['Salud', 'Médico', 'Familia', 'Dieta', 'Ejercicio', 'Otro']

const emptyForm = { title: '', content: '', tags: [] }

const fieldStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1.5px solid #EDE5D8', background: '#FDFAF7',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.15s', fontFamily: 'inherit',
}
const onFocus = e => { e.target.style.borderColor = '#4A7C59'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }
const onBlur  = e => { e.target.style.borderColor = '#EDE5D8'; e.target.style.boxShadow = 'none' }

export default function Notes() {
  const { user } = useAuth()
  const { ownerId, profile } = useFamily()
  const { canEdit, trialExpired } = useSubscription()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showPaywall, setShowPaywall] = useState(false)
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)

  const isAdmin = user?.id === ownerId

  const { recording, interim, error: speechError, start, stop, clearError } =
    useSpeechToText(text =>
      setForm(prev => ({ ...prev, content: prev.content ? prev.content + ' ' + text : text }))
    )

  useEffect(() => { if (user && ownerId) fetchNotes() }, [user, ownerId])

  // Auto-open compose form when navigated via FAB (?add=1)
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      openAdd()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  // Real-time sync for all family members
  useEffect(() => {
    if (!ownerId) return
    const ch = supabase
      .channel(`notes:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${ownerId}` }, fetchNotes)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [ownerId])

  async function fetchNotes() {
    setLoading(true)
    setLoadError('')
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotes(data ?? [])
    } catch {
      setLoadError('No se pudieron cargar las notas. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleTag(tag) {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }))
  }

  function openAdd() {
    if (trialExpired && isAdmin) { setShowPaywall(true); return }
    setEditId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(note) {
    setEditId(note.id)
    setForm({ title: note.title ?? '', content: note.content ?? '', tags: note.tags ?? [] })
    setExpanded(null)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (editId) {
      await supabase.from('notes').update({ title: form.title, content: form.content, tags: form.tags }).eq('id', editId)
    } else {
      const loc = await getLocation()
      await supabase.from('notes').insert({
        ...form,
        user_id: ownerId,
        created_by_user_id: user.id,
        latitude:  loc?.latitude  ?? null,
        longitude: loc?.longitude ?? null,
        address:   loc?.address   ?? null,
      })
    }
    stop()
    setForm(emptyForm)
    setEditId(null)
    setShowForm(false)
    setSaving(false)
    fetchNotes()
  }

  function handleCancel() {
    stop()
    setEditId(null)
    setShowForm(false)
  }

  async function handleDelete(id) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (expanded === id) setExpanded(null)
  }

  function canActOn(note) {
    return isAdmin || note.created_by_user_id === user?.id
  }

  const filtered = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} patientName={profile?.name?.split(' ')[0]} />}
      {/* Transparent overlay to close menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(null)} />
      )}

      <div style={{ padding: '16px 16px 96px', maxWidth: 600 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
              Notas
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Observaciones del cuidado diario</p>
          </div>
          <button
            onClick={openAdd}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(74,124,89,0.3)',
            }}
          >
            <Plus size={20} color="white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar notas..."
          style={{ ...fieldStyle, marginBottom: 16 }}
          onFocus={onFocus}
          onBlur={onBlur}
        />

        {/* Notes list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #EDE5D8', borderTopColor: '#4A7C59', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : loadError ? (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#D63031', marginBottom: 12 }}>{loadError}</p>
            <button onClick={fetchNotes} style={{ padding: '10px 24px', borderRadius: 12, background: '#4A7C59', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE5D8', padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
              {search ? 'Sin resultados' : 'Sin notas aún'}
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
              {search ? 'Intenta con otras palabras.' : 'Registra las observaciones del cuidado diario.'}
            </p>
            {!search && (
              <button onClick={openAdd} style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #4A7C59, #3A6347)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                + Nueva nota
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(note => {
              const isExpanded = expanded === note.id
              const canAct = canActOn(note)
              return (
                <div
                  key={note.id}
                  style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE5D8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '14px 14px 14px 16px' }}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : note.id)}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.title || note.content?.slice(0, 60) || '—'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {new Date(note.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {note.tags?.map(tag => (
                          <span key={tag} style={{ fontSize: 10, fontWeight: 700, color: '#4A7C59', background: '#EBF3EE', padding: '2px 8px', borderRadius: 20 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>

                    {/* ⋮ Menu */}
                    {canAct && (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === note.id ? null : note.id) }}
                          style={{ width: 32, height: 32, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#9CA3AF', lineHeight: 1 }}
                        >
                          ⋮
                        </button>
                        {menuOpen === note.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', border: '1px solid #EDE5D8', overflow: 'hidden', minWidth: 150 }}>
                            <button
                              onClick={() => { openEdit(note); setMenuOpen(null) }}
                              style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => { setMenuOpen(null); setConfirmDialog({ onConfirm: () => handleDelete(note.id) }) }}
                              style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: '#FFF8F8', border: 'none', borderTop: '1px solid #F3F4F6', cursor: 'pointer', fontSize: 13, color: '#D63031', fontWeight: 600 }}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded(isExpanded ? null : note.id)}
                      style={{ width: 28, height: 28, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F3F4F6' }}>
                      <p style={{ fontSize: 13, color: '#374151', marginTop: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </p>
                      {note.address && (
                        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>📍 {note.address}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add / Edit sheet */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) handleCancel() }}
        >
          <div style={{ width: '100%', maxHeight: '92vh', background: 'white', borderRadius: '24px 24px 0 0', padding: '24px 20px 96px', overflowY: 'auto', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                {editId ? 'Editar nota' : 'Nueva nota'}
              </h3>
              <button onClick={handleCancel} style={{ padding: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
                <XIcon size={20} color="#9CA3AF" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Contenido *</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MicButton recording={recording} onStart={start} onStop={stop} size="sm" />
                  </div>
                </div>
                <textarea
                  name="content"
                  required
                  value={form.content}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Escribe o dicta las observaciones..."
                  style={{ ...fieldStyle, resize: 'vertical', minHeight: 88, lineHeight: 1.5 }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
                {recording && interim && (
                  <p style={{ fontSize: 11, marginTop: 6, paddingLeft: 4, color: '#9CA3AF', fontStyle: 'italic' }}>
                    🎤 {interim}
                  </p>
                )}
                {speechError && (
                  <div style={{ marginTop: 8, padding: '10px 14px', background: '#FFF0F0', border: '1px solid #FFBABA', borderRadius: 10, fontSize: 12, color: '#D63031' }}>
                    ⚠ {speechError}{' '}
                    <button type="button" onClick={clearError} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit' }}>
                      Cerrar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Título <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></p>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="ej. Visita al médico hoy"
                  style={fieldStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Etiquetas</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TAG_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: form.tags.includes(tag) ? '#4A7C59' : '#F3F4F6',
                        color: form.tags.includes(tag) ? 'white' : '#6B7280',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{ flex: 1, padding: '13px', border: '1.5px solid #EDE5D8', borderRadius: 14, background: 'white', color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !canEdit}
                  onClick={!canEdit ? e => { e.preventDefault(); navigate('/pricing') } : undefined}
                  style={{
                    flex: 2, padding: '13px', borderRadius: 14, border: 'none',
                    background: (saving || !canEdit) ? '#D4C4B8' : 'linear-gradient(135deg, #4A7C59, #3A6347)',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 6px 20px rgba(74,124,89,0.3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Guardar nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null) }}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar este registro?</p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EDE5D8', background: 'white', color: '#6B7280', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#D63031', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,48,49,0.3)' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
