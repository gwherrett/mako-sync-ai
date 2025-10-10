export interface SpotifyConnection {
  id: string
  user_id: string
  spotify_user_id: string
  access_token: string // Deprecated: Contains placeholder, actual token in vault
  refresh_token: string | null // Deprecated: Contains placeholder, actual token in vault
  access_token_secret_id: string | null // Reference to encrypted token in vault
  refresh_token_secret_id: string | null // Reference to encrypted token in vault
  expires_at: string
  scope: string | null
  token_type: string | null
  display_name: string | null
  email: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SpotifyTrack {
  track: {
    id: string
    name: string
    artists: Array<{ name: string; id: string }>
    album: {
      id: string
      name: string
      release_date: string
    }
  }
  added_at: string
}