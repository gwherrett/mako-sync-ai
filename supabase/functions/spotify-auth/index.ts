
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
    console.log('🟢 Step 14a: Initializing Supabase client...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
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

    // Store tokens and profile in database
    console.log('🟢 Step 18: Storing connection in database...')
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

    console.log('🟢 Step 18a: Connection data prepared:', {
      user_id: connectionData.user_id,
      spotify_user_id: connectionData.spotify_user_id,
      display_name: connectionData.display_name,
      expires_at: connectionData.expires_at
    })

    const { error: dbError } = await supabaseClient
      .from('spotify_connections')
      .upsert(connectionData)

    if (dbError) {
      console.log('❌ Step 18 Failed: Database error:', dbError)
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Step 18 Complete: Connection stored in database successfully')
    console.log('🎉 SPOTIFY AUTH FLOW COMPLETE! User connected successfully.')
    
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
