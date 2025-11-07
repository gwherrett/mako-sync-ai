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

export class AiGenreSuggestService {
  /**
   * Get AI-powered genre suggestion for a track
   */
  static async suggestGenre(trackInfo: TrackInfo): Promise<AiGenreSuggestion> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-genre-suggest', {
        body: trackInfo
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
  static async suggestGenreBulk(tracks: TrackInfo[]): Promise<Map<string, AiGenreSuggestion>> {
    const results = new Map<string, AiGenreSuggestion>();
    
    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      
      const promises = batch.map(async (track) => {
        try {
          const suggestion = await this.suggestGenre(track);
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
