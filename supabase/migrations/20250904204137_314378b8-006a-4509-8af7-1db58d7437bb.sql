-- Fix Security Definer View issue
-- The view v_effective_spotify_genre_map was likely created with SECURITY DEFINER
-- We need to recreate it as a regular view since RLS on underlying tables will handle security

-- Drop the existing view
DROP VIEW IF EXISTS public.v_effective_spotify_genre_map;

-- Recreate the view without SECURITY DEFINER
-- This view combines base genre mappings with user-specific overrides
CREATE VIEW public.v_effective_spotify_genre_map AS
SELECT 
  COALESCE(o.spotify_genre, b.spotify_genre) AS spotify_genre,
  COALESCE(o.super_genre, b.super_genre) AS super_genre,
  CASE 
    WHEN o.spotify_genre IS NOT NULL THEN true
    ELSE false
  END AS is_overridden
FROM spotify_genre_map_base b
FULL JOIN spotify_genre_map_overrides o 
  ON b.spotify_genre = o.spotify_genre 
  AND o.user_id = auth.uid();

-- Enable RLS on the view (this will inherit from underlying tables)
ALTER VIEW public.v_effective_spotify_genre_map SET (security_invoker = true);

COMMENT ON VIEW public.v_effective_spotify_genre_map IS 'Effective genre mapping combining base mappings with user overrides. Uses security invoker to respect caller permissions.';