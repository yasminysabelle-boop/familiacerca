import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setSub(null); setLoading(false); return }

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      // First load — create 14-day trial from account creation date
      const trialEnd = new Date(user.created_at)
      trialEnd.setDate(trialEnd.getDate() + 14)
      const { data: created } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'free',
          status: 'trial',
          trial_end_date: trialEnd.toISOString(),
        })
        .select()
        .single()
      setSub(created)
    } else {
      setSub(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const now = Date.now()
  const trialEndMs = sub?.trial_end_date ? new Date(sub.trial_end_date).getTime() : 0

  // Users with app_metadata.role === 'admin' bypass all subscription and trial checks.
  // This is set server-side via the Supabase service role key and cannot be spoofed by users.
  const isAppAdmin = user?.app_metadata?.role === 'admin'

  const isPaid    = isAppAdmin || (sub?.status === 'active' && (sub?.plan === 'familiar' || sub?.plan === 'care_plus'))
  const isTrialing = !isAppAdmin && (sub?.status === 'trial' && trialEndMs > now)
  const trialExpired = !isAppAdmin && (sub?.plan === 'free' && (sub?.status === 'expired' || (sub?.status === 'trial' && trialEndMs <= now)))
  const daysLeft  = isTrialing ? Math.max(0, Math.ceil((trialEndMs - now) / 86400000)) : 0
  const canEdit   = isAppAdmin || isPaid || isTrialing

  // Profundidad de Milo/Luna — por plan, no por estado de pago. El trial
  // muestra la experiencia completa de Cuidado Total a propósito (para eso
  // existe el trial); al expirar cae a la profundidad real del plan Gratis.
  const aiLevel =
      isAppAdmin                    ? 'trends'
    : sub?.status === 'trial'       ? 'trends'
    : sub?.plan === 'care_plus'     ? 'trends'
    : sub?.plan === 'familiar'      ? 'realtime'
    :                                  'basic'

  // Ventana de datos históricos visible para Milo/Luna — deriva del PLAN
  // real (sub.plan), NUNCA de aiLevel ni del estado de trial. A diferencia
  // de aiLevel (que sí se infla durante el trial para mostrar la
  // experiencia de Cuidado Total), esta ventana debe quedarse estable: si
  // el trial diera contexto ilimitado y luego cayera a 7 días de golpe al
  // expirar, Milo dejaría de ver datos de los que ya venía hablando — peor
  // que no haberlos tenido nunca. El trial regala PROFUNDIDAD de análisis
  // (aiLevel), no ventana de datos.
  const contextWindowDays =
      isAppAdmin                 ? null
    : sub?.plan === 'care_plus'  ? null
    : sub?.plan === 'familiar'   ? 90
    :                               7

  // Cuidadores y Historial (enforcement de Tarea B) siguen la regla general:
  // el trial da la experiencia completa (isTrialing → sin tope), y el gate
  // solo se activa con plan real 'free' + trial ya vencido. Esto es DISTINTO
  // de contextWindowDays (arriba, para Milo), que a propósito NO se infla
  // durante el trial — ahí la razón era continuidad (Milo no puede perder de
  // golpe visibilidad de datos de los que ya venía hablando al expirar el
  // trial). Esa razón no aplica a cuidadores/historial, así que aquí sí se
  // infla durante el trial como el resto de los gates del producto
  // (isPaid, canEdit, aiLevel). No unificar esto con contextWindowDays sin
  // volver a pensar el caso de Milo — son intencionalmente distintos.
  const caregiverLimit =
      isAppAdmin                 ? Infinity
    : isTrialing                 ? Infinity
    : sub?.plan === 'care_plus'  ? Infinity
    : sub?.plan === 'familiar'   ? 6
    :                               2

  const historyWindowDays =
      isAppAdmin                 ? null
    : isTrialing                 ? null
    : sub?.plan === 'care_plus'  ? null
    : sub?.plan === 'familiar'   ? 90
    :                               7

  // Mensaje único de "tu prueba terminó" (reemplaza el paywall global e
  // incondicional que antes vivía en Layout.jsx). Se marca visto vía RPC
  // security definer — subscriptions no tiene policy de update para el
  // cliente, ver supabase/add_trial_ended_seen.sql. Optimista en el estado
  // local para que no vuelva a aparecer en la misma sesión mientras el RPC
  // viaja; persistido en DB (no localStorage) para que valga entre
  // dispositivos.
  async function markTrialEndedSeen() {
    if (sub?.trial_ended_seen_at) return
    setSub(prev => prev ? { ...prev, trial_ended_seen_at: new Date().toISOString() } : prev)
    await supabase.rpc('mark_trial_ended_seen')
  }

  // Mismo patrón, para el aviso ANTERIOR al vencimiento (últimos días de
  // trial, ver TrialEndingNotice) — columna y RPC separados de
  // trial_ended_seen_at porque son dos momentos distintos del mismo trial,
  // ver supabase/add_trial_ending_seen.sql.
  async function markTrialEndingSeen() {
    if (sub?.trial_ending_seen_at) return
    setSub(prev => prev ? { ...prev, trial_ending_seen_at: new Date().toISOString() } : prev)
    await supabase.rpc('mark_trial_ending_seen')
  }

  const value = {
    sub, loading,
    isPaid, isTrialing, trialExpired, daysLeft, aiLevel, contextWindowDays,
    caregiverLimit, historyWindowDays, canEdit, isAppAdmin,
    markTrialEndedSeen, markTrialEndingSeen,
    refresh: load,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
