-- Create album_genres table for caching Spotify album genre data
CREATE TABLE IF NOT EXISTS public.album_genres (
  spotify_album_id text PRIMARY KEY,
  genres jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.album_genres ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read album genres
CREATE POLICY "Authenticated users can view album genres"
  ON public.album_genres
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert album genres
CREATE POLICY "Authenticated users can insert album genres"
  ON public.album_genres
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update album genres
CREATE POLICY "Authenticated users can update album genres"
  ON public.album_genres
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_album_genres_album_id ON public.album_genres(spotify_album_id);
CREATE INDEX IF NOT EXISTS idx_album_genres_cached_at ON public.album_genres(cached_at);