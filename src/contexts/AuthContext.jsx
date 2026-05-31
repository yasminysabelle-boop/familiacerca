import { createContext, useContext, useEffect, useState } from 'react'
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
    }).catch(() => {
      clearTimeout(timer)
      resolve(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, inactivityWarning }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
