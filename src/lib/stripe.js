import { supabase } from './supabase'

export async function createCheckoutSession(plan) {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { plan },
  })
  if (error) throw new Error(error.message)
  return data.url
}

export async function createPortalSession() {
  const { data, error } = await supabase.functions.invoke('create-portal', {
    body: {},
  })
  if (error) throw new Error(error.message)
  return data.url
}
