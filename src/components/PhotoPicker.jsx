import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Elegir foto (nov 2026): en Android 14+ un <input type="file"> sin "capture"
// abre solo la galería y no ofrece la cámara. Este selector siempre da las
// dos opciones. El handler recibe el mismo evento de siempre (e.target.files).
//
//   const photo = usePhotoPicker(handlePhoto)
//   <button onClick={photo.open}>…</button>
//   {photo.element}

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

export function usePhotoPicker(onChange, { title = 'Agregar foto' } = {}) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [open, setOpen] = useState(false)

  const pick = ref => { setOpen(false); if (ref.current) ref.current.value = ''; setTimeout(() => ref.current?.click(), 50) }
  const btn = primary => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px',
    borderRadius: 16, fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textAlign: 'left',
    border: primary ? 'none' : '1.5px solid #E6E3DB', background: primary ? '#0C6C9C' : 'white',
    color: primary ? 'white' : '#14303D',
  })

  const element = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onChange} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onChange} style={{ display: 'none' }} />
      {open && createPortal(
        <div role="dialog" aria-label={title} onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(8,30,42,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '24px 24px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom, 0px))', fontFamily: SANS, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 800, color: '#14303D' }}>{title}</p>
            <button onClick={() => pick(cameraRef)} style={btn(true)}><span style={{ fontSize: 22 }}>📷</span> Tomar foto</button>
            <button onClick={() => pick(galleryRef)} style={btn(false)}><span style={{ fontSize: 22 }}>🖼️</span> Elegir de galería</button>
            <button onClick={() => setOpen(false)} style={{ marginTop: 2, padding: 12, background: 'none', border: 'none', fontSize: 16, color: '#4E6470', cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
  return { open: () => setOpen(true), element }
}
