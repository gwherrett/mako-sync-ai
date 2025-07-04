
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError) {
      console.error('User authentication error:', userError)
      return new Response(
        JSON.stringify({ error: `Authentication error: ${userError.message}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      console.error('No authenticated user found')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no user found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id)
    console.log('User provider:', user.app_metadata?.provider)

    // Get current session to access provider tokens
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      return new Response(
        JSON.stringify({ error: `Session error: ${sessionError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!session) {
      console.error('No session found')
      return new Response(
        JSON.stringify({ error: 'No active session found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract Spotify tokens from session
    let spotifyToken = session.provider_token
    let spotifyRefreshToken = session.provider_refresh_token
    let tokenSource = 'session.provider_token'

    // Fallback to user metadata if session tokens not available
    if (!spotifyToken && user.user_metadata?.provider_token) {
      spotifyToken = user.user_metadata.provider_token
      spotifyRefreshToken = user.user_metadata.provider_refresh_token
      tokenSource = 'user_metadata.provider_token'
    }

    console.log('Token source:', tokenSource)
    console.log('Spotify token present:', !!spotifyToken)
    console.log('Spotify refresh token present:', !!spotifyRefreshToken)

    if (!spotifyToken) {
      console.error('No Spotify token found')
      return new Response(
        JSON.stringify({ 
          error: 'No Spotify access token found',
          debug: {
            tokenSource,
            hasSession: !!session,
            hasProviderToken: !!session?.provider_token,
            hasUserMetadata: !!user.user_metadata,
            provider: user.app_metadata?.provider
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Spotify user info
    let spotifyUserInfo = {}
    try {
      const spotifyResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${spotifyToken}`,
        },
      })
      
      if (spotifyResponse.ok) {
        spotifyUserInfo = await spotifyResponse.json()
        console.log('Fetched Spotify user info:', {
          id: spotifyUserInfo.id,
          display_name: spotifyUserInfo.display_name,
          email: spotifyUserInfo.email
        })
      } else {
        console.warn('Failed to fetch Spotify user info:', spotifyResponse.status)
        const errorText = await spotifyResponse.text()
        console.warn('Spotify API error:', errorText)
      }
    } catch (error) {
      console.warn('Error fetching Spotify user info:', error.message)
    }

    // Prepare connection data
    const connectionData = {
      user_id: user.id,
      spotify_user_id: spotifyUserInfo.id || user.user_metadata?.sub || user.id,
      access_token: spotifyToken,
      refresh_token: spotifyRefreshToken,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      scope: 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative',
      token_type: 'Bearer',
      display_name: spotifyUserInfo.display_name || user.user_metadata?.name || user.user_metadata?.full_name,
      email: spotifyUserInfo.email || user.email,
    }

    console.log('Attempting to store connection data...')

    // Use upsert to handle both insert and update cases
    const { data: connectionResult, error: dbError } = await supabaseClient
      .from('spotify_connections')
      .upsert(connectionData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })
      .select()

    if (dbError) {
      console.error('Database upsert error:', dbError)
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Connection stored successfully:', connectionResult ? 'with data' : 'without return data')
    console.log('=== SPOTIFY OAUTH HANDLER COMPLETED SUCCESSFULLY ===')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Spotify OAuth connection stored successfully',
        tokenSource,
        connectionStored: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== SPOTIFY OAUTH HANDLER ERROR ===', error)
    return new Response(
      JSON.stringify({ 
        error: `Server error: ${error.message}`,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
