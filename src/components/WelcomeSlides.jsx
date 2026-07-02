import { useState, useRef } from 'react'
import Logo from './Logo'

const FEATURES = [
  { icon: '💊', title: 'Medicamentos', desc: 'Control diario de dosis y horarios' },
  { icon: '📅', title: 'Citas y eventos', desc: 'Calendario compartido familiar' },
  { icon: '💬', title: 'Chat familiar', desc: 'Coordina con todos en tiempo real' },
  { icon: '📊', title: 'Reportes', desc: 'Historial detallado de salud' },
  { icon: '🎙️', title: 'Memorias de voz', desc: 'Guarda momentos especiales' },
  { icon: '👨‍👩‍👧', title: 'Equipo de cuidado', desc: 'Cada quien con su rol' },
]

export default function WelcomeSlides({ onDone }) {
  const [slide, setSlide] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  function goNext() { if (slide < 2) setSlide(s => s + 1) }
  function goPrev() { if (slide > 0) setSlide(s => s - 1) }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    touchStartX.current = null
    touchStartY.current = null
    if (dy > Math.abs(dx) || Math.abs(dx) < 40) return
    if (dx > 0) goNext()
    else goPrev()
  }

  function handleRegister() { onDone(); window.location.href = '/register' }
  function handleLogin()    { onDone(); window.location.href = '/login' }
  function handleSkip()     { onDone(); window.location.href = '/login' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Sliding panel ── */}
      <div style={{
        display: 'flex',
        width: '300vw',
        height: '100%',
        transform: `translateX(calc(-${slide} * 100vw))`,
        transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
      }}>

        {/* ── Slide 1: Bienvenida ── */}
        <div style={{
          width: '100vw', height: '100%', flexShrink: 0,
          background: '#F8F4ED',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', padding: '0 36px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 26 }}>
              <Logo size={84} />
            </div>
            <h1 style={{
              color: '#143C32',
              fontFamily: 'Georgia, serif',
              fontSize: 40, fontWeight: 700,
              margin: '0 0 10px',
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
            }}>
              FamiliaCerca
            </h1>
            <p style={{
              color: '#6B7280',
              fontSize: 21, fontWeight: 500,
              letterSpacing: '0.04em',
              margin: '0 0 18px',
              fontFamily: 'Georgia, serif',
            }}>
              Cuidado con amor
            </p>
            <p style={{
              color: '#9AA89E',
              fontSize: 15, lineHeight: 1.65,
              margin: 0, maxWidth: 290,
            }}>
              La app que conecta a toda la familia para cuidar mejor a quien más quieres.
            </p>
          </div>
        </div>

        {/* ── Slide 2: Funciones ── */}
        <div style={{
          width: '100vw', height: '100%', flexShrink: 0,
          background: '#F8F4ED',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Membrete superior */}
          <div style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 48px)',
            paddingBottom: 24,
            paddingLeft: 28, paddingRight: 28,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{ marginBottom: 18 }}>
              <Logo size={40} />
            </div>
            <p style={{
              color: '#6B7280', fontSize: 11, margin: '0 0 8px',
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
            }}>
              Todo en un solo lugar
            </p>
            <h2 style={{
              color: '#143C32',
              fontFamily: 'Georgia, serif',
              fontSize: 28, fontWeight: 700,
              margin: 0, lineHeight: 1.25,
            }}>
              Toda la familia<br />conectada
            </h2>
          </div>

          {/* Features grid */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '4px 16px 140px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            alignContent: 'start',
          }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'white', borderRadius: 16,
                border: '1px solid #EDE5D8',
                padding: '16px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <span style={{ fontSize: 28, display: 'block', marginBottom: 8, lineHeight: 1 }}>
                  {f.icon}
                </span>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
                  {f.title}
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.4 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Slide 3: CTA ── */}
        <div style={{
          width: '100vw', height: '100%', flexShrink: 0,
          background: '#F8F4ED',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 28px',
          textAlign: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Membrete */}
            <div style={{ marginBottom: 28 }}>
              <Logo size={40} />
            </div>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'white',
              border: '1.5px solid #EDE5D8',
              borderRadius: 50, padding: '7px 18px',
              marginBottom: 24,
            }}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <span style={{ color: '#143C32', fontSize: 14, fontWeight: 700 }}>14 días gratis</span>
            </div>

            <h2 style={{
              color: '#143C32',
              fontFamily: 'Georgia, serif',
              fontSize: 36, fontWeight: 700,
              margin: '0 0 14px', lineHeight: 1.15,
            }}>
              Empieza hoy<br />sin costo
            </h2>
            <p style={{
              color: '#6B7280',
              fontSize: 15, lineHeight: 1.65,
              margin: '0 0 40px',
            }}>
              Sin tarjeta de crédito.<br />Sin contratos. Cancela cuando quieras.
            </p>

            {/* Register */}
            <button
              onClick={handleRegister}
              style={{
                width: '100%', padding: '18px',
                borderRadius: 16,
                background: '#143C32',
                color: 'white',
                fontSize: 17, fontWeight: 800,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(20,60,50,0.18)',
                marginBottom: 14,
                letterSpacing: '-0.2px',
              }}
            >
              Crear cuenta gratis →
            </button>

            {/* Login */}
            <button
              onClick={handleLogin}
              style={{
                width: '100%', padding: '15px',
                borderRadius: 16,
                background: 'transparent',
                border: '1.5px solid #143C32',
                color: '#143C32',
                fontSize: 15, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ya tengo cuenta → Iniciar sesión
            </button>
          </div>
        </div>
      </div>

      {/* ── Skip button (solo slides 1 y 2) ── */}
      {slide < 2 && (
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 16px)',
            right: 20,
            zIndex: 10,
            background: 'rgba(0,0,0,0.06)',
            border: '1px solid #EDE5D8',
            borderRadius: 20,
            color: '#6B7280',
            fontSize: 13, fontWeight: 600,
            padding: '6px 15px',
            cursor: 'pointer',
          }}
        >
          Omitir
        </button>
      )}

      {/* ── Dots + Siguiente (oculto en slide 3 que tiene sus propios CTAs) ── */}
      {slide < 2 && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom) + 36px)',
          left: 0, right: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 22,
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
            {[0, 1, 2].map(i => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                style={{
                  width: i === slide ? 28 : 8,
                  height: 8,
                  borderRadius: 4,
                  padding: 0, border: 'none', cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: i === slide ? '#E9826E' : '#D4C9BB',
                  boxShadow: 'none',
                }}
              />
            ))}
          </div>

          {/* Siguiente */}
          <button
            onClick={goNext}
            style={{
              pointerEvents: 'auto',
              padding: '15px 48px',
              borderRadius: 50,
              background: '#143C32',
              color: 'white',
              fontSize: 16, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(20,60,50,0.18)',
              letterSpacing: '-0.2px',
            }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
