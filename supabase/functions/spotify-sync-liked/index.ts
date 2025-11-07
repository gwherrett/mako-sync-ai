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
    
    // Create client for user auth and RLS-protected operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Create admin client for vault operations (needs service_role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's Spotify connection using admin client for vault access
    const { data: connection, error: connectionError } = await supabaseAdmin
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

    // Get valid access token (refresh if needed) - use admin client for vault access
    let accessToken
    try {
      accessToken = await getValidAccessToken(connection as SpotifyConnection, supabaseAdmin, user.id)
      console.log('Access token obtained successfully')
    } catch (error: any) {
      console.error('Failed to get valid access token:', error)
      if (error.message.includes('refresh token is invalid')) {
        // Clear the invalid connection
        await supabaseAdmin
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

    // Fetch effective genre mapping for this user
    const { data: genreMappingData, error: genreMappingError } = await supabaseClient
      .from('v_effective_spotify_genre_map')
      .select('spotify_genre, super_genre')

    if (genreMappingError) {
      console.error('Error fetching genre mapping:', genreMappingError)
      throw new Error('Failed to fetch genre mapping')
    }

    // Convert to Map for efficient lookups
    const genreMapping = new Map<string, string>()
    if (genreMappingData) {
      genreMappingData.forEach(item => {
        if (item.spotify_genre && item.super_genre) {
          genreMapping.set(item.spotify_genre, item.super_genre)
        }
      })
    }

    // Process and prepare songs for database insertion
    const songsToInsert = processSongsData(allTracks, user.id, artistGenreMap, new Map(), genreMapping)

    // Clear existing songs and insert new ones - use admin client to bypass RLS
    const insertedCount = await clearAndInsertSongs(songsToInsert, user.id, supabaseAdmin)

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