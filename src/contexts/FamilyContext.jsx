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

    // Fetch own profile and any family membership in parallel
    const [{ data: ownData }, { data: membership }] = await Promise.all([
      supabase.from('care_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('family_members').select('user_id').eq('member_user_id', user.id).maybeSingle(),
    ])

    // Use the invited family when: user just accepted an invite (fc_active_family=member)
    // or when user has no profile of their own yet
    const preferMember = localStorage.getItem('fc_active_family') === 'member'

    if (membership && (!ownData || preferMember)) {
      const { data: ownerProfile } = await supabase
        .from('care_profiles').select('*').eq('user_id', membership.user_id).maybeSingle()
      setOwnerId(membership.user_id)
      setProfile(ownerProfile ?? null)
    } else if (ownData) {
      setOwnerId(user.id)
      setProfile(ownData)
    } else {
      setOwnerId(user.id)
      setProfile(null)
    }

    setLoading(false)
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
