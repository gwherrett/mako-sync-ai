-- Fix the security definer view issue by recreating the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_effective_spotify_genre_map;

-- Create the view without SECURITY DEFINER (it will use the default SECURITY INVOKER)
CREATE VIEW public.v_effective_spotify_genre_map AS
SELECT 
    COALESCE(o.spotify_genre, b.spotify_genre) AS spotify_genre,
    COALESCE(o.super_genre, b.super_genre) AS super_genre,
    CASE WHEN o.spotify_genre IS NOT NULL THEN true ELSE false END AS is_overridden
FROM public.spotify_genre_map_base b
FULL OUTER JOIN public.spotify_genre_map_overrides o 
    ON b.spotify_genre = o.spotify_genre 
    AND o.user_id = auth.uid();

-- Add RLS policy for the view (views inherit RLS from underlying tables)
-- No explicit RLS needed as the view filters by auth.uid() automatically