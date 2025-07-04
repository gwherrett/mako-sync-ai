-- Add danceability column to spotify_liked table
ALTER TABLE public.spotify_liked ADD COLUMN IF NOT EXISTS danceability numeric;