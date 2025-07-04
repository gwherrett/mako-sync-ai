
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
    console.log('Request method:', req.method)
    console.log('Request headers present:', Object.keys(Object.fromEntries(req.headers.entries())))
    
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
    console.log('User email:', user.email)
    console.log('User provider:', user.app_metadata?.provider)
    console.log('User metadata keys:', Object.keys(user.user_metadata || {}))
    console.log('App metadata:', JSON.stringify(user.app_metadata, null, 2))

    // Try multiple sources for Spotify tokens
    let spotifyToken = null
    let spotifyRefreshToken = null
    let tokenSource = 'unknown'

    // Source 1: user_metadata.provider_token (most common)
    if (user.user_metadata?.provider_token) {
      spotifyToken = user.user_metadata.provider_token
      spotifyRefreshToken = user.user_metadata.provider_refresh_token
      tokenSource = 'user_metadata.provider_token'
    }
    // Source 2: user_metadata direct properties
    else if (user.user_metadata?.access_token) {
      spotifyToken = user.user_metadata.access_token
      spotifyRefreshToken = user.user_metadata.refresh_token
      tokenSource = 'user_metadata.access_token'
    }
    // Source 3: Parse from session if available (fallback)
    else {
      console.log('No tokens found in user metadata, checking session...')
      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (session?.provider_token) {
        spotifyToken = session.provider_token
        spotifyRefreshToken = session.provider_refresh_token
        tokenSource = 'session.provider_token'
      }
    }

    console.log('Token source:', tokenSource)
    console.log('Spotify token present:', !!spotifyToken)
    console.log('Spotify refresh token present:', !!spotifyRefreshToken)

    if (!spotifyToken) {
      console.error('No Spotify token found in any source')
      console.log('Full user metadata:', JSON.stringify(user.user_metadata, null, 2))
      
      return new Response(
        JSON.stringify({ 
          error: 'No Spotify access token found',
          debug: {
            tokenSource,
            hasUserMetadata: !!user.user_metadata,
            metadataKeys: Object.keys(user.user_metadata || {}),
            provider: user.app_metadata?.provider,
            userEmail: user.email
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Spotify tokens found via', tokenSource)

    // Get additional user info from Spotify API
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
      }
    } catch (error) {
      console.warn('Error fetching Spotify user info:', error.message)
    }

    // Prepare connection data
    const connectionData = {
      user_id: user.id,
      spotify_user_id: spotifyUserInfo.id || user.user_metadata?.sub || user.user_metadata?.id || user.id,
      access_token: spotifyToken,
      refresh_token: spotifyRefreshToken,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      scope: 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative',
      token_type: 'Bearer',
      display_name: spotifyUserInfo.display_name || user.user_metadata?.name || user.user_metadata?.display_name || user.user_metadata?.full_name,
      email: spotifyUserInfo.email || user.email,
    }

    console.log('Connection data prepared (tokens redacted):', {
      ...connectionData,
      access_token: '[REDACTED]',
      refresh_token: spotifyRefreshToken ? '[REDACTED]' : null
    })

    // Check if connection already exists
    const { data: existingConnection, error: checkError } = await supabaseClient
      .from('spotify_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing connection:', checkError)
      return new Response(
        JSON.stringify({ error: `Database check error: ${checkError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingConnection) {
      console.log('Updating existing connection...')
      const { error: updateError } = await supabaseClient
        .from('spotify_connections')
        .update({
          access_token: connectionData.access_token,
          refresh_token: connectionData.refresh_token,
          expires_at: connectionData.expires_at,
          display_name: connectionData.display_name,
          email: connectionData.email,
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
      
      console.log('Connection updated successfully')
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
      
      console.log('New connection created successfully')
    }

    console.log('=== SPOTIFY OAUTH HANDLER COMPLETED SUCCESSFULLY ===')
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Spotify OAuth connection stored successfully',
        tokenSource,
        connectionExists: !!existingConnection
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
