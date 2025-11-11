-- Update all existing records from 'Reggae/Dancehall' to 'Reggae-Dancehall'
UPDATE spotify_liked 
SET super_genre = 'Reggae-Dancehall'::super_genre
WHERE super_genre::text = 'Reggae/Dancehall';

UPDATE spotify_genre_map_base 
SET super_genre = 'Reggae-Dancehall'::super_genre
WHERE super_genre::text = 'Reggae/Dancehall';

UPDATE spotify_genre_map_overrides 
SET super_genre = 'Reggae-Dancehall'::super_genre
WHERE super_genre::text = 'Reggae/Dancehall';