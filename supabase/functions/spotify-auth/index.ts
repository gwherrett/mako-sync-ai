
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
    console.log('=== SPOTIFY AUTH FUNCTION STARTED ===')
    
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

    const requestBody = await req.json()
    console.log('Request body received:', { 
      code: requestBody.code ? 'present' : 'missing', 
      state: requestBody.state,
      redirect_uri: requestBody.redirect_uri || 'not provided'
    })
    
    const { code, state, redirect_uri } = requestBody

    // Use the redirect_uri from the request, with fallback to hardcoded value
    const redirectUri = redirect_uri || 'https://groove-sync-serato-ai.lovable.app/spotify-callback';

    console.log('Using redirect URI:', redirectUri)
    console.log('Using client ID:', Deno.env.get('SPOTIFY_CLIENT_ID') ? 'present' : 'missing')
    console.log('Using client secret:', Deno.env.get('SPOTIFY_CLIENT_SECRET') ? 'present' : 'missing')

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })

    console.log('Making token request to Spotify...')
    console.log('Token request body:', {
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code ? 'present' : 'missing'
    })
    
    const authHeader = `Basic ${btoa(`${Deno.env.get('SPOTIFY_CLIENT_ID')}:${Deno.env.get('SPOTIFY_CLIENT_SECRET')}`)}`;
    console.log('Auth header created, length:', authHeader.length)
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: tokenRequestBody,
    })

    console.log('Token response status:', tokenResponse.status)
    const tokenData = await tokenResponse.json()
    console.log('Token response data:', { 
      error: tokenData.error, 
      access_token: tokenData.access_token ? 'present' : 'missing',
      refresh_token: tokenData.refresh_token ? 'present' : 'missing',
      error_description: tokenData.error_description
    })

    if (tokenData.error) {
      console.error('Spotify token exchange failed:', tokenData)
      return new Response(
        JSON.stringify({ 
          error: `Spotify auth failed: ${tokenData.error}`, 
          details: tokenData.error_description,
          redirect_uri: redirectUri,
          client_id: Deno.env.get('SPOTIFY_CLIENT_ID') ? 'configured' : 'missing'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile from Spotify
    console.log('Making profile request to Spotify...')
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    console.log('Profile response status:', profileResponse.status)
    const profileData = await profileResponse.json()
    console.log('Profile response data:', { 
      id: profileData.id, 
      display_name: profileData.display_name,
      email: profileData.email ? 'present' : 'missing'
    })

    if (profileResponse.status !== 200) {
      console.error('Failed to get Spotify profile:', profileData)
      return new Response(
        JSON.stringify({ error: `Failed to get Spotify profile: ${profileData.error?.message || 'Unknown error'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store tokens and profile in database
    console.log('Storing connection in database...')
    const connectionData = {
      user_id: user.id,
      spotify_user_id: profileData.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer',
      display_name: profileData.display_name,
      email: profileData.email,
    }

    const { error: dbError } = await supabaseClient
      .from('spotify_connections')
      .upsert(connectionData)

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== SPOTIFY AUTH COMPLETED SUCCESSFULLY ===')
    return new Response(
      JSON.stringify({ success: true, message: 'Spotify connected successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('=== SPOTIFY AUTH ERROR ===', error)
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
