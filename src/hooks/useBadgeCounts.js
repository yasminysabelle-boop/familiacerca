import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'
import { useAuth } from '../contexts/AuthContext'

export function useBadgeCounts() {
  const { ownerId } = useFamily()
  const { user } = useAuth()
  const [homeBadge, setHomeBadge]   = useState(0)
  const [familyBadge, setFamilyBadge] = useState(0)

  useEffect(() => {
    if (!ownerId || !user) return
    let cancelled = false

    async function fetch() {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
      const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString()

      // 1) Pending medications today
      const [{ data: meds }, { data: logs }] = await Promise.all([
        supabase.from('medications').select('id').eq('user_id', ownerId),
        supabase.from('medication_logs').select('medication_id')
          .eq('user_id', ownerId).eq('log_date', today).eq('status', 'confirmed'),
      ])
      const confirmedIds = new Set((logs ?? []).map(l => l.medication_id))
      const pendingMeds = (meds ?? []).filter(m => !confirmedIds.has(m.id)).length

      // 2) Pending care routines today (logs with null completion)
      const { data: careLogs } = await supabase
        .from('daily_care_logs')
        .select('id, status')
        .eq('user_id', ownerId)
        .eq('log_date', today)
      const completedRoutines = (careLogs ?? []).filter(l => l.status !== 'no_completado').length
      // We count pending as max(0, totalItems - completedRoutines) — use 7 as a rough daily count
      const pendingRoutines = Math.max(0, 7 - completedRoutines)

      if (!cancelled) setHomeBadge(pendingMeds + pendingRoutines)

      // 3) Unread chat messages (sent after user's last visit — use created_at > 10min ago as proxy)
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { count: chatCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .neq('user_id', user.id)
        .gte('created_at', tenMinAgo)

      // 4) Pending family invitations
      const { count: pendingCount } = await supabase
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId)
        .is('member_user_id', null)

      if (!cancelled) setFamilyBadge((chatCount ?? 0) + (pendingCount ?? 0))
    }

    fetch()
    const interval = setInterval(fetch, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [ownerId, user?.id])

  return { homeBadge, familyBadge }
}
