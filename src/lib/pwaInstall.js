const KEY = 'fc_pwa_installed'

export function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

export function isKnownInstalled() {
  return isStandaloneDisplay() || localStorage.getItem(KEY) === '1'
}

export function markInstalled() {
  localStorage.setItem(KEY, '1')
}

export async function checkRelatedApps() {
  if (!navigator.getInstalledRelatedApps) return false
  const apps = await navigator.getInstalledRelatedApps()
  if (apps.length) markInstalled()
  return apps.length > 0
}

export function listenForInstalledEvent(cb) {
  const handler = () => { markInstalled(); cb() }
  window.addEventListener('appinstalled', handler)
  return () => window.removeEventListener('appinstalled', handler)
}
