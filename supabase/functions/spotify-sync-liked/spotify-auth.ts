import type { SpotifyConnection } from './types.ts'

export async function refreshSpotifyToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  console.log('Token expired, attempting to refresh...', {
    refresh_token_available: !!connection.refresh_token,
    expires_at: connection.expires_at,
    current_time: new Date().toISOString()
  })
  
  if (!connection.refresh_token) {
    throw new Error('Spotify token expired and no refresh token available')
  }

  // Validate client credentials exist
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.error('Missing Spotify client credentials')
    throw new Error('Spotify client credentials not configured')
  }

  console.log('Making refresh token request...', {
    client_id: clientId.substring(0, 8) + '...',
    refresh_token: connection.refresh_token.substring(0, 20) + '...'
  })

  const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }),
  })

  console.log('Refresh response status:', refreshResponse.status)

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text()
    console.error('Token refresh failed:', {
      status: refreshResponse.status,
      statusText: refreshResponse.statusText,
      error: errorText
    })
    
    // Parse the error response for better debugging
    try {
      const errorData = JSON.parse(errorText)
      console.error('Parsed refresh error:', errorData)
    } catch (e) {
      console.error('Could not parse refresh error response')
    }
    
    // If refresh token is invalid (400) or forbidden (403), we need a fresh connection
    if (refreshResponse.status === 400 || refreshResponse.status === 403) {
      // Clear the invalid connection
      await supabaseClient
        .from('spotify_connections')
        .delete()
        .eq('user_id', userId)
      
      throw new Error('Spotify refresh token is invalid. Please disconnect and reconnect your Spotify account to get fresh tokens.')
    }
    
    throw new Error(`Failed to refresh Spotify token: ${refreshResponse.status} - ${errorText}`)
  }

  const refreshData = await refreshResponse.json()
  console.log('Refresh successful:', {
    has_access_token: !!refreshData.access_token,
    has_refresh_token: !!refreshData.refresh_token,
    expires_in: refreshData.expires_in
  })
  
  const newAccessToken = refreshData.access_token
  const newRefreshToken = refreshData.refresh_token || connection.refresh_token
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

  console.log('Updating tokens in database...', {
    new_expires_at: newExpiresAt,
    using_new_refresh_token: !!refreshData.refresh_token
  })

  const { error: updateError } = await supabaseClient
    .from('spotify_connections')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Error updating tokens:', updateError)
    throw new Error('Failed to update Spotify tokens')
  }

  console.log('Token refreshed successfully')
  return newAccessToken
}

export async function getValidAccessToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(connection.expires_at)
  const timeUntilExpiry = expiresAt.getTime() - now.getTime()
  
  console.log('Checking token validity:', {
    expires_at: connection.expires_at,
    current_time: now.toISOString(),
    time_until_expiry_minutes: Math.round(timeUntilExpiry / (1000 * 60)),
    is_expired: now >= expiresAt
  })
  
  // Refresh if token is expired or expires within 5 minutes
  if (now >= expiresAt || timeUntilExpiry < 5 * 60 * 1000) {
    console.log('Token needs refresh - expired or expires soon')
    return await refreshSpotifyToken(connection, supabaseClient, userId)
  }
  
  console.log('Using existing access token')
  return connection.access_token
}