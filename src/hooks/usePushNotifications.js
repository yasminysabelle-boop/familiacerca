import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function usePushNotifications() {
  const { user, retryFcm } = useAuth()
  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [subscribeError, setSubscribeError] = useState(null)
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && !!VAPID_PUBLIC_KEY

  async function subscribe() {
    if (!supported || !user) return
    setSubscribeError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // Verify the browser subscription is still in the DB (not deleted after a 410)
        const { data: dbSub } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', existing.endpoint)
          .maybeSingle()
        if (dbSub) {
          setSubscribed(true)
          return
        }
        // DB record was deleted (stale 410) — clear browser subscription and create fresh one
        await existing.unsubscribe()
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      )
      if (error) {
        console.warn('[usePushNotifications] upsert error:', error)
        setSubscribeError(error.message)
      } else {
        setSubscribed(true)
      }
    } catch (err) {
      console.warn('[usePushNotifications] subscribe error:', err)
      setSubscribeError(err?.message ?? 'Error al suscribirse')
    }
  }

  // Force-clears the browser subscription and creates a new one — use after stale token detection
  async function resubscribe() {
    if (!supported || !user) return
    setSubscribed(false)
    setSubscribeError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      )
      if (error) {
        console.warn('[usePushNotifications] resubscribe upsert error:', error)
        setSubscribeError(error.message)
      } else {
        setSubscribed(true)
      }
    } catch (err) {
      console.warn('[usePushNotifications] resubscribe error:', err)
      setSubscribeError(err?.message ?? 'Error al reactivar')
    }
  }

  async function requestAndSubscribe() {
    if (!supported) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      await subscribe()
      // FCM token was likely not saved at login (permission was default/denied then).
      // Save it now so background FCM push is available immediately after grant.
      retryFcm?.()
    }
  }

  useEffect(() => {
    if (!user || permission !== 'granted') return
    subscribe()
  }, [user])

  return { permission, subscribed, supported, subscribeError, requestAndSubscribe, resubscribe }
}
