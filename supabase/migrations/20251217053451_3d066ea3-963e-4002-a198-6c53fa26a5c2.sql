-- Fix Spotify connection constraint to allow the same Spotify account to be connected by multiple app users (e.g., test accounts)
-- and to support upserting per user.

DO $$
BEGIN
  -- Remove uniqueness on spotify_user_id (blocks using the same Spotify account across multiple app users)
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'spotify_connections_spotify_user_id_key'
  ) THEN
    ALTER TABLE public.spotify_connections
      DROP CONSTRAINT spotify_connections_spotify_user_id_key;
  END IF;

  -- Ensure we only have one connection row per app user
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'spotify_connections_user_id_key'
  ) THEN
    ALTER TABLE public.spotify_connections
      ADD CONSTRAINT spotify_connections_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Helpful index for lookups by spotify_user_id (non-unique)
CREATE INDEX IF NOT EXISTS idx_spotify_connections_spotify_user_id
  ON public.spotify_connections (spotify_user_id);
