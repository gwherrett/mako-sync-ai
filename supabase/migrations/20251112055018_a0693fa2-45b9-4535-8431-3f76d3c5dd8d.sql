-- Fix security warnings by setting search_path on the new functions
DROP FUNCTION IF EXISTS get_distinct_local_genres(uuid);
DROP FUNCTION IF EXISTS get_distinct_local_artists(uuid);
DROP FUNCTION IF EXISTS get_distinct_local_albums(uuid);

CREATE OR REPLACE FUNCTION get_distinct_local_genres(user_uuid uuid)
RETURNS TABLE (genre text) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT local_mp3s.genre
  FROM local_mp3s
  WHERE local_mp3s.user_id = user_uuid
    AND local_mp3s.genre IS NOT NULL
  ORDER BY local_mp3s.genre;
END;
$$;

CREATE OR REPLACE FUNCTION get_distinct_local_artists(user_uuid uuid)
RETURNS TABLE (artist text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT local_mp3s.artist
  FROM local_mp3s
  WHERE local_mp3s.user_id = user_uuid
    AND local_mp3s.artist IS NOT NULL
  ORDER BY local_mp3s.artist;
END;
$$;

CREATE OR REPLACE FUNCTION get_distinct_local_albums(user_uuid uuid)
RETURNS TABLE (album text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT local_mp3s.album
  FROM local_mp3s
  WHERE local_mp3s.user_id = user_uuid
    AND local_mp3s.album IS NOT NULL
  ORDER BY local_mp3s.album;
END;
$$;