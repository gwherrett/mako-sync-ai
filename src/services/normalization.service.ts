/**
 * Advanced Music Metadata Normalization Service
 * Implements comprehensive text normalization for accurate track matching
 */

export interface NormalizedMetadata {
  normalizedTitle: string;
  normalizedArtist: string;
  coreTitle: string;
  versionInfo: string | null;
  primaryArtist: string;
  featuredArtists: string[];
  mix: string | null;
}

export class NormalizationService {
  // Common version/remix patterns
  private readonly versionPatterns = [
    /\(live(?:\s+at\s+[^)]+)?\)/gi,
    /\(live\)/gi,
    /\(remaster(?:ed)?(?:\s+\d{4})?\)/gi,
    /\(radio\s+edit\)/gi,
    /\(original\s+mix\)/gi,
    /\(extended\s+mix\)/gi,
    /\(club\s+mix\)/gi,
    /\(dub\s+mix\)/gi,
    /\(instrumental\)/gi,
    /\(acoustic\)/gi,
    /\(unplugged\)/gi,
    /\(\d{4}\s+remaster\)/gi,
  ];

  // Remix patterns - capture remixer name
  private readonly remixPattern = /\(([^)]+)\s+(?:remix|mix|edit)\)/gi;

  // Feature patterns
  private readonly featurePatterns = [
    /\s+feat\.?\s+/gi,
    /\s+ft\.?\s+/gi,
    /\s+featuring\s+/gi,
    /\s+with\s+/gi,
  ];

  /**
   * Step 1.1: Unicode normalization (NFKC) + casefold + trim + collapse whitespace
   */
  private unicodeNormalize(text: string | null): string {
    if (!text) return '';
    return text
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Step 1.2: Remove accents and diacritics
   * "Beyoncé" → "beyonce"; "Sigur Rós" → "sigur ros"
   */
  private removeDiacritics(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Step 1.3: Unify punctuation
   * Various quotes → ', hyphens → -, &/x/+ → &
   */
  private unifyPunctuation(text: string): string {
    return text
      // Unify quotes
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      // Unify hyphens
      .replace(/[‐‑‒–—―]/g, '-')
      // Unify ampersands
      .replace(/\s+[x×]\s+/gi, ' & ')
      .replace(/\s+and\s+/gi, ' & ')
      // Remove most punctuation except &, -, and spaces
      .replace(/[^\w\s&'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Step 1.4: Standardize featuring notation
   * feat.|ft.|featuring|with → feat
   */
  private standardizeFeatures(text: string): string {
    let normalized = text;
    for (const pattern of this.featurePatterns) {
      normalized = normalized.replace(pattern, ' feat ');
    }
    return normalized.trim();
  }

  /**
   * Step 1.5: Extract version information
   * Returns { core: "track without version", version: "Live" | "Radio Edit" | etc. }
   */
  extractVersionInfo(title: string | null): { core: string; version: string | null; mix: string | null } {
    if (!title) return { core: '', version: null, mix: null };

    let core = title;
    let version: string | null = null;
    let mix: string | null = null;

    // First, check for remixes and extract mix info
    const remixMatch = this.remixPattern.exec(title);
    if (remixMatch) {
      mix = remixMatch[1].trim();
      version = `${mix} Remix`;
      core = title.replace(this.remixPattern, '').trim();
    }

    // Then check for other version patterns
    for (const pattern of this.versionPatterns) {
      const match = pattern.exec(core);
      if (match) {
        if (!version) {
          version = match[0].replace(/[()]/g, '').trim();
        }
        core = core.replace(pattern, '').trim();
      }
    }

    // Clean up any remaining parentheses with content
    core = core.replace(/\([^)]*\)/g, '').trim();
    core = core.replace(/\s+/g, ' ').trim();

    return { core, version, mix };
  }

  /**
   * Parse artist field into primary artist and featured artists
   */
  parseArtists(artist: string | null): { primary: string; featured: string[] } {
    if (!artist) return { primary: '', featured: [] };

    // Standardize featuring notation first
    let normalized = this.standardizeFeatures(artist);

    // Split on "feat"
    const parts = normalized.split(/\s+feat\s+/i);
    const primary = parts[0].trim();
    const featured = parts.slice(1).map(a => a.trim()).filter(a => a.length > 0);

    return { primary, featured };
  }

  /**
   * Full normalization pipeline for matching
   */
  normalize(text: string | null): string {
    if (!text) return '';
    
    let normalized = this.unicodeNormalize(text);
    normalized = this.removeDiacritics(normalized);
    normalized = this.unifyPunctuation(normalized);
    normalized = this.standardizeFeatures(normalized);
    
    return normalized.trim();
  }

  /**
   * Process complete track metadata
   */
  processMetadata(title: string | null, artist: string | null): NormalizedMetadata {
    // Extract version and mix info from title
    const { core, version, mix } = this.extractVersionInfo(title);
    
    // Parse artist information
    const { primary, featured } = this.parseArtists(artist);

    // Apply full normalization
    const normalizedTitle = this.normalize(title);
    const normalizedArtist = this.normalize(artist);
    const coreTitle = this.normalize(core);
    const primaryArtist = this.normalize(primary);

    return {
      normalizedTitle,
      normalizedArtist,
      coreTitle,
      versionInfo: version,
      primaryArtist,
      featuredArtists: featured,
      mix,
    };
  }
}
