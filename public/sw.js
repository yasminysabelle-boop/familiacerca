// FamiliaCerca Service Worker — offline caching + push notifications

const CACHE_VER = 'familiacerca-v3'

// Static assets whose URLs are stable (not content-hashed by Vite)
const PRECACHE = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-72.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
  '/icons.svg',
]

// ── Install: precache known static assets ─────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_VER).then(cache =>
      // Individual fetches so one 404 can't abort the whole install
      Promise.allSettled(
        PRECACHE.map(url =>
          fetch(url).then(res => { if (res.ok) cache.put(url, res) }).catch(() => {})
        )
      )
    )
  )
})

// ── Activate: clear old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
      ),
    ])
  )
})

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Never intercept cross-origin requests (Supabase, Stripe, Google, etc.)
  if (url.origin !== self.location.origin) return

  // Navigation → network-first, cache index.html, fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_VER).then(c => c.put('/index.html', clone))
          }
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Vite hashed bundles (/assets/*.js, /assets/*.css) — immutable, cache-first
  // Content hash in filename means a new deploy = new URL = cache miss = fresh fetch
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_VER).then(c => c.put(event.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Everything else (icons, manifest, fonts) — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_VER).then(cache =>
      cache.match(event.request).then(cached => {
        const revalidate = fetch(event.request)
          .then(res => {
            if (res.ok) cache.put(event.request, res.clone())
            return res
          })
          .catch(() => cached)
        return cached ?? revalidate
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
      data: { url: data.url ?? '/hoy' },
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
  const target = (event.notification.data?.url ?? '/hoy') +
    (event.action ? `?action=${event.action}` : '')

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus().then(w => w.navigate(target))
      return clients.openWindow(target)
    })
  )
})
