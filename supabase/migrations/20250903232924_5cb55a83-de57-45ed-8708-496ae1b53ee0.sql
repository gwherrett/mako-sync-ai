-- Add user_id column to local_mp3s table
ALTER TABLE public.local_mp3s 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to have a user_id (this will need manual assignment or deletion if there are existing records)
-- For now, we'll leave existing records as is - they'll be filtered out by the new policies

-- Drop existing overly permissive policies
DROP POLICY "Enable insert for authenticated users only" ON public.local_mp3s;
DROP POLICY "Enable read access for all users" ON public.local_mp3s;
DROP POLICY "Users can delete local MP3s" ON public.local_mp3s;
DROP POLICY "Users can update local MP3s" ON public.local_mp3s;

-- Create secure user-scoped policies
CREATE POLICY "Users can view their own MP3s" 
ON public.local_mp3s 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MP3s" 
ON public.local_mp3s 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MP3s" 
ON public.local_mp3s 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MP3s" 
ON public.local_mp3s 
FOR DELETE 
USING (auth.uid() = user_id);