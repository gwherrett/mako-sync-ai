-- Add normalized columns to local_mp3s table
ALTER TABLE public.local_mp3s 
ADD COLUMN IF NOT EXISTS normalized_title TEXT,
ADD COLUMN IF NOT EXISTS normalized_artist TEXT,
ADD COLUMN IF NOT EXISTS core_title TEXT,
ADD COLUMN IF NOT EXISTS version_info TEXT,
ADD COLUMN IF NOT EXISTS primary_artist TEXT,
ADD COLUMN IF NOT EXISTS featured_artists TEXT[],
ADD COLUMN IF NOT EXISTS remixer TEXT;

-- Add normalized columns to spotify_liked table
ALTER TABLE public.spotify_liked 
ADD COLUMN IF NOT EXISTS normalized_title TEXT,
ADD COLUMN IF NOT EXISTS normalized_artist TEXT,
ADD COLUMN IF NOT EXISTS core_title TEXT,
ADD COLUMN IF NOT EXISTS version_info TEXT,
ADD COLUMN IF NOT EXISTS primary_artist TEXT,
ADD COLUMN IF NOT EXISTS featured_artists TEXT[],
ADD COLUMN IF NOT EXISTS remixer TEXT;

-- Create indexes for faster normalized lookups
CREATE INDEX IF NOT EXISTS idx_local_mp3s_normalized_title ON public.local_mp3s(normalized_title);
CREATE INDEX IF NOT EXISTS idx_local_mp3s_normalized_artist ON public.local_mp3s(normalized_artist);
CREATE INDEX IF NOT EXISTS idx_local_mp3s_core_title ON public.local_mp3s(core_title);
CREATE INDEX IF NOT EXISTS idx_spotify_liked_normalized_title ON public.spotify_liked(normalized_title);
CREATE INDEX IF NOT EXISTS idx_spotify_liked_normalized_artist ON public.spotify_liked(normalized_artist);
CREATE INDEX IF NOT EXISTS idx_spotify_liked_core_title ON public.spotify_liked(core_title);

COMMENT ON COLUMN public.local_mp3s.normalized_title IS 'Fully normalized title for matching (NFKC, accent-folded, punctuation unified)';
COMMENT ON COLUMN public.local_mp3s.core_title IS 'Title without version info (Live, Remix, Remastered, etc.)';
COMMENT ON COLUMN public.local_mp3s.version_info IS 'Extracted version information (Live, Radio Edit, Original Mix, etc.)';
COMMENT ON COLUMN public.local_mp3s.primary_artist IS 'Main artist without features';
COMMENT ON COLUMN public.local_mp3s.featured_artists IS 'Array of featured artists';
COMMENT ON COLUMN public.local_mp3s.remixer IS 'Remixer name extracted from title';

COMMENT ON COLUMN public.spotify_liked.normalized_title IS 'Fully normalized title for matching (NFKC, accent-folded, punctuation unified)';
COMMENT ON COLUMN public.spotify_liked.core_title IS 'Title without version info (Live, Remix, Remastered, etc.)';
COMMENT ON COLUMN public.spotify_liked.version_info IS 'Extracted version information (Live, Radio Edit, Original Mix, etc.)';
COMMENT ON COLUMN public.spotify_liked.primary_artist IS 'Main artist without features';
COMMENT ON COLUMN public.spotify_liked.featured_artists IS 'Array of featured artists';
COMMENT ON COLUMN public.spotify_liked.remixer IS 'Remixer name extracted from title';