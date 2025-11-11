-- Update all existing records from 'Soul-Jazz-Funk' to 'Soul-Funk'
UPDATE spotify_liked 
SET super_genre = 'Soul-Funk'::super_genre
WHERE super_genre::text = 'Soul-Jazz-Funk';

UPDATE spotify_genre_map_base 
SET super_genre = 'Soul-Funk'::super_genre
WHERE super_genre::text = 'Soul-Jazz-Funk';

UPDATE spotify_genre_map_overrides 
SET super_genre = 'Soul-Funk'::super_genre
WHERE super_genre::text = 'Soul-Jazz-Funk';