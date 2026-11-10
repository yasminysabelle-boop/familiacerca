import { useEffect, useState } from 'react'

// Recorrido de bienvenida: 3 globitos que salen UNA sola vez la primera vez
// que alguien abre el Inicio (UX nov 2026). Ilumina cada parte y explica en
// palabras de casa para qué sirve. Se puede saltar.

const KEY = 'fc_tour_done'
const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

const STEPS = [
  { sel: '[data-tour="card"]', title: 'Así va el cuidado hoy', text: 'Aquí ves de un vistazo cómo está tu familiar. Toca los botones blancos para resolver lo que falta.' },
  { sel: '[data-tour="nav-meds"]', title: 'Las medicinas', text: 'Aquí agregas las medicinas y marcas cuando se las dan. Toda la familia lo ve al momento.' },
  { sel: '[data-tour="nav-chat"]', title: 'Habla con tu familia', text: 'Un chat solo para el cuidado, para que nada se pierda entre los mensajes de WhatsApp.' },
]

function readDone() {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}

export default function FirstTour() {
  const [step, setStep] = useState(-1)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (readDone()) return
    // Espera a que el Inicio termine de cargar (que exista la tarjeta) para empezar.
    let tries = 0
    const t = setInterval(() => {
      tries++
      if (document.querySelector(STEPS[0].sel) || tries > 20) { clearInterval(t); setStep(0) }
    }, 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (step < 0) return
    const measure = () => {
      const el = document.querySelector(STEPS[step].sel)
      if (!el) { setRect(null); return }
      if (step === 0) el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const t = setTimeout(measure, 350)
    const iv = setInterval(() => {
      const el = document.querySelector(STEPS[step].sel)
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect(prev => (prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.height - r.height) < 1) ? prev : { top: r.top, left: r.left, width: r.width, height: r.height })
    }, 300)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); clearInterval(iv); window.removeEventListener('resize', measure) }
  }, [step])

  function finish() {
    try { localStorage.setItem(KEY, '1') } catch { /* sin almacenamiento */ }
    setStep(-1)
  }

  if (step < 0) return null
  const s = STEPS[step]
  const pad = 6
  const vh = window.innerHeight
  const below = rect ? rect.top + rect.height + 190 < vh : true
  const cardTop = rect
    ? (below ? rect.top + rect.height + pad + 14 : Math.max(16, rect.top - pad - 14 - 240))
    : vh / 2 - 90

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} role="dialog" aria-label="Recorrido de bienvenida">
      {rect ? (
        <div style={{
          position: 'fixed', top: rect.top - pad, left: rect.left - pad,
          width: rect.width + pad * 2, height: rect.height + pad * 2,
          borderRadius: 20, boxShadow: '0 0 0 9999px rgba(8, 30, 42, 0.62)',
          border: '3px solid #4FD0E0', pointerEvents: 'none', transition: 'all 0.3s ease',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8, 30, 42, 0.62)' }} />
      )}
      <div style={{
        position: 'fixed', left: 16, right: 16, top: cardTop, maxWidth: 420, margin: '0 auto',
        background: 'white', borderRadius: 20, padding: '18px 18px 14px',
        boxShadow: '0 18px 40px rgba(0,0,0,0.3)', fontFamily: SANS,
      }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#A3452F' }}>Paso {step + 1} de {STEPS.length}</p>
        <p style={{ margin: '4px 0 6px', fontSize: 19, fontWeight: 800, color: '#14303D' }}>{s.title}</p>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: '#30454F' }}>{s.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', padding: '10px 4px', fontSize: 16, color: '#5E7480', cursor: 'pointer' }}>
            Saltar
          </button>
          <button
            onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : finish())}
            style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: '#0C6C9C', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
          >
            {step + 1 < STEPS.length ? 'Siguiente →' : '¡Entendido!'}
          </button>
        </div>
      </div>
    </div>
  )
}
