-- Add cached_genres column to sync_progress table to persist manual genre assignments
-- This allows resuming syncs without losing cached genre data
ALTER TABLE sync_progress ADD COLUMN IF NOT EXISTS cached_genres JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sync_progress.cached_genres IS 'Cached manual genre assignments (spotify_id -> super_genre) to restore after full sync deletion';