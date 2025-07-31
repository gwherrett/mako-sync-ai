import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import type { SpotifyConnection } from './types.ts'
import { getValidAccessToken, refreshSpotifyToken } from './spotify-auth.ts'
import { fetchAllLikedSongs, fetchAudioFeatures } from './spotify-api.ts'
import { extractUniqueArtistIds, processSongsData } from './data-processing.ts'
import { clearAndInsertSongs } from './database.ts'
import { getArtistGenresWithCache } from './artist-genres.ts'

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

    // Extract unique artist IDs for genre fetching
    const artistIds = extractUniqueArtistIds(allTracks)
    console.log(`Found ${artistIds.length} unique artists to fetch genres for`)

    // Fetch artist genres with caching
    const artistGenreMap = await getArtistGenresWithCache(accessToken, artistIds, supabaseClient)

    // Process and prepare songs for database insertion
    const songsToInsert = processSongsData(allTracks, user.id, artistGenreMap)

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