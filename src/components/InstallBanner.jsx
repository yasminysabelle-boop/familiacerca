import { useState, useEffect } from 'react'

const DISMISS_KEY = 'pwa_install_dismissed_at'
const DISMISS_MS  = 7 * 24 * 60 * 60 * 1000   // 7 days
const SHOW_DELAY  = 10_000                       // 10 seconds

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

function wasDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY)
  return !!ts && Date.now() - Number(ts) < DISMISS_MS
}

function detectDevice() {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua) && !window.MSStream) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0 }}>
      <path d="M12 3v12" stroke="#C9882A" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4"  stroke="#C9882A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-3"
        stroke="#C9882A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const IOS_STEPS = [
  {
    label: 'Toca el botón compartir',
    icon: <ShareIcon />,
    desc: 'Barra inferior de Safari',
  },
  {
    label: '"Agregar a pantalla de inicio"',
    icon: <span style={{ fontSize: 17, color: '#C9882A', fontWeight: 700 }}>＋□</span>,
    desc: 'Desliza hacia abajo en el menú de opciones',
  },
  {
    label: 'Toca Agregar',
    icon: <span style={{ fontSize: 17, color: '#4A7C59', fontWeight: 700 }}>✓</span>,
    desc: '¡FamiliaCerca estará en tu pantalla de inicio!',
  },
]

export default function InstallBanner() {
  const [device]  = useState(detectDevice)
  const [visible,  setVisible]  = useState(false)
  const [prompt,   setPrompt]   = useState(null)
  const [success,  setSuccess]  = useState(false)

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return
    if (device === 'desktop') return

    let timer

    if (device === 'ios') {
      timer = setTimeout(() => setVisible(true), SHOW_DELAY)
      return () => clearTimeout(timer)
    }

    // Android — use prompt captured before React mounted
    const saved = window.__pwaPrompt
    if (saved) {
      window.__pwaPrompt = null
      timer = setTimeout(() => { setPrompt(saved); setVisible(true) }, SHOW_DELAY)
      return () => clearTimeout(timer)
    }

    function onPrompt(e) {
      e.preventDefault()
      timer = setTimeout(() => { setPrompt(e); setVisible(true) }, SHOW_DELAY)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); clearTimeout(timer) }
  }, [device])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setSuccess(true)
      setVisible(false)
      setTimeout(() => setSuccess(false), 4000)
    } else {
      dismiss()
    }
  }

  // ── Success toast ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8900,
        background: 'linear-gradient(135deg, #15803D, #166534)',
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
      }}>
        <span style={{ fontSize: 18 }}>🎉</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
          ¡FamiliaCerca instalada! Ahora recibirás notificaciones
        </span>
      </div>
    )
  }

  if (!visible) return null

  // ── iOS modal ──────────────────────────────────────────────────────────────
  if (device === 'ios') {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 8900,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 28px',
        }}
        onClick={dismiss}
      >
        <div
          style={{
            background: 'white', borderRadius: 24, padding: '24px 20px',
            width: 'min(380px, calc(100% - 32px))',
            boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <img src="/icon-72.png" alt="FamiliaCerca"
              style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
                color: '#1A1A1A', margin: '0 0 3px',
              }}>
                Instala FamiliaCerca
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                Acceso rápido · Sin usar el navegador
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Cerrar"
              style={{
                background: '#F3F4F6', border: 'none', borderRadius: '50%',
                width: 28, height: 28, cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', fontSize: 16, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#F3F4F6', marginBottom: 20 }} />

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {IOS_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Number bubble */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: '#FDF8EE', border: '1.5px solid #C9882A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#C9882A',
                }}>
                  {i + 1}
                </div>
                {/* Icon box */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: '#F9F5F1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {step.icon}
                </div>
                {/* Text */}
                <div style={{ paddingTop: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px' }}>
                    {step.label}
                  </p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Hint */}
          <p style={{
            marginTop: 20, textAlign: 'center',
            fontSize: 11, color: '#9CA3AF', lineHeight: 1.4,
          }}>
            Solo disponible en Safari · Toca fuera para cerrar
          </p>
        </div>
      </div>
    )
  }

  // ── Android / Chrome — bottom bar ──────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8900,
      background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
    }}>
      <img src="/icon-72.png" alt="" width={40} height={40}
        style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 2px' }}>
          Instala FamiliaCerca
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
          Acceso rápido y notificaciones push
        </p>
      </div>
      <button
        onClick={handleInstall}
        style={{
          padding: '9px 18px', borderRadius: 12, border: 'none', flexShrink: 0,
          background: '#C9882A', color: 'white',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(201,136,42,0.45)',
          whiteSpace: 'nowrap',
        }}
      >
        Instalar app
      </button>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
          color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 1, padding: 4,
        }}
      >
        ×
      </button>
    </div>
  )
}
