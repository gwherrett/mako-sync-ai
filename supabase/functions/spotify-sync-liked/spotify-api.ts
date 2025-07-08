import type { SpotifyTrack } from './types.ts'

export async function fetchAllLikedSongs(accessToken: string): Promise<SpotifyTrack[]> {
  let allTracks: SpotifyTrack[] = []
  let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50'
  
  console.log('Starting to fetch liked songs...')
  
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SpotifyMetadataSync/1.0'
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch tracks: ${response.status} ${response.statusText} - ${errorText}`)
      
      if (response.status === 403) {
        throw new Error(`Spotify API returned 403 Forbidden. This could be a scope issue or app approval issue. Response: ${errorText}`)
      } else if (response.status === 401) {
        throw new Error('Spotify token invalid')
      }
      
      throw new Error(`Failed to fetch liked songs from Spotify: ${response.status} - ${errorText}`)
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

export async function fetchAudioFeatures(trackIds: string[], accessToken: string): Promise<{ [key: string]: any }> {
  const audioFeatures: { [key: string]: any } = {}
  const batchSize = 100 // Spotify allows up to 100 tracks per request
  
  console.log(`Fetching audio features for ${trackIds.length} tracks`)
  
  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batchIds = trackIds.slice(i, i + batchSize)
    console.log(`Fetching audio features batch ${Math.floor(i/batchSize) + 1}: ${batchIds.length} tracks`)
    
    const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features?ids=${batchIds.join(',')}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SpotifyMetadataSync/1.0'
      },
    })
    
    console.log(`Audio features API response status: ${featuresResponse.status}`)
    
    if (featuresResponse.ok) {
      const featuresData = await featuresResponse.json()
      console.log(`Received ${featuresData.audio_features?.length || 0} audio features in response`)
      
      if (featuresData.audio_features) {
        featuresData.audio_features.forEach((features: any) => {
          if (features && features.id) {
            audioFeatures[features.id] = {
              danceability: features.danceability,
              tempo: features.tempo, // BPM
              key: features.key, // Musical key (0-11, where 0=C, 1=C#, etc.)
              mode: features.mode // Major (1) or Minor (0)
            }
          }
        })
      }
    } else {
      // Get detailed error information
      const errorText = await featuresResponse.text()
      console.error(`Audio features API error:`, {
        status: featuresResponse.status,
        statusText: featuresResponse.statusText,
        headers: Object.fromEntries(featuresResponse.headers.entries()),
        body: errorText
      })
      
      // Check if it's a rate limit issue
      if (featuresResponse.status === 429) {
        const retryAfter = featuresResponse.headers.get('Retry-After')
        console.error(`Rate limited. Retry after: ${retryAfter} seconds`)
        throw new Error(`Spotify API rate limit exceeded. Retry after ${retryAfter} seconds`)
      }
      
      // Check for token/auth issues
      if (featuresResponse.status === 401 || featuresResponse.status === 403) {
        console.error(`Token invalid (${featuresResponse.status}), need to refresh token`)
        throw new Error(`Spotify token invalid: ${featuresResponse.status}`)
      }
      
      // Other errors
      throw new Error(`Failed to fetch audio features: ${featuresResponse.status} - ${errorText}`)
    }
  }

  console.log(`Fetched audio features for ${Object.keys(audioFeatures).length} tracks`)
  return audioFeatures
}