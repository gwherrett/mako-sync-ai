import { supabase } from '@/integrations/supabase/client';
import type { SuperGenre } from '@/types/genreMapping';

interface TrackWithoutGenre {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotify_id: string;
}

interface LibraryContext {
  sameArtistTracks: Array<{
    title: string;
    super_genre: SuperGenre | null;
  }>;
  libraryPatterns: string;
}

interface GenreSuggestion {
  suggestedGenre: SuperGenre;
  confidence: number;
  reasoning: string;
}

export class TrackGenreService {
  /**
   * Get all tracks that have no Spotify genre assigned
   */
  static async getTracksWithoutGenre(): Promise<TrackWithoutGenre[]> {
    const { data, error } = await supabase
      .from('spotify_liked')
      .select('id, title, artist, album, spotify_id')
      .is('genre', null)
      .order('artist', { ascending: true })
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching tracks without genre:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Build library context for a specific artist
   */
  static async buildLibraryContext(artist: string): Promise<LibraryContext> {
    // Get other tracks by the same artist
    const { data: artistTracks } = await supabase
      .from('spotify_liked')
      .select('title, super_genre')
      .eq('artist', artist)
      .not('super_genre', 'is', null);

    // Get overall library patterns
    const { data: genreStats } = await supabase
      .from('spotify_liked')
      .select('super_genre')
      .not('super_genre', 'is', null);

    let libraryPatterns = '';
    if (genreStats && genreStats.length > 0) {
      const genreCounts: Record<string, number> = {};
      genreStats.forEach(track => {
        if (track.super_genre) {
          genreCounts[track.super_genre] = (genreCounts[track.super_genre] || 0) + 1;
        }
      });
      
      const topGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([genre, count]) => `${genre} (${count})`);
      
      libraryPatterns = `User's library has ${genreStats.length} tracks with genres. Top genres: ${topGenres.join(', ')}`;
    }

    return {
      sameArtistTracks: artistTracks || [],
      libraryPatterns
    };
  }

  /**
   * Get AI suggestion for a track's genre
   */
  static async suggestGenreForTrack(
    trackId: string,
    title: string,
    artist: string,
    album?: string | null
  ): Promise<GenreSuggestion> {
    const libraryContext = await this.buildLibraryContext(artist);

    const { data, error } = await supabase.functions.invoke('ai-track-genre-suggest', {
      body: {
        title,
        artist,
        album: album || undefined,
        libraryContext
      }
    });

    if (error) {
      console.error('Error getting AI suggestion:', error);
      throw error;
    }

    return data as GenreSuggestion;
  }

  /**
   * Assign a super genre directly to a track
   */
  static async assignGenreToTrack(trackId: string, superGenre: SuperGenre): Promise<void> {
    const { error } = await supabase
      .from('spotify_liked')
      .update({ super_genre: superGenre })
      .eq('id', trackId);

    if (error) {
      console.error('Error assigning genre to track:', error);
      throw error;
    }
  }

  /**
   * Get count of tracks without genre
   */
  static async getTracksWithoutGenreCount(): Promise<number> {
    const { count, error } = await supabase
      .from('spotify_liked')
      .select('*', { count: 'exact', head: true })
      .is('genre', null);

    if (error) {
      console.error('Error counting tracks without genre:', error);
      throw error;
    }

    return count || 0;
  }
}
