-- Add genre column to spotify_liked table
ALTER TABLE public.spotify_liked 
ADD COLUMN genre TEXT;

-- Create artist_genres cache table
CREATE TABLE public.artist_genres (
  spotify_artist_id TEXT PRIMARY KEY,
  genres JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on artist_genres table
ALTER TABLE public.artist_genres ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for artist_genres table
CREATE POLICY "Users can view artist genres" 
ON public.artist_genres 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert artist genres" 
ON public.artist_genres 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update artist genres" 
ON public.artist_genres 
FOR UPDATE 
USING (true);

-- Create index for better performance on cached_at
CREATE INDEX idx_artist_genres_cached_at ON public.artist_genres(cached_at);