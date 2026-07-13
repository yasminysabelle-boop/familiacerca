import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { XIcon } from './Icons'

/**
 * Dual-mode evidence photo component.
 *
 * Display mode  — pass `photoUrl` (string): shows 48×48 thumbnail, tap → lightbox.
 * Capture mode  — pass `onPhotoCapture(url)`: shows pick button → preview → upload → callback.
 *
 * Capture-mode extra props:
 *   label      — button label (default "Agregar foto de evidencia")
 *   bucket     — Supabase Storage bucket (default "care-photos")
 *   pathPrefix — path prefix; component appends /{timestamp}.ext
 */
export default function EvidencePhoto({
  photoUrl,
  onPhotoCapture,
  label = 'Agregar foto de evidencia',
  bucket = 'care-photos',
  pathPrefix = 'evidence',
  alwaysExpanded = false,
  renderOptions,
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showOptions,  setShowOptions]  = useState(alwaysExpanded)
  const [preview,      setPreview]      = useState(null)
  const [file,         setFile]         = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState('')
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  // ── Display mode ──────────────────────────────────────────────────────────
  if (!onPhotoCapture) {
    if (!photoUrl) return null
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          style={{
            width: 48, height: 48, padding: 0,
            border: 'none', background: 'none',
            cursor: 'pointer', position: 'relative',
            borderRadius: 10, overflow: 'hidden', flexShrink: 0,
          }}
          title="Ver foto de evidencia"
        >
          <img
            src={photoUrl}
            alt="Evidencia"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', borderRadius: 10,
              border: '1.5px solid #EDE5D8',
            }}
          />
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            background: 'rgba(0,0,0,0.45)', borderRadius: 4,
            padding: '1px 3px', fontSize: 9, lineHeight: 1,
          }}>
            📷
          </div>
        </button>

        {lightboxOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute', top: 20, right: 20,
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <XIcon size={18} color="white" strokeWidth={2} />
            </button>
            <img
              src={photoUrl}
              alt="Evidencia"
              style={{
                maxWidth: '100%', maxHeight: '88vh',
                objectFit: 'contain', borderRadius: 12,
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </>
    )
  }

  // ── Capture mode ──────────────────────────────────────────────────────────
  function handleFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setShowOptions(false)
    setUploadError('')
  }

  async function handleConfirm() {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const ext  = file.name.split('.').pop() || 'jpg'
      const path = `${pathPrefix}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
      onPhotoCapture(publicUrl)
      setPreview(null)
      setFile(null)
    } catch (err) {
      console.error(err)
      setUploadError('No se pudo subir la foto. Intenta de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  function handleCancel() {
    setPreview(null)
    setFile(null)
    setShowOptions(false)
    setUploadError('')
  }

  // Preview step
  if (preview) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={preview}
            alt="Vista previa"
            style={{
              width: 80, height: 80, objectFit: 'cover',
              borderRadius: 10, border: '2px solid #EDE5D8',
            }}
          />
          <button
            type="button"
            onClick={handleCancel}
            disabled={uploading}
            style={{
              position: 'absolute', top: -6, right: -6,
              width: 20, height: 20, borderRadius: '50%',
              background: '#9CA3AF', border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <XIcon size={10} color="white" strokeWidth={2.5} />
          </button>
        </div>
        {uploadError && (
          <p style={{ fontSize: 11, color: '#DC2626', margin: '4px 0 0' }}>
            {uploadError}
          </p>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={uploading}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: '1px solid #EDE5D8', background: 'white',
              fontSize: 12, color: '#6B7280', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={uploading}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: uploading ? '#C0CCC5' : '#087F70',
              color: 'white', fontSize: 12, fontWeight: 700,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Subiendo…' : '✓ Confirmar foto'}
          </button>
        </div>
      </div>
    )
  }

  // Button / options step
  return (
    <>
      {showOptions ? (
        renderOptions ? (
          renderOptions({ onCamera: () => cameraRef.current?.click(), onGallery: () => galleryRef.current?.click() })
        ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            style={{
              flex: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 4,
              padding: '8px', borderRadius: 10,
              border: '1.5px dashed #C0CCC5', background: '#FDF8F4',
              cursor: 'pointer', fontSize: 12, color: '#087F70', fontWeight: 600,
            }}
          >
            📷 Tomar foto
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            style={{
              flex: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 4,
              padding: '8px', borderRadius: 10,
              border: '1.5px dashed #C0CCC5', background: '#FDF8F4',
              cursor: 'pointer', fontSize: 12, color: '#087F70', fontWeight: 600,
            }}
          >
            🖼️ Galería
          </button>
          {!alwaysExpanded && (
            <button
              type="button"
              onClick={() => setShowOptions(false)}
              style={{
                padding: '8px 10px', borderRadius: 10, border: 'none',
                background: '#F3F4F6', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <XIcon size={13} color="#9CA3AF" strokeWidth={2} />
            </button>
          )}
        </div>
        )
      ) : (
        <button
          type="button"
          onClick={() => setShowOptions(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 10,
            border: '1.5px dashed #C0CCC5', background: '#FDF8F4',
            cursor: 'pointer', fontSize: 12, color: '#0d6b63', fontWeight: 600,
            marginTop: 6,
          }}
        >
          <span>📷</span>
          {label}
        </button>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </>
  )
}
