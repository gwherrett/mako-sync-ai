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
