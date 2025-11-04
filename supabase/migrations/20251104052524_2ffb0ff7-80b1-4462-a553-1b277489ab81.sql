-- Rename remixer to mix in local_mp3s table
ALTER TABLE local_mp3s 
RENAME COLUMN remixer TO mix;

-- Rename remixer to mix in spotify_liked table
ALTER TABLE spotify_liked 
RENAME COLUMN remixer TO mix;