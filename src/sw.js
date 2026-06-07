// FamiliaCerca Service Worker — Workbox offline support
// Source file: vite-plugin-pwa (injectManifest) processes this and injects
// self.__WB_MANIFEST with content-hashed precache entries.

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

// Build date injected by vite.config.js define — e.g. "20260607"
// Changing this on every deploy means new runtime cache names are created and
// old ones are deleted in the activate handler below.
const CACHE_VER = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'v1'

// ── Precache all build assets (app shell) ─────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Install: skip waiting immediately so the new SW activates on next load ────
// This is the critical fix: without it the SW stays in "waiting" state until
// every open tab is closed, meaning users see stale cached code after deploys.
self.addEventListener('install', () => self.skipWaiting())

// ── Activate: claim all clients + clean old runtime caches + broadcast reload ─
clientsClaim()
self.addEventListener('activate', event => {
  const VERSIONED_PREFIXES = ['navigation-', 'supabase-data-', 'supabase-storage-', 'images-', 'google-fonts-']
  event.waitUntil(Promise.all([
    // Delete runtime caches from previous deploys (different CACHE_VER)
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => VERSIONED_PREFIXES.some(p => k.startsWith(p)))
          .filter(k => !k.endsWith(CACHE_VER))
          .map(k => caches.delete(k))
      )
    ),
    // Broadcast to all open tabs so main.jsx can reload
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) c.postMessage({ type: 'SW_UPDATED' })
    }),
  ]))
})

// ── Skip-waiting on demand (kept as fallback for older main.jsx in flight) ────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Navigation: network-first, fall back to offline.html ─────────────────────
const navHandler = new NetworkFirst({
  cacheName: `navigation-${CACHE_VER}`,
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
    cacheName: `supabase-data-${CACHE_VER}`,
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
    cacheName: `supabase-storage-${CACHE_VER}`,
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
    cacheName: `images-${CACHE_VER}`,
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
    cacheName: `google-fonts-${CACHE_VER}`,
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
      data:     { url: data.url ?? '/hoy', ...(data.data ?? {}) },
      requireInteraction: data.requireInteraction ?? false,
      vibrate:  data.vibrate ?? [200],
      actions:  data.actions ?? [],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const d = event.notification.data ?? {}
  const base = d.target_screen ? `/${d.target_screen}` : (d.url ?? '/hoy')
  const target = base + (event.action ? `?action=${event.action}` : '')

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus().then(w => w.navigate(target))
      return self.clients.openWindow(target)
    })
  )
})
