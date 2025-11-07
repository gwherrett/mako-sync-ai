-- Security Fix: Make user_id columns NOT NULL to enforce RLS policies
-- This prevents data orphans and ensures proper access control

-- Fix spotify_liked table
ALTER TABLE spotify_liked 
  ALTER COLUMN user_id SET NOT NULL;

-- Fix local_mp3s table
ALTER TABLE local_mp3s 
  ALTER COLUMN user_id SET NOT NULL;

-- Security Fix: Require vault storage for Spotify tokens
-- All connections are already migrated, so we can safely require vault references

ALTER TABLE spotify_connections
  ALTER COLUMN access_token_secret_id SET NOT NULL,
  ALTER COLUMN refresh_token_secret_id SET NOT NULL;

-- Add comment explaining the plain text columns are now deprecated
COMMENT ON COLUMN spotify_connections.access_token IS 'Deprecated: Contains migration marker only. Actual token stored in vault (access_token_secret_id).';
COMMENT ON COLUMN spotify_connections.refresh_token IS 'Deprecated: Contains migration marker only. Actual token stored in vault (refresh_token_secret_id).';