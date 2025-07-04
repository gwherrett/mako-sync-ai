export async function clearAndInsertSongs(songsToInsert: any[], userId: string, supabaseClient: any) {
  // Clear existing songs for this user
  const { error: deleteError } = await supabaseClient
    .from('spotify_liked')
    .delete()
    .eq('user_id', userId)

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

  return insertedCount
}