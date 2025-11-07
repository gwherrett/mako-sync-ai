import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import type { SpotifyConnection } from './types.ts'
import { getValidAccessToken, refreshSpotifyToken } from './spotify-auth.ts'
import { fetchAudioFeatures } from './spotify-api.ts'
import { extractUniqueArtistIds, processSongsData } from './data-processing.ts'
import { getArtistGenresWithCache } from './artist-genres.ts'

const CHUNK_SIZE = 500 // Process 500 tracks at a time

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

    // Check for existing in-progress sync
    const { data: existingSync } = await supabaseClient
      .from('sync_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle()

    let syncId: string
    let startOffset = 0
    let totalTracks: number | null = null

    if (existingSync) {
      console.log(`📝 Resuming sync from offset ${existingSync.last_offset}`)
      syncId = existingSync.sync_id
      startOffset = existingSync.last_offset
      totalTracks = existingSync.total_tracks
    } else {
      // Create new sync progress record
      const { data: newSync, error: syncError } = await supabaseClient
        .from('sync_progress')
        .insert({
          user_id: user.id,
          status: 'in_progress',
          last_offset: 0
        })
        .select()
        .single()

      if (syncError || !newSync) {
        throw new Error('Failed to create sync progress record')
      }

      syncId = newSync.sync_id
      console.log(`🆕 Starting new sync with ID: ${syncId}`)

      // Clear existing songs on first chunk only
      console.log('🗑️ Clearing existing songs...')
      const { error: deleteError } = await supabaseAdmin
        .from('spotify_liked')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        throw new Error(`Failed to clear existing songs: ${deleteError.message}`)
      }
    }

    // Fetch tracks in chunks
    let currentOffset = startOffset
    let hasMore = true
    let allChunkTracks: any[] = []

    while (hasMore) {
      const url = `https://api.spotify.com/v1/me/tracks?limit=50&offset=${currentOffset}`
      console.log(`📥 Fetching tracks at offset ${currentOffset}`)

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch tracks: ${response.status} ${response.statusText} - ${errorText}`)
        
        // Update sync status to failed
        await supabaseClient
          .from('sync_progress')
          .update({
            status: 'failed',
            error_message: `Spotify API error: ${response.status} - ${errorText}`
          })
          .eq('sync_id', syncId)

        throw new Error(`Failed to fetch liked songs from Spotify: ${response.status}`)
      }

      const data = await response.json()
      allChunkTracks = allChunkTracks.concat(data.items)
      
      // Set total on first fetch
      if (totalTracks === null) {
        totalTracks = data.total
        await supabaseClient
          .from('sync_progress')
          .update({ total_tracks: totalTracks })
          .eq('sync_id', syncId)
        console.log(`📊 Total tracks to sync: ${totalTracks}`)
      }

      currentOffset += data.items.length
      hasMore = data.next !== null

      // Process chunk if we have enough tracks or reached the end
      if (allChunkTracks.length >= CHUNK_SIZE || !hasMore) {
        console.log(`🔄 Processing chunk of ${allChunkTracks.length} tracks`)

        // Extract artist IDs and fetch genres
        const artistIds = extractUniqueArtistIds(allChunkTracks)
        console.log(`Found ${artistIds.length} unique artists for this chunk`)

        const artistGenreMap = await getArtistGenresWithCache(accessToken, artistIds, supabaseClient)

        // Fetch genre mapping
        const { data: genreMappingData } = await supabaseClient
          .from('v_effective_spotify_genre_map')
          .select('spotify_genre, super_genre')

        const genreMapping = new Map<string, string>()
        if (genreMappingData) {
          genreMappingData.forEach(item => {
            if (item.spotify_genre && item.super_genre) {
              genreMapping.set(item.spotify_genre, item.super_genre)
            }
          })
        }

        // Process and insert songs
        const songsToInsert = processSongsData(allChunkTracks, user.id, artistGenreMap, new Map(), genreMapping)

        const { error: insertError } = await supabaseAdmin
          .from('spotify_liked')
          .upsert(songsToInsert, {
            onConflict: 'user_id,spotify_id',
            ignoreDuplicates: false
          })

        if (insertError) {
          console.error('Insert error:', insertError)
          
          // Update sync status to failed
          await supabaseClient
            .from('sync_progress')
            .update({
              status: 'failed',
              error_message: `Database insert error: ${insertError.message}`
            })
            .eq('sync_id', syncId)

          throw new Error(`Failed to insert songs: ${insertError.message}`)
        }

        // Update progress
        await supabaseClient
          .from('sync_progress')
          .update({
            tracks_fetched: currentOffset,
            tracks_processed: currentOffset,
            last_offset: currentOffset
          })
          .eq('sync_id', syncId)

        console.log(`✅ Processed ${currentOffset}/${totalTracks} tracks`)

        // Clear chunk for next iteration
        allChunkTracks = []
      }

      // Break if we've processed everything
      if (!hasMore) break
    }

    // Mark sync as completed
    await supabaseClient
      .from('sync_progress')
      .update({
        status: 'completed',
        tracks_fetched: currentOffset,
        tracks_processed: currentOffset
      })
      .eq('sync_id', syncId)

    console.log(`🎉 Sync completed successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${currentOffset} liked songs from Spotify`,
        total_songs: totalTracks,
        processed_songs: currentOffset,
        sync_id: syncId
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