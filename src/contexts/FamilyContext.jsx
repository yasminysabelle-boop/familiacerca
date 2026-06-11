import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const FamilyContext = createContext(null)

export function FamilyProvider({ children }) {
  const { user } = useAuth()
  const [families, setFamilies] = useState([])
  const [activeOwnerId, setActiveOwnerId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSelector, setNeedsSelector] = useState(false)
  const loadFamiliesRef = useRef(null)

  useEffect(() => {
    if (user) loadFamilies()
    else reset()
  }, [user])

  useEffect(() => {
    function onPatientUpdated() { loadFamiliesRef.current?.() }
    window.addEventListener('patientProfileUpdated', onPatientUpdated)
    return () => window.removeEventListener('patientProfileUpdated', onPatientUpdated)
  }, [])

  function reset() {
    setFamilies([])
    setActiveOwnerId(null)
    setNeedsSelector(false)
    setLoading(false)
  }

  async function loadFamilies() {
    setLoading(true)
    const timer = setTimeout(() => {
      const fallback = [{ ownerId: user.id, patientName: null, patientPhotoUrl: null, role: null, profile: null }]
      setFamilies(fallback)
      setActiveOwnerId(user.id)
      setNeedsSelector(false)
      setLoading(false)
    }, 8000)

    try {
      const [{ data: ownData }, { data: memberships }, { data: ownPatient }] = await Promise.all([
        supabase.from('care_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('family_members').select('user_id, role').eq('member_user_id', user.id).neq('user_id', user.id),
        supabase.from('patient_profiles').select('nombre_completo').eq('owner_id', user.id).maybeSingle(),
      ])

      const built = []

      if (ownData) {
        built.push({
          ownerId: user.id,
          patientName: ownPatient?.nombre_completo || ownData.name || null,
          patientPhotoUrl: ownData.photo_url ?? null,
          role: null,
          profile: ownData,
        })
      }

      if (memberships?.length) {
        const memberOwnerIds = memberships.map(m => m.user_id)
        const [{ data: ownerProfiles }, { data: memberPatients }, { data: ownerUserProfiles }] = await Promise.all([
          supabase.from('care_profiles').select('*').in('user_id', memberOwnerIds),
          supabase.from('patient_profiles').select('owner_id, nombre_completo').in('owner_id', memberOwnerIds),
          supabase.from('user_profiles').select('id, full_name, email').in('id', memberOwnerIds),
        ])
        const profileMap = {}
        ;(ownerProfiles ?? []).forEach(p => { profileMap[p.user_id] = p })
        const patientNameMap = {}
        ;(memberPatients ?? []).forEach(pp => { if (pp.nombre_completo) patientNameMap[pp.owner_id] = pp.nombre_completo })
        const ownerUserProfileMap = {}
        ;(ownerUserProfiles ?? []).forEach(p => { ownerUserProfileMap[p.id] = p })

        for (const m of memberships) {
          const op = profileMap[m.user_id]
          const role = m.role ?? 'familiar'
          localStorage.setItem('fc_member_role_' + m.user_id, role)
          built.push({
            ownerId: m.user_id,
            patientName: (() => {
            const fromPatient = patientNameMap[m.user_id]
            const careProfileName = op?.name
            const fromCare = careProfileName?.includes('@') ? null : careProfileName?.trim()
            return fromPatient || fromCare || null
          })(),
            patientPhotoUrl: op?.photo_url ?? null,
            role,
            profile: op ?? null,
          })
        }
      }

      // Fallback: localStorage for when RLS hasn't propagated to family_members yet
      if (built.length <= 1) {
        const storedOwnerId = localStorage.getItem('fc_member_owner_id')
        const storedContext = localStorage.getItem('fc_active_context')
        if (storedOwnerId && storedContext === storedOwnerId) {
          const alreadyAdded = built.some(f => f.ownerId === storedOwnerId)
          if (!alreadyAdded) {
            const { data: ownerProfile } = await supabase
              .from('care_profiles').select('*').eq('user_id', storedOwnerId).maybeSingle()
            if (ownerProfile) {
              built.push({
                ownerId: storedOwnerId,
                patientName: ownerProfile.name ?? null,
                patientPhotoUrl: ownerProfile.photo_url ?? null,
                role: localStorage.getItem('fc_member_role_' + storedOwnerId) ?? 'familiar',
                profile: ownerProfile,
              })
              // RLS may not have propagated yet — re-verify membership after 3 s
              setTimeout(async () => {
                try {
                  const { data: recheck } = await supabase
                    .from('family_members')
                    .select('user_id, role')
                    .eq('member_user_id', user.id)
                    .neq('user_id', user.id)
                  if (recheck?.length) loadFamilies()
                } catch (err) {
                  console.warn('[FamilyContext] membership recheck failed:', err)
                }
              }, 3000)
            }
          }
        }
      }

      if (built.length === 0) {
        built.push({ ownerId: user.id, patientName: null, patientPhotoUrl: null, role: null, profile: null })
      }

      setFamilies(built)

      const stored = localStorage.getItem('fc_active_context')
      const storedValid = built.some(f => f.ownerId === stored)

      if (storedValid) {
        setActiveOwnerId(stored)
        setNeedsSelector(false)
      } else {
        setActiveOwnerId(built[0].ownerId)
        setNeedsSelector(built.length > 1)
      }
    } catch (err) {
      console.error(err)
      const fallback = [{ ownerId: user.id, patientName: null, patientPhotoUrl: null, role: null, profile: null }]
      setFamilies(fallback)
      setActiveOwnerId(user.id)
      setNeedsSelector(false)
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  loadFamiliesRef.current = loadFamilies

  function switchFamily(ownerId) {
    localStorage.setItem('fc_active_context', ownerId)
    setActiveOwnerId(ownerId)
    setNeedsSelector(false)
  }

  const activeEntry = families.find(f => f.ownerId === activeOwnerId) ?? families[0] ?? null
  const profile = activeEntry?.profile ?? null
  const memberRole = activeEntry?.role ?? null
  const ownerId = activeOwnerId ?? user?.id ?? null
  const activeFamilyLabel = activeEntry?.patientName ?? 'Mi familia'

  // Legacy compatibility
  const ownFamily = families.find(f => f.role === null)
  const memberFamily = families.find(f => f.role !== null)
  const hasBoth = families.length > 1
  const ownPatientName = ownFamily?.patientName ?? null
  const memberPatientName = memberFamily?.patientName ?? null

  return (
    <FamilyContext.Provider value={{
      ownerId,
      profile,
      memberRole,
      loading,
      refresh: loadFamilies,

      families,
      hasMultiple: families.length > 1,
      needsSelector,
      switchFamily,
      activeFamilyLabel,
      activeOwnerId,
      activePatientName: activeEntry?.patientName ?? null,

      hasBoth,
      activeFamily: activeOwnerId === user?.id ? 'owner' : 'member',
      ownPatientName,
      memberPatientName,
    }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  return useContext(FamilyContext)
}
