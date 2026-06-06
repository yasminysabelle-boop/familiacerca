// Firebase background message handler — handles FCM pushes when the app is closed
// or in the background. Runs in its own scope so it doesn't conflict with sw.js.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyANXvBz9uTaYsnnNM9a4-EU5Ei7cmZ5lGM',
  authDomain:        'familiacerca-641b8.firebaseapp.com',
  projectId:         'familiacerca-641b8',
  storageBucket:     'familiacerca-641b8.firebasestorage.app',
  messagingSenderId: '121171249678',
  appId:             '1:121171249678:web:838e51e5e18cb024b30a5f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification ?? {};
  const data = payload.data ?? {};

  const isSOS = data.type === 'SOS';
  const isAppt = data.type === 'APPOINTMENT';

  self.registration.showNotification(
    notification.title ?? 'FamiliaCerca',
    {
      body:             notification.body ?? '',
      icon:             '/icon-192.png',
      badge:            '/icon-72.png',
      tag:              isSOS ? 'sos-alert' : isAppt ? 'appointment-reminder' : 'fcm',
      data:             { url: data.url ?? '/', target_screen: data.target_screen ?? null },
      requireInteraction: isSOS,
      vibrate:          isSOS ? [300, 100, 300, 100, 300] : [200],
      actions:          isAppt ? [{ action: 'view', title: '📅 Ver cita' }] : [],
    },
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const d = event.notification.data ?? {};
  const url = d.target_screen ? `/${d.target_screen}` : (d.url ?? '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then(w => w.navigate(url));
      return clients.openWindow(url);
    }),
  );
});
