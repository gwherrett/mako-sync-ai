import { supabase } from '@/integrations/supabase/client';
import type { SuperGenre } from '@/types/genreMapping';

export interface AiGenreSuggestion {
  suggestedGenre: SuperGenre;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface TrackInfo {
  title: string;
  artist: string;
  album?: string;
  mix?: string;
  spotifyGenre?: string;
}

interface LibraryContext {
  artistPatterns?: Array<{ track: string; genre: string; super_genre: string }>;
  genrePatterns?: Record<string, string>;
  similarTracks?: Array<{ title: string; artist: string; genre: string; super_genre: string }>;
}

export class AiGenreSuggestService {
  /**
   * Build library context from user's existing tracks
   */
  private static async buildLibraryContext(trackInfo: TrackInfo): Promise<LibraryContext> {
    const context: LibraryContext = {};

    try {
      // Get tracks by the same artist
      const { data: artistTracks } = await supabase
        .from('spotify_liked')
        .select('title, genre, super_genre')
        .ilike('artist', `%${trackInfo.artist}%`)
        .not('genre', 'is', null)
        .not('super_genre', 'is', null)
        .limit(10);

      if (artistTracks && artistTracks.length > 0) {
        context.artistPatterns = artistTracks.map(t => ({
          track: t.title,
          genre: t.genre!,
          super_genre: t.super_genre!
        }));
      }

      // Get common genre patterns from user's library
      const { data: allTracks } = await supabase
        .from('spotify_liked')
        .select('genre, super_genre')
        .not('genre', 'is', null)
        .not('super_genre', 'is', null);

      if (allTracks && allTracks.length > 0) {
        const genreMap = new Map<string, Map<string, number>>();
        
        allTracks.forEach(track => {
          if (!genreMap.has(track.genre!)) {
            genreMap.set(track.genre!, new Map());
          }
          const superGenreMap = genreMap.get(track.genre!)!;
          superGenreMap.set(track.super_genre!, (superGenreMap.get(track.super_genre!) || 0) + 1);
        });

        // Get most common super_genre for each spotify genre
        const genrePatterns: Record<string, string> = {};
        genreMap.forEach((superGenreMap, spotifyGenre) => {
          let maxCount = 0;
          let mostCommon = '';
          superGenreMap.forEach((count, superGenre) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommon = superGenre;
            }
          });
          genrePatterns[spotifyGenre] = mostCommon;
        });
        
        context.genrePatterns = genrePatterns;
      }

      // Find similar tracks (same words in title, similar album)
      if (trackInfo.album) {
        const { data: similarTracks } = await supabase
          .from('spotify_liked')
          .select('title, artist, genre, super_genre')
          .ilike('album', `%${trackInfo.album}%`)
          .not('genre', 'is', null)
          .not('super_genre', 'is', null)
          .limit(5);

        if (similarTracks && similarTracks.length > 0) {
          context.similarTracks = similarTracks.map(t => ({
            title: t.title,
            artist: t.artist,
            genre: t.genre!,
            super_genre: t.super_genre!
          }));
        }
      }
    } catch (error) {
      console.error('Error building library context:', error);
      // Continue without context rather than failing
    }

    return context;
  }

  /**
   * Get AI-powered genre suggestion for a track
   */
  static async suggestGenre(trackInfo: TrackInfo, useLibraryContext = true): Promise<AiGenreSuggestion> {
    try {
      let libraryContext: LibraryContext | undefined;
      
      if (useLibraryContext) {
        libraryContext = await this.buildLibraryContext(trackInfo);
        console.log('Built library context:', libraryContext);
      }

      const { data, error } = await supabase.functions.invoke('ai-genre-suggest', {
        body: {
          ...trackInfo,
          libraryContext
        }
      });

      if (error) {
        console.error('Error calling ai-genre-suggest:', error);
        throw new Error(error.message || 'Failed to get AI suggestion');
      }

      return data as AiGenreSuggestion;
    } catch (error) {
      console.error('Error in suggestGenre:', error);
      throw error;
    }
  }

  /**
   * Get bulk suggestions for multiple tracks
   */
  static async suggestGenreBulk(tracks: TrackInfo[], useLibraryContext = true): Promise<Map<string, AiGenreSuggestion>> {
    const results = new Map<string, AiGenreSuggestion>();
    
    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      
      const promises = batch.map(async (track) => {
        try {
          const suggestion = await this.suggestGenre(track, useLibraryContext);
          const key = `${track.title}-${track.artist}`;
          results.set(key, suggestion);
        } catch (error) {
          console.error(`Failed to get suggestion for ${track.title}:`, error);
          // Store error as low confidence "Other"
          const key = `${track.title}-${track.artist}`;
          results.set(key, {
            suggestedGenre: 'Other',
            confidence: 'low',
            reasoning: 'Failed to get AI suggestion'
          });
        }
      });

      await Promise.all(promises);
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
