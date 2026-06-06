import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  // Guard: prevents double-reload if both update paths fire simultaneously
  let swReloading = false
  function reloadOnce() {
    if (swReloading) return
    swReloading = true
    window.location.reload()
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

      // Primary path: new SW found → tell it to skip waiting immediately
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed') {
            // Tell the waiting SW to activate immediately
            sw.postMessage({ type: 'SKIP_WAITING' })
          }
          if (sw.state === 'activated' && navigator.serviceWorker.controller) {
            reloadOnce()
          }
        })
      })
    } catch {
      // SW registration failed (e.g. private browsing) — app works without it
    }

    // Fallback: the SW itself broadcasts SW_UPDATED after activate
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') reloadOnce()
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
