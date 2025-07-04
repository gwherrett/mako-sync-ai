import type { SpotifyConnection } from './types.ts'

export async function refreshSpotifyToken(connection: SpotifyConnection, supabaseClient: any, userId: string): Promise<string> {
  console.log('Token expired, attempting to refresh...')
  
  if (!connection.refresh_token) {
    throw new Error('Spotify token expired and no refresh token available')
  }

  const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${Deno.env.get('SPOTIFY_CLIENT_ID')}:${Deno.env.get('SPOTIFY_CLIENT_SECRET')}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }),
  })

  if (!refreshResponse.ok) {
    console.error('Token refresh failed:', refreshResponse.status)
    throw new Error('Failed to refresh Spotify token')
  }

  const refreshData = await refreshResponse.json()
  const newAccessToken = refreshData.access_token
  const newRefreshToken = refreshData.refresh_token || connection.refresh_token
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

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
  
  if (now >= expiresAt) {
    return await refreshSpotifyToken(connection, supabaseClient, userId)
  }
  
  return connection.access_token
}