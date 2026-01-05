-- Drop the incorrect unique constraint on spotify_id alone
-- This allows multiple users to have the same track in their liked songs
ALTER TABLE public.spotify_liked DROP CONSTRAINT spotify_liked_songs_spotify_id_key;