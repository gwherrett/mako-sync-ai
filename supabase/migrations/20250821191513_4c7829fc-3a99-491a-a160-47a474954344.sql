-- Drop the view that's preventing enum changes
DROP VIEW IF EXISTS public.v_effective_spotify_genre_map;

-- 1) Create a new enum that replaces 'Soul/R&B' with 'Urban' 
DO $$
BEGIN
  -- Create the new enum with the current values, swapping 'Soul/R&B' -> 'Urban'
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'super_genre_new' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.super_genre_new AS ENUM (
      'House',
      'Drum & Bass',
      'UK Garage',
      'Hip Hop',
      'Urban',             -- Renamed from 'Soul/R&B'
      'Pop',
      'Rock',
      'Jazz',
      'Blues',
      'Country/Folk',
      'Electronic',
      'Classical',
      'Latin',
      'Reggae/Dancehall',
      'World',
      'Disco',
      'Metal',
      'Other'
    );
  END IF;
END$$;

-- 2) Migrate columns to the new enum, mapping value 'Soul/R&B' -> 'Urban' and preserving NULLs

-- spotify_genre_map_base.super_genre
ALTER TABLE public.spotify_genre_map_base
  ALTER COLUMN super_genre TYPE public.super_genre_new
  USING (
    CASE
      WHEN super_genre::text = 'Soul/R&B' THEN 'Urban'
      ELSE super_genre::text
    END
  )::public.super_genre_new;

-- spotify_genre_map_overrides.super_genre
ALTER TABLE public.spotify_genre_map_overrides
  ALTER COLUMN super_genre TYPE public.super_genre_new
  USING (
    CASE
      WHEN super_genre::text = 'Soul/R&B' THEN 'Urban'
      ELSE super_genre::text
    END
  )::public.super_genre_new;

-- spotify_liked.super_genre
ALTER TABLE public.spotify_liked
  ALTER COLUMN super_genre TYPE public.super_genre_new
  USING (
    CASE
      WHEN super_genre::text = 'Soul/R&B' THEN 'Urban'
      ELSE super_genre::text
    END
  )::public.super_genre_new;

-- 3) Drop old enum and rename the new one
DROP TYPE public.super_genre;
ALTER TYPE public.super_genre_new RENAME TO super_genre;

-- 4) Recreate the view with the new enum
CREATE OR REPLACE VIEW public.v_effective_spotify_genre_map AS
SELECT 
  COALESCE(o.spotify_genre, b.spotify_genre) as spotify_genre,
  COALESCE(o.super_genre, b.super_genre) as super_genre,
  (o.spotify_genre IS NOT NULL) as is_overridden
FROM public.spotify_genre_map_base b
FULL OUTER JOIN public.spotify_genre_map_overrides o ON b.spotify_genre = o.spotify_genre;

-- 5) Upsert Urban base mappings for R&B / Soul / Funk clusters
INSERT INTO public.spotify_genre_map_base (spotify_genre, super_genre)
VALUES
  ('r&b', 'Urban'),
  ('uk r&b', 'Urban'),
  ('alternative r&b', 'Urban'),
  ('soul', 'Urban'),
  ('neo soul', 'Urban'),
  ('classic soul', 'Urban'),
  ('retro soul', 'Urban'),
  ('northern soul', 'Urban'),
  ('philly soul', 'Urban'),
  ('motown', 'Urban'),
  ('quiet storm', 'Urban'),
  ('new jack swing', 'Urban'),
  ('indie soul', 'Urban'),
  ('afro soul', 'Urban'),
  ('funk', 'Urban'),
  ('funk rock', 'Urban')
ON CONFLICT (spotify_genre)
DO UPDATE SET super_genre = EXCLUDED.super_genre;