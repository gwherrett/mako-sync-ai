/**
 * slskd Integration Types
 *
 * Types for interacting with slskd REST API and managing configuration.
 * Configuration is stored in browser localStorage (not Supabase).
 */

/**
 * User's slskd configuration stored in localStorage
 */
export interface SlskdConfig {
  apiEndpoint: string;           // e.g., "http://localhost:5030"
  apiKey: string;                // slskd API key
  downloadsFolder: string;       // e.g., "D:\Downloads\slskd"
  searchFormat: 'primary' | 'full';  // Search query format preference
  lastConnectionTest?: string;   // ISO timestamp
  connectionStatus: boolean;     // Last known connection status
}

/**
 * Request body for creating a new search/wishlist item
 */
export interface SlskdSearchRequest {
  searchText: string;
}

/**
 * Response from slskd search API
 */
export interface SlskdSearchResponse {
  id: string;
  searchText: string;
  state: 'InProgress' | 'Completed' | 'Errored' | 'TimedOut' | 'Cancelled';
  responseCount?: number;
  fileCount?: number;
}

/**
 * slskd session info returned from /api/v0/session
 */
export interface SlskdSessionResponse {
  username: string;
  isLoggedIn: boolean;
}

/**
 * Result of syncing tracks to slskd wishlist
 */
export interface SlskdSyncResult {
  totalTracks: number;
  addedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: SlskdSyncError[];
}

/**
 * Individual sync error
 */
export interface SlskdSyncError {
  track: string;
  error: string;
}

/**
 * Track to be synced to slskd
 */
export interface SlskdTrackToSync {
  id: string;
  title: string;
  artist: string;
  primary_artist?: string;
}
