import { useEffect, useState } from 'react'
import { isKnownInstalled, checkRelatedApps, listenForInstalledEvent } from '../lib/pwaInstall'

const DISMISSED_KEY = 'fc_install_dismissed_until'

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isDismissed() {
  const until = localStorage.getItem(DISMISSED_KEY)
  if (!until) return false
  return Date.now() < Number(until)
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(() => window.__pwaPrompt ?? null)
  const [showIOS, setShowIOS] = useState(false)
  const [hidden, setHidden] = useState(() => isKnownInstalled() || isDismissed())

  useEffect(() => {
    if (hidden) return

    checkRelatedApps().then(found => { if (found) setHidden(true) })
    const stopListening = listenForInstalledEvent(() => setHidden(true))

    // Android/Desktop: catch deferred prompt if it fires after React mounts
    function onBeforeInstall(e) {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS: no beforeinstallprompt — show manual instructions
    if (isIOS() && !isKnownInstalled()) {
      setShowIOS(true)
    }

    return () => { window.removeEventListener('beforeinstallprompt', onBeforeInstall); stopListening() }
  }, [hidden])

  function dismiss(days = 30) {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + days * 864e5))
    setHidden(true)
    setPrompt(null)
    setShowIOS(false)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') dismiss(3650) // permanent
    else dismiss(7) // snooze 1 week if declined
    setPrompt(null)
  }

  const canInstall = !!prompt && !hidden
  const showIOSBanner = showIOS && !hidden

  return { canInstall, showIOSBanner, install, dismiss }
}
