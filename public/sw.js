// FamiliaCerca Service Worker — handles push notifications

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

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(clients.claim()))
