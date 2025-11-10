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
    // Parse request body for force_full_sync flag
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const forceFullSync = body.force_full_sync === true
    
    console.log('=== SPOTIFY SYNC STARTED ===')
    console.log('Request method:', req.method)
    console.log('Force full sync:', forceFullSync)
    
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
    let lastSyncTime: string | null = null
    let isFullSync = forceFullSync

    if (existingSync) {
      console.log(`📝 Resuming sync from offset ${existingSync.last_offset}`)
      syncId = existingSync.sync_id
      startOffset = existingSync.last_offset
      totalTracks = existingSync.total_tracks
      isFullSync = existingSync.is_full_sync ?? false
    } else {
      // Check for last successful sync to determine if incremental is possible
      if (!forceFullSync) {
        const { data: lastSync } = await supabaseClient
          .from('sync_progress')
          .select('last_sync_completed_at')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .not('last_sync_completed_at', 'is', null)
          .order('last_sync_completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (lastSync?.last_sync_completed_at) {
          lastSyncTime = lastSync.last_sync_completed_at
          isFullSync = false
          console.log(`🔄 Incremental sync mode - fetching songs added after ${lastSyncTime}`)
        } else {
          isFullSync = true
          console.log('🆕 First sync - will sync all songs')
        }
      } else {
        console.log('🔄 Force full sync requested')
      }

      // Create new sync progress record
      const { data: newSync, error: syncError } = await supabaseClient
        .from('sync_progress')
        .insert({
          user_id: user.id,
          status: 'in_progress',
          last_offset: 0,
          is_full_sync: isFullSync
        })
        .select()
        .single()

      if (syncError || !newSync) {
        throw new Error('Failed to create sync progress record')
      }

      syncId = newSync.sync_id
      console.log(`🆕 Starting new sync with ID: ${syncId}`)

      // Clear existing songs only for full sync
      if (isFullSync) {
        console.log('🗑️ Clearing existing songs for full sync...')
        const { error: deleteError } = await supabaseAdmin
          .from('spotify_liked')
          .delete()
          .eq('user_id', user.id)

        if (deleteError) {
          throw new Error(`Failed to clear existing songs: ${deleteError.message}`)
        }
      }
    }

    // Fetch tracks in chunks
    let currentOffset = startOffset
    let hasMore = true
    let allChunkTracks: any[] = []
    let newTracksCount = 0
    let consecutiveEmptyBatches = 0
    const MAX_EMPTY_BATCHES = 3 // Check 3 batches (150 tracks) before giving up on incremental sync

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
      
      // For incremental sync, filter out tracks already synced
      let newItems = data.items
      if (!isFullSync && lastSyncTime) {
        const lastSyncDate = new Date(lastSyncTime)
        
        // Debug: Log what we're comparing
        console.log(`\n=== INCREMENTAL SYNC DEBUG ===`)
        console.log(`Last sync timestamp: ${lastSyncTime}`)
        console.log(`Last sync as Date: ${lastSyncDate.toISOString()}`)
        console.log(`Fetched ${data.items.length} tracks from Spotify`)
        
        // Log first 3 tracks for debugging
        if (data.items.length > 0) {
          console.log(`\nFirst 3 tracks from Spotify:`)
          data.items.slice(0, 3).forEach((item: any, idx: number) => {
            const trackAddedAt = new Date(item.added_at)
            const isNewer = trackAddedAt >= lastSyncDate
            console.log(`  ${idx + 1}. "${item.track.name}" by ${item.track.artists[0].name}`)
            console.log(`     added_at: ${item.added_at}`)
            console.log(`     as Date: ${trackAddedAt.toISOString()}`)
            console.log(`     >= lastSync? ${isNewer}`)
          })
        }
        
        newItems = data.items.filter((item: any) => {
          const addedAt = new Date(item.added_at)
          return addedAt >= lastSyncDate
        })
        
        console.log(`Filtered result: ${newItems.length} new tracks`)
        console.log(`=== END DEBUG ===\n`)
      }
      
      allChunkTracks = allChunkTracks.concat(newItems)
      
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
      if (allChunkTracks.length >= CHUNK_SIZE || (!hasMore && allChunkTracks.length > 0)) {
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

        // Process songs data
        const songsToInsert = processSongsData(allChunkTracks, user.id, artistGenreMap, new Map(), genreMapping)
        newTracksCount += songsToInsert.length

        // Get existing tracks with manually assigned super_genre to preserve them
        const spotifyIds = songsToInsert.map(s => s.spotify_id)
        const { data: existingTracks } = await supabaseClient
          .from('spotify_liked')
          .select('spotify_id, super_genre')
          .eq('user_id', user.id)
          .in('spotify_id', spotifyIds)
          .not('super_genre', 'is', null)
        
        // Create a set of spotify_ids that have manually assigned genres
        const tracksWithManualGenres = new Set(
          (existingTracks || []).map(t => t.spotify_id)
        )
        
        // For tracks with manual genres, preserve the super_genre by removing it from upsert data
        const songsToUpsert = songsToInsert.map(song => {
          if (tracksWithManualGenres.has(song.spotify_id)) {
            // Remove super_genre from update to preserve manual assignment
            const { super_genre, ...songWithoutSuperGenre } = song
            return songWithoutSuperGenre
          }
          return song
        })

        const { error: insertError } = await supabaseAdmin
          .from('spotify_liked')
          .upsert(songsToUpsert, {
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
            last_offset: currentOffset,
            new_tracks_added: newTracksCount
          })
          .eq('sync_id', syncId)

        console.log(`✅ Processed ${currentOffset}/${totalTracks} tracks (${newTracksCount} new)`)

        // Clear chunk for next iteration
        allChunkTracks = []
      }
      
      // For incremental sync, check if we should stop after multiple empty batches
      // This handles cases where Spotify API order might not be perfect
      if (!isFullSync && lastSyncTime) {
        if (newItems.length === 0) {
          consecutiveEmptyBatches++
          console.log(`Empty batch ${consecutiveEmptyBatches}/${MAX_EMPTY_BATCHES}, continuing...`)
          
          if (consecutiveEmptyBatches >= MAX_EMPTY_BATCHES) {
            console.log(`No new tracks found in ${MAX_EMPTY_BATCHES} consecutive batches (${MAX_EMPTY_BATCHES * 50} tracks checked), stopping incremental sync`)
            hasMore = false
            break
          }
        } else {
          // Reset counter if we found new tracks
          consecutiveEmptyBatches = 0
        }
      }

      // Break if we've processed everything
      if (!hasMore) break
    }

    // Mark sync as completed with timestamp
    await supabaseClient
      .from('sync_progress')
      .update({
        status: 'completed',
        tracks_fetched: currentOffset,
        tracks_processed: currentOffset,
        new_tracks_added: newTracksCount,
        last_sync_completed_at: new Date().toISOString()
      })
      .eq('sync_id', syncId)

    const syncType = isFullSync ? 'Full' : 'Incremental'
    const message = isFullSync 
      ? `Full sync complete: ${currentOffset} tracks synced`
      : `Incremental sync complete: ${newTracksCount} new tracks added`
    
    console.log(`🎉 ${message}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        total_songs: totalTracks,
        processed_songs: currentOffset,
        new_tracks_added: newTracksCount,
        sync_type: syncType,
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