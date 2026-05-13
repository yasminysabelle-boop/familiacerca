// FamiliaCerca — Medication Reminder Push Notifications
// Deploy: supabase functions deploy send-med-notifications
// Set secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_CONTACT_EMAIL=...
// Schedule: use pg_cron or an external cron to call this function every minute

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidEmail      = Deno.env.get('VAPID_CONTACT_EMAIL')!

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Current UTC time as HH:MM
  const now = new Date()
  const currentTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  // Find all medications scheduled for this exact minute
  const { data: meds } = await supabase
    .from('medications')
    .select('id, name, dosage, user_id, scheduled_times')
    .contains('scheduled_times', [currentTime])

  if (!meds || meds.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, time: currentTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let sentCount = 0

  for (const med of meds) {
    // Collect all users in this care group (owner + family members)
    const { data: members } = await supabase
      .from('family_members')
      .select('member_user_id')
      .eq('user_id', med.user_id)

    const userIds = [med.user_id, ...(members?.map((m: { member_user_id: string }) => m.member_user_id) ?? [])]

    // Get push subscriptions for all group members
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `💊 Hora de ${med.name}`,
            body: med.dosage ? `${med.dosage} · ${currentTime}` : currentTime,
            url: '/medications',
            tag: `med-${med.id}-${currentTime}`,
          })
        )
        sentCount++
      } catch (err: unknown) {
        // Remove expired subscriptions (HTTP 410 Gone)
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ sent: sentCount, time: currentTime, medications: meds.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
