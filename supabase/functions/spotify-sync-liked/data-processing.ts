import type { SpotifyTrack } from './types.ts'

export function extractUniqueArtistIds(allTracks: SpotifyTrack[]): string[] {
  const artistIds = new Set<string>()
  
  allTracks.forEach(item => {
    if (item.track?.artists) {
      item.track.artists.forEach((artist: any) => {
        if (artist?.id) {
          artistIds.add(artist.id)
        }
      })
    }
  })
  
  return Array.from(artistIds)
}

export function processSongsData(allTracks: SpotifyTrack[], userId: string, artistGenreMap: Map<string, string[]>, genreMapping: Map<string, string>) {
  return allTracks.map(item => {
    // Get the primary artist's genre (first artist, first genre)
    let primaryGenre: string | null = null
    let superGenre: string | null = null
    
    if (item.track?.artists && item.track.artists.length > 0) {
      const primaryArtistId = item.track.artists[0]?.id
      if (primaryArtistId && artistGenreMap.has(primaryArtistId)) {
        const genres = artistGenreMap.get(primaryArtistId) || []
        primaryGenre = genres.length > 0 ? genres[0] : null
        
        // Get super genre from mapping if primary genre exists
        if (primaryGenre && genreMapping.has(primaryGenre)) {
          superGenre = genreMapping.get(primaryGenre) || null
        }
      }
    }
    
    return {
      user_id: userId,
      spotify_id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((artist: any) => artist.name).join(', '),
      album: item.track.album.name,
      year: item.track.album.release_date ? new Date(item.track.album.release_date).getFullYear() : null,
      added_at: item.added_at,
      genre: primaryGenre,
      super_genre: superGenre,
      danceability: null,
      bpm: null,
      key: null,
    }
  })
}