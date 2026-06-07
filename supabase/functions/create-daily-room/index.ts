// FamiliaCerca — Create/get Daily.co room and schedule a video call
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') ?? ''
const DAILY_DOMAIN  = 'familiacerca'

async function getOrCreateRoom(ownerId: string): Promise<{ roomName: string; roomUrl: string }> {
  // Permanent room per care-profile: fc-{first8charsOfOwnerId}
  const roomName = `fc-${ownerId.replace(/-/g, '').slice(0, 8).toLowerCase()}`

  // Try to fetch existing room
  const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  })

  if (getRes.ok) {
    const room = await getRes.json()
    return { roomName: room.name, roomUrl: room.url }
  }

  // Create new permanent room
  const createRes = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_prejoin_ui: true,
        enable_screenshare: false,
        enable_chat: false,
        lang: 'es',
        max_participants: 15,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text()
    throw new Error(`Daily.co create room failed (${createRes.status}): ${errText}`)
  }

  const room = await createRes.json()
  return { roomName: room.name, roomUrl: room.url }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!DAILY_API_KEY) {
    console.error('[create-daily-room] DAILY_API_KEY secret not set')
    return new Response(JSON.stringify({ error: 'DAILY_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { ownerId, title, scheduledAt, participants } = await req.json()

  if (!ownerId || !scheduledAt) {
    return new Response(JSON.stringify({ error: 'ownerId and scheduledAt required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { roomName, roomUrl } = await getOrCreateRoom(ownerId)

    const createdByName =
      user.user_metadata?.full_name ?? user.email ?? 'Familiar'

    const { data: call, error: insertErr } = await supabase
      .from('video_calls')
      .insert({
        owner_id:        ownerId,
        room_name:       roomName,
        room_url:        roomUrl,
        title:           title ?? 'Videollamada familiar',
        scheduled_at:    scheduledAt,
        participants:    participants ?? '"all"',
        created_by:      user.id,
        created_by_name: createdByName,
      })
      .select('id, room_url, title, scheduled_at')
      .single()

    if (insertErr) throw insertErr

    console.log(`[create-daily-room] Call ${call.id} scheduled for ${scheduledAt}`)

    // For instant calls (scheduledAt within 2 min of now), trigger push
    // notifications immediately instead of waiting up to 60s for the cron.
    const diffMs = Math.abs(new Date(scheduledAt).getTime() - Date.now())
    if (diffMs < 2 * 60 * 1000) {
      const notifUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-videocall-notifications`
      await fetch(`${notifUrl}?callId=${call.id}&immediate=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
      }).catch(err =>
        console.warn('[create-daily-room] immediate notification failed:', err)
      )
    }

    return new Response(
      JSON.stringify({ callId: call.id, roomUrl: call.room_url, title: call.title, scheduledAt: call.scheduled_at }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[create-daily-room] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
