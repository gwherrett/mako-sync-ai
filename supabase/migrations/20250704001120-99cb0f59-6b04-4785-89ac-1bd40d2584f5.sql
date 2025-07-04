-- Add RLS policies for spotify_liked table so users can insert and read their liked songs

-- Add user_id column to spotify_liked table to track ownership
ALTER TABLE public.spotify_liked 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.spotify_liked ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own liked songs" 
ON public.spotify_liked 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own liked songs" 
ON public.spotify_liked 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own liked songs" 
ON public.spotify_liked 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own liked songs" 
ON public.spotify_liked 
FOR DELETE 
USING (auth.uid() = user_id);