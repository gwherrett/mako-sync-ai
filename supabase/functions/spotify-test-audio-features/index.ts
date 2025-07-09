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
    console.log('=== SPOTIFY AUDIO FEATURES TEST ===')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { spotify_id } = await req.json()
    
    if (!spotify_id) {
      return new Response(
        JSON.stringify({ error: 'spotify_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Testing audio features for track:', spotify_id)

    // Get user's Spotify connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('spotify_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Spotify not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found Spotify connection for user')

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(connection.expires_at)
    
    let accessToken = connection.access_token

    if (now >= expiresAt) {
      console.log('Access token expired, refreshing...')
      
      if (!connection.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'No refresh token available. Please reconnect Spotify.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Refresh token
      const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${Deno.env.get('SPOTIFY_CLIENT_ID')}:${Deno.env.get('SPOTIFY_CLIENT_SECRET')}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
        }),
      })

      if (!refreshResponse.ok) {
        console.error('Failed to refresh token:', await refreshResponse.text())
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Spotify token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update the connection with new token
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
      await supabaseClient
        .from('spotify_connections')
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      console.log('Token refreshed successfully')
    }

    // Call Spotify Audio Features API
    console.log('Calling Spotify Audio Features API...')
    
    const audioFeaturesResponse = await fetch(
      `https://api.spotify.com/v1/audio-features/${spotify_id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!audioFeaturesResponse.ok) {
      const errorText = await audioFeaturesResponse.text()
      console.error('Spotify API error:', audioFeaturesResponse.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          error: 'Spotify API error',
          status: audioFeaturesResponse.status,
          details: errorText
        }),
        { status: audioFeaturesResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const audioFeatures = await audioFeaturesResponse.json()
    console.log('Audio features retrieved successfully:', audioFeatures)

    return new Response(
      JSON.stringify({ 
        success: true,
        spotify_id,
        audio_features: audioFeatures
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Test audio features error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})