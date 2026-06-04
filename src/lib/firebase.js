import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyANXvBz9uTaYsnnNM9a4-EU5Ei7cmZ5lGM',
  authDomain:        'familiacerca-641b8.firebaseapp.com',
  projectId:         'familiacerca-641b8',
  storageBucket:     'familiacerca-641b8.firebasestorage.app',
  messagingSenderId: '121171249678',
  appId:             '1:121171249678:web:838e51e5e18cb024b30a5f',
}

const VAPID_KEY = 'BIBtYd6Ghj-OPDcolzfVLzhMrbqfqDRhsrpaJ-3qacahWZHt7H4PkyiJR-IFHfGL1kbpSc-jWfNg5V9Wo1ttweQ'

// Lazy singleton — avoids double-init across HMR reloads
let _messaging = null
function getFirebaseMessaging() {
  if (_messaging) return _messaging
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
  _messaging = getMessaging(app)
  return _messaging
}

/**
 * Requests notification permission, registers the FCM service worker under a
 * non-conflicting scope, and returns the FCM registration token (or null on
 * failure / denial).
 */
export async function requestFcmToken() {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // Use a dedicated scope so this SW doesn't displace the main sw.js
    const swReg = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/firebase-cloud-messaging-push-scope' },
    )

    const token = await getToken(getFirebaseMessaging(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    return token ?? null
  } catch (err) {
    console.warn('[FCM] Token request failed:', err)
    return null
  }
}

/**
 * Subscribes to foreground FCM messages (app is open/focused).
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback) {
  try {
    return onMessage(getFirebaseMessaging(), callback)
  } catch {
    return () => {}
  }
}
