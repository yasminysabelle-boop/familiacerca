import { useEffect, useRef, useState } from 'react'
import { XIcon, Camera } from './Icons'

// Vista de cámara in-page (getUserMedia) — reemplaza <input type="file" capture>
// para el flujo de foto de medicamento. En Android, abrir la cámara nativa desde
// una PWA instalada puede matar el proceso de la app en background y perder la
// foto sin ningún aviso (diagnosticado en Medications.jsx, ver memoria del
// proyecto). getUserMedia nunca sale de la página, así que no hay ventana en la
// que el sistema pueda matar el proceso a mitad de la captura.
export default function CameraCapture({ guidance, onCapture, onCancel, onManualFallback }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('requesting') // 'requesting' | 'live' | 'denied'

  useEffect(() => {
    let cancelled = false
    async function start() {
      let stream
      try {
        // 'ideal' (no 'exact'): en una laptop sin cámara trasera esto no
        // rechaza — el navegador entrega la cámara que tenga disponible.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        try {
          // Fallback sin ningún constraint de facingMode, por si algún
          // navegador se comporta raro con el objeto facingMode en desktop.
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } catch {
          if (!cancelled) setStatus('denied')
          return
        }
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      // El <video> ya está montado (se renderiza siempre, oculto vía CSS
      // mientras status !== 'live') así que la ref ya existe en este punto.
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        // Algunos navegadores no auto-reproducen solo por el atributo
        // autoPlay cuando srcObject se asigna de forma asíncrona/tardía —
        // hay que pedir play() explícitamente.
        try { await video.play() } catch { /* bloqueado por el navegador; el usuario puede tocar el video */ }
      }
      if (!cancelled) setStatus('live')
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function handleCancel() {
    stopStream()
    onCancel()
  }

  function handleShutter() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      stopStream()
      if (blob) onCapture(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={handleCancel}
        aria-label="Cerrar cámara"
        style={{
          position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top))', zIndex: 10,
          width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: status === 'denied' ? 'white' : 'rgba(0,0,0,0.45)',
          boxShadow: status === 'denied' ? '0 4px 10px -6px rgba(30,44,58,0.25)' : 'none',
        }}
      >
        <XIcon size={16} color={status === 'denied' ? '#6B7A88' : 'white'} strokeWidth={2.2} />
      </button>

      {/* Montado siempre desde el primer render — la ref debe existir antes
          de que getUserMedia() resuelva, así que no puede depender de
          `status === 'live'` para aparecer en el DOM. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ flex: 1, width: '100%', objectFit: 'cover', display: status === 'live' ? 'block' : 'none' }}
      />

      {status === 'requesting' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#087F70', animation: 'camCaptureSpin 0.85s linear infinite' }} />
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5, fontWeight: 600, margin: 0 }}>Abriendo cámara…</p>
        </div>
      )}

      {status === 'live' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingTop: 'calc(46px + env(safe-area-inset-top))' }}>
            {guidance && (
              <span style={{
                background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'white', fontSize: 12, fontWeight: 600, padding: '8px 14px',
                borderRadius: 100, maxWidth: '78%', textAlign: 'center',
              }}>
                {guidance}
              </span>
            )}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center',
            paddingBottom: 'calc(34px + env(safe-area-inset-bottom))', paddingTop: 46,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
          }}>
            <button
              onClick={handleShutter}
              aria-label="Tomar foto"
              style={{
                width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                border: '3.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#087F70' }} />
            </button>
          </div>
        </>
      )}

      {status === 'denied' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 18, background: '#F8F4ED', padding: '0 30px', textAlign: 'center',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FBEAE4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera size={26} color="#C4664F" strokeWidth={1.8} />
          </div>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 16.5, fontWeight: 800, color: '#1E2C3A', margin: 0 }}>
            No pudimos abrir la cámara
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: '#6B7A88', margin: 0, maxWidth: '27ch' }}>
            Necesitamos permiso de cámara para tomar la foto. Puedes ingresar los datos del medicamento tú mismo.
          </p>
          <button
            onClick={onManualFallback}
            style={{
              width: '100%', marginTop: 4, padding: 13, border: 'none', borderRadius: 14,
              background: '#087F70', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(8,127,112,0.3)',
            }}
          >
            Ingresar manualmente
          </button>
        </div>
      )}

      <style>{`@keyframes camCaptureSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
