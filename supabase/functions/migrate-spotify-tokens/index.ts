import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Spotify token migration to vault...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user } } = await supabaseClient.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    )
    
    if (!user) {
      console.log('❌ No authenticated user found')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ User authenticated:', user.id)

    // Get user's connection
    const { data: connection, error: fetchError } = await supabaseClient
      .from('spotify_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !connection) {
      console.log('❌ No connection found for user')
      return new Response(
        JSON.stringify({ error: 'No Spotify connection found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already migrated
    if (connection.access_token_secret_id && connection.refresh_token_secret_id) {
      console.log('✅ Connection already migrated to vault')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Connection already using vault encryption',
          already_migrated: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if tokens are placeholders (already migrated but not properly flagged)
    if (connection.access_token?.includes('VAULT') || connection.access_token?.includes('ENCRYPTED')) {
      console.log('⚠️ Tokens appear to be placeholders but secret IDs missing - possible incomplete migration')
      return new Response(
        JSON.stringify({ 
          error: 'Incomplete migration detected - please reconnect your Spotify account',
          requires_reconnection: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔄 Migrating connection to vault...')

    // Call the migration function
    const { error: migrationError } = await supabaseClient
      .rpc('migrate_connection_to_vault', {
        p_connection_id: connection.id
      })

    if (migrationError) {
      console.error('❌ Migration failed:', migrationError)
      return new Response(
        JSON.stringify({ error: `Migration failed: ${migrationError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Migration successful - tokens now encrypted in vault')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Spotify tokens successfully migrated to encrypted vault storage'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('=== MIGRATION ERROR ===', error)
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
