import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFamily } from '../../contexts/FamilyContext'
import { useAuth } from '../../contexts/AuthContext'
import VoiceInput from '../VoiceInput'

const DOC_TYPES = [
  { value: 'receta', label: '💊 Receta', color: '#DBEAFE' },
  { value: 'estudio', label: '🔬 Estudio', color: '#FCE7F3' },
  { value: 'informe', label: '📄 Informe', color: '#FEF3C7' },
  { value: 'indicaciones', label: '📋 Indicaciones', color: '#D1FAE5' },
  { value: 'otro', label: '📎 Otro', color: '#F3F4F6' },
]

function typeLabel(val) {
  return DOC_TYPES.find(t => t.value === val)?.label ?? '📎 Otro'
}
function typeBg(val) {
  return DOC_TYPES.find(t => t.value === val)?.color ?? '#F3F4F6'
}

export default function HospitalDocumentsCard() {
  const { ownerId } = useFamily()
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('otro')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    if (!ownerId) return
    load()
  }, [ownerId])

  async function load() {
    const { data } = await supabase
      .from('hospital_documents')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
  }

  async function handleUpload() {
    if (!file || !title.trim()) return
    setUploading(true)
    setUploadError('')
    const ext = file.name.split('.').pop()
    const path = `${ownerId}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('hospital-docs')
      .upload(path, file, { contentType: file.type })
    if (upErr) {
      setUploadError('Error al subir el archivo. Intenta de nuevo.')
      setUploading(false)
      return
    }

    // Prefer signed URL (private bucket); fall back to public URL
    const { data: signedData } = await supabase.storage
      .from('hospital-docs')
      .createSignedUrl(path, 60 * 60 * 24 * 365)
    const { data: { publicUrl } } = supabase.storage.from('hospital-docs').getPublicUrl(path)
    const docUrl = signedData?.signedUrl ?? publicUrl

    const { data, error: insertErr } = await supabase
      .from('hospital_documents')
      .insert({
        owner_id: ownerId,
        title: title.trim(),
        document_url: docUrl,
        document_type: docType,
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertErr) {
      setUploadError('Archivo subido pero no se pudo registrar. Intenta de nuevo.')
      setUploading(false)
      return
    }

    if (data) setDocs(prev => [data, ...prev])
    setTitle('')
    setDocType('otro')
    setNotes('')
    setFile(null)
    setShowForm(false)
    setUploading(false)
  }

  async function removeDoc(doc) {
    await supabase.from('hospital_documents').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid #F0EDE6',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>📁</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A', flex: 1 }}>
          Documentos del hospital
        </h3>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '5px 12px', borderRadius: 8, border: 'none',
            background: '#4A7C59', color: 'white', fontSize: 12,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Subir
        </button>
      </div>

      {docs.length === 0 && !showForm && (
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>
          Sin documentos aún
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map(d => (
          <div
            key={d.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: typeBg(d.document_type),
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                {d.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>
                {typeLabel(d.document_type)}
                {d.notes && ` · ${d.notes}`}
              </p>
            </div>
            <a
              href={d.document_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '5px 12px', borderRadius: 7,
                background: 'rgba(0,0,0,0.07)', border: 'none',
                fontSize: 12, color: '#1A1A1A', textDecoration: 'none',
                fontWeight: 600, flexShrink: 0,
              }}
            >
              Ver
            </a>
            <button
              onClick={() => removeDoc(d)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', fontSize: 15, padding: '0 2px', flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{
          marginTop: 12, padding: 14, borderRadius: 12,
          background: '#F9F7F4', border: '1px solid #E5E0D8',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <VoiceInput
            value={title}
            onChange={setTitle}
            placeholder="Nombre del documento"
            rows={1}
            label="Título"
          />

          {/* Tipo */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Tipo
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DOC_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDocType(t.value)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${docType === t.value ? '#4A7C59' : '#D1C9BF'}`,
                    background: docType === t.value ? '#4A7C59' : 'white',
                    color: docType === t.value ? 'white' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <VoiceInput
            value={notes}
            onChange={setNotes}
            placeholder="Nota opcional..."
            rows={1}
            label="Nota"
          />

          {/* File picker */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Archivo (PDF, foto)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13 }}
            />
          </div>

          {uploadError && (
            <p style={{ margin: 0, fontSize: 12, color: '#DC2626', padding: '6px 10px', borderRadius: 8, background: '#FEF2F2' }}>
              {uploadError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowForm(false); setUploadError('') }}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #D1C9BF',
                background: 'white', fontSize: 13, cursor: 'pointer', color: '#6B7280',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !title.trim() || uploading}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: file && title.trim() ? '#4A7C59' : '#9CA3AF',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: file && title.trim() ? 'pointer' : 'default',
              }}
            >
              {uploading ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
