-- Phase 1: Drop the view that depends on super_genre columns
DROP VIEW IF EXISTS v_effective_spotify_genre_map;

-- Phase 2: Create new enum with 26 super genres (Classical/Orchestral merged)
CREATE TYPE super_genre_new AS ENUM (
  'Bass', 'Blues', 'Books & Spoken', 'Classical', 'Comedy', 'Country', 
  'Dance', 'Disco', 'Drum & Bass', 'Electronic', 'Folk', 'Hip Hop', 
  'House', 'Indie-Alternative', 'Jazz', 'Latin', 'Metal', 
  'Other', 'Pop', 'Reggae/Dancehall', 'Rock', 'Seasonal', 
  'Soul-Jazz-Funk', 'UK Garage', 'Urban', 'World'
);

-- Phase 3: Migrate spotify_genre_map_base with Country/Folk split
ALTER TABLE spotify_genre_map_base ADD COLUMN super_genre_new super_genre_new;

UPDATE spotify_genre_map_base SET super_genre_new = 
  CASE 
    WHEN super_genre = 'Country/Folk' AND spotify_genre IN 
      ('country', 'classic country', 'alt country', 'christian country', 
       'outlaw country', 'honky tonk', 'cajun', 'country rock') 
      THEN 'Country'::super_genre_new
    WHEN super_genre = 'Country/Folk' AND spotify_genre IN
      ('folk', 'anti-folk', 'indie folk', 'bluegrass', 'sea shanties', 
       'folk punk', 'folk rock')
      THEN 'Folk'::super_genre_new
    ELSE super_genre::text::super_genre_new
  END;

ALTER TABLE spotify_genre_map_base DROP COLUMN super_genre;
ALTER TABLE spotify_genre_map_base RENAME COLUMN super_genre_new TO super_genre;

-- Phase 4: Migrate spotify_liked (126 tracks) with Country/Folk split
ALTER TABLE spotify_liked ADD COLUMN super_genre_new super_genre_new;

UPDATE spotify_liked SET super_genre_new = 
  CASE 
    WHEN super_genre = 'Country/Folk' AND genre IN 
      ('classic country', 'alt country', 'country', 'outlaw country', 
       'honky tonk', 'christian country', 'cajun')
      THEN 'Country'::super_genre_new
    WHEN super_genre = 'Country/Folk' AND genre IN
      ('folk', 'anti-folk', 'indie folk', 'bluegrass', 'sea shanties')
      THEN 'Folk'::super_genre_new
    WHEN super_genre IS NOT NULL
      THEN super_genre::text::super_genre_new
    ELSE NULL
  END;

ALTER TABLE spotify_liked DROP COLUMN super_genre;
ALTER TABLE spotify_liked RENAME COLUMN super_genre_new TO super_genre;

-- Phase 5: Handle spotify_genre_map_overrides - clear all entries as requested
DELETE FROM spotify_genre_map_overrides;

ALTER TABLE spotify_genre_map_overrides ALTER COLUMN super_genre DROP NOT NULL;
ALTER TABLE spotify_genre_map_overrides ADD COLUMN super_genre_new super_genre_new;

ALTER TABLE spotify_genre_map_overrides DROP COLUMN super_genre;
ALTER TABLE spotify_genre_map_overrides RENAME COLUMN super_genre_new TO super_genre;
ALTER TABLE spotify_genre_map_overrides ALTER COLUMN super_genre SET NOT NULL;

-- Phase 6: Drop old enum and rename new one
DROP TYPE super_genre;
ALTER TYPE super_genre_new RENAME TO super_genre;

-- Phase 7: Recreate the view with new enum
CREATE OR REPLACE VIEW v_effective_spotify_genre_map AS
SELECT 
  COALESCE(o.spotify_genre, b.spotify_genre) as spotify_genre,
  COALESCE(o.super_genre, b.super_genre) as super_genre,
  CASE WHEN o.spotify_genre IS NOT NULL THEN true ELSE false END as is_overridden
FROM spotify_genre_map_base b
FULL OUTER JOIN spotify_genre_map_overrides o 
  ON b.spotify_genre = o.spotify_genre;

-- Phase 8: Insert/Update all 51 genre mappings (orchestral → Classical)
INSERT INTO spotify_genre_map_base (spotify_genre, super_genre, updated_at) VALUES
  ('acid jazz', 'Soul-Jazz-Funk', now()),
  ('african', 'World', now()),
  ('alternative', 'Indie-Alternative', now()),
  ('ambient', 'Electronic', now()),
  ('blues', 'Blues', now()),
  ('books & spoken', 'Books & Spoken', now()),
  ('breakbeat', 'Dance', now()),
  ('broken beat', 'Soul-Jazz-Funk', now()),
  ('christmas', 'Seasonal', now()),
  ('comedy', 'Comedy', now()),
  ('country', 'Country', now()),
  ('dancehall', 'Reggae/Dancehall', now()),
  ('disco', 'Disco', now()),
  ('downtempo', 'Electronic', now()),
  ('drum & bass', 'Drum & Bass', now()),
  ('dub', 'Reggae/Dancehall', now()),
  ('dubstep', 'Bass', now()),
  ('electro', 'Dance', now()),
  ('electroclash', 'Dance', now()),
  ('electronic', 'Electronic', now()),
  ('folk', 'Folk', now()),
  ('funk', 'Soul-Jazz-Funk', now()),
  ('grime', 'Bass', now()),
  ('hip hop', 'Hip Hop', now()),
  ('house', 'House', now()),
  ('indian', 'World', now()),
  ('indie', 'Indie-Alternative', now()),
  ('indie electronic', 'Indie-Alternative', now()),
  ('indie folk', 'Indie-Alternative', now()),
  ('indie pop', 'Indie-Alternative', now()),
  ('indie rock', 'Indie-Alternative', now()),
  ('industrial', 'Indie-Alternative', now()),
  ('jazz', 'Jazz', now()),
  ('latin', 'Latin', now()),
  ('mashup', 'Dance', now()),
  ('metal', 'Metal', now()),
  ('musical', 'Pop', now()),
  ('old skool', 'Dance', now()),
  ('orchestral', 'Classical', now()),
  ('pop', 'Pop', now()),
  ('punk', 'Indie-Alternative', now()),
  ('r&b', 'Urban', now()),
  ('reggae', 'Reggae/Dancehall', now()),
  ('rock', 'Rock', now()),
  ('soul', 'Soul-Jazz-Funk', now()),
  ('soundtrack', 'Pop', now()),
  ('techno', 'Dance', now()),
  ('trance', 'Dance', now()),
  ('uk funky', 'Bass', now()),
  ('uk garage', 'UK Garage', now())
ON CONFLICT (spotify_genre) 
DO UPDATE SET 
  super_genre = EXCLUDED.super_genre,
  updated_at = EXCLUDED.updated_at;