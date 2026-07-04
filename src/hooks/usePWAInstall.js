import { useState, useEffect } from 'react'
import { isKnownInstalled, checkRelatedApps, listenForInstalledEvent } from '../lib/pwaInstall'

const DISMISS_KEY = 'pwa_install_dismissed_at'
const DISMISS_MS  = 7 * 24 * 60 * 60 * 1000

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent)
}

function isMobileDevice() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent)
}

function wasDismissedRecently() {
  const ts = localStorage.getItem(DISMISS_KEY)
  return !!(ts && Date.now() - Number(ts) < DISMISS_MS)
}

export function usePWAInstall() {
  const [installed, setInstalled] = useState(isKnownInstalled)
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(wasDismissedRecently)

  useEffect(() => {
    if (installed) return

    checkRelatedApps().then(found => { if (found) setInstalled(true) })
    const stopListening = listenForInstalledEvent(() => setInstalled(true))

    // Use prompt captured by the inline script in index.html before React mounts
    if (window.__pwaPrompt) {
      setPrompt(window.__pwaPrompt)
      window.__pwaPrompt = null
      return stopListening
    }

    function handler(e) {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => { window.removeEventListener('beforeinstallprompt', handler); stopListening() }
  }, [installed])

  async function install() {
    if (!prompt) return 'no-prompt'
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    if (outcome === 'accepted') setInstalled(true)
    return outcome
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  return {
    installed,
    isMobile: isMobileDevice(),
    isIOS: isIOSDevice(),
    isAndroid: isAndroidDevice(),
    canPrompt: !!prompt,
    install,
    dismiss,
    dismissed,
  }
}
