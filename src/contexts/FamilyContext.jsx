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
    // Safety net: if Supabase never responds on slow mobile, unblock after 8 s
    const timer = setTimeout(() => {
      setOwnerId(user.id)
      setMemberRole(null)
      setProfile(null)
      setActiveFamily('owner')
      setLoading(false)
    }, 8000)
    try {
      const preferMember = localStorage.getItem('fc_active_family') === 'member'

      // Always fetch own profile and membership in parallel so we can detect both
      const [{ data: ownData }, { data: membership }] = await Promise.all([
        supabase.from('care_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('family_members').select('user_id, role').eq('member_user_id', user.id).maybeSingle(),
      ])

      // ------------------------------------------------------------------
      // If the family_members RLS policy hasn't been applied yet, the query
      // above silently returns null for invited members.  Fall back to the
      // owner_id we stored in localStorage during the join flow.
      // ------------------------------------------------------------------
      let effectiveMembership = membership
      if (!membership) {
        const storedOwnerId = localStorage.getItem('fc_member_owner_id')
        if (storedOwnerId && preferMember) {
          const { data: ownerProfile } = await supabase
            .from('care_profiles').select('*').eq('user_id', storedOwnerId).maybeSingle()
          if (ownerProfile) {
            setHasBoth(!!ownData)
            setOwnPatientName(ownData?.name ?? null)
            setMemberPatientName(ownerProfile.name ?? null)
            const useMember = !ownData || preferMember
            if (useMember) {
              setOwnerId(storedOwnerId)
              setMemberRole('familiar')
              setProfile(ownerProfile)
              setActiveFamily('member')
              return
            }
          }
        }
      }

      const both = !!(ownData && effectiveMembership)
      setHasBoth(both)
      setOwnPatientName(ownData?.name ?? null)

      const useMember = !!effectiveMembership && (!ownData || preferMember)

      if (effectiveMembership) {
        // Fetch the invited family's care profile — needed for the switcher label
        // and as the active profile when viewing as member
        const { data: ownerProfile } = await supabase
          .from('care_profiles').select('*').eq('user_id', effectiveMembership.user_id).maybeSingle()
        setMemberPatientName(ownerProfile?.name ?? null)

        if (useMember) {
          setOwnerId(effectiveMembership.user_id)
          setMemberRole(effectiveMembership.role ?? 'familiar')
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
      clearTimeout(timer)
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
