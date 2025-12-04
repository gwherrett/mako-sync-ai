import { supabase } from '@/integrations/supabase/client';

interface LocalTrack {
  id: string;
  title: string | null;
  artist: string | null;
  primary_artist: string | null;
  album: string | null;
  genre: string | null;
  file_path: string;
}

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  primary_artist: string | null;
  album: string | null;
  genre: string | null;
  super_genre: string | null;
}

interface MissingTrack {
  spotifyTrack: SpotifyTrack;
  reason: string;
}

export class TrackMatchingService {
  // Normalize strings for comparison with enhanced artist handling
  private static normalize(str: string | null): string {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Simplified artist normalization - just basic cleanup since primary_artist is pre-normalized
  private static normalizeArtist(artist: string | null): string {
    if (!artist) return '';
    
    return artist.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Compare primary artists (already normalized in DB)
  private static compareArtists(localPrimaryArtist: string | null, spotifyPrimaryArtist: string | null): {
    exactMatch: boolean;
    similarity: number;
    normalizedLocal: string;
    normalizedSpotify: string;
  } {
    const normalizedLocal = this.normalizeArtist(localPrimaryArtist);
    const normalizedSpotify = this.normalizeArtist(spotifyPrimaryArtist);
    
    // Check for exact match first
    if (normalizedLocal === normalizedSpotify) {
      return {
        exactMatch: true,
        similarity: 100,
        normalizedLocal,
        normalizedSpotify
      };
    }

    // Calculate similarity for partial matches
    const similarity = normalizedLocal && normalizedSpotify 
      ? this.calculateSimilarity(normalizedLocal, normalizedSpotify)
      : 0;

    return {
      exactMatch: false,
      similarity,
      normalizedLocal,
      normalizedSpotify
    };
  }

  // Calculate Levenshtein distance
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len2][len1];
  }

  // Calculate similarity percentage
  private static calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100;
  }

  // Fetch local tracks for user
  static async fetchLocalTracks(userId: string): Promise<LocalTrack[]> {
    const { data, error } = await supabase
      .from('local_mp3s')
      .select('id, title, artist, primary_artist, album, genre, file_path')
      .eq('user_id', userId)
      .limit(50000); // Override default 1000 limit to handle large collections

    if (error) {
      throw new Error(`Failed to fetch local tracks: ${error.message}`);
    }

    console.log(`📀 Fetched ${data?.length || 0} local tracks for matching`);
    return data || [];
  }

  // Fetch Spotify tracks for user with optional genre filter
  static async fetchSpotifyTracks(userId: string, superGenreFilter?: string): Promise<SpotifyTrack[]> {
    let query = supabase
      .from('spotify_liked')
      .select('id, title, artist, primary_artist, album, genre, super_genre')
      .eq('user_id', userId)
      .limit(50000); // Override default 1000 limit to handle large collections

    if (superGenreFilter && superGenreFilter !== 'all') {
      query = query.eq('super_genre', superGenreFilter as any);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch Spotify tracks: ${error.message}`);
    }

    const genreText = superGenreFilter && superGenreFilter !== 'all' ? ` (${superGenreFilter} genre)` : '';
    console.log(`🎵 Fetched ${data?.length || 0} Spotify tracks for matching${genreText}`);
    return data || [];
  }

  // Find missing tracks (Spotify tracks not in local collection)
  static async findMissingTracks(userId: string, superGenreFilter?: string): Promise<MissingTrack[]> {
    const [localTracks, spotifyTracks] = await Promise.all([
      this.fetchLocalTracks(userId),
      this.fetchSpotifyTracks(userId, superGenreFilter)
    ]);

    const missingTracks: MissingTrack[] = [];
    
    // Create a set of normalized local track titles + artists for fast lookup
    const localTracksSet = new Set(
      localTracks.map(track => 
        `${this.normalize(track.title)}_${this.normalizeArtist(track.primary_artist)}`
      )
    );

    for (const spotifyTrack of spotifyTracks) {
      const spotifyKey = `${this.normalize(spotifyTrack.title)}_${this.normalizeArtist(spotifyTrack.primary_artist)}`;
      
      if (!localTracksSet.has(spotifyKey)) {
        missingTracks.push({
          spotifyTrack,
          reason: 'No matching local track found'
        });
      }
    }

    return missingTracks;
  }

  // Fetch available super genres for filtering
  static async fetchSuperGenres(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('spotify_liked')
      .select('super_genre')
      .eq('user_id', userId)
      .not('super_genre', 'is', null)
      .limit(50000); // Override default 1000 limit

    if (error) {
      throw new Error(`Failed to fetch super genres: ${error.message}`);
    }

    const uniqueGenres = [...new Set(data?.map(item => item.super_genre).filter(Boolean) || [])];
    return uniqueGenres.sort();
  }
}
