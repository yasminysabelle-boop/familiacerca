import { useState, useEffect } from 'react'

const DISMISS_KEY = 'pwa_install_dismissed_at'
const DISMISS_MS  = 7 * 24 * 60 * 60 * 1000
const SHOW_DELAY  = 4000 // ms before banner appears

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

function isDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY)
  return ts && Date.now() - Number(ts) < DISMISS_MS
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

export default function InstallBanner() {
  const [prompt,   setPrompt]   = useState(null)   // BeforeInstallPromptEvent
  const [visible,  setVisible]  = useState(false)
  const [iosHint,  setIosHint]  = useState(false)  // iOS manual instructions
  const [success,  setSuccess]  = useState(false)

  useEffect(() => {
    // Already installed or dismissed recently — do nothing
    if (isStandalone() || isDismissed()) return

    let timer

    if (isIOS()) {
      // iOS Safari never fires beforeinstallprompt — show manual instructions instead
      timer = setTimeout(() => setIosHint(true), SHOW_DELAY)
      return () => clearTimeout(timer)
    }

    // Use prompt captured in index.html inline script (fires before React mounts)
    if (window.__pwaPrompt) {
      const saved = window.__pwaPrompt
      window.__pwaPrompt = null
      timer = setTimeout(() => { setPrompt(saved); setVisible(true) }, SHOW_DELAY)
      return () => clearTimeout(timer)
    }

    // Capture event if it fires after component mounts (rare, but possible)
    function handler(e) {
      timer = setTimeout(() => { setPrompt(e); setVisible(true) }, SHOW_DELAY)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    setVisible(false)
    setPrompt(null)
    if (outcome === 'accepted') {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    } else {
      dismiss()
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
    setIosHint(false)
  }

  if (success) {
    return (
      <div style={{
        padding: '12px 16px', margin: '0 12px 12px',
        background: 'linear-gradient(135deg, #15803D, #166534)',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'white', textAlign: 'center' }}>
          ¡Instalada! 🎉 Ahora recibirás notificaciones
        </span>
      </div>
    )
  }

  // iOS: manual "Add to Home Screen" guidance
  if (iosHint) {
    return (
      <div style={{
        margin: '0 12px 12px',
        background: 'white',
        border: '1.5px solid #EDE5D8',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>📱</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
              Instala FamiliaCerca en tu dispositivo
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px', lineHeight: 1.5 }}>
              Toca <strong>compartir</strong> <span style={{ fontSize: 14 }}>↑</span> y luego
              {' '}<strong>"Agregar a pantalla de inicio"</strong>
            </p>
          </div>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#9CA3AF', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  if (!visible) return null

  // Android / desktop Chrome: native install prompt
  return (
    <div style={{
      margin: '0 12px 12px',
      background: 'linear-gradient(135deg, #4A7C59, #3A6347)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 20px rgba(196,98,58,0.3)',
    }}>
      <img src="/icon-72.png" alt="" width={40} height={40}
        style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 2px' }}>
          Instala FamiliaCerca en tu dispositivo
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
          Acceso rápido y notificaciones push
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: 'white', color: '#4A7C59',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Instalar
        </button>
        <button
          onClick={dismiss}
          style={{
            padding: '6px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'rgba(255,255,255,0.9)', fontWeight: 600,
            fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
