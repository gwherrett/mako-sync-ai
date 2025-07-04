
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

    console.log('User authenticated via OAuth:', user.id)
    console.log('User metadata:', JSON.stringify(user.user_metadata, null, 2))
    console.log('App metadata:', JSON.stringify(user.app_metadata, null, 2))

    // Get Spotify access token from user metadata
    const spotifyToken = user.user_metadata?.provider_token
    const spotifyRefreshToken = user.user_metadata?.provider_refresh_token 
    const spotifyData = user.user_metadata

    if (!spotifyToken) {
      console.error('No Spotify token found in user metadata')
      console.log('Available metadata keys:', Object.keys(user.user_metadata || {}))
      return new Response(
        JSON.stringify({ 
          error: 'No Spotify token found',
          debug: {
            hasUserMetadata: !!user.user_metadata,
            metadataKeys: Object.keys(user.user_metadata || {}),
            provider: user.app_metadata?.provider
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Spotify token found, storing connection...')

    // Store the Spotify connection data
    const connectionData = {
      user_id: user.id,
      spotify_user_id: spotifyData?.sub || spotifyData?.id || user.id,
      access_token: spotifyToken,
      refresh_token: spotifyRefreshToken,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      scope: 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative',
      token_type: 'Bearer',
      display_name: spotifyData?.name || spotifyData?.display_name,
      email: user.email,
    }

    console.log('Connection data to store:', {
      ...connectionData,
      access_token: '[REDACTED]',
      refresh_token: spotifyRefreshToken ? '[REDACTED]' : null
    })

    const { error: dbError } = await supabaseClient
      .from('spotify_connections')
      .upsert(connectionData, {
        onConflict: 'user_id'
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
