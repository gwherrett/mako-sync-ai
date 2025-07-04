
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
    console.log('Request method:', req.method)
    console.log('Request URL:', req.url)
    
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    console.log('URL parameters:', { code: code ? 'present' : 'missing', state })

    // If no code is present, this is the initial auth request - return the auth URL
    if (!code) {
      console.log('No code found, generating auth URL...')
      
      const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
      if (!clientId) {
        console.error('SPOTIFY_CLIENT_ID not configured')
        return new Response(
          JSON.stringify({ error: 'Spotify client ID not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const redirectUri = `${url.origin}${url.pathname}`
      const scopes = 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative'
      
      const authUrl = `https://accounts.spotify.com/authorize?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${Math.random().toString(36).substring(7)}`

      console.log('Generated auth URL:', authUrl)
      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If code is present, this is the callback from Spotify - handle token exchange
    console.log('Code found, handling callback...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      console.error('No authenticated user found')
      return new Response(
        `<html><body><script>
          window.opener?.postMessage({ error: 'No authenticated user found' }, '*');
          window.close();
        </script></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      )
    }

    console.log('User authenticated:', user.id)

    const redirectUri = `${url.origin}${url.pathname}`
    console.log('Using redirect URI:', redirectUri)

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })

    console.log('Making token request to Spotify...')
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${Deno.env.get('SPOTIFY_CLIENT_ID')}:${Deno.env.get('SPOTIFY_CLIENT_SECRET')}`)}`,
      },
      body: tokenRequestBody,
    })

    console.log('Token response status:', tokenResponse.status)
    const tokenData = await tokenResponse.json()
    console.log('Token response data:', { 
      error: tokenData.error, 
      access_token: tokenData.access_token ? 'present' : 'missing',
      refresh_token: tokenData.refresh_token ? 'present' : 'missing'
    })

    if (tokenData.error) {
      console.error('Spotify token exchange failed:', tokenData)
      return new Response(
        `<html><body><script>
          window.opener?.postMessage({ error: 'Spotify auth failed: ${tokenData.error}' }, '*');
          window.close();
        </script></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
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
        `<html><body><script>
          window.opener?.postMessage({ error: 'Failed to get Spotify profile' }, '*');
          window.close();
        </script></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
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
        `<html><body><script>
          window.opener?.postMessage({ error: 'Database error: ${dbError.message}' }, '*');
          window.close();
        </script></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      )
    }

    console.log('=== SPOTIFY AUTH COMPLETED SUCCESSFULLY ===')
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ success: true, message: 'Spotify connected successfully' }, '*');
        window.close();
      </script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    )

  } catch (error) {
    console.error('=== SPOTIFY AUTH ERROR ===', error)
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ error: 'Server error: ${error.message}' }, '*');
        window.close();
      </script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    )
  }
})
