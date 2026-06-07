import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'

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

export default function NotasTurno() {
  const navigate = useNavigate()
  const { ownerId } = useFamily()
  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!ownerId) return
    setLoading(true)
    supabase
      .from('notes')
      .select('id, title, content, created_at')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setNotes(data ?? []); setLoading(false) })
  }, [ownerId])

  return (
    <div style={{ minHeight: '100vh', background: '#F0EDE6', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1E2D26', margin: 0 }}>
              Notas del turno
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              {loading ? 'Cargando…' : notes.length > 0 ? `${notes.length} nota${notes.length !== 1 ? 's' : ''}` : 'Sin notas aún'}
            </p>
          </div>
          <button
            onClick={() => navigate('/paciente/nota-nueva')}
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: '#2D4A1E', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 26, fontWeight: 300, flexShrink: 0,
              boxShadow: '0 2px 10px rgba(45,74,30,0.3)',
            }}
          >
            +
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 40 }}>Cargando notas…</p>
        ) : notes.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 20, padding: '36px 20px',
            textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <p style={{ fontSize: 36, margin: '0 0 12px' }}>📓</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E2D26', margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>
              Sin notas del turno
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              Documenta aquí lo que ocurre en cada turno de cuidado
            </p>
            <button
              onClick={() => navigate('/paciente/nota-nueva')}
              style={{
                padding: '13px 28px', borderRadius: 14,
                background: '#2D4A1E', color: 'white',
                border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              }}
            >
              Crear primera nota
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map(note => {
              const isOpen = expanded === note.id
              return (
                <div
                  key={note.id}
                  onClick={() => setExpanded(isOpen ? null : note.id)}
                  style={{
                    background: 'white', borderRadius: 16,
                    padding: '14px 16px', cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    border: `1.5px solid ${isOpen ? '#B7D9C4' : 'transparent'}`,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📝</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {note.title && (
                        <p style={{
                          margin: '0 0 3px', fontSize: 14, fontWeight: 700,
                          color: '#1E2D26', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {note.title}
                        </p>
                      )}
                      <p style={{
                        margin: 0, fontSize: 13, color: '#4B5563', lineHeight: 1.5,
                        ...(isOpen ? {} : {
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }),
                      }}>
                        {note.content}
                      </p>
                      {isOpen && (
                        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                          {new Date(note.created_at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
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
        )}
      </div>
    </div>
  )
}
