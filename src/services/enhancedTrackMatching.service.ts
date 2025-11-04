import { supabase } from '@/integrations/supabase/client';
import { NormalizationService } from './normalization.service';

export interface LocalTrack {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  normalized_title?: string | null;
  normalized_artist?: string | null;
  core_title?: string | null;
  primary_artist?: string | null;
  mix?: string | null;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  super_genre: string | null;
  normalized_title?: string | null;
  normalized_artist?: string | null;
  core_title?: string | null;
  primary_artist?: string | null;
  mix?: string | null;
}

export interface MatchScore {
  total: number;
  breakdown: {
    coreTitleMatch: number;
    artistMatch: number;
    versionBonus: number;
    albumBonus: number;
    mixBonus: number;
    penalties: number;
  };
  algorithm: string;
  details: string;
}

export interface TrackMatch {
  localTrack: LocalTrack;
  spotifyTrack: SpotifyTrack;
  score: MatchScore;
}

export class EnhancedTrackMatchingService {
  private normalizer = new NormalizationService();

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate similarity percentage
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 100;

    const distance = this.levenshteinDistance(str1, str2);
    return ((maxLength - distance) / maxLength) * 100;
  }

  /**
   * Match tracks with detailed scoring
   */
  private matchTracks(local: LocalTrack, spotify: SpotifyTrack): MatchScore | null {
    const breakdown = {
      coreTitleMatch: 0,
      artistMatch: 0,
      versionBonus: 0,
      albumBonus: 0,
      mixBonus: 0,
      penalties: 0,
    };

    let algorithm = '';
    let details = '';

    // Use normalized fields if available, otherwise normalize on the fly
    const localCoreTitle = local.core_title || this.normalizer.normalize(local.title);
    const spotifyCoreTitle = spotify.core_title || this.normalizer.normalize(spotify.title);
    const localPrimaryArtist = local.primary_artist || this.normalizer.normalize(local.artist);
    const spotifyPrimaryArtist = spotify.primary_artist || this.normalizer.normalize(spotify.artist);

    // Level 1: Exact core match
    if (localCoreTitle === spotifyCoreTitle && localPrimaryArtist === spotifyPrimaryArtist) {
      breakdown.coreTitleMatch = 50;
      breakdown.artistMatch = 20;
      algorithm = 'Exact Core Match';
      details = 'Perfect match on core title and primary artist';

      // Mix bonus
      if (local.mix === spotify.mix) {
        breakdown.versionBonus = 10;
        details += '; Same mix';
      } else if (local.mix && spotify.mix && local.mix !== spotify.mix) {
        breakdown.penalties = -5;
        details += '; Different mixes';
      }

      // Mix bonus
      if (local.mix && spotify.mix && local.mix === spotify.mix) {
        breakdown.mixBonus = 15;
        details += '; Same mix';
      }

      // Album bonus
      const localAlbum = this.normalizer.normalize(local.album);
      const spotifyAlbum = this.normalizer.normalize(spotify.album);
      if (localAlbum === spotifyAlbum) {
        breakdown.albumBonus = 5;
        details += '; Same album';
      }
    }
    // Level 2: Fuzzy core match (90%+)
    else {
      const titleSimilarity = this.calculateSimilarity(localCoreTitle, spotifyCoreTitle);
      const artistSimilarity = this.calculateSimilarity(localPrimaryArtist, spotifyPrimaryArtist);

      if (titleSimilarity >= 90 && artistSimilarity >= 90) {
        breakdown.coreTitleMatch = Math.round((titleSimilarity / 100) * 40);
        breakdown.artistMatch = Math.round((artistSimilarity / 100) * 20);
        algorithm = 'Fuzzy Match';
        details = `Title: ${titleSimilarity.toFixed(1)}%, Artist: ${artistSimilarity.toFixed(1)}%`;

        // Mix bonus
        if (local.mix === spotify.mix) {
          breakdown.versionBonus = 5;
        }

        // Album bonus
        const localAlbum = this.normalizer.normalize(local.album);
        const spotifyAlbum = this.normalizer.normalize(spotify.album);
        if (localAlbum === spotifyAlbum) {
          breakdown.albumBonus = 3;
        }
      }
      // Level 3: Artist + partial title match (for remixes)
      else if (artistSimilarity >= 95 && titleSimilarity >= 70) {
        breakdown.artistMatch = 30;
        breakdown.coreTitleMatch = Math.round((titleSimilarity / 100) * 20);
        algorithm = 'Artist + Partial Title';
        details = `Same artist, similar title (${titleSimilarity.toFixed(1)}%)`;

        // Mix handling
        if (local.mix && spotify.mix) {
          if (local.mix === spotify.mix) {
            breakdown.mixBonus = 15;
            details += '; Same mix';
          } else {
            breakdown.penalties = -10;
            details += '; Different mix';
          }
        }
      }
      // Level 4: Artist-only with version cross-reference
      else if (artistSimilarity >= 98) {
        breakdown.artistMatch = 25;
        algorithm = 'Artist Only';
        details = `Artist match only (${artistSimilarity.toFixed(1)}%)`;

        // Check if titles share significant words
        const localWords = new Set(localCoreTitle.split(' ').filter(w => w.length > 3));
        const spotifyWords = new Set(spotifyCoreTitle.split(' ').filter(w => w.length > 3));
        const sharedWords = [...localWords].filter(w => spotifyWords.has(w));
        
        if (sharedWords.length > 0) {
          breakdown.coreTitleMatch = Math.min(15, sharedWords.length * 5);
          details += `; ${sharedWords.length} shared words`;
        }
      } else {
        return null; // No match
      }
    }

    const total = Math.min(100, 
      breakdown.coreTitleMatch + 
      breakdown.artistMatch + 
      breakdown.versionBonus + 
      breakdown.albumBonus + 
      breakdown.mixBonus + 
      breakdown.penalties
    );

    // Only return matches with confidence >= 60
    if (total < 60) return null;

    return {
      total,
      breakdown,
      algorithm,
      details,
    };
  }

  /**
   * Find best match for a local track
   */
  async findBestMatch(localTrack: LocalTrack, spotifyTracks: SpotifyTrack[]): Promise<TrackMatch | null> {
    let bestMatch: TrackMatch | null = null;
    let bestScore = 0;

    for (const spotifyTrack of spotifyTracks) {
      const score = this.matchTracks(localTrack, spotifyTrack);
      
      if (score && score.total > bestScore) {
        bestScore = score.total;
        bestMatch = {
          localTrack,
          spotifyTrack,
          score,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Normalize and update a track's metadata in the database
   */
  async normalizeAndUpdateTrack(
    tableName: 'local_mp3s' | 'spotify_liked',
    trackId: string,
    title: string | null,
    artist: string | null
  ): Promise<void> {
    const metadata = this.normalizer.processMetadata(title, artist);

    const updateData = {
      normalized_title: metadata.normalizedTitle,
      normalized_artist: metadata.normalizedArtist,
      core_title: metadata.coreTitle,
      primary_artist: metadata.primaryArtist,
      featured_artists: metadata.featuredArtists,
      mix: metadata.mix,
    };

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', trackId);

    if (error) {
      console.error(`Error updating ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Batch normalize all tracks for a user
   */
  async normalizeAllUserTracks(userId: string): Promise<{ local: number; spotify: number }> {
    // Normalize local tracks
    const { data: localTracks, error: localError } = await supabase
      .from('local_mp3s')
      .select('id, title, artist')
      .eq('user_id', userId)
      .is('normalized_title', null);

    if (localError) throw localError;

    let localCount = 0;
    if (localTracks) {
      for (const track of localTracks) {
        await this.normalizeAndUpdateTrack('local_mp3s', track.id, track.title, track.artist);
        localCount++;
      }
    }

    // Normalize Spotify tracks
    const { data: spotifyTracks, error: spotifyError } = await supabase
      .from('spotify_liked')
      .select('id, title, artist')
      .eq('user_id', userId)
      .is('normalized_title', null);

    if (spotifyError) throw spotifyError;

    let spotifyCount = 0;
    if (spotifyTracks) {
      for (const track of spotifyTracks) {
        await this.normalizeAndUpdateTrack('spotify_liked', track.id, track.title, track.artist);
        spotifyCount++;
      }
    }

    return { local: localCount, spotify: spotifyCount };
  }

  /**
   * Perform batch matching with enhanced scoring
   */
  async performBatchMatching(userId: string, superGenreFilter?: string): Promise<TrackMatch[]> {
    // Fetch all tracks
    const { data: localTracks, error: localError } = await supabase
      .from('local_mp3s')
      .select('*')
      .eq('user_id', userId);

    if (localError) throw localError;

    let spotifyQuery = supabase
      .from('spotify_liked')
      .select('*')
      .eq('user_id', userId);

    if (superGenreFilter && superGenreFilter !== 'all') {
      spotifyQuery = spotifyQuery.eq('super_genre', superGenreFilter as any);
    }

    const { data: spotifyTracks, error: spotifyError } = await spotifyQuery;

    if (spotifyError) throw spotifyError;

    // Perform matching
    const matches: TrackMatch[] = [];
    
    for (const localTrack of localTracks || []) {
      const match = await this.findBestMatch(localTrack, spotifyTracks || []);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }
}

export const enhancedTrackMatchingService = new EnhancedTrackMatchingService();
