import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import type { SpotifyConnection } from './types.ts'
import { getValidAccessToken } from './spotify-auth.ts'
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
    console.log('=== SPOTIFY SYNC STARTED - REFACTORED VERSION ===')
    
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
    
    // Fetch audio features (danceability, BPM, key) with token refresh retry
    let audioFeatures: { [key: string]: any } = {}
    try {
      audioFeatures = await fetchAudioFeatures(trackIds, accessToken)
    } catch (error: any) {
      if (error.message.includes('Spotify token invalid')) {
        console.log('Token expired during audio features fetch, refreshing...')
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
          
          // Try to refresh the token with fresh connection data
          accessToken = await getValidAccessToken(freshConnection as SpotifyConnection, supabaseClient, user.id)
          audioFeatures = await fetchAudioFeatures(trackIds, accessToken)
        } catch (retryError: any) {
          console.error('Token refresh retry also failed:', retryError)
          // If refresh token is also invalid, clear the connection and ask user to reconnect
          if (retryError.message.includes('refresh token is invalid')) {
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})