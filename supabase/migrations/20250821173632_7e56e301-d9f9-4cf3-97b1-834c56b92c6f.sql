-- Update existing 'Garage' super_genre values to 'UK Garage'
UPDATE spotify_liked 
SET super_genre = 'UK Garage' 
WHERE super_genre = 'Garage';

-- Update any existing overrides that might have 'Garage'
UPDATE spotify_genre_map_overrides 
SET super_genre = 'UK Garage' 
WHERE super_genre = 'Garage';

-- Update base mappings if any exist
UPDATE spotify_genre_map_base 
SET super_genre = 'UK Garage' 
WHERE super_genre = 'Garage';