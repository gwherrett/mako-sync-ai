
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
    console.log('=== SPOTIFY SYNC STARTED ===')
    console.log('Request method:', req.method)
    console.log('Request headers present:', Object.keys(Object.fromEntries(req.headers.entries())))
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    console.log('Getting authenticated user...')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError) {
      console.error('User authentication error:', userError)
      return new Response(
        JSON.stringify({ error: `Authentication error: ${userError.message}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      console.error('No authenticated user found')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no user found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated successfully:', user.id)

    // Get user's Spotify connection
    console.log('Fetching Spotify connection from database...')
    const { data: connection, error: connectionError } = await supabaseClient
      .from('spotify_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (connectionError) {
      console.error('Connection fetch error:', connectionError)
      return new Response(
        JSON.stringify({ 
          error: 'Spotify connection not found in database',
          details: connectionError.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!connection) {
      console.error('No connection data returned')
      return new Response(
        JSON.stringify({ error: 'Spotify not connected - no connection data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Spotify connection found:', connection.id)
    console.log('Connection expires at:', connection.expires_at)

    // Get valid access token (refresh if needed)
    console.log('Getting valid access token...')
    let accessToken: string
    try {
      accessToken = await getValidAccessToken(connection as SpotifyConnection, supabaseClient, user.id)
      console.log('Access token obtained successfully')
    } catch (tokenError: any) {
      console.error('Token error:', tokenError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get valid Spotify access token',
          details: tokenError.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all liked songs from Spotify
    console.log('Fetching liked songs from Spotify API...')
    let allTracks
    try {
      allTracks = await fetchAllLikedSongs(accessToken)
      console.log(`Successfully fetched ${allTracks.length} liked songs`)
    } catch (fetchError: any) {
      console.error('Error fetching liked songs:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch liked songs from Spotify',
          details: fetchError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get track IDs for audio features
    const trackIds = allTracks.map(item => item.track.id)
    console.log(`Fetching audio features for ${trackIds.length} tracks...`)
    
    // Fetch audio features (danceability, BPM, key) with token refresh retry
    let audioFeatures: { [key: string]: any } = {}
    try {
      audioFeatures = await fetchAudioFeatures(trackIds, accessToken)
      console.log(`Successfully fetched audio features for ${Object.keys(audioFeatures).length} tracks`)
    } catch (error: any) {
      if (error.message.includes('Spotify token invalid')) {
        console.log('Token expired during audio features fetch, refreshing...')
        // Refresh connection data and get new token
        const { data: refreshedConnection } = await supabaseClient
          .from('spotify_connections')
          .select('*')
          .eq('user_id', user.id)
          .single()
        
        if (refreshedConnection) {
          try {
            accessToken = await getValidAccessToken(refreshedConnection as SpotifyConnection, supabaseClient, user.id)
            audioFeatures = await fetchAudioFeatures(trackIds, accessToken)
            console.log(`Successfully fetched audio features after token refresh for ${Object.keys(audioFeatures).length} tracks`)
          } catch (retryError: any) {
            console.error('Token refresh retry also failed:', retryError)
            return new Response(
              JSON.stringify({ 
                error: 'Spotify connection appears to be invalid. Please disconnect and reconnect your Spotify account to get fresh tokens.',
                details: retryError.message 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          return new Response(
            JSON.stringify({ error: 'Failed to refresh Spotify connection' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        console.error('Audio features fetch error:', error)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch audio features',
            details: error.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Process and prepare songs for database insertion
    console.log('Processing songs data...')
    let songsToInsert
    try {
      songsToInsert = processSongsData(allTracks, audioFeatures, user.id)
      console.log(`Processed ${songsToInsert.length} songs for database insertion`)
    } catch (processError: any) {
      console.error('Error processing songs data:', processError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to process songs data',
          details: processError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clear existing songs and insert new ones
    console.log('Clearing existing songs and inserting new ones...')
    let insertedCount
    try {
      insertedCount = await clearAndInsertSongs(songsToInsert, user.id, supabaseClient)
      console.log(`Successfully inserted ${insertedCount} songs into database`)
    } catch (dbError: any) {
      console.error('Database operation error:', dbError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save songs to database',
          details: dbError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== SPOTIFY SYNC COMPLETED SUCCESSFULLY ===')
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${insertedCount} liked songs from Spotify`,
        total_songs: allTracks.length,
        inserted_songs: insertedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('=== SPOTIFY SYNC ERROR ===', error)
    return new Response(
      JSON.stringify({ 
        error: `Server error: ${error.message}`,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
