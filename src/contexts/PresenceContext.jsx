import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useFamily } from './FamilyContext'

const PresenceContext = createContext(new Set())

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => {
    if (!user?.id || !ownerId) return

    const channel = supabase.channel(`family-presence:${ownerId}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: user.id })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, ownerId])

  return (
    <PresenceContext.Provider value={onlineIds}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  return useContext(PresenceContext)
}
