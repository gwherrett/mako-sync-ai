/**
 * useGenreMap Hook
 *
 * TanStack Query hook for fetching the effective genre mapping.
 * Combines base mappings with user overrides via the v_effective_spotify_genre_map view.
 * Returns a Map for O(1) lookups during download processing.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GenreMapRow {
  spotify_genre: string;
  super_genre: string;
  is_overridden: boolean;
}

/**
 * Fetch the effective genre map from Supabase
 * This view combines spotify_genre_map_base with user's spotify_genre_map_overrides
 */
async function fetchGenreMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('v_effective_spotify_genre_map')
    .select('spotify_genre, super_genre');

  if (error) {
    console.error('Error fetching genre map:', error);
    throw new Error(`Failed to fetch genre map: ${error.message}`);
  }

  // Build Map with lowercase keys for case-insensitive matching
  const genreMap = new Map<string, string>();
  data?.forEach((row: GenreMapRow) => {
    genreMap.set(row.spotify_genre.toLowerCase().trim(), row.super_genre);
  });

  console.log(`📊 Loaded ${genreMap.size} genre mappings`);
  return genreMap;
}

/**
 * Hook to get the effective genre map for the current user.
 * Uses TanStack Query for caching and automatic refetching.
 *
 * @example
 * const { genreMap, isLoading, error, refetch } = useGenreMap();
 *
 * // Look up a genre
 * const superGenre = genreMap?.get('deep house'); // Returns 'House'
 */
export function useGenreMap() {
  const query = useQuery({
    queryKey: ['genre-map'],
    queryFn: fetchGenreMap,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: false, // Don't refetch on every tab focus
  });

  return {
    genreMap: query.data ?? new Map<string, string>(),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetched: query.isFetched,
  };
}

/**
 * Standalone function to fetch genre map (for use outside React components)
 * Useful in service layer when processing files
 */
export async function getGenreMap(): Promise<Map<string, string>> {
  return fetchGenreMap();
}
