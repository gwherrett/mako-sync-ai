/**
 * Server-side normalization for Spotify tracks
 * Mirrors the client-side normalization logic
 */

export interface NormalizedMetadata {
  normalized_title: string;
  normalized_artist: string;
  core_title: string;
  version_info: string | null;
  primary_artist: string;
  featured_artists: string[];
  remixer: string | null;
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
 * Step 1.5: Extract version information
 */
function extractVersionInfo(title: string | null): { core: string; version: string | null; remixer: string | null } {
  if (!title) return { core: '', version: null, remixer: null };

  let core = title;
  let version: string | null = null;
  let remixer: string | null = null;

  // First, check for remixes and extract remixer
  const remixMatch = remixPattern.exec(title);
  if (remixMatch) {
    remixer = remixMatch[1].trim();
    version = `${remixer} Remix`;
    core = title.replace(remixPattern, '').trim();
  }

  // Then check for other version patterns
  for (const pattern of versionPatterns) {
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

  return { core, version, remixer };
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
  // Extract version and remixer info from title
  const { core, version, remixer } = extractVersionInfo(title);
  
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
    version_info: version,
    primary_artist,
    featured_artists: featured,
    remixer,
  };
}
