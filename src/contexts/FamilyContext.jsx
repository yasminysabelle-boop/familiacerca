import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const FamilyContext = createContext(null)

export function FamilyProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchProfile()
    } else {
      setProfile(null)
      setLoading(false)
    }
  }, [user])

  async function fetchProfile() {
    setLoading(true)
    const { data } = await supabase
      .from('care_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    setProfile(data ?? null)
    setLoading(false)
  }

  return (
    <FamilyContext.Provider value={{ profile, loading, refresh: fetchProfile }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  return useContext(FamilyContext)
}
