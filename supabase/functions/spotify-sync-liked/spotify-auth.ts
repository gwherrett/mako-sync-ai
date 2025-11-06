import type { SpotifyConnection } from './types.ts'

export async function refreshSpotifyToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  console.log('Token expired, attempting refresh')
  
  // Get refresh token from vault only (no plain text fallback)
  if (!connection.refresh_token_secret_id) {
    console.error('No refresh token vault reference found')
    throw new Error('No refresh token available - please reconnect Spotify')
  }
  
  console.log('Retrieving refresh token from vault')
  const { data: refreshToken, error: vaultError } = await supabaseClient
    .rpc('get_spotify_token_from_vault', {
      p_secret_id: connection.refresh_token_secret_id
    })

  if (vaultError || !refreshToken) {
    console.error('Failed to retrieve refresh token from vault')
    throw new Error('Failed to retrieve refresh token from vault - please reconnect Spotify')
  }

  // Validate client credentials exist
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.error('Missing Spotify client credentials')
    throw new Error('Spotify client credentials not configured')
  }

  console.log('Requesting token refresh from Spotify')

  const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  console.log('Refresh response received', { status: refreshResponse.status })

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text()
    console.error('Token refresh failed', { status: refreshResponse.status })
    
    // If refresh token is invalid (400) or forbidden (403), we need a fresh connection
    if (refreshResponse.status === 400 || refreshResponse.status === 403) {
      // Clear the invalid connection
      await supabaseClient
        .from('spotify_connections')
        .delete()
        .eq('user_id', userId)
      
      throw new Error('Spotify refresh token is invalid. Please disconnect and reconnect your Spotify account to get fresh tokens.')
    }
    
    throw new Error('Failed to refresh Spotify token')
  }

  const refreshData = await refreshResponse.json()
  console.log('Token refresh successful')
  
  const newAccessToken = refreshData.access_token
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

  console.log('Updating tokens in database')

  // Update tokens in vault only (no plain text storage)
  const updateData: any = {
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString()
  }

  if (!connection.access_token_secret_id) {
    console.error('No access token vault reference found')
    throw new Error('Invalid connection state - please reconnect Spotify')
  }

  // Update access token in vault
  console.log('Updating access token in vault')
  const { error: accessTokenUpdateError } = await supabaseClient
    .rpc('update_spotify_token_in_vault', {
      p_secret_id: connection.access_token_secret_id,
      p_new_token_value: newAccessToken
    })

  if (accessTokenUpdateError) {
    console.error('Failed to update access token in vault')
    throw new Error('Failed to update access token in vault')
  }

  // If Spotify provided a new refresh token, update it too
  if (refreshData.refresh_token) {
    if (!connection.refresh_token_secret_id) {
      console.error('No refresh token vault reference found')
      throw new Error('Invalid connection state - please reconnect Spotify')
    }

    console.log('Updating refresh token in vault')
    const { error: refreshTokenUpdateError } = await supabaseClient
      .rpc('update_spotify_token_in_vault', {
        p_secret_id: connection.refresh_token_secret_id,
        p_new_token_value: refreshData.refresh_token
      })

    if (refreshTokenUpdateError) {
      console.error('Failed to update refresh token in vault')
      throw new Error('Failed to update refresh token in vault')
    }
  }

  // Update connection
  const { error: updateError } = await supabaseClient
    .from('spotify_connections')
    .update(updateData)
    .eq('user_id', userId)

  if (updateError) {
    console.error('Failed to update connection metadata')
    throw new Error('Failed to update connection metadata')
  }

  console.log('Token refreshed successfully')
  return newAccessToken
}

export async function getValidAccessToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(connection.expires_at)
  const timeUntilExpiry = expiresAt.getTime() - now.getTime()
  
  console.log('Checking token validity', {
    time_until_expiry_minutes: Math.round(timeUntilExpiry / (1000 * 60)),
    is_expired: now >= expiresAt
  })
  
  // Refresh if token is expired or expires within 5 minutes
  if (now >= expiresAt || timeUntilExpiry < 5 * 60 * 1000) {
    console.log('Token needs refresh')
    return await refreshSpotifyToken(connection, supabaseClient, userId)
  }
  
  // Get access token from vault only (no plain text fallback)
  if (!connection.access_token_secret_id) {
    console.error('No access token vault reference found')
    throw new Error('No access token available - please reconnect Spotify')
  }
  
  console.log('Retrieving access token from vault')
  const { data: accessToken, error: vaultError } = await supabaseClient
    .rpc('get_spotify_token_from_vault', {
      p_secret_id: connection.access_token_secret_id
    })

  if (vaultError || !accessToken) {
    console.error('Failed to retrieve access token from vault')
    throw new Error('Failed to retrieve access token from vault - please reconnect Spotify')
  }

  return accessToken
}