-- Update existing 'Garage' super_genre values to 'UK Garage' to match the updated type definition
UPDATE spotify_liked 
SET super_genre = 'UK Garage' 
WHERE super_genre = 'Garage';

-- Also update any existing overrides that might have 'Garage'
UPDATE spotify_genre_map_overrides 
SET super_genre = 'UK Garage' 
WHERE super_genre = 'Garage';

-- Update base mappings if any exist
UPDATE spotify_genre_map_base 
SET super_genre = 'UK Garage' 
WHERE super_genre = 'Garage';