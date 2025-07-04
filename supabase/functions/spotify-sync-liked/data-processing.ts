import type { SpotifyTrack } from './types.ts'

export function processSongsData(allTracks: SpotifyTrack[], audioFeatures: { [key: string]: any }, userId: string) {
  return allTracks.map(item => {
    const features = audioFeatures[item.track.id] || {}
    
    // Convert Spotify's key format to a readable format
    const keyMap = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const keyString = features.key !== undefined && features.mode !== undefined 
      ? `${keyMap[features.key]} ${features.mode === 1 ? 'Major' : 'Minor'}`
      : null
    
    return {
      user_id: userId,
      spotify_id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((artist: any) => artist.name).join(', '),
      album: item.track.album.name,
      year: item.track.album.release_date ? new Date(item.track.album.release_date).getFullYear() : null,
      added_at: item.added_at,
      danceability: features.danceability || null,
      bpm: features.tempo ? Math.round(features.tempo) : null,
      key: keyString,
    }
  })
}