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
      // First load — create trial record
      const trialEnd = new Date(user.created_at)
      trialEnd.setDate(trialEnd.getDate() + 14)
      const { data: created } = await supabase
        .from('subscriptions')
        .insert({ user_id: user.id, plan: 'trial', status: 'trialing', trial_end_date: trialEnd.toISOString() })
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
  const periodEndMs = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : 0

  const isPaid = sub?.status === 'active' && (sub?.plan === 'familiar' || sub?.plan === 'care_plus')
  const isTrialing = sub?.status === 'trialing' && trialEndMs > now
  const trialExpired = sub?.status === 'trialing' && trialEndMs <= now
  const daysLeft = isTrialing ? Math.max(0, Math.ceil((trialEndMs - now) / 86400000)) : 0
  const hasAI = isPaid && sub?.plan === 'care_plus'
  const canEdit = isPaid || isTrialing

  const value = {
    sub, loading,
    isPaid, isTrialing, trialExpired, daysLeft, hasAI, canEdit,
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
