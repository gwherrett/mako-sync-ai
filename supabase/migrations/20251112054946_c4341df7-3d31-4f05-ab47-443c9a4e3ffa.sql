-- Create helper functions to get distinct filter values efficiently
CREATE OR REPLACE FUNCTION get_distinct_local_genres(user_uuid uuid)
RETURNS TABLE (genre text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT local_mp3s.genre
  FROM local_mp3s
  WHERE local_mp3s.user_id = user_uuid
    AND local_mp3s.genre IS NOT NULL
  ORDER BY local_mp3s.genre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_distinct_local_artists(user_uuid uuid)
RETURNS TABLE (artist text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT local_mp3s.artist
  FROM local_mp3s
  WHERE local_mp3s.user_id = user_uuid
    AND local_mp3s.artist IS NOT NULL
  ORDER BY local_mp3s.artist;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_distinct_local_albums(user_uuid uuid)
RETURNS TABLE (album text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT local_mp3s.album
  FROM local_mp3s
  WHERE local_mp3s.user_id = user_uuid
    AND local_mp3s.album IS NOT NULL
  ORDER BY local_mp3s.album;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;