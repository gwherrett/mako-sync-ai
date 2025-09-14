import { supabase } from '@/integrations/supabase/client';

interface TrackMatch {
  localTrack: LocalTrack;
  spotifyTrack: SpotifyTrack;
  confidence: number;
  algorithm: 'exact' | 'close' | 'fuzzy' | 'artist-only';
}

interface LocalTrack {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  file_path: string;
}

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  super_genre: string | null;
}

interface MissingTrack {
  spotifyTrack: SpotifyTrack;
  reason: string;
}

export class TrackMatchingService {
  // Normalize strings for comparison
  private static normalize(str: string | null): string {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
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

  // Exact match algorithm
  private static exactMatch(local: LocalTrack, spotify: SpotifyTrack): number {
    const localTitle = this.normalize(local.title);
    const localArtist = this.normalize(local.artist);
    const localAlbum = this.normalize(local.album);
    
    const spotifyTitle = this.normalize(spotify.title);
    const spotifyArtist = this.normalize(spotify.artist);
    const spotifyAlbum = this.normalize(spotify.album);

    if (localTitle === spotifyTitle && localArtist === spotifyArtist && localAlbum === spotifyAlbum) {
      return 100;
    }
    return 0;
  }

  // Close match algorithm (title + artist)
  private static closeMatch(local: LocalTrack, spotify: SpotifyTrack): number {
    const localTitle = this.normalize(local.title);
    const localArtist = this.normalize(local.artist);
    
    const spotifyTitle = this.normalize(spotify.title);
    const spotifyArtist = this.normalize(spotify.artist);

    if (localTitle === spotifyTitle && localArtist === spotifyArtist) {
      return 95;
    }
    return 0;
  }

  // Fuzzy match algorithm
  private static fuzzyMatch(local: LocalTrack, spotify: SpotifyTrack): number {
    const localTitle = this.normalize(local.title);
    const localArtist = this.normalize(local.artist);
    
    const spotifyTitle = this.normalize(spotify.title);
    const spotifyArtist = this.normalize(spotify.artist);

    if (!localTitle || !localArtist || !spotifyTitle || !spotifyArtist) {
      return 0;
    }

    const titleSimilarity = this.calculateSimilarity(localTitle, spotifyTitle);
    const artistSimilarity = this.calculateSimilarity(localArtist, spotifyArtist);
    
    // Require both title and artist to have reasonable similarity
    if (titleSimilarity >= 80 && artistSimilarity >= 80) {
      return Math.min(titleSimilarity, artistSimilarity);
    }
    
    return 0;
  }

  // Artist-only match (for identification purposes)
  private static artistOnlyMatch(local: LocalTrack, spotify: SpotifyTrack): number {
    const localArtist = this.normalize(local.artist);
    const spotifyArtist = this.normalize(spotify.artist);

    if (localArtist === spotifyArtist) {
      return 50; // Low confidence, just for artist identification
    }
    return 0;
  }

  // Find best match for a local track
  static findBestMatch(localTrack: LocalTrack, spotifyTracks: SpotifyTrack[]): TrackMatch | null {
    let bestMatch: TrackMatch | null = null;

    for (const spotifyTrack of spotifyTracks) {
      // Try exact match first
      let confidence = this.exactMatch(localTrack, spotifyTrack);
      let algorithm: TrackMatch['algorithm'] = 'exact';

      // Try close match if no exact match
      if (confidence === 0) {
        confidence = this.closeMatch(localTrack, spotifyTrack);
        algorithm = 'close';
      }

      // Try fuzzy match if no close match
      if (confidence === 0) {
        confidence = this.fuzzyMatch(localTrack, spotifyTrack);
        algorithm = 'fuzzy';
      }

      // Try artist-only match for identification
      if (confidence === 0) {
        confidence = this.artistOnlyMatch(localTrack, spotifyTrack);
        algorithm = 'artist-only';
      }

      // Update best match if this is better
      if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = {
          localTrack,
          spotifyTrack,
          confidence,
          algorithm
        };
      }
    }

    return bestMatch;
  }

  // Fetch local tracks for user
  static async fetchLocalTracks(userId: string): Promise<LocalTrack[]> {
    const { data, error } = await supabase
      .from('local_mp3s')
      .select('id, title, artist, album, genre, file_path')
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
      .select('id, title, artist, album, genre, super_genre')
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

    for (const spotifyTrack of spotifyTracks) {
      // Check if this Spotify track has a high-confidence match in local tracks
      const hasMatch = localTracks.some(localTrack => {
        const matchResult = this.findBestMatch(localTrack, [spotifyTrack]);
        return matchResult && matchResult.confidence >= 80; // Only high confidence matches
      });

      if (!hasMatch) {
        missingTracks.push({
          spotifyTrack,
          reason: 'No matching local track found'
        });
      }
    }

    return missingTracks;
  }

  // Perform batch matching and save to database
  static async performBatchMatching(userId: string, superGenreFilter?: string): Promise<{
    matches: TrackMatch[];
    processed: number;
    saved: number;
  }> {
    const [localTracks, spotifyTracks] = await Promise.all([
      this.fetchLocalTracks(userId),
      this.fetchSpotifyTracks(userId, superGenreFilter)
    ]);

    const matches: TrackMatch[] = [];
    let saved = 0;

    for (const localTrack of localTracks) {
      const bestMatch = this.findBestMatch(localTrack, spotifyTracks);
      
      if (bestMatch && bestMatch.confidence >= 60) { // Only save matches with reasonable confidence
        matches.push(bestMatch);

        // Save to database
        const { error } = await supabase
          .from('track_matches')
          .upsert({
            mp3_id: localTrack.id,
            spotify_track_id: bestMatch.spotifyTrack.id,
            match_confidence: bestMatch.confidence,
            match_method: bestMatch.algorithm,
            is_confirmed: bestMatch.confidence >= 95
          }, {
            onConflict: 'mp3_id,spotify_track_id'
          });

        if (!error) {
          saved++;
        }
      }
    }

    return {
      matches,
      processed: localTracks.length,
      saved
    };
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