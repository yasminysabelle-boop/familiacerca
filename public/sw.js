// FamiliaCerca Service Worker — push notifications + offline shell

const CACHE   = 'familiacerca-v2'
const SHELL   = ['/index.html', '/manifest.json']

// ── Install: cache app shell ──────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  )
})

// ── Activate: clear old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
    ])
  )
})

// ── Fetch: offline fallback for navigation requests ───────────────
self.addEventListener('fetch', event => {
  // Only intercept same-origin GET requests
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Cache-first for shell assets, network-first otherwise
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached ?? fetch(event.request).then(res => {
        // Cache successful static asset responses
        if (res.ok && SHELL.includes(new URL(event.request.url).pathname)) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(event.request, clone))
        }
        return res
      })
    )
  )
})

// ── Push notifications ────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { data = { title: 'FamiliaCerca', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FamiliaCerca', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      tag: data.tag ?? 'med-reminder',
      data: { url: data.url ?? '/medications' },
      actions: [
        { action: 'taken',  title: '✓ Tomado' },
        { action: 'snooze', title: '⏰ 15 min' },
      ],
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data?.url ?? '/medications') +
    (event.action ? `?action=${event.action}` : '')

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
