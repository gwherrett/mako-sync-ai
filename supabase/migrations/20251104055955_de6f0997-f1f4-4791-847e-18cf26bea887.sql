-- Remove version_info column from both tables since we're consolidating into mix field
ALTER TABLE local_mp3s DROP COLUMN IF EXISTS version_info;
ALTER TABLE spotify_liked DROP COLUMN IF EXISTS version_info;