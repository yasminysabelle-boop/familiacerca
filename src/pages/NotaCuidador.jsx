import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import VoiceRecorder from '../components/VoiceRecorder'

export default function NotaCuidador() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function appendTranscript(text) {
    setContent(prev => prev ? prev + ' ' + text : text)
  }

  async function handleSave() {
    if (!content.trim()) { setError('Escribe algo antes de guardar.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('notes').insert({
      user_id: ownerId,
      created_by_user_id: user.id,
      title: title.trim() || null,
      content: content.trim(),
    })
    setSaving(false)
    if (err) { setError('Error al guardar. Intenta de nuevo.'); return }
    navigate('/paciente/notas-turno')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0EDE6', padding: '24px 20px 40px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Title */}
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
          color: '#1E2D26', margin: '0 0 6px',
        }}>
          Nueva nota de turno
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6B7280' }}>
          Documenta lo que pasó en este turno
        </p>

        {/* Optional title field */}
        <input
          type="text"
          placeholder="Título (opcional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={80}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 12,
            border: '1.5px solid #DDD5C8', background: 'white',
            fontSize: 14, color: '#1E2D26', marginBottom: 12,
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Content textarea */}
        <textarea
          placeholder="¿Qué ocurrió en este turno? Medicamentos dados, estado del paciente, incidencias…"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={7}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px', borderRadius: 12,
            border: '1.5px solid #DDD5C8', background: 'white',
            fontSize: 14, color: '#1E2D26', lineHeight: 1.6,
            resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', marginBottom: 16,
          }}
        />

        {/* Voice dictation */}
        <div style={{
          background: 'white', borderRadius: 14,
          border: '1.5px solid #DDD5C8',
          padding: '14px 16px', marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
            DICTAR CON VOZ
          </p>
          <VoiceRecorder
            mode="transcribe"
            onTranscript={appendTranscript}
            placeholder="Toca para dictar"
          />
          {content.length > 0 && (
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9CA3AF' }}>
              {content.length} caracteres
            </p>
          )}
        </div>

        {error && (
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              border: '1.5px solid #DDD5C8', background: 'white',
              color: '#6B7280', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            style={{
              flex: 2, padding: '14px', borderRadius: 14,
              border: 'none', background: saving ? '#9CA3AF' : '#2D4A1E',
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
