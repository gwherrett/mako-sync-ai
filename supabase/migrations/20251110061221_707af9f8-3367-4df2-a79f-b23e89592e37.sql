-- Drop the view first
DROP VIEW IF EXISTS v_effective_spotify_genre_map;

-- Create new enum with Orchestral instead of Classical
CREATE TYPE super_genre_new AS ENUM (
  'Bass', 'Blues', 'Books & Spoken', 'Comedy', 'Country', 
  'Dance', 'Disco', 'Drum & Bass', 'Electronic', 'Folk', 'Hip Hop', 
  'House', 'Indie-Alternative', 'Jazz', 'Latin', 'Metal', 
  'Orchestral', 'Other', 'Pop', 'Reggae/Dancehall', 'Rock', 'Seasonal', 
  'Soul-Jazz-Funk', 'UK Garage', 'Urban', 'World'
);

-- Migrate spotify_genre_map_base
ALTER TABLE spotify_genre_map_base ADD COLUMN super_genre_new super_genre_new;
UPDATE spotify_genre_map_base SET super_genre_new = 
  CASE 
    WHEN super_genre = 'Classical' THEN 'Orchestral'::super_genre_new
    ELSE super_genre::text::super_genre_new
  END;
ALTER TABLE spotify_genre_map_base DROP COLUMN super_genre;
ALTER TABLE spotify_genre_map_base RENAME COLUMN super_genre_new TO super_genre;

-- Migrate spotify_liked
ALTER TABLE spotify_liked ADD COLUMN super_genre_new super_genre_new;
UPDATE spotify_liked SET super_genre_new = 
  CASE 
    WHEN super_genre = 'Classical' THEN 'Orchestral'::super_genre_new
    WHEN super_genre IS NOT NULL THEN super_genre::text::super_genre_new
    ELSE NULL
  END;
ALTER TABLE spotify_liked DROP COLUMN super_genre;
ALTER TABLE spotify_liked RENAME COLUMN super_genre_new TO super_genre;

-- Migrate spotify_genre_map_overrides (if any entries exist)
ALTER TABLE spotify_genre_map_overrides ALTER COLUMN super_genre DROP NOT NULL;
ALTER TABLE spotify_genre_map_overrides ADD COLUMN super_genre_new super_genre_new;
UPDATE spotify_genre_map_overrides SET super_genre_new = 
  CASE 
    WHEN super_genre = 'Classical' THEN 'Orchestral'::super_genre_new
    ELSE super_genre::text::super_genre_new
  END;
ALTER TABLE spotify_genre_map_overrides DROP COLUMN super_genre;
ALTER TABLE spotify_genre_map_overrides RENAME COLUMN super_genre_new TO super_genre;
ALTER TABLE spotify_genre_map_overrides ALTER COLUMN super_genre SET NOT NULL;

-- Drop old enum and rename new one
DROP TYPE super_genre;
ALTER TYPE super_genre_new RENAME TO super_genre;

-- Recreate the view
CREATE OR REPLACE VIEW v_effective_spotify_genre_map AS
SELECT 
  COALESCE(o.spotify_genre, b.spotify_genre) as spotify_genre,
  COALESCE(o.super_genre, b.super_genre) as super_genre,
  CASE WHEN o.spotify_genre IS NOT NULL THEN true ELSE false END as is_overridden
FROM spotify_genre_map_base b
FULL OUTER JOIN spotify_genre_map_overrides o 
  ON b.spotify_genre = o.spotify_genre;