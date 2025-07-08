import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import type { SpotifyConnection } from './types.ts'
import { getValidAccessToken, refreshSpotifyToken } from './spotify-auth.ts'
import { fetchAllLikedSongs, fetchAudioFeatures } from './spotify-api.ts'
import { processSongsData } from './data-processing.ts'
import { clearAndInsertSongs } from './database.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== SPOTIFY SYNC STARTED - DEBUG VERSION ===')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))
    
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

    console.log('Connection found:', {
      spotify_user_id: connection.spotify_user_id,
      expires_at: connection.expires_at,
      has_refresh_token: !!connection.refresh_token,
      created_at: connection.created_at
    })

    // Get valid access token (refresh if needed)
    let accessToken
    try {
      accessToken = await getValidAccessToken(connection as SpotifyConnection, supabaseClient, user.id)
      console.log('Access token obtained successfully')
    } catch (error: any) {
      console.error('Failed to get valid access token:', error)
      if (error.message.includes('refresh token is invalid')) {
        // Clear the invalid connection
        await supabaseClient
          .from('spotify_connections')
          .delete()
          .eq('user_id', user.id)
        
        throw new Error('Your Spotify connection has expired. Please disconnect and reconnect your Spotify account to get fresh tokens.')
      }
      throw error
    }

    // Fetch all liked songs from Spotify
    const allTracks = await fetchAllLikedSongs(accessToken)

    // Get track IDs for audio features
    const trackIds = allTracks.map(item => item.track.id)
    
    // Pre-validate token before making audio features call
    console.log('Pre-validating access token before audio features fetch...')
    try {
      const { data: latestConnection } = await supabaseClient
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (latestConnection) {
        accessToken = await getValidAccessToken(latestConnection as SpotifyConnection, supabaseClient, user.id)
        console.log('Token pre-validation complete')
      }
    } catch (preValidationError: any) {
      console.error('Pre-validation failed:', preValidationError)
      // Continue with existing token if pre-validation fails
    }

    // Fetch audio features (danceability, BPM, key) with token refresh retry
    let audioFeatures: { [key: string]: any } = {}
    try {
      console.log('Attempting to fetch audio features...')
      audioFeatures = await fetchAudioFeatures(trackIds, accessToken)
      console.log('Audio features fetched successfully')
    } catch (error: any) {
      console.error('Audio features fetch failed:', error.message)
      
      if (error.message.includes('Spotify token invalid')) {
        console.log('Token expired during audio features fetch, attempting refresh...')
        try {
          // Get fresh connection data from database before retrying
          const { data: freshConnection } = await supabaseClient
            .from('spotify_connections')
            .select('*')
            .eq('user_id', user.id)
            .single()
          
          if (!freshConnection) {
            throw new Error('Spotify connection no longer exists')
          }
          
          console.log('Attempting token refresh for retry...')
          // Force refresh the token
          accessToken = await refreshSpotifyToken(freshConnection as SpotifyConnection, supabaseClient, user.id)
          console.log('Token refreshed, retrying audio features...')
          audioFeatures = await fetchAudioFeatures(trackIds, accessToken)
          console.log('Audio features retry successful')
        } catch (retryError: any) {
          console.error('Token refresh retry also failed:', retryError)
          // If refresh token is also invalid, clear the connection and ask user to reconnect
          if (retryError.message.includes('refresh token is invalid') || 
              retryError.message.includes('Spotify client credentials not configured')) {
            await supabaseClient
              .from('spotify_connections')
              .delete()
              .eq('user_id', user.id)
            
            throw new Error('Your Spotify connection has expired. Please disconnect and reconnect your Spotify account to get fresh tokens.')
          }
          throw retryError
        }
      } else {
        throw error
      }
    }

    // Process and prepare songs for database insertion
    const songsToInsert = processSongsData(allTracks, audioFeatures, user.id)

    // Clear existing songs and insert new ones
    const insertedCount = await clearAndInsertSongs(songsToInsert, user.id, supabaseClient)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${insertedCount} liked songs from Spotify`,
        total_songs: allTracks.length,
        inserted_songs: insertedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Spotify sync error:', error)
    
    // Handle specific Spotify errors with proper status codes
    if (error.message.includes('refresh token is invalid') || 
        error.message.includes('Spotify connection has expired')) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (error.message.includes('Spotify token invalid') || 
        error.message.includes('403')) {
      return new Response(
        JSON.stringify({ error: 'Spotify authentication expired. Please disconnect and reconnect your Spotify account.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})