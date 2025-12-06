
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts"

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

    // Use the redirect_uri from the request, with fallback to production domain
    const redirectUri = redirect_uri || 'https://mako-sync.vercel.app/spotify-callback';

    console.log('Processing Spotify token exchange')
    
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
    
    console.log('Environment check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdPreview: clientId?.substring(0, 8) + '...',
      redirectUri
    })
    
    if (!clientId || !clientSecret) {
      console.error('Spotify credentials not configured:', {
        SPOTIFY_CLIENT_ID: !!clientId,
        SPOTIFY_CLIENT_SECRET: !!clientSecret
      })
      return new Response(
        JSON.stringify({
          error: 'Spotify credentials not configured in edge function environment',
          debug: {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    // Store tokens securely in Vault using Postgres driver for direct SQL access
    console.log('Storing tokens in vault using Postgres driver')
    
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    console.log('Database connection check:', {
      hasDbUrl: !!dbUrl,
      dbUrlPreview: dbUrl?.substring(0, 20) + '...'
    })
    
    if (!dbUrl) {
      console.error('SUPABASE_DB_URL not configured')
      return new Response(
        JSON.stringify({
          error: 'Database connection not configured in edge function environment',
          debug: 'SUPABASE_DB_URL missing'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create Postgres connection pool - use connection string for internal socket connection
    const pool = new Pool(dbUrl, 1)

    let accessTokenSecretId: string
    let refreshTokenSecretId: string
    
    try {
      const connection = await pool.connect()
      
      try {
        // Store access token in vault
        console.log('Creating access token secret in vault')
        const accessTokenResult = await connection.queryObject<{ id: string }>`
          SELECT vault.create_secret(
            ${tokenData.access_token},
            ${'spotify_access_token_' + user.id},
            ${'Spotify access_token for user ' + user.id}
          ) as id
        `
        
        if (!accessTokenResult.rows[0]?.id) {
          throw new Error('Failed to create access token secret')
        }
        
        accessTokenSecretId = accessTokenResult.rows[0].id
        console.log('Access token stored in vault successfully')

        // Store refresh token in vault
        console.log('Creating refresh token secret in vault')
        const refreshTokenResult = await connection.queryObject<{ id: string }>`
          SELECT vault.create_secret(
            ${tokenData.refresh_token},
            ${'spotify_refresh_token_' + user.id},
            ${'Spotify refresh_token for user ' + user.id}
          ) as id
        `
        
        if (!refreshTokenResult.rows[0]?.id) {
          throw new Error('Failed to create refresh token secret')
        }
        
        refreshTokenSecretId = refreshTokenResult.rows[0].id
        console.log('Refresh token stored in vault successfully')
        
      } finally {
        connection.release()
      }
    } catch (vaultError: any) {
      console.error('Failed to store tokens in vault:', vaultError)
      await pool.end()
      return new Response(
        JSON.stringify({ 
          error: 'Failed to securely store tokens. Please try again.',
          debug: vaultError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } finally {
      await pool.end()
    }

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
