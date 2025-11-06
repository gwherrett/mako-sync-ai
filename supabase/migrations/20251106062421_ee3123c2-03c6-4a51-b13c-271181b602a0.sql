-- Enable realtime for local_mp3s table
ALTER TABLE public.local_mp3s REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.local_mp3s;