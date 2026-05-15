import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const FamilyContext = createContext(null)

export function FamilyProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchProfile()
    } else {
      setProfile(null)
      setOwnerId(null)
      setLoading(false)
    }
  }, [user])

  async function fetchProfile() {
    setLoading(true)
    try {
      const { data: ownData } = await supabase
        .from('care_profiles').select('*').eq('user_id', user.id).maybeSingle()

      const preferMember = localStorage.getItem('fc_active_family') === 'member'

      // Only query family_members when the user has accepted an invitation
      // or has no profile of their own — avoids unnecessary queries for regular users
      if (!ownData || preferMember) {
        const { data: membership } = await supabase
          .from('family_members').select('user_id').eq('member_user_id', user.id).maybeSingle()

        if (membership) {
          const { data: ownerProfile } = await supabase
            .from('care_profiles').select('*').eq('user_id', membership.user_id).maybeSingle()
          setOwnerId(membership.user_id)
          setProfile(ownerProfile ?? null)
          return
        }
      }

      setOwnerId(user.id)
      setProfile(ownData ?? null)
    } catch {
      // On any unexpected error fall back to the user's own context
      setOwnerId(user.id)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <FamilyContext.Provider value={{ profile, ownerId, loading, refresh: fetchProfile }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  return useContext(FamilyContext)
}
