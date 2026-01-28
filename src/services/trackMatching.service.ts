import { supabase } from '@/integrations/supabase/client';
import { NormalizationService } from './normalization.service';

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

// Similarity threshold for fuzzy matching (percentage)
const FUZZY_MATCH_THRESHOLD = 85;

// Debug mode - set to true to log detailed matching info for specific tracks
const DEBUG_MATCHING = true;
// Add artist/title substrings to debug specific tracks (case-insensitive)
const DEBUG_TRACKS: string[] = ['armando', 'disin'];

function shouldDebug(title: string, artist: string): boolean {
  if (!DEBUG_MATCHING || DEBUG_TRACKS.length === 0) return false;
  const combined = `${title} ${artist}`.toLowerCase();
  return DEBUG_TRACKS.some(term => combined.includes(term.toLowerCase()));
}

export class TrackMatchingService {
  private static normalizationService = new NormalizationService();

  // Normalize strings for comparison with enhanced artist handling
  private static normalize(str: string | null): string {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Extract core title without mix/version info
  private static extractCoreTitle(title: string | null): string {
    if (!title) return '';
    const { core } = this.normalizationService.extractVersionInfo(title);
    return this.normalize(core);
  }

  // Simplified artist normalization - strips "The" prefix and normalizes
  private static normalizeArtist(artist: string | null): string {
    if (!artist) return '';

    let normalized = artist.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Strip leading "The " from artist names
    if (normalized.startsWith('the ')) {
      normalized = normalized.slice(4);
    }

    return normalized;
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
  // Uses three-tier matching: exact → core title → fuzzy
  static async findMissingTracks(userId: string, superGenreFilter?: string): Promise<MissingTrack[]> {
    const [localTracks, spotifyTracks] = await Promise.all([
      this.fetchLocalTracks(userId),
      this.fetchSpotifyTracks(userId, superGenreFilter)
    ]);

    const missingTracks: MissingTrack[] = [];

    // Build lookup structures for local tracks
    // Note: Fallback to artist field if primary_artist is null (legacy data)
    // 1. Exact match set: full normalized title + artist
    const localExactSet = new Set(
      localTracks.map(track =>
        `${this.normalize(track.title)}_${this.normalizeArtist(track.primary_artist || track.artist)}`
      )
    );

    // 2. Core title match set: core title (no mix/version) + artist
    const localCoreSet = new Set(
      localTracks.map(track =>
        `${this.extractCoreTitle(track.title)}_${this.normalizeArtist(track.primary_artist || track.artist)}`
      )
    );

    // 3. For fuzzy matching, keep array of normalized local tracks with original data for debugging
    const localNormalized = localTracks.map(track => ({
      title: this.normalize(track.title),
      coreTitle: this.extractCoreTitle(track.title),
      artist: this.normalizeArtist(track.primary_artist || track.artist),
      // Keep original values for debugging
      originalTitle: track.title,
      originalArtist: track.primary_artist || track.artist,
    }));

    // Debug: Log local tracks matching debug criteria
    if (DEBUG_MATCHING) {
      const debugLocalTracks = localNormalized.filter(t =>
        shouldDebug(t.originalTitle || '', t.originalArtist || '')
      );
      if (debugLocalTracks.length > 0) {
        console.log('🔍 DEBUG: Local tracks matching debug criteria:');
        debugLocalTracks.forEach(t => {
          console.log(`  📀 Original: "${t.originalTitle}" by "${t.originalArtist}"`);
          console.log(`     Normalized title: "${t.title}"`);
          console.log(`     Core title: "${t.coreTitle}"`);
          console.log(`     Normalized artist: "${t.artist}"`);
        });
      }
    }

    for (const spotifyTrack of spotifyTracks) {
      const spotifyTitle = this.normalize(spotifyTrack.title);
      const spotifyCoreTitle = this.extractCoreTitle(spotifyTrack.title);
      // Fallback to artist field if primary_artist is null (legacy data)
      const spotifyArtist = this.normalizeArtist(spotifyTrack.primary_artist || spotifyTrack.artist);

      const debug = shouldDebug(spotifyTrack.title, spotifyTrack.primary_artist || spotifyTrack.artist);

      if (debug) {
        console.log('🔍 DEBUG: Processing Spotify track:');
        console.log(`  🎵 Original: "${spotifyTrack.title}" by "${spotifyTrack.artist}"`);
        console.log(`     Primary artist: "${spotifyTrack.primary_artist}"`);
        console.log(`     Normalized title: "${spotifyTitle}"`);
        console.log(`     Core title: "${spotifyCoreTitle}"`);
        console.log(`     Normalized artist: "${spotifyArtist}"`);
      }

      // Tier 1: Exact match on full title + artist
      const exactKey = `${spotifyTitle}_${spotifyArtist}`;
      if (localExactSet.has(exactKey)) {
        if (debug) console.log(`  ✅ Tier 1 MATCH (exact): key="${exactKey}"`);
        continue; // Found exact match
      }
      if (debug) console.log(`  ❌ Tier 1 no match: key="${exactKey}"`);

      // Tier 2: Match on core title (without mix/version) + artist
      const coreKey = `${spotifyCoreTitle}_${spotifyArtist}`;
      if (localCoreSet.has(coreKey)) {
        if (debug) console.log(`  ✅ Tier 2 MATCH (core): key="${coreKey}"`);
        continue; // Found core title match
      }
      if (debug) console.log(`  ❌ Tier 2 no match: key="${coreKey}"`);

      // Tier 3: Fuzzy matching - check if any local track is similar enough
      let fuzzyMatch = false;
      let bestFuzzyMatch: { local: typeof localNormalized[0]; titleSim: number; coreSim: number } | null = null;

      for (const local of localNormalized) {
        // Artist must match exactly (after normalization)
        if (local.artist !== spotifyArtist) continue;

        // Check title similarity (try both full title and core title)
        const titleSimilarity = this.calculateSimilarity(local.title, spotifyTitle);
        const coreSimilarity = this.calculateSimilarity(local.coreTitle, spotifyCoreTitle);

        if (debug && (titleSimilarity > 50 || coreSimilarity > 50)) {
          console.log(`  🔎 Fuzzy candidate: "${local.originalTitle}"`);
          console.log(`     Title similarity: ${titleSimilarity.toFixed(1)}%, Core similarity: ${coreSimilarity.toFixed(1)}%`);
        }

        if (titleSimilarity >= FUZZY_MATCH_THRESHOLD || coreSimilarity >= FUZZY_MATCH_THRESHOLD) {
          fuzzyMatch = true;
          bestFuzzyMatch = { local, titleSim: titleSimilarity, coreSim: coreSimilarity };
          break;
        }
      }

      if (fuzzyMatch && bestFuzzyMatch) {
        if (debug) {
          console.log(`  ✅ Tier 3 MATCH (fuzzy): "${bestFuzzyMatch.local.originalTitle}"`);
          console.log(`     Similarity: title=${bestFuzzyMatch.titleSim.toFixed(1)}%, core=${bestFuzzyMatch.coreSim.toFixed(1)}%`);
        }
        continue; // Found fuzzy match
      }

      if (debug) {
        console.log(`  ❌ Tier 3 no fuzzy match found`);
        // Check if there are ANY local tracks by this artist
        const artistMatches = localNormalized.filter(l => l.artist === spotifyArtist);
        if (artistMatches.length === 0) {
          console.log(`  ⚠️  No local tracks found for artist "${spotifyArtist}"`);
        } else {
          console.log(`  📋 Local tracks by this artist (${artistMatches.length}):`);
          artistMatches.slice(0, 5).forEach(l => {
            console.log(`     - "${l.originalTitle}" (normalized: "${l.title}")`);
          });
          if (artistMatches.length > 5) {
            console.log(`     ... and ${artistMatches.length - 5} more`);
          }
        }
        console.log(`  🚫 MISSING: Track will be added to missing list`);
      }

      // No match found at any tier
      missingTracks.push({
        spotifyTrack,
        reason: 'No matching local track found'
      });
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
