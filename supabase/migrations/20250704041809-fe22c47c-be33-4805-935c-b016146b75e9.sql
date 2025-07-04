-- Remove genre column from spotify_liked table
ALTER TABLE public.spotify_liked DROP COLUMN IF EXISTS genre;