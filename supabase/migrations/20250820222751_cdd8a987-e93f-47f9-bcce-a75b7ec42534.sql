-- Fix the security definer view issue by recreating it as a regular view
DROP VIEW public.v_effective_spotify_genre_map;

CREATE VIEW public.v_effective_spotify_genre_map AS
SELECT
  b.spotify_genre,
  COALESCE(o.super_genre, b.super_genre) AS super_genre,
  o.user_id IS NOT NULL AS is_overridden
FROM public.spotify_genre_map_base b
LEFT JOIN public.spotify_genre_map_overrides o
  ON o.spotify_genre = b.spotify_genre
  AND o.user_id = auth.uid();