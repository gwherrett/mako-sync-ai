-- Add RLS policies for metadata_sync_log table
-- This table tracks metadata sync operations on MP3s, should be user-scoped via mp3_id
CREATE POLICY "Users can view their own sync logs" 
ON public.metadata_sync_log 
FOR SELECT 
USING (
  mp3_id IN (
    SELECT id FROM public.local_mp3s WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert sync logs" 
ON public.metadata_sync_log 
FOR INSERT 
WITH CHECK (true); -- Allow system to insert logs

CREATE POLICY "System can update sync logs" 
ON public.metadata_sync_log 
FOR UPDATE 
USING (true); -- Allow system to update logs

-- Add RLS policies for track_matches table  
-- This table matches Spotify tracks to local MP3s, should be user-scoped
CREATE POLICY "Users can view their own track matches" 
ON public.track_matches 
FOR SELECT 
USING (
  spotify_track_id IN (
    SELECT id FROM public.spotify_liked WHERE user_id = auth.uid()
  )
  OR mp3_id IN (
    SELECT id FROM public.local_mp3s WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own track matches" 
ON public.track_matches 
FOR INSERT 
WITH CHECK (
  spotify_track_id IN (
    SELECT id FROM public.spotify_liked WHERE user_id = auth.uid()
  )
  AND mp3_id IN (
    SELECT id FROM public.local_mp3s WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own track matches" 
ON public.track_matches 
FOR UPDATE 
USING (
  spotify_track_id IN (
    SELECT id FROM public.spotify_liked WHERE user_id = auth.uid()
  )
  OR mp3_id IN (
    SELECT id FROM public.local_mp3s WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own track matches" 
ON public.track_matches 
FOR DELETE 
USING (
  spotify_track_id IN (
    SELECT id FROM public.spotify_liked WHERE user_id = auth.uid()
  )
  OR mp3_id IN (
    SELECT id FROM public.local_mp3s WHERE user_id = auth.uid()
  )
);

-- Fix function search paths for security definer functions
ALTER FUNCTION public.get_user_role(_user_id uuid) SET search_path = public;
ALTER FUNCTION public.has_role(_user_id uuid, _role app_role) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;