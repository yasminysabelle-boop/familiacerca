import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const WARN_MS   = 25 * 60 * 1000  // 25 min → show warning
const LOGOUT_MS = 30 * 60 * 1000  // 30 min → sign out (caregivers step away frequently)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inactivityWarning, setInactivityWarning] = useState(false)

  useEffect(() => {
    // On slow/offline mobile, getSession() can hang if it needs to refresh an
    // expired access token. Cap the wait so the app never stays in loading=true forever.
    let settled = false
    function resolve(session) {
      if (settled) return
      settled = true
      setUser(session?.user ?? null)
      setLoading(false)
    }
    const timer = setTimeout(() => resolve(null), 8000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timer)
      resolve(session)
      // Refresh in the background so any server-side metadata changes
      // (e.g. admin flag set while already logged in) apply without re-login.
      if (session) supabase.auth.refreshSession().catch(() => {})
    }).catch(() => {
      clearTimeout(timer)
      resolve(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  // Ensure a Web Push subscription exists for the user in push_subscriptions.
  // This runs on every login so background push works even if the user never
  // visits Settings or Medications (the only pages that mount usePushNotifications).
  const ensurePushSubscription = useCallback(async (userId) => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey || Notification.permission !== 'granted') return
    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        const keyData = atob(
          (vapidKey + '='.repeat((4 - vapidKey.length % 4) % 4))
            .replace(/-/g, '+').replace(/_/g, '/')
        )
        const applicationServerKey = Uint8Array.from(keyData, c => c.charCodeAt(0))
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      }
      const j = sub.toJSON()
      await supabase.from('push_subscriptions').upsert(
        { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
        { onConflict: 'user_id,endpoint' }
      )
    } catch (err) {
      console.warn('[Push] ensurePushSubscription failed:', err?.message ?? String(err))
    }
  }, [])

  // Ensure Web Push subscription on login
  useEffect(() => {
    if (!user) return
    ensurePushSubscription(user.id)
  }, [user?.id, ensurePushSubscription])

  // Respaldo de OnboardingFlow.jsx: si el flag de servidor (onboarding_completed)
  // no se guardó por un corte real de red durante el onboarding (los 3 reintentos
  // de finish() no alcanzaron), se reintenta aquí en el próximo login.
  useEffect(() => {
    if (!user || user.user_metadata?.onboarding_completed) return
    if (localStorage.getItem('fc_patient_onboarding_done') !== '1') return
    supabase.auth.updateUser({ data: { onboarding_completed: true } }).then(({ data, error }) => {
      if (error) { console.warn('[Auth] reintento de onboarding_completed falló:', error); return }
      if (data?.user) setUser(data.user)
    })
  }, [user])

  // Update last_seen every 2 minutes while active
  useEffect(() => {
    if (!user) return
    const ping = () =>
      supabase.from('user_profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then()
    ping()
    const interval = setInterval(ping, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // Inactivity auto-logout: warn at 9 min, sign out at 10 min
  useEffect(() => {
    if (!user) {
      setInactivityWarning(false)
      return
    }

    let warnTimer
    let logoutTimer

    function reset() {
      setInactivityWarning(false)
      clearTimeout(warnTimer)
      clearTimeout(logoutTimer)
      warnTimer   = setTimeout(() => setInactivityWarning(true), WARN_MS)
      logoutTimer = setTimeout(() => supabase.auth.signOut(), LOGOUT_MS)
    }

    const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    EVENTS.forEach(ev => document.addEventListener(ev, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(warnTimer)
      clearTimeout(logoutTimer)
      EVENTS.forEach(ev => document.removeEventListener(ev, reset))
    }
  }, [user])

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp  = (email, password, metadata) => supabase.auth.signUp({ email, password, options: { data: metadata } })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      user, loading, signIn, signUp, signOut, inactivityWarning,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
