import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const FamilyContext = createContext(null)

export function FamilyProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [memberRole, setMemberRole] = useState(null) // null = owner/admin, 'cuidador' | 'familiar' = invited member
  const [loading, setLoading] = useState(true)

  // Switcher state — only populated when the user belongs to 2+ families
  const [hasBoth, setHasBoth] = useState(false)
  const [activeFamily, setActiveFamily] = useState('owner') // 'owner' | 'member'
  const [ownPatientName, setOwnPatientName] = useState(null)
  const [memberPatientName, setMemberPatientName] = useState(null)

  useEffect(() => {
    if (user) {
      fetchProfile()
    } else {
      setProfile(null)
      setOwnerId(null)
      setMemberRole(null)
      setHasBoth(false)
      setActiveFamily('owner')
      setOwnPatientName(null)
      setMemberPatientName(null)
      setLoading(false)
    }
  }, [user])

  async function fetchProfile() {
    setLoading(true)
    try {
      // Always fetch own profile and membership in parallel so we can detect both
      const [{ data: ownData }, { data: membership }] = await Promise.all([
        supabase.from('care_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('family_members').select('user_id, role').eq('member_user_id', user.id).maybeSingle(),
      ])

      const both = !!(ownData && membership)
      setHasBoth(both)
      setOwnPatientName(ownData?.name ?? null)

      const preferMember = localStorage.getItem('fc_active_family') === 'member'
      const useMember = !!membership && (!ownData || preferMember)

      if (membership) {
        // Fetch the invited family's care profile — needed for the switcher label
        // and as the active profile when viewing as member
        const { data: ownerProfile } = await supabase
          .from('care_profiles').select('*').eq('user_id', membership.user_id).maybeSingle()
        setMemberPatientName(ownerProfile?.name ?? null)

        if (useMember) {
          setOwnerId(membership.user_id)
          setMemberRole(membership.role ?? 'familiar')
          setProfile(ownerProfile ?? null)
          setActiveFamily('member')
          return
        }
      } else {
        setMemberPatientName(null)
      }

      // Viewing as owner
      setOwnerId(user.id)
      setMemberRole(null)
      setProfile(ownData ?? null)
      setActiveFamily('owner')
    } catch {
      setOwnerId(user.id)
      setMemberRole(null)
      setProfile(null)
      setActiveFamily('owner')
    } finally {
      setLoading(false)
    }
  }

  function switchFamily(target) {
    localStorage.setItem('fc_active_family', target)
    fetchProfile()
  }

  return (
    <FamilyContext.Provider value={{
      profile, ownerId, memberRole, loading, refresh: fetchProfile,
      hasBoth, activeFamily, ownPatientName, memberPatientName, switchFamily,
    }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  return useContext(FamilyContext)
}
