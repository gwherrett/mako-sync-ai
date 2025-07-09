-- Add bitrate field to local_mp3s table
ALTER TABLE public.local_mp3s 
ADD COLUMN bitrate INTEGER;