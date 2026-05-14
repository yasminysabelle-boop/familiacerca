import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { getLocation } from '../lib/gps'
import MicButton from '../components/MicButton'
import { useSpeechToText } from '../hooks/useSpeechToText'

const TAG_OPTIONS = ['Salud', 'Médico', 'Familia', 'Dieta', 'Ejercicio', 'Otro']
const emptyForm = { title: '', content: '', tags: [] }

export default function Notes() {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const { canEdit } = useSubscription()
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const { recording, interim, error: speechError, start, stop, clearError } =
    useSpeechToText(text =>
      setForm(prev => ({ ...prev, content: prev.content ? prev.content + ' ' + text : text }))
    )

  useEffect(() => { if (user && ownerId) fetchNotes() }, [user, ownerId])

  async function fetchNotes() {
    setLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    setNotes(data ?? [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleTag(tag) {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const loc = await getLocation()
    await supabase.from('notes').insert({
      ...form, user_id: ownerId,
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      address: loc?.address ?? null,
    })
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    fetchNotes()
  }

  function handleCancel() {
    stop()
    setShowForm(false)
  }

  async function handleDelete(id) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const filtered = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notas</h2>
            <p className="text-gray-500 mt-1">Observaciones del cuidado diario</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nueva nota
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-green-100 p-6 mb-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Nueva nota</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input
                name="title"
                required
                value={form.title}
                onChange={handleChange}
                placeholder="ej. Visita al médico hoy"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              {/* Label row with mic button */}
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Contenido *
                </label>
                <div className="flex items-center gap-2">
                  {recording && (
                    <span className="text-xs font-semibold" style={{ color: '#D63031' }}>
                      🔴 Escuchando...
                    </span>
                  )}
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              {/* Live interim preview */}
              {recording && interim && (
                <p className="text-xs mt-1.5 px-1" style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                  🎤 {interim}
                </p>
              )}

              {/* Speech error */}
              {speechError && (
                <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FFF0F0', border: '1px solid #FFBABA', color: '#D63031' }}>
                  ⚠ {speechError}{' '}
                  <button
                    type="button"
                    onClick={clearError}
                    style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit' }}
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      form.tags.includes(tag)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !canEdit}
                onClick={!canEdit ? (e) => { e.preventDefault(); navigate('/pricing') } : undefined}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar nota'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-gray-500 text-sm">
              {search ? 'Sin resultados para esa búsqueda.' : 'No hay notas aún.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(note => (
              <div key={note.id} className="bg-white rounded-xl border border-green-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === note.id ? null : note.id)}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{note.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {new Date(note.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {note.tags?.map(tag => (
                        <span key={tag} className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm flex-shrink-0">{expanded === note.id ? '▲' : '▼'}</span>
                </button>

                {expanded === note.id && (
                  <div className="px-5 pb-4 border-t border-gray-50">
                    <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{note.content}</p>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="mt-4 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Eliminar nota
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
