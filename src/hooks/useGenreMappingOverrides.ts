import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GenreOverride {
  spotify_genre: string;
  super_genre: string;
}

/**
 * Hook to get user's genre mapping overrides
 */
export const useGenreMappingOverrides = () => {
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from('spotify_genre_map_overrides')
        .select('spotify_genre, super_genre');

      if (error) {
        console.error('Error fetching overrides:', error);
        return;
      }

      const overrideMap = new Map<string, string>();
      data?.forEach((override: GenreOverride) => {
        overrideMap.set(override.spotify_genre, override.super_genre);
      });

      setOverrides(overrideMap);
    } catch (error) {
      console.error('Error fetching overrides:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, []);

  const hasOverride = (spotifyGenre: string): boolean => {
    return overrides.has(spotifyGenre);
  };

  return {
    overrides,
    loading,
    hasOverride,
    refetch: fetchOverrides
  };
};