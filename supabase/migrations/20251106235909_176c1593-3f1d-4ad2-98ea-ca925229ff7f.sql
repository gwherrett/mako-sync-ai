-- Add unique constraint to prevent duplicate Spotify tracks per user
-- This ensures we can use upsert to handle sync interruptions gracefully

-- First, remove any existing duplicates if they exist
DELETE FROM spotify_liked a
USING spotify_liked b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.spotify_id = b.spotify_id;

-- Add the unique constraint
ALTER TABLE spotify_liked 
ADD CONSTRAINT spotify_liked_user_spotify_unique 
UNIQUE (user_id, spotify_id);