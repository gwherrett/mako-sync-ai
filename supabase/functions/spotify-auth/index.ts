
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
    console.log('🟢 Step 14: spotify-auth edge function called')
    console.log('🟢 Step 14a: Initializing Supabase clients...')
    
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
      console.log('❌ Step 14 Failed: No authenticated user found')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 14 Complete: User authenticated:', user.id)

    const requestBody = await req.json()
    console.log('🟢 Step 15: Request body received:', { 
      code: requestBody.code ? 'present (length: ' + requestBody.code.length + ')' : 'missing', 
      state: requestBody.state,
      redirect_uri: requestBody.redirect_uri || 'not provided'
    })
    
    const { code, state, redirect_uri } = requestBody

    // Use the redirect_uri from the request, with fallback to hardcoded value
    const redirectUri = redirect_uri || 'https://groove-sync-serato-ai.lovable.app/spotify-callback';

    console.log('🟢 Step 15a: Using redirect URI:', redirectUri)
    
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
    
    console.log('🟢 Step 15b: Spotify credentials check:', {
      clientId: clientId ? 'present (length: ' + clientId.length + ')' : 'missing',
      clientSecret: clientSecret ? 'present (length: ' + clientSecret.length + ')' : 'missing'
    })

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })

    console.log('🟢 Step 16: Making token request to Spotify...')
    console.log('🟢 Step 16a: Token request parameters:', {
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code ? 'present (length: ' + code.length + ')' : 'missing'
    })
    
    const authHeader = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    console.log('🟢 Step 16b: Auth header created, length:', authHeader.length)
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: tokenRequestBody,
    })

    console.log('🟢 Step 16c: Token response received, status:', tokenResponse.status)
    const tokenData = await tokenResponse.json()
    console.log('🟢 Step 16d: Token response data:', { 
      error: tokenData.error, 
      access_token: tokenData.access_token ? 'present' : 'missing',
      refresh_token: tokenData.refresh_token ? 'present' : 'missing',
      error_description: tokenData.error_description,
      expires_in: tokenData.expires_in
    })

    if (tokenData.error) {
      console.log('❌ Step 16 Failed: Spotify token exchange failed:', tokenData)
      return new Response(
        JSON.stringify({ 
          error: `Spotify auth failed: ${tokenData.error}`, 
          details: tokenData.error_description,
          redirect_uri: redirectUri,
          client_id: clientId ? 'configured' : 'missing'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 16 Complete: Access token received successfully')

    // Get user profile from Spotify
    console.log('🟢 Step 17: Making profile request to Spotify...')
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    console.log('🟢 Step 17a: Profile response status:', profileResponse.status)
    const profileData = await profileResponse.json()
    console.log('🟢 Step 17b: Profile response data:', { 
      id: profileData.id, 
      display_name: profileData.display_name,
      email: profileData.email ? 'present' : 'missing'
    })

    if (profileResponse.status !== 200) {
      console.log('❌ Step 17 Failed: Failed to get Spotify profile:', profileData)
      return new Response(
        JSON.stringify({ error: `Failed to get Spotify profile: ${profileData.error?.message || 'Unknown error'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 17 Complete: Spotify profile retrieved successfully')

    // Store tokens securely in Vault and connection in database
    console.log('🟢 Step 18: Storing tokens in Vault and connection in database...')
    
    // Step 18a: Store access token in vault using database function
    console.log('🟢 Step 18a: Storing access token in vault via RPC...')
    const { data: accessTokenSecretId, error: accessTokenError } = await supabaseAdmin
      .rpc('store_spotify_token_in_vault', {
        p_user_id: user.id,
        p_token_name: 'access_token',
        p_token_value: tokenData.access_token
      })

    if (accessTokenError || !accessTokenSecretId) {
      console.error('❌ Step 18a Failed: Error storing access token in vault:', accessTokenError)
      return new Response(
        JSON.stringify({ error: `Failed to store access token securely: ${accessTokenError?.message || 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 18a Complete: Access token stored in vault, ID:', accessTokenSecretId)

    // Step 18b: Store refresh token in vault using database function
    console.log('🟢 Step 18b: Storing refresh token in vault via RPC...')
    const { data: refreshTokenSecretId, error: refreshTokenError } = await supabaseAdmin
      .rpc('store_spotify_token_in_vault', {
        p_user_id: user.id,
        p_token_name: 'refresh_token',
        p_token_value: tokenData.refresh_token
      })

    if (refreshTokenError || !refreshTokenSecretId) {
      console.error('❌ Step 18b Failed: Error storing refresh token in vault:', refreshTokenError)
      return new Response(
        JSON.stringify({ error: `Failed to store refresh token securely: ${refreshTokenError?.message || 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 18b Complete: Refresh token stored in vault, ID:', refreshTokenSecretId)

    // Step 18c: Store connection with vault references (no plain text tokens!)
    const connectionData = {
      user_id: user.id,
      spotify_user_id: profileData.id,
      access_token_secret_id: accessTokenSecretId,
      refresh_token_secret_id: refreshTokenSecretId,
      access_token: '***ENCRYPTED_IN_VAULT***', // Placeholder only
      refresh_token: '***ENCRYPTED_IN_VAULT***', // Placeholder only
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer',
      display_name: profileData.display_name,
      email: profileData.email,
    }

    console.log('🟢 Step 18c: Connection data prepared with vault references:', {
      user_id: connectionData.user_id,
      spotify_user_id: connectionData.spotify_user_id,
      display_name: connectionData.display_name,
      expires_at: connectionData.expires_at,
      has_vault_references: true
    })

    const { error: dbError } = await supabaseClient
      .from('spotify_connections')
      .upsert(connectionData)

    if (dbError) {
      console.log('❌ Step 18c Failed: Database error:', dbError)
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 18c Complete: Connection stored in database successfully')
    console.log('🎉 SPOTIFY AUTH FLOW COMPLETE! User connected successfully with encrypted tokens!')
    
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
