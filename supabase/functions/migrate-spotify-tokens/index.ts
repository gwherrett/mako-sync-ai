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

    console.log('🔄 Migrating tokens to vault using service role...')

    let accessTokenSecretId = null
    let refreshTokenSecretId = null

    // Store access token in vault using database function
    if (connection.access_token) {
      console.log('📝 Storing access token in vault via RPC...')
      const { data: accessSecretId, error: accessError } = await supabaseClient
        .rpc('store_spotify_token_in_vault', {
          p_user_id: user.id,
          p_token_name: 'access_token',
          p_token_value: connection.access_token
        })

      if (accessError) {
        console.error('❌ Failed to store access token in vault:', accessError)
        return new Response(
          JSON.stringify({ error: `Failed to store access token: ${accessError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      accessTokenSecretId = accessSecretId
      console.log('✅ Access token stored with ID:', accessTokenSecretId)
    }

    // Store refresh token in vault using database function
    if (connection.refresh_token) {
      console.log('📝 Storing refresh token in vault via RPC...')
      const { data: refreshSecretId, error: refreshError } = await supabaseClient
        .rpc('store_spotify_token_in_vault', {
          p_user_id: user.id,
          p_token_name: 'refresh_token',
          p_token_value: connection.refresh_token
        })

      if (refreshError) {
        console.error('❌ Failed to store refresh token in vault:', refreshError)
        return new Response(
          JSON.stringify({ error: `Failed to store refresh token: ${refreshError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      refreshTokenSecretId = refreshSecretId
      console.log('✅ Refresh token stored with ID:', refreshTokenSecretId)
    }

    // Update connection with vault references
    console.log('📝 Updating connection with vault secret IDs...')
    const { error: updateError } = await supabaseClient
      .from('spotify_connections')
      .update({
        access_token_secret_id: accessTokenSecretId,
        refresh_token_secret_id: refreshTokenSecretId,
        access_token: '***MIGRATED_TO_VAULT***',
        refresh_token: '***MIGRATED_TO_VAULT***',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    if (updateError) {
      console.error('❌ Failed to update connection:', updateError)
      return new Response(
        JSON.stringify({ error: `Failed to update connection: ${updateError.message}` }),
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
