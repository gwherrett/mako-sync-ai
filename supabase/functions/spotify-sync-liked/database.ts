import { processMetadata } from './normalization.ts'

export async function clearAndInsertSongs(songsToInsert: any[], userId: string, supabaseClient: any) {
  // Clear existing songs for this user
  const { error: deleteError } = await supabaseClient
    .from('spotify_liked')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error('Error clearing existing songs:', deleteError)
  }

  // Normalize tracks before insertion
  console.log('🔄 Normalizing tracks before insertion...')
  const normalizedSongs = songsToInsert.map(song => {
    const normalized = processMetadata(song.title, song.artist)
    return {
      ...song,
      normalized_title: normalized.normalized_title,
      normalized_artist: normalized.normalized_artist,
      core_title: normalized.core_title,
      version_info: normalized.version_info,
      primary_artist: normalized.primary_artist,
      featured_artists: normalized.featured_artists,
      remixer: normalized.remixer,
    }
  })

  // Insert new songs in batches
  const insertBatchSize = 100
  let insertedCount = 0
  
  for (let i = 0; i < normalizedSongs.length; i += insertBatchSize) {
    const batch = normalizedSongs.slice(i, i + insertBatchSize)
    
    const { error: insertError } = await supabaseClient
      .from('spotify_liked')
      .insert(batch)

    if (insertError) {
      console.error('Error inserting songs batch:', insertError)
      continue
    }
    
    insertedCount += batch.length
  }

  console.log(`✅ Inserted ${insertedCount} normalized tracks`)
  return insertedCount
}