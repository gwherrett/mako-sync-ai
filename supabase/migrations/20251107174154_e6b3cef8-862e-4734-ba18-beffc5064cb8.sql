-- Add last_sync_completed_at to sync_progress table to track incremental syncs
ALTER TABLE sync_progress 
ADD COLUMN last_sync_completed_at timestamp with time zone;

-- Add index for faster lookups
CREATE INDEX idx_sync_progress_user_completed 
ON sync_progress(user_id, last_sync_completed_at DESC) 
WHERE status = 'completed';

-- Add columns to track incremental sync statistics
ALTER TABLE sync_progress
ADD COLUMN new_tracks_added integer DEFAULT 0,
ADD COLUMN is_full_sync boolean DEFAULT true;