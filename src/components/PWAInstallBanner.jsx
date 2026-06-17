import { useState, useEffect } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

const SHOW_DELAY = 3000

export default function PWAInstallBanner() {
  const { installed, isMobile, isIOS, canPrompt, install, dismiss, dismissed } = usePWAInstall()
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false) // iOS instructions
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isMobile || installed || dismissed) return
    // Only show banner if there's something actionable: native prompt OR iOS manual hint
    if (!canPrompt && !isIOS) return
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY)
    return () => clearTimeout(timer)
  }, [isMobile, installed, dismissed, canPrompt, isIOS])

  if (!visible || installed || dismissed) return null

  async function handleInstall() {
    if (isIOS) {
      setExpanded(v => !v)
      return
    }
    if (canPrompt) {
      const outcome = await install()
      if (outcome === 'accepted') {
        setSuccess(true)
        setTimeout(() => setVisible(false), 3500)
      } else {
        dismiss()
      }
    }
  }

  if (success) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8900,
        background: 'linear-gradient(135deg, #15803D, #166534)',
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
      }}>
        <span style={{ fontSize: 20 }}>🎉</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
          ¡FamiliaCerca instalada! Ahora recibirás notificaciones
        </span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8900,
      background: 'linear-gradient(135deg, #0d6b63, #3A6347)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
    }}>
      <div style={{
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* Logo */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={24} height={24} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="white" fillOpacity="0.15" />
            <text x="20" y="19" textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="13" fontWeight="800" fontFamily="Georgia,serif">FC</text>
            <text x="20" y="30" textAnchor="middle" dominantBaseline="middle"
              fill="white" fillOpacity="0.75" fontSize="9">♥</text>
          </svg>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 1px' }}>
            {isIOS ? 'Instala FamiliaCerca' : 'Instala FamiliaCerca en tu celular'}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {isIOS ? 'Acceso rápido desde tu pantalla de inicio' : 'Acceso rápido y notificaciones push'}
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={handleInstall}
          style={{
            padding: '8px 14px', borderRadius: 10, border: 'none', flexShrink: 0,
            background: 'white', color: '#0d6b63',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isIOS ? (expanded ? 'Cerrar' : 'Cómo instalar') : 'Instalar'}
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.60)', fontSize: 20, lineHeight: 1,
            padding: '2px 0 2px 4px', flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* iOS expanded instructions */}
      {isIOS && expanded && (
        <div style={{
          padding: '12px 16px 18px',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          {[
            { icon: '1', text: 'Toca el botón Compartir  ↑  en Safari (parte inferior de la pantalla)' },
            { icon: '2', text: 'Desliza hacia abajo y toca "Agregar a pantalla de inicio"' },
            { icon: '3', text: '¡Toca "Agregar" y ya tienes FamiliaCerca como app!' },
          ].map(s => (
            <div key={s.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'white',
              }}>
                {s.icon}
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.88)', margin: 0, lineHeight: 1.5, paddingTop: 2 }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
