-- Add super_genre column to spotify_liked table
ALTER TABLE public.spotify_liked 
ADD COLUMN super_genre super_genre_enum;

-- Create an index for better performance on super_genre filtering
CREATE INDEX idx_spotify_liked_super_genre ON public.spotify_liked(super_genre);

-- Update existing records to populate super_genre based on current genre mappings
UPDATE public.spotify_liked 
SET super_genre = (
  SELECT COALESCE(overrides.super_genre, base.super_genre)
  FROM public.spotify_genre_map_base base
  LEFT JOIN public.spotify_genre_map_overrides overrides 
    ON base.spotify_genre = overrides.spotify_genre 
    AND overrides.user_id = spotify_liked.user_id
  WHERE base.spotify_genre = spotify_liked.genre
  LIMIT 1
);