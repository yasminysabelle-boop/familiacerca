import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paywallDismissed, setPaywallDismissed] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setSub(null); setLoading(false); return }

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      // First load — create 14-day trial from account creation date
      const trialEnd = new Date(user.created_at)
      trialEnd.setDate(trialEnd.getDate() + 14)
      const { data: created } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'free',
          status: 'trial',
          trial_end_date: trialEnd.toISOString(),
        })
        .select()
        .single()
      setSub(created)
    } else {
      setSub(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const now = Date.now()
  const trialEndMs = sub?.trial_end_date ? new Date(sub.trial_end_date).getTime() : 0

  // Users with app_metadata.role === 'admin' bypass all subscription and trial checks.
  // This is set server-side via the Supabase service role key and cannot be spoofed by users.
  const isAppAdmin = user?.app_metadata?.role === 'admin'

  const isPaid    = isAppAdmin || (sub?.status === 'active' && (sub?.plan === 'familiar' || sub?.plan === 'care_plus'))
  const isTrialing = !isAppAdmin && (sub?.status === 'trial' && trialEndMs > now)
  const trialExpired = !isAppAdmin && (sub?.plan === 'free' && (sub?.status === 'expired' || (sub?.status === 'trial' && trialEndMs <= now)))
  const daysLeft  = isTrialing ? Math.max(0, Math.ceil((trialEndMs - now) / 86400000)) : 0
  const hasAI     = isAppAdmin || (isPaid && sub?.plan === 'care_plus')
  const canEdit   = isAppAdmin || isPaid || isTrialing

  const value = {
    sub, loading,
    isPaid, isTrialing, trialExpired, daysLeft, hasAI, canEdit, isAppAdmin,
    paywallDismissed,
    dismissPaywall: () => setPaywallDismissed(true),
    refresh: load,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
