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
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')

      // Force browser to check for a new SW on every app load.
      // Without this the browser only checks once every 24 h.
      reg.update().catch(() => {})

      // Primary path: listen for the new SW moving through install → activate
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          // Only reload after full activation AND when a previous SW was in
          // control (skip on first-ever install to avoid spurious reloads)
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
