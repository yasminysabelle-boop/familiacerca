import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Snapshot before any SW registration runs — true only when an existing SW
  // was already controlling this page, i.e. this is a returning session.
  // Used to skip the update banner on first-ever install.
  const hadController = !!navigator.serviceWorker.controller

  function showUpdateBanner() {
    if (document.getElementById('sw-update-banner')) return
    const banner = document.createElement('div')
    banner.id = 'sw-update-banner'
    banner.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:#1A1A1A', 'color:#fff', 'padding:12px 14px 12px 16px',
      'border-radius:16px', 'display:flex', 'align-items:center', 'gap:12px',
      'z-index:99999', 'font-family:system-ui,sans-serif', 'font-size:14px',
      'box-shadow:0 4px 24px rgba(0,0,0,0.35)', 'max-width:calc(100vw - 32px)',
    ].join(';')
    const label = document.createElement('span')
    label.textContent = 'Nueva versión disponible'
    const btn = document.createElement('button')
    btn.textContent = 'Actualizar'
    btn.style.cssText = [
      'padding:7px 14px', 'border-radius:10px', 'border:none',
      'background:#0d6b63', 'color:#fff', 'font-size:13px', 'font-weight:700',
      'cursor:pointer', 'white-space:nowrap', 'flex-shrink:0',
    ].join(';')
    btn.addEventListener('click', () => window.location.reload())
    banner.appendChild(label)
    banner.appendChild(btn)
    document.body.appendChild(banner)
  }

  window.addEventListener('load', async () => {
    // Register Firebase messaging SW immediately if permission already granted.
    // This ensures the background handler is active on every app start, not just
    // after requestFcmToken() runs at login time.
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
      }).catch(() => {})
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js')

      // Force browser to check for a new SW on every app load.
      // Without this the browser only checks once every 24 h.
      reg.update().catch(() => {})

      // Primary path: new SW found → tell it to skip waiting immediately,
      // then show the update banner so the user can reload when ready.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed') {
            sw.postMessage({ type: 'SKIP_WAITING' })
          }
          if (sw.state === 'activated' && hadController) {
            showUpdateBanner()
          }
        })
      })
    } catch {
      // SW registration failed (e.g. private browsing) — app works without it
    }

    // Fallback: the SW itself broadcasts SW_UPDATED after activate.
    // Guard with hadController so first-ever installs don't show the banner.
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED' && hadController) {
        showUpdateBanner()
      }
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
