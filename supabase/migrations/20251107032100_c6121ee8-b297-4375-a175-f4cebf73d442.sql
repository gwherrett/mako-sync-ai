-- Enable realtime for sync_progress table
ALTER TABLE public.sync_progress REPLICA IDENTITY FULL;

-- Add sync_progress to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_progress;