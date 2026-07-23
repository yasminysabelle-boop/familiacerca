// FamiliaCerca — Real presence for the join lobby ("Ya están dentro").
// Reads Daily.co's room presence via their REST API (server-side only —
// DAILY_API_KEY never reaches the client). Names reflect whatever the
// participant's Daily session was joined with (our own userName once the
// call object join carries it, see VideoCall.jsx).
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') ?? ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const callId = url.searchParams.get('callId')
  if (!callId) {
    return new Response(JSON.stringify({ error: 'callId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

  try {
    const { data: call, error: callErr } = await supabase
      .from('video_calls')
      .select('room_name, owner_id')
      .eq('id', callId)
      .maybeSingle()

    if (callErr || !call) {
      return new Response(JSON.stringify({ error: 'Call not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Access check: requester must be the family owner or a member of that family.
    const isOwner = call.owner_id === user.id
    let hasAccess = isOwner
    if (!hasAccess) {
      const { data: membership } = await supabase
        .from('family_members')
        .select('member_user_id')
        .eq('user_id', call.owner_id)
        .eq('member_user_id', user.id)
        .maybeSingle()
      hasAccess = !!membership
    }
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!DAILY_API_KEY) {
      console.error('[get-call-presence] DAILY_API_KEY secret not set')
      return new Response(JSON.stringify({ count: 0, participants: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const presRes = await fetch(`https://api.daily.co/v1/rooms/${call.room_name}/presence`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    })

    if (!presRes.ok) {
      // Room may not exist yet on Daily's side, or transient error — fail soft.
      console.warn(`[get-call-presence] presence fetch failed (${presRes.status})`)
      return new Response(JSON.stringify({ count: 0, participants: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const presence = await presRes.json()
    const participants = (presence?.data ?? []).map((p: any) => ({
      name: p.userName || 'Familiar',
    }))

    return new Response(JSON.stringify({ count: participants.length, participants }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[get-call-presence] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
