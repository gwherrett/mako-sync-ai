/**
 * Advanced Music Metadata Normalization Service
 * Implements comprehensive text normalization for accurate track matching
 */

export interface NormalizedMetadata {
  normalizedTitle: string;
  normalizedArtist: string;
  coreTitle: string;
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
   * Step 1.5: Extract mix/version information
   * Captures the full text from parentheses or after hyphen separator
   * Examples: "Title (Vocal Mix)" or "Title - Vocal Mix"
   */
  extractVersionInfo(title: string | null): { core: string; mix: string | null } {
    if (!title) return { core: '', mix: null };

    let core = title;
    let mix: string | null = null;

    // First check for parentheses format: "Title (Vocal Mix)"
    const parenthesesMatch = /\(([^)]+)\)/.exec(title);
    if (parenthesesMatch) {
      mix = parenthesesMatch[1].trim();
      core = title.replace(/\([^)]+\)/g, '').trim();
    }
    // Then check for hyphen format: "Title - Vocal Mix"
    else if (title.includes(' - ')) {
      const parts = title.split(' - ');
      if (parts.length === 2) {
        core = parts[0].trim();
        mix = parts[1].trim();
      }
    }

    // Clean up whitespace
    core = core.replace(/\s+/g, ' ').trim();

    return { core, mix };
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
    // Extract mix info from title
    const { core, mix } = this.extractVersionInfo(title);
    
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
      primaryArtist,
      featuredArtists: featured,
      mix,
    };
  }
}
