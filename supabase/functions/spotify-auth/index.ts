
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
    console.log('Spotify auth edge function called')
    
    // Client for user authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Admin client for vault operations (requires service_role key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      console.log('Authentication failed: No user found')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated successfully')

    const requestBody = await req.json()
    console.log('Authorization code received')
    
    const { code, state, redirect_uri } = requestBody

    // Use the redirect_uri from the request, with fallback to hardcoded value
    const redirectUri = redirect_uri || 'https://groove-sync-serato-ai.lovable.app/spotify-callback';

    console.log('Processing Spotify token exchange')
    
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
    
    if (!clientId || !clientSecret) {
      console.error('Spotify credentials not configured')
      throw new Error('Spotify credentials not configured')
    }

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })

    console.log('Requesting tokens from Spotify')
    
    const authHeader = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: tokenRequestBody,
    })

    const tokenData = await tokenResponse.json()
    console.log('Token exchange response received', { 
      success: !tokenData.error,
      status: tokenResponse.status
    })

    if (tokenData.error) {
      console.log('Token exchange failed')
      return new Response(
        JSON.stringify({ 
          error: `Spotify auth failed: ${tokenData.error}`, 
          details: tokenData.error_description
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Access token received successfully')

    // Get user profile from Spotify
    console.log('Fetching Spotify user profile')
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const profileData = await profileResponse.json()
    console.log('Profile retrieved successfully')

    if (profileResponse.status !== 200) {
      console.log('Failed to get Spotify profile')
      return new Response(
        JSON.stringify({ error: `Failed to get Spotify profile: ${profileData.error?.message || 'Unknown error'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Spotify profile retrieved successfully')

    // Store tokens securely in Vault using database functions
    console.log('Storing tokens in vault using database functions')
    
    // Store access token in vault
    console.log('Storing access token in vault')
    
    const { data: accessTokenSecretId, error: accessTokenError } = await supabaseAdmin
      .rpc('store_spotify_token_in_vault', {
        p_user_id: user.id,
        p_token_name: 'access_token',
        p_token_value: tokenData.access_token
      })

    if (accessTokenError || !accessTokenSecretId) {
      console.error('Failed to store access token in vault:', JSON.stringify(accessTokenError))
      return new Response(
        JSON.stringify({ 
          error: 'Failed to securely store access token. Please try again.',
          debug: accessTokenError?.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Access token stored in vault successfully')

    // Store refresh token in vault
    console.log('Storing refresh token in vault')
    
    const { data: refreshTokenSecretId, error: refreshTokenError } = await supabaseAdmin
      .rpc('store_spotify_token_in_vault', {
        p_user_id: user.id,
        p_token_name: 'refresh_token',
        p_token_value: tokenData.refresh_token
      })

    if (refreshTokenError || !refreshTokenSecretId) {
      console.error('Failed to store refresh token in vault:', JSON.stringify(refreshTokenError))
      return new Response(
        JSON.stringify({ 
          error: 'Failed to securely store refresh token. Please try again.',
          debug: refreshTokenError?.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Refresh token stored in vault successfully')

    // Store connection with vault references only (no plain text fallback)
    const connectionData = {
      user_id: user.id,
      spotify_user_id: profileData.id,
      access_token_secret_id: accessTokenSecretId,
      refresh_token_secret_id: refreshTokenSecretId,
      // Always use placeholder - tokens only stored in vault
      access_token: '***ENCRYPTED_IN_VAULT***',
      refresh_token: '***ENCRYPTED_IN_VAULT***',
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer',
      display_name: profileData.display_name,
      email: profileData.email,
    }

    console.log('Storing connection in database')

    const { error: dbError } = await supabaseClient
      .from('spotify_connections')
      .upsert(connectionData)

    if (dbError) {
      console.log('Database error storing connection')
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Spotify connection created successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: 'Spotify connected successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Spotify auth failed:', error.message)
    return new Response(
      JSON.stringify({ error: 'Server error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
