import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SpotifyConnection {
  id: string
  user_id: string
  spotify_user_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string
  scope: string | null
  token_type: string | null
  display_name: string | null
  email: string | null
  created_at: string | null
  updated_at: string | null
}

interface SpotifyTrack {
  track: {
    id: string
    name: string
    artists: Array<{ name: string; id: string }>
    album: {
      id: string
      name: string
      release_date: string
    }
  }
  added_at: string
}

async function refreshSpotifyToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  console.log('Token expired, attempting to refresh...')
  
  if (!connection.refresh_token) {
    throw new Error('Spotify token expired and no refresh token available')
  }

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
    console.error('Token refresh failed:', refreshResponse.status)
    throw new Error('Failed to refresh Spotify token')
  }

  const refreshData = await refreshResponse.json()
  const newAccessToken = refreshData.access_token
  const newRefreshToken = refreshData.refresh_token || connection.refresh_token
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

  const { error: updateError } = await supabaseClient
    .from('spotify_connections')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Error updating tokens:', updateError)
    throw new Error('Failed to update Spotify tokens')
  }

  console.log('Token refreshed successfully')
  return newAccessToken
}

async function getValidAccessToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(connection.expires_at)
  
  if (now >= expiresAt) {
    return await refreshSpotifyToken(connection, supabaseClient, userId)
  }
  
  return connection.access_token
}

async function fetchAllLikedSongs(accessToken: string): Promise<SpotifyTrack[]> {
  let allTracks: SpotifyTrack[] = []
  let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50'
  
  console.log('Starting to fetch liked songs...')
  
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch tracks: ${response.status} ${response.statusText}`)
      throw new Error('Failed to fetch liked songs from Spotify')
    }

    const data = await response.json()
    allTracks = allTracks.concat(data.items)
    nextUrl = data.next
    console.log(`Fetched ${data.items.length} tracks, total so far: ${allTracks.length}`)
  }

  console.log(`Fetched ${allTracks.length} liked songs from Spotify`)
  
  // Debug: Log a sample track to see the album structure
  if (allTracks.length > 0) {
    const sampleTrack = allTracks[0]
    console.log('Sample track structure:', JSON.stringify({
      track_name: sampleTrack.track?.name,
      album_id: sampleTrack.track?.album?.id,
      album_name: sampleTrack.track?.album?.name,
      album_type: sampleTrack.track?.album?.album_type
    }, null, 2))
  }

  return allTracks
}

async function fetchArtistGenres(allTracks: SpotifyTrack[], accessToken: string): Promise<{ [key: string]: string[] }> {
  const artistGenres: { [key: string]: string[] } = {}
  
  // Get unique artist IDs from all tracks
  const artistIds = [...new Set(
    allTracks.flatMap(item => 
      item.track.artists.map(artist => artist.id).filter(Boolean)
    )
  )]
  
  console.log(`Found ${artistIds.length} unique artists`)
  
  const batchSize = 50 // Spotify allows up to 50 artists per request
  
  for (let i = 0; i < artistIds.length; i += batchSize) {
    const batchIds = artistIds.slice(i, i + batchSize)
    console.log(`Fetching artist batch ${Math.floor(i/batchSize) + 1}: ${batchIds.length} artists`)
    
    const artistResponse = await fetch(`https://api.spotify.com/v1/artists?ids=${batchIds.join(',')}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    
    console.log(`Artist API response status: ${artistResponse.status}`)
    
    if (artistResponse.ok) {
      const artistData = await artistResponse.json()
      console.log(`Received ${artistData.artists?.length || 0} artists in response`)
      
      if (artistData.artists) {
        artistData.artists.forEach((artist: any, index: number) => {
          if (artist) {
            console.log(`Artist ${index + 1}: ${artist.name} - Genres: ${artist.genres?.join(', ') || 'No genres'}`)
            if (artist.genres && artist.genres.length > 0) {
              artistGenres[artist.id] = artist.genres
            }
          } else {
            console.log(`Artist ${index + 1}: null/undefined`)
          }
        })
      }
    } else {
      console.error(`Failed to fetch artists batch: ${artistResponse.status} ${artistResponse.statusText}`)
      const errorText = await artistResponse.text()
      console.error(`Error response: ${errorText}`)
    }
  }

  console.log(`Fetched genres for ${Object.keys(artistGenres).length} artists`)
  return artistGenres
}

function processSongsData(allTracks: SpotifyTrack[], artistGenres: { [key: string]: string[] }, userId: string) {
  return allTracks.map(item => {
    // Get genres from all artists for this track
    const trackGenres = new Set<string>()
    item.track.artists.forEach(artist => {
      const genres = artistGenres[artist.id] || []
      genres.forEach(genre => trackGenres.add(genre))
    })
    
    return {
      user_id: userId,
      spotify_id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((artist: any) => artist.name).join(', '),
      album: item.track.album.name,
      genre: trackGenres.size > 0 ? Array.from(trackGenres).join(', ') : null,
      year: item.track.album.release_date ? new Date(item.track.album.release_date).getFullYear() : null,
      added_at: item.added_at,
    }
  })
}

async function clearAndInsertSongs(songsToInsert: any[], userId: string, supabaseClient: any) {
  // Clear existing songs for this user
  const { error: deleteError } = await supabaseClient
    .from('spotify_liked')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error('Error clearing existing songs:', deleteError)
  }

  // Insert new songs in batches
  const insertBatchSize = 100
  let insertedCount = 0
  
  for (let i = 0; i < songsToInsert.length; i += insertBatchSize) {
    const batch = songsToInsert.slice(i, i + insertBatchSize)
    
    const { error: insertError } = await supabaseClient
      .from('spotify_liked')
      .insert(batch)

    if (insertError) {
      console.error('Error inserting songs batch:', insertError)
      continue
    }
    
    insertedCount += batch.length
  }

  return insertedCount
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

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(connection, supabaseClient, user.id)

    // Fetch all liked songs from Spotify
    const allTracks = await fetchAllLikedSongs(accessToken)

    // Fetch artist details to get genres (artists have better genre data than albums)
    const artistGenres = await fetchArtistGenres(allTracks, accessToken)

    // Process and prepare songs for database insertion
    const songsToInsert = processSongsData(allTracks, artistGenres, user.id)

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