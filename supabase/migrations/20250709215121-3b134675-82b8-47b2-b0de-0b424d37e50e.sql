-- Phase 1: Fix Duplicate File Prevention and Cleanup

-- First, let's clean up existing duplicates by keeping only the most recent version of each file
-- We'll delete duplicates based on hash, keeping the one with the latest created_at
DELETE FROM public.local_mp3s 
WHERE id NOT IN (
  SELECT DISTINCT ON (hash) id 
  FROM public.local_mp3s 
  WHERE hash IS NOT NULL
  ORDER BY hash, created_at DESC
);

-- Also clean up any records where hash is NULL (these shouldn't exist but let's be safe)
-- Keep only the most recent version based on file_path for records with NULL hash
DELETE FROM public.local_mp3s 
WHERE hash IS NULL 
AND id NOT IN (
  SELECT DISTINCT ON (file_path) id 
  FROM public.local_mp3s 
  WHERE hash IS NULL
  ORDER BY file_path, created_at DESC
);

-- Now add a unique constraint on hash to prevent future duplicates
-- This will ensure that files with the same hash cannot be inserted twice
ALTER TABLE public.local_mp3s 
ADD CONSTRAINT unique_mp3_hash 
UNIQUE (hash);

-- Add an index on hash for better performance during lookups
CREATE INDEX IF NOT EXISTS idx_local_mp3s_hash ON public.local_mp3s(hash);

-- Add an index on file_path for better performance during path-based lookups
CREATE INDEX IF NOT EXISTS idx_local_mp3s_file_path ON public.local_mp3s(file_path);