
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
    console.log('=== SPOTIFY OAUTH HANDLER STARTED ===')
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      console.error('No authenticated user found')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id)
    console.log('User metadata keys:', Object.keys(user.user_metadata || {}))
    console.log('App metadata:', JSON.stringify(user.app_metadata, null, 2))

    // Get Spotify access token from user metadata
    const spotifyToken = user.user_metadata?.provider_token
    const spotifyRefreshToken = user.user_metadata?.provider_refresh_token 
    const spotifyData = user.user_metadata

    console.log('Spotify token present:', !!spotifyToken)
    console.log('Spotify refresh token present:', !!spotifyRefreshToken)

    if (!spotifyToken) {
      console.error('No Spotify token found in user metadata')
      console.log('Full user metadata:', JSON.stringify(user.user_metadata, null, 2))
      return new Response(
        JSON.stringify({ 
          error: 'No Spotify token found',
          debug: {
            hasUserMetadata: !!user.user_metadata,
            metadataKeys: Object.keys(user.user_metadata || {}),
            provider: user.app_metadata?.provider,
            fullMetadata: user.user_metadata
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Spotify token found, preparing connection data...')

    // Store the Spotify connection data
    const connectionData = {
      user_id: user.id,
      spotify_user_id: spotifyData?.sub || spotifyData?.id || user.id,
      access_token: spotifyToken,
      refresh_token: spotifyRefreshToken,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      scope: 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative',
      token_type: 'Bearer',
      display_name: spotifyData?.name || spotifyData?.display_name || spotifyData?.full_name,
      email: user.email,
    }

    console.log('Connection data prepared (tokens redacted):', {
      ...connectionData,
      access_token: '[REDACTED]',
      refresh_token: spotifyRefreshToken ? '[REDACTED]' : null
    })

    // Check if connection already exists
    const { data: existingConnection } = await supabaseClient
      .from('spotify_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingConnection) {
      console.log('Updating existing connection...')
      const { error: updateError } = await supabaseClient
        .from('spotify_connections')
        .update({
          access_token: connectionData.access_token,
          refresh_token: connectionData.refresh_token,
          expires_at: connectionData.expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Database update error:', updateError)
        return new Response(
          JSON.stringify({ error: `Database update error: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      console.log('Creating new connection...')
      const { error: insertError } = await supabaseClient
        .from('spotify_connections')
        .insert(connectionData)

      if (insertError) {
        console.error('Database insert error:', insertError)
        return new Response(
          JSON.stringify({ error: `Database insert error: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('=== SPOTIFY OAUTH HANDLER COMPLETED SUCCESSFULLY ===')
    return new Response(
      JSON.stringify({ success: true, message: 'Spotify OAuth connection stored successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== SPOTIFY OAUTH HANDLER ERROR ===', error)
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
