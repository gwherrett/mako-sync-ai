-- Create sync_progress table to track incremental sync state
CREATE TABLE IF NOT EXISTS public.sync_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sync_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  tracks_fetched integer NOT NULL DEFAULT 0,
  tracks_processed integer NOT NULL DEFAULT 0,
  artists_processed integer NOT NULL DEFAULT 0,
  total_tracks integer,
  last_offset integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, sync_id)
);

-- Enable RLS
ALTER TABLE public.sync_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sync progress"
  ON public.sync_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync progress"
  ON public.sync_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync progress"
  ON public.sync_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync progress"
  ON public.sync_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_sync_progress_user_status ON public.sync_progress(user_id, status);

-- Add trigger for updated_at
CREATE TRIGGER update_sync_progress_updated_at
  BEFORE UPDATE ON public.sync_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();