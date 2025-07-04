import type { SpotifyTrack } from './types.ts'

export async function fetchAllLikedSongs(accessToken: string): Promise<SpotifyTrack[]> {
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
      console.error(`Failed to fetch audio features batch: ${featuresResponse.status} ${featuresResponse.statusText}`)
      const errorText = await featuresResponse.text()
      console.error(`Error response: ${errorText}`)
    }
  }

  console.log(`Fetched audio features for ${Object.keys(audioFeatures).length} tracks`)
  return audioFeatures
}