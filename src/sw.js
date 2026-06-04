// FamiliaCerca Service Worker — Workbox offline support
// Source file: vite-plugin-pwa (injectManifest) processes this and injects
// self.__WB_MANIFEST with content-hashed precache entries.

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

// ── Precache all build assets (app shell) ─────────────────────────────────────
// vite-plugin-pwa injects the manifest here; each entry has a content-hash
// revision so deployments automatically bust stale caches.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Activate: claim clients + broadcast SW_UPDATED so main.jsx can reload ────
clientsClaim()
self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) c.postMessage({ type: 'SW_UPDATED' })
    })
  )
})

// ── Skip-waiting on demand (main.jsx sends this when update is found) ─────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Navigation: network-first, fall back to offline.html ─────────────────────
const navHandler = new NetworkFirst({
  cacheName: 'navigation-v1',
  networkTimeoutSeconds: 5,
  plugins: [new CacheableResponsePlugin({ statuses: [200] })],
})

registerRoute(
  new NavigationRoute(async params => {
    try {
      return await navHandler.handle(params)
    } catch {
      const offline = await matchPrecache('/offline.html')
      return offline ?? Response.error()
    }
  })
)

// ── Supabase REST API: network-first with 7-day cache fallback ────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    (url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/storage/v1/render')),
  new NetworkFirst({
    cacheName: 'supabase-data-v1',
    networkTimeoutSeconds: 8,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
  'GET'
)

// ── Supabase Storage public files: cache-first (attachments, avatars) ─────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.startsWith('/storage/v1/object/public'),
  new CacheFirst({
    cacheName: 'supabase-storage-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)

// ── Images (all origins): cache-first with 30-day expiry ─────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)

// ── Google Fonts: stale-while-revalidate ──────────────────────────────────────
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
)

// ── Global catch handler: offline fallback for document navigations ───────────
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const offline = await matchPrecache('/offline.html')
    return offline ?? Response.error()
  }
  return Response.error()
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { data = { title: 'FamiliaCerca', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FamiliaCerca', {
      body:     data.body,
      icon:     '/icon-192.png',
      badge:    '/icon-72.png',
      tag:      data.tag ?? 'fc-notification',
      data:     { url: data.url ?? '/hoy' },
      requireInteraction: data.requireInteraction ?? false,
      vibrate:  data.vibrate ?? [200],
      actions:  data.actions ?? [],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data?.url ?? '/hoy') +
    (event.action ? `?action=${event.action}` : '')

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus().then(w => w.navigate(target))
      return self.clients.openWindow(target)
    })
  )
})
