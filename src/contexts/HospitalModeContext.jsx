import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useFamily } from './FamilyContext'

const HospitalModeContext = createContext(null)

export function HospitalModeProvider({ children }) {
  const { user } = useAuth()
  const { ownerId } = useFamily()
  const [hospitalMode, setHospitalMode] = useState(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user || !ownerId) {
      setHospitalMode(null)
      setLoading(false)
      return
    }
    load()
    subscribe()
    return () => {
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [user, ownerId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('hospital_mode')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle()
    setHospitalMode(data ?? null)
    setLoading(false)
  }

  function subscribe() {
    channelRef.current?.unsubscribe()
    const channel = supabase
      .channel(`hospital-mode:${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_mode',
          filter: `owner_id=eq.${ownerId}`,
        },
        payload => {
          if (payload.eventType === 'DELETE') {
            setHospitalMode(null)
          } else {
            setHospitalMode(payload.new)
          }
        }
      )
      .subscribe()
    channelRef.current = channel
  }

  async function activateHospitalMode({ hospitalName, roomNumber, activatedByName }) {
    if (!ownerId) return

    const { data, error } = await supabase
      .from('hospital_mode')
      .upsert(
        {
          owner_id: ownerId,
          active: true,
          activated_at: new Date().toISOString(),
          deactivated_at: null,
          activated_by_name: activatedByName,
          hospital_name: hospitalName ?? null,
          room_number: roomNumber ?? null,
        },
        { onConflict: 'owner_id' }
      )
      .select()
      .single()

    if (!error && data) {
      setHospitalMode(data)
      await sendNotification('activate', activatedByName, hospitalName)
    }
    return { data, error }
  }

  async function deactivateHospitalMode(activatedByName) {
    if (!ownerId) return

    const { data, error } = await supabase
      .from('hospital_mode')
      .update({
        active: false,
        deactivated_at: new Date().toISOString(),
        activated_by_name: activatedByName,
      })
      .eq('owner_id', ownerId)
      .select()
      .single()

    if (!error && data) {
      setHospitalMode(data)
      await sendNotification('deactivate', activatedByName, null)
    }
    return { data, error }
  }

  async function updateHospitalMode(fields) {
    if (!ownerId) return
    const { data, error } = await supabase
      .from('hospital_mode')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .select()
      .single()
    if (!error && data) setHospitalMode(data)
    return { data, error }
  }

  async function sendNotification(action, activatedByName, hospitalName) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-hospital-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ownerId, action, activatedByName, hospitalName }),
        }
      )
    } catch (err) {
      console.warn('[HospitalModeContext] notification failed:', err)
    }
  }

  const isHospitalMode = hospitalMode?.active === true

  return (
    <HospitalModeContext.Provider value={{
      hospitalMode,
      isHospitalMode,
      loading,
      activateHospitalMode,
      deactivateHospitalMode,
      updateHospitalMode,
      reload: load,
    }}>
      {children}
    </HospitalModeContext.Provider>
  )
}

export function useHospitalMode() {
  return useContext(HospitalModeContext)
}
