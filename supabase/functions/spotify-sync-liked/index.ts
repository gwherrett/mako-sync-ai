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

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(connection.expires_at)
    
    if (now >= expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Spotify token expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch liked songs from Spotify
    let allTracks: any[] = []
    let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50'
    
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      })

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch liked songs from Spotify' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await response.json()
      allTracks = allTracks.concat(data.items)
      nextUrl = data.next
    }

    console.log(`Fetched ${allTracks.length} liked songs from Spotify`)

    // Get unique album IDs for genre fetching
    const albumIds = [...new Set(allTracks.map(item => item.track.album.id))].filter(Boolean)
    console.log(`Found ${albumIds.length} unique albums`)
    
    // Fetch album details in batches to get genres
    const albumGenres: { [key: string]: string[] } = {}
    const batchSize = 20 // Spotify allows up to 20 albums per request
    
    for (let i = 0; i < albumIds.length; i += batchSize) {
      const batchIds = albumIds.slice(i, i + batchSize)
      const albumResponse = await fetch(`https://api.spotify.com/v1/albums?ids=${batchIds.join(',')}`, {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      })
      
      if (albumResponse.ok) {
        const albumData = await albumResponse.json()
        albumData.albums.forEach((album: any) => {
          if (album && album.genres) {
            albumGenres[album.id] = album.genres
          }
        })
      }
    }

    console.log(`Fetched genres for ${Object.keys(albumGenres).length} albums`)

    // Process and store songs
    const songsToInsert = allTracks.map(item => {
      const albumId = item.track.album.id
      const genres = albumGenres[albumId] || []
      
      return {
        user_id: user.id,
        spotify_id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((artist: any) => artist.name).join(', '),
        album: item.track.album.name,
        genre: genres.length > 0 ? genres.join(', ') : null,
        year: item.track.album.release_date ? new Date(item.track.album.release_date).getFullYear() : null,
        added_at: item.added_at,
      }
    })

    // Clear existing songs and insert new ones
    const { error: deleteError } = await supabaseClient
      .from('spotify_liked')
      .delete()
      .eq('user_id', user.id) // Delete only current user's songs

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