// FamiliaCerca — Delete account and all associated data
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

  const uid = user.id
  console.log(`[delete-account] Starting deletion for user ${uid}`)

  // Delete in dependency order (children first)
  const tables: [string, string][] = [
    ['medication_logs',       'user_id'],
    ['daily_care_logs',       'user_id'],
    ['care_item_schedules',   'user_id'],
    ['medications',           'user_id'],
    ['notes',                 'user_id'],
    ['events',                'user_id'],
    ['appointment_proofs',    'user_id'],
    ['voice_diary',           'user_id'],
    ['memories',              'user_id'],
    ['care_expenses',         'user_id'],
    ['chat_messages',         'user_id'],
    ['timeline_reactions',    'user_id'],
    ['daily_moods',           'user_id'],
    ['emergency_alerts',      'user_id'],
    ['push_subscriptions',    'user_id'],
    ['directory_contacts',    'owner_id'],
    ['directory_doctors',     'owner_id'],
    ['directory_institutions','owner_id'],
    ['care_shifts',           'owner_id'],
    ['hospital_visits',       'owner_id'],
    ['hospital_documents',    'owner_id'],
    ['hospital_mode',         'owner_id'],
    ['video_calls',           'owner_id'],
    ['patient_profiles',      'owner_id'],
    ['family_invitations',    'user_id'],
    ['family_members',        'user_id'],
    ['family_members',        'member_user_id'],
    ['subscriptions',         'user_id'],
    ['care_profiles',         'user_id'],
    ['user_profiles',         'id'],
  ]

  const errors: string[] = []
  for (const [table, col] of tables) {
    const { error } = await supabase.from(table).delete().eq(col, uid)
    if (error) {
      console.warn(`[delete-account] Error deleting ${table}.${col}:`, error.message)
      errors.push(`${table}: ${error.message}`)
    }
  }

  // Delete auth user last
  const { error: deleteErr } = await supabase.auth.admin.deleteUser(uid)
  if (deleteErr) {
    console.error('[delete-account] Failed to delete auth user:', deleteErr)
    return new Response(JSON.stringify({ error: deleteErr.message, dataErrors: errors }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[delete-account] Done for user ${uid}. Data errors: ${errors.length}`)
  return new Response(
    JSON.stringify({ success: true, dataErrors: errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
