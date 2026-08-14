import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useFamily } from './FamilyContext'
import { useBillingAccount } from './BillingAccountContext'
import { supabase } from '../lib/supabase'

// Plan EFECTIVO de la familia que se está viendo (ownerId de useFamily()),
// vía la RPC get_family_plan -- nunca la suscripción propia de quien está
// logueado (eso es BillingAccountContext/useBillingAccount). Un miembro
// invitado ve el plan del DUEÑO de la familia, no el suyo propio. Ver
// project_familiacerca_subscription_scoped_to_viewer en memoria para el
// porqué de la separación y qué se rompía antes de esto.
const FamilyPlanContext = createContext(null)

export function FamilyPlanProvider({ children }) {
  // ownerId de useFamily() cae a user?.id ANTES de que loadFamilies()
  // resuelva la familia real -- nunca es null para un usuario logueado, así
  // que no sirve por sí solo como guard. `loading` (de FamilyContext) tampoco
  // alcanza: en el primer render tras resolver el usuario, `loading` puede
  // seguir en `false` (quedó así de un reset() previo, sin user) en el MISMO
  // render donde `ownerId` ya cayó al fallback -- loadFamilies() recién pone
  // loading=true un ciclo después. `profileResolved` sí sirve: arranca en
  // false y SOLO pasa a true al terminar loadFamilies(), en el mismo punto
  // donde activeOwnerId ya quedó correcto -- nunca hay una ventana donde esté
  // en true con el ownerId todavía sin resolver. Sin este guard, un miembro
  // invitado dispara get_family_plan primero con SU PROPIO id (por el
  // fallback) y recién después con el del dueño real -- el mismo bug que se
  // está cerrando, pero como parpadeo transitorio en vez de estado
  // persistente. Confirmado en vivo con Playwright antes de este fix.
  const { ownerId, profileResolved } = useFamily()
  const { isAppAdmin } = useBillingAccount()
  const [familyPlan, setFamilyPlan] = useState(null)
  const [familyLoading, setFamilyLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profileResolved) { setFamilyLoading(true); return }
    if (!ownerId) { setFamilyPlan(null); setFamilyLoading(false); return }
    setFamilyLoading(true)
    const { data } = await supabase
      .rpc('get_family_plan', { p_owner_id: ownerId })
      .maybeSingle()
    setFamilyPlan(data ?? null)
    setFamilyLoading(false)
  }, [ownerId, profileResolved])

  useEffect(() => { load() }, [load])

  const now = Date.now()
  const trialEndMs = familyPlan?.trial_end_date ? new Date(familyPlan.trial_end_date).getTime() : 0

  // Mismas fórmulas que BillingAccountContext, sobre familyPlan en vez de
  // sub -- isAppAdmin sigue bypaseando todo (staff de FamiliaCerca, nunca
  // restringido, sin importar de quién es la familia que está viendo).
  const familyIsPaid = isAppAdmin || (familyPlan?.status === 'active' && (familyPlan?.plan === 'familiar' || familyPlan?.plan === 'care_plus'))
  const familyIsTrialing = !isAppAdmin && (familyPlan?.status === 'trial' && trialEndMs > now)
  const familyTrialExpired = !isAppAdmin && (familyPlan?.plan === 'free' && (familyPlan?.status === 'expired' || (familyPlan?.status === 'trial' && trialEndMs <= now)))
  const familyDaysLeft = familyIsTrialing ? Math.max(0, Math.ceil((trialEndMs - now) / 86400000)) : 0
  const familyCanEdit = isAppAdmin || familyIsPaid || familyIsTrialing

  const familyAiLevel =
      isAppAdmin                          ? 'trends'
    : familyPlan?.status === 'trial'      ? 'trends'
    : familyPlan?.plan === 'care_plus'    ? 'trends'
    : familyPlan?.plan === 'familiar'     ? 'realtime'
    :                                        'basic'

  const familyContextWindowDays =
      isAppAdmin                       ? null
    : familyPlan?.plan === 'care_plus' ? null
    : familyPlan?.plan === 'familiar'  ? 90
    :                                     7

  const familyCaregiverLimit =
      isAppAdmin                       ? Infinity
    : familyIsTrialing                 ? Infinity
    : familyPlan?.plan === 'care_plus' ? Infinity
    : familyPlan?.plan === 'familiar'  ? 6
    :                                     2

  const familyHistoryWindowDays =
      isAppAdmin                       ? null
    : familyIsTrialing                 ? null
    : familyPlan?.plan === 'care_plus' ? null
    : familyPlan?.plan === 'familiar'  ? 90
    :                                     7

  const value = {
    familyPlan, familyLoading,
    familyIsPaid, familyIsTrialing, familyTrialExpired, familyDaysLeft,
    familyAiLevel, familyContextWindowDays,
    familyCaregiverLimit, familyHistoryWindowDays, familyCanEdit,
    refresh: load,
  }

  return (
    <FamilyPlanContext.Provider value={value}>
      {children}
    </FamilyPlanContext.Provider>
  )
}

export function useFamilyPlan() {
  return useContext(FamilyPlanContext)
}
