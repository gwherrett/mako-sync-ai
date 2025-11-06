export async function fetchAlbumGenres(accessToken: string, albumIds: string[]): Promise<Map<string, string[]>> {
  const genreMap = new Map<string, string[]>()
  
  // Spotify allows up to 20 album IDs per request
  const batchSize = 20
  
  for (let i = 0; i < albumIds.length; i += batchSize) {
    const batch = albumIds.slice(i, i + batchSize)
    const idsParam = batch.join(',')
    
    console.log(`Fetching genres for ${batch.length} albums (batch ${Math.floor(i/batchSize) + 1})`)
    
    const response = await fetch(`https://api.spotify.com/v1/albums?ids=${idsParam}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SpotifyMetadataSync/1.0'
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch album data: ${response.status} ${response.statusText} - ${errorText}`)
      
      if (response.status === 401) {
        throw new Error('Spotify token invalid')
      }
      
      // Continue with other batches on non-auth errors
      console.warn(`Skipping batch due to error: ${errorText}`)
      continue
    }

    const data = await response.json()
    
    if (data.albums) {
      data.albums.forEach((album: any) => {
        if (album && album.id) {
          genreMap.set(album.id, album.genres || [])
        }
      })
    }
  }
  
  console.log(`Fetched genres for ${genreMap.size} albums`)
  return genreMap
}

export async function getCachedAlbumGenres(albumIds: string[], supabaseClient: any): Promise<Map<string, string[]>> {
  const { data, error } = await supabaseClient
    .from('album_genres')
    .select('spotify_album_id, genres')
    .in('spotify_album_id', albumIds)
  
  if (error) {
    console.error('Error fetching cached album genres:', error)
    return new Map()
  }
  
  const genreMap = new Map<string, string[]>()
  data?.forEach((row: any) => {
    genreMap.set(row.spotify_album_id, row.genres || [])
  })
  
  console.log(`Found ${genreMap.size} cached album genres out of ${albumIds.length} requested`)
  return genreMap
}

export async function cacheAlbumGenres(genreMap: Map<string, string[]>, supabaseClient: any): Promise<void> {
  if (genreMap.size === 0) return
  
  const cacheEntries = Array.from(genreMap.entries()).map(([albumId, genres]) => ({
    spotify_album_id: albumId,
    genres: genres,
    cached_at: new Date().toISOString()
  }))
  
  // Insert or update cache entries
  const { error } = await supabaseClient
    .from('album_genres')
    .upsert(cacheEntries, { 
      onConflict: 'spotify_album_id',
      ignoreDuplicates: false 
    })
  
  if (error) {
    console.error('Error caching album genres:', error)
  } else {
    console.log(`Cached genres for ${cacheEntries.length} albums`)
  }
}

export async function getAlbumGenresWithCache(accessToken: string, albumIds: string[], supabaseClient: any): Promise<Map<string, string[]>> {
  // Remove duplicates
  const uniqueAlbumIds = [...new Set(albumIds)]
  
  console.log(`Getting genres for ${uniqueAlbumIds.length} unique albums`)
  
  // Get cached genres first
  const cachedGenres = await getCachedAlbumGenres(uniqueAlbumIds, supabaseClient)
  
  // Find albums that need fresh data
  const uncachedAlbumIds = uniqueAlbumIds.filter(id => !cachedGenres.has(id))
  
  if (uncachedAlbumIds.length === 0) {
    console.log('All album genres found in cache')
    return cachedGenres
  }
  
  console.log(`Fetching fresh data for ${uncachedAlbumIds.length} uncached albums`)
  
  // Fetch missing album data from Spotify
  const freshGenres = await fetchAlbumGenres(accessToken, uncachedAlbumIds)
  
  // Cache the fresh data
  await cacheAlbumGenres(freshGenres, supabaseClient)
  
  // Combine cached and fresh data
  const allGenres = new Map([...cachedGenres, ...freshGenres])
  
  console.log(`Total album genres available: ${allGenres.size} out of ${uniqueAlbumIds.length} requested`)
  return allGenres
}

export function extractUniqueAlbumIds(allTracks: any[]): string[] {
  const albumIds = new Set<string>()
  
  allTracks.forEach(item => {
    if (item.track?.album?.id) {
      albumIds.add(item.track.album.id)
    }
  })
  
  return Array.from(albumIds)
}
