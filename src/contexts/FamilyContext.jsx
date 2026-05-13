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

    let { data } = await supabase
      .from('care_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      // User is an invited member — look up the family owner's profile
      const { data: membership } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('member_user_id', user.id)
        .maybeSingle()

      if (membership) {
        const { data: ownerProfile } = await supabase
          .from('care_profiles')
          .select('*')
          .eq('user_id', membership.user_id)
          .maybeSingle()
        data = ownerProfile
        setOwnerId(membership.user_id)
      } else {
        setOwnerId(user.id)
      }
    } else {
      setOwnerId(user.id)
    }

    setProfile(data ?? null)
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
