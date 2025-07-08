import type { SpotifyTrack } from './types.ts'

export function processSongsData(allTracks: SpotifyTrack[], userId: string) {
  return allTracks.map(item => {
    return {
      user_id: userId,
      spotify_id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((artist: any) => artist.name).join(', '),
      album: item.track.album.name,
      year: item.track.album.release_date ? new Date(item.track.album.release_date).getFullYear() : null,
      added_at: item.added_at,
      danceability: null,
      bpm: null,
      key: null,
    }
  })
}