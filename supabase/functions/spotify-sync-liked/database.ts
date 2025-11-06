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
      primary_artist: normalized.primary_artist,
      featured_artists: normalized.featured_artists,
      mix: normalized.mix,
    }
  })

  // Insert new songs in batches with upsert to handle duplicates
  const insertBatchSize = 100
  let insertedCount = 0
  const errors: string[] = []
  
  for (let i = 0; i < normalizedSongs.length; i += insertBatchSize) {
    const batch = normalizedSongs.slice(i, i + insertBatchSize)
    
    const { error: insertError } = await supabaseClient
      .from('spotify_liked')
      .upsert(batch, {
        onConflict: 'user_id,spotify_id',
        ignoreDuplicates: false
      })

    if (insertError) {
      console.error(`❌ Error inserting batch ${i / insertBatchSize + 1}:`, insertError)
      errors.push(`Batch ${i / insertBatchSize + 1}: ${insertError.message}`)
      // Don't continue - throw error to stop sync
      throw new Error(`Failed to insert batch: ${insertError.message}`)
    }
    
    insertedCount += batch.length
    console.log(`✅ Inserted batch ${i / insertBatchSize + 1}/${Math.ceil(normalizedSongs.length / insertBatchSize)} (${insertedCount} songs)`)
  }

  if (errors.length > 0) {
    throw new Error(`Sync completed with ${errors.length} errors: ${errors.join(', ')}`)
  }

  console.log(`✅ Successfully inserted ${insertedCount} normalized tracks`)
  return insertedCount
}