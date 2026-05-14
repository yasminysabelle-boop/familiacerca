import { useState, useEffect } from 'react'

const DISMISS_KEY = 'pwa_install_dismissed_at'
const DISMISS_MS  = 7 * 24 * 60 * 60 * 1000

function shouldShow() {
  // Only mobile
  if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.innerWidth >= 768) return false
  // Already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) return false
  if (window.navigator.standalone === true) return false
  // Dismissed recently
  const ts = localStorage.getItem(DISMISS_KEY)
  if (ts && Date.now() - Number(ts) < DISMISS_MS) return false
  return true
}

export default function InstallBanner() {
  const [prompt,  setPrompt]  = useState(null)
  const [visible, setVisible] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!shouldShow()) return
    function handler(e) {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    setVisible(false)
    setPrompt(null)
    if (outcome === 'accepted') {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (success) {
    return (
      <div style={{
        margin: '0 0 0', padding: '12px 16px',
        background: 'linear-gradient(135deg, #15803D, #166534)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'white', textAlign: 'center' }}>
          ¡Instalada! 🎉 Ahora recibirás notificaciones
        </span>
      </div>
    )
  }

  if (!visible) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #C4623A, #A85130)',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 3px 16px rgba(196,98,58,0.25)',
    }}>
      <span style={{ fontSize: 13, color: 'white', flex: 1, lineHeight: 1.45 }}>
        📱 Instala FamiliaCerca en tu teléfono para recibir notificaciones
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            padding: '7px 12px', borderRadius: 10, border: 'none',
            background: 'white', color: '#C4623A',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            whiteSpace: 'nowrap', letterSpacing: '0.01em',
          }}
        >
          Instalar ahora
        </button>
        <button
          onClick={dismiss}
          style={{
            padding: '5px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'rgba(255,255,255,0.9)', fontWeight: 600,
            fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
