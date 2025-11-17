-- Fix Security Definer View issue by setting security_invoker = true
-- This makes the view run with the privileges of the calling user, not the owner

CREATE OR REPLACE VIEW v_effective_spotify_genre_map 
WITH (security_invoker = true)
AS
SELECT 
  COALESCE(o.spotify_genre, b.spotify_genre) AS spotify_genre,
  COALESCE(o.super_genre, b.super_genre) AS super_genre,
  CASE 
    WHEN o.spotify_genre IS NOT NULL THEN true 
    ELSE false 
  END AS is_overridden
FROM spotify_genre_map_base b
FULL JOIN spotify_genre_map_overrides o ON b.spotify_genre = o.spotify_genre;