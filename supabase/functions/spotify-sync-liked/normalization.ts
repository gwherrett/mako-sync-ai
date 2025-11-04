/**
 * Server-side normalization for Spotify tracks
 * Mirrors the client-side normalization logic
 */

export interface NormalizedMetadata {
  normalized_title: string;
  normalized_artist: string;
  core_title: string;
  primary_artist: string;
  featured_artists: string[];
  mix: string | null;
}

// Common version/remix patterns
const versionPatterns = [
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
const remixPattern = /\(([^)]+)\s+(?:remix|mix|edit)\)/gi;

// Feature patterns
const featurePatterns = [
  /\s+feat\.?\s+/gi,
  /\s+ft\.?\s+/gi,
  /\s+featuring\s+/gi,
  /\s+with\s+/gi,
];

/**
 * Step 1.1: Unicode normalization (NFKC) + casefold + trim + collapse whitespace
 */
function unicodeNormalize(text: string | null): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Step 1.2: Remove accents and diacritics
 */
function removeDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Step 1.3: Unify punctuation
 */
function unifyPunctuation(text: string): string {
  return text
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+[x×]\s+/gi, ' & ')
    .replace(/\s+and\s+/gi, ' & ')
    .replace(/[^\w\s&'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Step 1.4: Standardize featuring notation
 */
function standardizeFeatures(text: string): string {
  let normalized = text;
  for (const pattern of featurePatterns) {
    normalized = normalized.replace(pattern, ' feat ');
  }
  return normalized.trim();
}

/**
 * Step 1.5: Extract mix/version information
 * Captures the full text from parentheses (e.g., "Radio Edit", "David Guetta Remix", "Live")
 */
function extractVersionInfo(title: string | null): { core: string; mix: string | null } {
  if (!title) return { core: '', mix: null };

  let core = title;
  let mix: string | null = null;

  // Extract content from parentheses (any version/mix/remix info)
  const parenthesesMatch = /\(([^)]+)\)/.exec(title);
  if (parenthesesMatch) {
    mix = parenthesesMatch[1].trim();
    core = title.replace(/\([^)]+\)/g, '').trim();
  }

  // Clean up whitespace
  core = core.replace(/\s+/g, ' ').trim();

  return { core, mix };
}

/**
 * Parse artist field into primary artist and featured artists
 */
function parseArtists(artist: string | null): { primary: string; featured: string[] } {
  if (!artist) return { primary: '', featured: [] };

  // Standardize featuring notation first
  let normalized = standardizeFeatures(artist);

  // Split on "feat"
  const parts = normalized.split(/\s+feat\s+/i);
  const primary = parts[0].trim();
  const featured = parts.slice(1).map(a => a.trim()).filter(a => a.length > 0);

  return { primary, featured };
}

/**
 * Full normalization pipeline for matching
 */
export function normalize(text: string | null): string {
  if (!text) return '';
  
  let normalized = unicodeNormalize(text);
  normalized = removeDiacritics(normalized);
  normalized = unifyPunctuation(normalized);
  normalized = standardizeFeatures(normalized);
  
  return normalized.trim();
}

/**
 * Process complete track metadata
 */
export function processMetadata(title: string | null, artist: string | null): NormalizedMetadata {
  // Extract mix info from title
  const { core, mix } = extractVersionInfo(title);
  
  // Parse artist information
  const { primary, featured } = parseArtists(artist);

  // Apply full normalization
  const normalized_title = normalize(title);
  const normalized_artist = normalize(artist);
  const core_title = normalize(core);
  const primary_artist = normalize(primary);

  return {
    normalized_title,
    normalized_artist,
    core_title,
    primary_artist,
    featured_artists: featured,
    mix,
  };
}
