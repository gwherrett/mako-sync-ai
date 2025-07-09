-- Add file_size column to local_mp3s table
ALTER TABLE public.local_mp3s 
ADD COLUMN file_size bigint;

-- Update RLS policies for local_mp3s to allow bulk editing
CREATE POLICY "Users can update local MP3s" 
ON public.local_mp3s 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete local MP3s" 
ON public.local_mp3s 
FOR DELETE 
USING (true);

-- Add index for better performance on common queries
CREATE INDEX idx_local_mp3s_file_path ON public.local_mp3s(file_path);
CREATE INDEX idx_local_mp3s_artist ON public.local_mp3s(artist);
CREATE INDEX idx_local_mp3s_album ON public.local_mp3s(album);
CREATE INDEX idx_local_mp3s_year ON public.local_mp3s(year);