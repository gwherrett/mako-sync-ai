# Mako Sync slskd Complete Implementation Guide

**Document Version:** 1.0
**Last Updated:** January 13, 2026
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Workflow](#complete-workflow)
3. [Phase 1: Post-Download Script](#phase-1-post-download-script)
4. [Phase 2: Mako Sync Database Setup](#phase-2-mako-sync-database-setup)
5. [Phase 3: slskd Configuration UI](#phase-3-slskd-configuration-ui)
6. [Phase 4: Missing Tracks Integration](#phase-4-missing-tracks-integration)
7. [Phase 5: Sync Implementation](#phase-5-sync-implementation)
8. [Phase 6: Progress & Results UI](#phase-6-progress--results-ui)
9. [Testing & Validation](#testing--validation)
10. [Deployment Checklist](#deployment-checklist)

---

## Overview

This implementation guide covers the complete slskd integration for Mako Sync, including:

1. **One-way sync**: Push missing tracks from Mako Sync → slskd wishlist
2. **Post-download processing**: Automatically organize downloaded files into Supercrates

### Key Architecture Decisions

✅ **Supercrates is single source of truth**
- Mako Sync scans Supercrates folders (not MediaMonkey)
- Downloads flow: slskd → post-processor → Supercrates → Serato

✅ **Client-side integration**
- Direct REST API calls from browser to slskd
- No edge function required

✅ **No sync state persistence**
- Duplicate detection via real-time slskd API queries
- Users can re-sync tracks anytime

✅ **Static genre mapping**
- Simple, reliable genre classification
- Based on ID3 tags from downloaded files

### End-to-End Flow

```
┌──────────────────────┐
│ Spotify Liked Songs  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Mako Sync            │
│ - Scan Supercrates   │
│ - Find missing       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ User selects artists │
│ Click "Push to slskd"│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Mako Sync → slskd    │
│ REST API calls       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ slskd downloads      │
│ to /downloads/       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Post-processor       │
│ Python script        │
│ - Read genre tags    │
│ - Map to super_genre │
│ - Clean metadata     │
│ - Move to Supercrates│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Supercrates/[genre]/ │
└──────────┬───────────┘
           │
           ├─────────┬─────────┐
           ▼         ▼         ▼
      Mako Sync  Serato  MediaMonkey
      (re-scan)  (use)   (backup)
```

---

## Complete Workflow

### Weekly Cycle

**Monday:**
1. Run Mako Sync "Missing Tracks" analysis
2. Select artists → Push to slskd
3. slskd downloads overnight

**Tuesday:**
1. Run post-processor script
2. Run Mako Sync "Scan Local Files"
3. Review "Unclassified" folder

**Rest of week:**
- Use tracks in Serato for gigs
- Repeat as needed

---

## Phase 1: Post-Download Script

**Priority:** HIGHEST - Implement this first
**Estimated Time:** 2-4 hours
**Dependencies:** Python 3.x, pip

### Objective

Automatically organize slskd downloads into Supercrates folders based on genre tags.

### Installation

```bash
# Install dependency
pip install mutagen

# Create script directory
mkdir -p ~/scripts
cd ~/scripts

# Create the script file
nano organize_downloads.py
```

### Complete Script

```python
#!/usr/bin/env python3
"""
Mako Sync Download Organizer
Moves files from slskd downloads to Supercrates folders based on genre tags
"""

import os
import shutil
import re
from pathlib import Path
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
import logging

# ============================================================
# CONFIGURATION - EDIT THESE PATHS
# ============================================================

DOWNLOAD_DIR = Path("/path/to/slskd/downloads")
SUPERCRATES_BASE = Path("/path/to/Supercrates")
MANUAL_REVIEW_DIR = SUPERCRATES_BASE / "Unclassified"

# Static super_genre mapping
GENRE_MAPPING = {
    "Bass": [
        "dubstep", "drum and bass", "dnb", "jungle", "halftime",
        "neurofunk", "liquid dnb", "jump up", "bass music"
    ],
    "Blues": [
        "blues", "delta blues", "chicago blues", "electric blues"
    ],
    "Country": [
        "country", "bluegrass", "americana", "folk country"
    ],
    "Dance": [
        "dance", "edm", "electronic dance"
    ],
    "Disco": [
        "disco", "nu-disco", "disco house", "funk"
    ],
    "Drum & Bass": [
        "drum and bass", "dnb", "jungle", "neurofunk", "liquid dnb"
    ],
    "Electronic": [
        "electronic", "electronica", "ambient", "idm", "downtempo",
        "chillout", "synthwave", "vaporwave"
    ],
    "Folk": [
        "folk", "indie folk", "folk rock", "acoustic folk"
    ],
    "Hip Hop": [
        "hip hop", "rap", "hip-hop", "trap", "boom bap",
        "conscious hip hop", "gangsta rap", "underground hip hop"
    ],
    "House": [
        "house", "deep house", "tech house", "progressive house",
        "electro house", "future house", "bass house", "tropical house",
        "afro house", "chicago house", "french house"
    ],
    "Indie-Alternative": [
        "indie", "alternative", "indie rock", "indie pop",
        "alternative rock", "indie electronic"
    ],
    "Jazz": [
        "jazz", "bebop", "smooth jazz", "jazz fusion",
        "contemporary jazz", "latin jazz"
    ],
    "Latin": [
        "latin", "salsa", "reggaeton", "bachata", "merengue",
        "cumbia", "latin pop"
    ],
    "Metal": [
        "metal", "heavy metal", "thrash metal", "death metal",
        "black metal", "metalcore", "progressive metal"
    ],
    "Pop": [
        "pop", "synth pop", "electropop", "indie pop", "dance pop",
        "80s", "90s pop"
    ],
    "Reggae-Dancehall": [
        "reggae", "dancehall", "dub", "roots reggae", "ska"
    ],
    "Rock": [
        "rock", "classic rock", "hard rock", "punk rock",
        "soft rock", "progressive rock", "psychedelic rock"
    ],
    "Soul-Funk": [
        "soul", "funk", "motown", "r&b 1970s", "r&b 1980s",
        "neo soul", "boogie", "p-funk"
    ],
    "Techno": [
        "techno", "minimal techno", "detroit techno", "acid techno",
        "industrial techno", "melodic techno"
    ],
    "UK Garage": [
        "uk garage", "garage", "2-step", "speed garage", "grime"
    ],
    "Urban": [
        "r&b", "rnb", "contemporary r&b", "urban contemporary",
        "r&b 1990s", "r&b 2000s", "r&b 2010s"
    ],
    "World": [
        "world", "afrobeat", "world music", "ethnic", "tribal"
    ]
}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================
# CORE FUNCTIONS
# ============================================================

def find_audio_files(root_dir):
    """Recursively find all MP3 files"""
    audio_files = []

    for path in root_dir.rglob('*.mp3'):
        audio_files.append(path)

    logger.info(f"Found {len(audio_files)} MP3 files")
    return audio_files


def extract_metadata(file_path):
    """Extract artist, title, and genre from MP3"""
    try:
        audio = MP3(file_path, ID3=EasyID3)

        return {
            'artist': audio.get('artist', ['Unknown'])[0],
            'title': audio.get('title', ['Unknown'])[0],
            'genre': audio.get('genre', [''])[0],
            'file_path': file_path
        }
    except Exception as e:
        logger.error(f"Could not read {file_path.name}: {e}")
        return None


def clean_artist_name(artist):
    """Remove featuring/feat/vs from artist name"""
    patterns = [
        r'\s*feat\.?\s+.*',
        r'\s*ft\.?\s+.*',
        r'\s*featuring\s+.*',
        r'\s*vs\.?\s+.*',
        r'\s*&\s+.*',
        r'\s*x\s+.*'
    ]

    for pattern in patterns:
        artist = re.sub(pattern, '', artist, flags=re.IGNORECASE)

    return artist.strip()


def clean_title(title):
    """Remove unnecessary brackets and markers"""
    patterns = [
        r'\s*\[.*?Official.*?\]',
        r'\s*\[.*?Audio.*?\]',
        r'\s*\(.*?HD.*?\)',
        r'\s*-\s*320\s*kbps.*',
    ]

    for pattern in patterns:
        title = re.sub(pattern, '', title, flags=re.IGNORECASE)

    return title.strip()


def map_genre_to_supercrate(genre_tag):
    """Map file genre tag to Supercrate folder"""
    if not genre_tag:
        return None

    genre_lower = genre_tag.lower()

    # Check each super_genre mapping
    for super_genre, keywords in GENRE_MAPPING.items():
        for keyword in keywords:
            if keyword in genre_lower:
                return super_genre

    return None


def generate_filename(artist, title):
    """Create clean filename: Artist - Title.mp3"""
    # Remove filesystem-unsafe characters
    artist = re.sub(r'[<>:"/\\|?*]', '', artist)
    title = re.sub(r'[<>:"/\\|?*]', '', title)

    # Limit length
    if len(artist) > 50:
        artist = artist[:50]
    if len(title) > 100:
        title = title[:100]

    return f"{artist} - {title}.mp3"


def move_to_supercrate(file_path, super_genre, clean_filename):
    """Move file to appropriate Supercrates folder"""
    if super_genre:
        dest_folder = SUPERCRATES_BASE / super_genre
    else:
        dest_folder = MANUAL_REVIEW_DIR

    # Create folder if needed
    dest_folder.mkdir(parents=True, exist_ok=True)

    dest_path = dest_folder / clean_filename

    # Handle duplicates
    if dest_path.exists():
        logger.warning(f"File exists, skipping: {clean_filename}")
        file_path.unlink()  # Delete the download
        return False

    # Move file
    shutil.move(str(file_path), str(dest_path))
    return True


# ============================================================
# MAIN PROCESSING
# ============================================================

def process_file(file_path):
    """Process a single downloaded MP3 file"""
    logger.info(f"\nProcessing: {file_path.name}")

    # Extract metadata
    metadata = extract_metadata(file_path)
    if not metadata:
        logger.warning(f"  → Moving to Unclassified (no metadata)")
        shutil.move(str(file_path), str(MANUAL_REVIEW_DIR / file_path.name))
        return

    # Clean metadata
    artist = clean_artist_name(metadata['artist'])
    title = clean_title(metadata['title'])

    # Map genre
    super_genre = map_genre_to_supercrate(metadata['genre'])

    if not super_genre:
        logger.warning(f"  → Genre: {metadata['genre']} (unmapped)")
        logger.warning(f"  → Moving to Unclassified")
    else:
        logger.info(f"  → Genre: {metadata['genre']} → {super_genre}")

    # Generate clean filename
    clean_filename = generate_filename(artist, title)

    # Move to Supercrates
    success = move_to_supercrate(file_path, super_genre, clean_filename)

    if success:
        folder = super_genre or "Unclassified"
        logger.info(f"  ✓ Moved to {folder}/{clean_filename}")
    else:
        logger.info(f"  ✗ Duplicate, skipped")


def main():
    """Main entry point"""
    print("="*60)
    print("Mako Sync Download Organizer")
    print("="*60)

    # Validate paths
    if not DOWNLOAD_DIR.exists():
        logger.error(f"Download directory not found: {DOWNLOAD_DIR}")
        return

    # Create Supercrates base
    SUPERCRATES_BASE.mkdir(parents=True, exist_ok=True)
    MANUAL_REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    # Find files
    audio_files = find_audio_files(DOWNLOAD_DIR)

    if not audio_files:
        logger.info("No files to process")
        return

    # Process each file
    processed = 0
    skipped = 0

    for file_path in audio_files:
        try:
            process_file(file_path)
            processed += 1
        except Exception as e:
            logger.error(f"Error processing {file_path.name}: {e}")
            skipped += 1

    # Summary
    print("\n" + "="*60)
    print(f"Processing complete!")
    print(f"  Processed: {processed}")
    print(f"  Skipped: {skipped}")
    print(f"\nCheck '{MANUAL_REVIEW_DIR}' for unclassified files")
    print("="*60)


if __name__ == "__main__":
    main()
```

### Configuration

Edit these lines in the script:

```python
DOWNLOAD_DIR = Path("/home/user/slskd/downloads")
SUPERCRATES_BASE = Path("/home/user/DJ/Supercrates")
```

### Testing

```bash
# Make executable
chmod +x organize_downloads.py

# Test run
python3 organize_downloads.py
```

### Expected Output

```
============================================================
Mako Sync Download Organizer
============================================================
Found 5 MP3 files

Processing: track1.mp3
  → Genre: house → House
  ✓ Moved to House/Daft Punk - One More Time.mp3

Processing: track2.mp3
  → Genre: hip hop → Hip Hop
  ✓ Moved to Hip Hop/Kendrick Lamar - HUMBLE.mp3

Processing: track3.mp3
  → Genre:  (unmapped)
  → Moving to Unclassified

============================================================
Processing complete!
  Processed: 5
  Skipped: 0

Check '/path/to/Supercrates/Unclassified' for unclassified files
============================================================
```

### Automation

**Option 1: Cron Job** (runs every 10 minutes)
```bash
crontab -e

# Add:
*/10 * * * * /usr/bin/python3 /home/user/scripts/organize_downloads.py >> /var/log/organize.log 2>&1
```

**Option 2: Manual Trigger**
```bash
# Run when downloads complete
python3 organize_downloads.py
```

### Phase 1 Completion Checklist

- [ ] Python 3.x installed
- [ ] `pip install mutagen` completed
- [ ] Script created at `~/scripts/organize_downloads.py`
- [ ] Paths configured (DOWNLOAD_DIR, SUPERCRATES_BASE)
- [ ] GENRE_MAPPING customized if needed
- [ ] Test run successful with sample files
- [ ] Supercrates folder structure created
- [ ] Automation set up (cron or manual)

---

## Phase 2: Mako Sync Database Setup

**Priority:** HIGH
**Estimated Time:** 1 hour
**Dependencies:** Phase 1 complete, Supabase access

### Objective

Create database table to store slskd configuration per user.

### Database Migration

**File:** `supabase/migrations/[timestamp]_create_user_preferences.sql`

```sql
-- Create user_preferences table for slskd configuration
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- slskd Configuration
  slskd_api_endpoint TEXT,
  slskd_api_key TEXT,
  slskd_last_connection_test TIMESTAMPTZ,
  slskd_connection_status BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id)
);

-- Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Comments
COMMENT ON TABLE public.user_preferences IS 'User-specific preferences including slskd configuration';
COMMENT ON COLUMN public.user_preferences.slskd_api_endpoint IS 'slskd REST API endpoint (e.g., http://localhost:5030)';
COMMENT ON COLUMN public.user_preferences.slskd_api_key IS 'slskd API key for authentication';
```

### Apply Migration

```bash
# Test locally
supabase db reset

# Apply to production
supabase db push
```

### Verify Migration

```sql
-- Check table exists
SELECT * FROM public.user_preferences LIMIT 1;

-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_preferences';
```

### Phase 2 Completion Checklist

- [ ] Migration file created
- [ ] Migration tested locally
- [ ] Migration applied to production
- [ ] Table verified in Supabase dashboard
- [ ] RLS policies verified

---

## Phase 3: slskd Configuration UI

**Priority:** HIGH
**Estimated Time:** 4-6 hours
**Dependencies:** Phase 2 complete

### Objective

Build UI for users to configure their slskd connection.

### TypeScript Types

**File:** `src/types/slskd.ts`

```typescript
export interface SlskdConfig {
  apiEndpoint: string;
  apiKey: string;
  lastConnectionTest?: string;
  connectionStatus: boolean;
}

export interface SlskdSearchRequest {
  searchText: string;
}

export interface SlskdSearchResponse {
  id: string;
  searchText: string;
  state: 'InProgress' | 'Completed' | 'Errored';
}

export interface SlskdSessionResponse {
  username: string;
  isLoggedIn: boolean;
}

export interface SlskdSyncResult {
  totalTracks: number;
  addedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{
    track: string;
    error: string;
  }>;
}
```

### Service Layer

**File:** `src/services/slskdClient.service.ts`

```typescript
import { SlskdConfig, SlskdSearchRequest, SlskdSearchResponse, SlskdSessionResponse } from '@/types/slskd';

export class SlskdClientService {
  private static async request<T>(
    config: SlskdConfig,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${config.apiEndpoint}${endpoint}`;
    const headers = {
      'X-API-Key': config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error');
      throw new Error(`slskd API error (${response.status}): ${errorMessage}`);
    }

    return response.json();
  }

  /**
   * Test connection to slskd instance
   */
  static async testConnection(config: SlskdConfig): Promise<boolean> {
    try {
      const session = await this.request<SlskdSessionResponse>(
        config,
        '/api/v0/session',
        { method: 'GET' }
      );
      return session.isLoggedIn;
    } catch (error) {
      console.error('slskd connection test failed:', error);
      return false;
    }
  }

  /**
   * Get existing searches from slskd wishlist
   */
  static async getExistingSearches(config: SlskdConfig): Promise<SlskdSearchResponse[]> {
    return this.request<SlskdSearchResponse[]>(
      config,
      '/api/v0/searches',
      { method: 'GET' }
    );
  }

  /**
   * Add track to slskd wishlist
   */
  static async addToWishlist(
    config: SlskdConfig,
    searchText: string
  ): Promise<SlskdSearchResponse> {
    const body: SlskdSearchRequest = { searchText };
    return this.request<SlskdSearchResponse>(
      config,
      '/api/v0/searches',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Format search query for slskd
   */
  static formatSearchQuery(artist: string, title: string): string {
    const sanitize = (str: string) => str.replace(/["]/g, '').trim();
    return `${sanitize(artist)} - ${sanitize(title)} 320 MP3`;
  }

  /**
   * Normalize search text for duplicate detection
   */
  static normalizeSearchText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if search already exists in wishlist
   */
  static isSearchDuplicate(
    existingSearches: SlskdSearchResponse[],
    newSearchText: string
  ): boolean {
    const normalizedNew = this.normalizeSearchText(newSearchText);
    return existingSearches.some(
      search => this.normalizeSearchText(search.searchText) === normalizedNew
    );
  }
}
```

### Configuration Hook

**File:** `src/hooks/useSlskdConfig.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SlskdClientService } from '@/services/slskdClient.service';
import { SlskdConfig } from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

export function useSlskdConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ['slskd-config'],
    queryFn: async (): Promise<SlskdConfig | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('slskd_api_endpoint, slskd_api_key, slskd_connection_status, slskd_last_connection_test')
        .eq('user_id', user.id)
        .single();

      if (error || !data) return null;

      return {
        apiEndpoint: data.slskd_api_endpoint || '',
        apiKey: data.slskd_api_key || '',
        connectionStatus: data.slskd_connection_status || false,
        lastConnectionTest: data.slskd_last_connection_test || undefined,
      };
    },
  });

  // Save config
  const saveMutation = useMutation({
    mutationFn: async (newConfig: Omit<SlskdConfig, 'connectionStatus' | 'lastConnectionTest'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Test connection first
      const testConfig = { ...newConfig, connectionStatus: false };
      const isValid = await SlskdClientService.testConnection(testConfig);

      // Save to database
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          slskd_api_endpoint: newConfig.apiEndpoint,
          slskd_api_key: newConfig.apiKey,
          slskd_connection_status: isValid,
          slskd_last_connection_test: new Date().toISOString(),
        });

      if (error) throw error;

      return isValid;
    },
    onSuccess: (isValid) => {
      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'slskd configuration saved'
          : 'Could not connect to slskd. Check your endpoint and API key.',
        variant: isValid ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['slskd-config'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: async (testConfig: Omit<SlskdConfig, 'connectionStatus' | 'lastConnectionTest'>) => {
      return SlskdClientService.testConnection({
        ...testConfig,
        connectionStatus: false,
      });
    },
    onSuccess: (isValid) => {
      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'Successfully connected to slskd'
          : 'Could not connect. Check your settings.',
        variant: isValid ? 'default' : 'destructive',
      });
    },
  });

  return {
    config,
    isLoading,
    saveConfig: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    testConnection: testMutation.mutate,
    isTesting: testMutation.isPending,
  };
}
```

### Settings UI Component

**File:** `src/components/SlskdConfigSection.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { Loader2 } from 'lucide-react';

export function SlskdConfigSection() {
  const { config, isLoading, saveConfig, isSaving, testConnection, isTesting } = useSlskdConfig();

  const [apiEndpoint, setApiEndpoint] = useState(config?.apiEndpoint || '');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');

  const handleSave = () => {
    saveConfig({ apiEndpoint, apiKey });
  };

  const handleTest = () => {
    testConnection({ apiEndpoint, apiKey });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>slskd Integration</CardTitle>
            <CardDescription>
              Connect to your slskd instance to automatically download missing tracks
            </CardDescription>
          </div>
          {config?.connectionStatus && (
            <Badge variant="default" className="bg-green-500">
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slskd-endpoint">API Endpoint</Label>
          <Input
            id="slskd-endpoint"
            type="url"
            placeholder="http://localhost:5030"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            The URL of your slskd instance (e.g., http://localhost:5030)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slskd-api-key">API Key</Label>
          <Input
            id="slskd-api-key"
            type="password"
            placeholder="Your slskd API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Found in slskd settings under API
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !apiEndpoint || !apiKey}
          >
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !apiEndpoint || !apiKey}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Add to Settings Page

**File:** `src/pages/Security.tsx` (modify existing)

```typescript
import { SlskdConfigSection } from '@/components/SlskdConfigSection';

// Add to the page component:
<div className="space-y-6">
  {/* Existing security settings */}

  {/* Add slskd configuration */}
  <SlskdConfigSection />
</div>
```

### Phase 3 Completion Checklist

- [ ] `src/types/slskd.ts` created with interfaces
- [ ] `src/services/slskdClient.service.ts` created
- [ ] `src/hooks/useSlskdConfig.ts` created
- [ ] `src/components/SlskdConfigSection.tsx` created
- [ ] Component added to Security.tsx
- [ ] Test connection with real slskd instance
- [ ] Save configuration works
- [ ] Connection status badge displays correctly
- [ ] Error handling works (wrong credentials, wrong URL)

---

## Phase 4: Missing Tracks Integration

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours
**Dependencies:** Phase 3 complete

### Objective

Add artist-level selection and "Push to slskd" button to Missing Tracks Analyzer.

### Modify MissingTracksAnalyzer Component

**File:** `src/components/MissingTracksAnalyzer.tsx` (modifications)

```typescript
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { Download } from 'lucide-react';

// Add state for selected artists
const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
const { config } = useSlskdConfig();

// Group missing tracks by artist (if not already done)
const tracksByArtist = missingTracks.reduce((acc, track) => {
  const artist = track.primary_artist || track.artist;
  if (!acc[artist]) {
    acc[artist] = [];
  }
  acc[artist].push(track);
  return acc;
}, {} as Record<string, typeof missingTracks>);

// Handle artist selection
const handleArtistToggle = (artist: string) => {
  const newSelected = new Set(selectedArtists);
  if (newSelected.has(artist)) {
    newSelected.delete(artist);
  } else {
    newSelected.add(artist);
  }
  setSelectedArtists(newSelected);
};

// Calculate selected track count
const selectedTrackCount = Array.from(selectedArtists).reduce((count, artist) => {
  return count + (tracksByArtist[artist]?.length || 0);
}, 0);

// Check if push button should be enabled
const canPushToSlskd = config?.connectionStatus && selectedArtists.size > 0;

// Render
return (
  <div className="space-y-4">
    {/* Connection status indicator */}
    {config?.connectionStatus && (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">
        slskd: Connected
      </Badge>
    )}

    {/* Artist list with checkboxes */}
    <div className="space-y-2">
      {Object.entries(tracksByArtist).map(([artist, tracks]) => (
        <div
          key={artist}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
          onClick={() => handleArtistToggle(artist)}
        >
          <Checkbox
            checked={selectedArtists.has(artist)}
            onCheckedChange={() => handleArtistToggle(artist)}
          />
          <div className="flex-1">
            <div className="font-medium">{artist}</div>
            <div className="text-sm text-muted-foreground">
              {tracks.length} track{tracks.length !== 1 ? 's' : ''}
            </div>
          </div>
          {/* Genre pills */}
          <div className="flex gap-1">
            {[...new Set(tracks.map(t => t.super_genre).filter(Boolean))].map(genre => (
              <Badge key={genre} variant="outline" className="text-xs">
                {genre}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Push to slskd button */}
    <div className="flex items-center justify-between pt-4 border-t">
      <div className="text-sm text-muted-foreground">
        {selectedArtists.size > 0 && (
          <span>
            Selected: {selectedTrackCount} track{selectedTrackCount !== 1 ? 's' : ''} from{' '}
            {selectedArtists.size} artist{selectedArtists.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <Button
        onClick={handlePushToSlskd}
        disabled={!canPushToSlskd}
      >
        <Download className="mr-2 h-4 w-4" />
        Push to slskd Wishlist
      </Button>
    </div>

    {!config?.connectionStatus && selectedArtists.size > 0 && (
      <p className="text-sm text-destructive">
        Configure slskd connection in Settings to push tracks
      </p>
    )}
  </div>
);
```

### Phase 4 Completion Checklist

- [ ] Artist grouping implemented (if not already)
- [ ] Checkboxes added per artist
- [ ] Selected state management works
- [ ] Track count displays correctly
- [ ] Genre pills display
- [ ] "Push to slskd" button added
- [ ] Button enable/disable logic works
- [ ] Connection status indicator shows
- [ ] UI is responsive and accessible

---

## Phase 5: Sync Implementation

**Priority:** HIGH
**Estimated Time:** 6-8 hours
**Dependencies:** Phase 4 complete

### Objective

Implement the actual sync logic to push tracks to slskd wishlist.

### Sync Hook

**File:** `src/hooks/useSlskdSync.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SlskdClientService } from '@/services/slskdClient.service';
import { supabase } from '@/integrations/supabase/client';
import { SlskdSyncResult } from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

interface MissingTrack {
  id: string;
  title: string;
  artist: string;
  primary_artist?: string;
}

export function useSlskdSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async (tracks: MissingTrack[]): Promise<SlskdSyncResult> => {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get slskd config
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('slskd_api_endpoint, slskd_api_key')
        .eq('user_id', user.id)
        .single();

      if (!prefs?.slskd_api_endpoint || !prefs?.slskd_api_key) {
        throw new Error('slskd not configured');
      }

      const config = {
        apiEndpoint: prefs.slskd_api_endpoint,
        apiKey: prefs.slskd_api_key,
        connectionStatus: true,
      };

      // Get existing searches
      const existingSearches = await SlskdClientService.getExistingSearches(config);

      const result: SlskdSyncResult = {
        totalTracks: tracks.length,
        addedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: [],
      };

      // Process each track
      for (const track of tracks) {
        const artist = track.primary_artist || track.artist;
        const searchText = SlskdClientService.formatSearchQuery(artist, track.title);

        // Check for duplicate
        if (SlskdClientService.isSearchDuplicate(existingSearches, searchText)) {
          result.skippedCount++;
          continue;
        }

        try {
          // Add to wishlist
          await SlskdClientService.addToWishlist(config, searchText);
          result.addedCount++;
        } catch (error: any) {
          result.failedCount++;
          result.errors.push({
            track: `${artist} - ${track.title}`,
            error: error.message || 'Unknown error',
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return result;
    },
    onSuccess: (result) => {
      toast({
        title: 'Sync Complete',
        description: `Added ${result.addedCount}, Skipped ${result.skippedCount}, Failed ${result.failedCount}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    syncToSlskd: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
  };
}
```

### Integrate into MissingTracksAnalyzer

```typescript
import { useSlskdSync } from '@/hooks/useSlskdSync';

const { syncToSlskd, isSyncing } = useSlskdSync();

const handlePushToSlskd = () => {
  // Get all tracks for selected artists
  const tracksToSync = Array.from(selectedArtists).flatMap(
    artist => tracksByArtist[artist] || []
  );

  // Sync
  syncToSlskd(tracksToSync);
};

// Update button
<Button
  onClick={handlePushToSlskd}
  disabled={!canPushToSlskd || isSyncing}
>
  {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  <Download className="mr-2 h-4 w-4" />
  Push to slskd Wishlist
</Button>
```

### Phase 5 Completion Checklist

- [ ] `src/hooks/useSlskdSync.ts` created
- [ ] Sync hook integrated into MissingTracksAnalyzer
- [ ] Query formatting works correctly
- [ ] Duplicate detection works
- [ ] Error handling works (401, 429, 500, timeout)
- [ ] Loading state displays during sync
- [ ] Toast notifications show results
- [ ] Test with real slskd instance
- [ ] Test with 1 track, 10 tracks, 50+ tracks

---

## Phase 6: Progress & Results UI

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours
**Dependencies:** Phase 5 complete

### Objective

Display real-time sync progress and detailed results.

### Progress Modal Component

**File:** `src/components/SlskdSyncProgress.tsx`

```typescript
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { SlskdSyncResult } from '@/types/slskd';

interface SlskdSyncProgressProps {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  result: SlskdSyncResult | null;
  onRetry?: () => void;
}

export function SlskdSyncProgress({
  isOpen,
  onClose,
  isSyncing,
  result,
  onRetry
}: SlskdSyncProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (result) {
      const completed = result.addedCount + result.skippedCount + result.failedCount;
      const percent = (completed / result.totalTracks) * 100;
      setProgress(percent);
    }
  }, [result]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSyncing ? 'Syncing to slskd' : 'Sync Complete'}
          </DialogTitle>
          <DialogDescription>
            {isSyncing ? 'Adding tracks to wishlist...' : 'Results'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          {result && (
            <>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Progress: {result.addedCount + result.skippedCount + result.failedCount} / {result.totalTracks} tracks
                </div>
                <Progress value={progress} />
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Added: {result.addedCount}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span>Skipped (duplicates): {result.skippedCount}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>Failed: {result.failedCount}</span>
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Errors:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {result.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx} className="text-sm">
                            {err.track}: {err.error}
                          </li>
                        ))}
                        {result.errors.length > 5 && (
                          <li className="text-sm">
                            ... and {result.errors.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              {!isSyncing && (
                <div className="flex gap-2 justify-end">
                  {result.failedCount > 0 && onRetry && (
                    <Button variant="outline" onClick={onRetry}>
                      Retry Failed
                    </Button>
                  )}
                  <Button onClick={onClose}>Close</Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Integrate Progress Modal

```typescript
import { SlskdSyncProgress } from '@/components/SlskdSyncProgress';

const [showProgress, setShowProgress] = useState(false);
const { syncToSlskd, isSyncing, syncResult } = useSlskdSync();

const handlePushToSlskd = () => {
  const tracksToSync = Array.from(selectedArtists).flatMap(
    artist => tracksByArtist[artist] || []
  );

  setShowProgress(true);
  syncToSlskd(tracksToSync);
};

// Add to render
<SlskdSyncProgress
  isOpen={showProgress}
  onClose={() => setShowProgress(false)}
  isSyncing={isSyncing}
  result={syncResult || null}
/>
```

### Phase 6 Completion Checklist

- [ ] `src/components/SlskdSyncProgress.tsx` created
- [ ] Progress modal integrated into MissingTracksAnalyzer
- [ ] Real-time progress updates work
- [ ] Added/Skipped/Failed counts display
- [ ] Error list displays (with limit)
- [ ] Close button works
- [ ] Retry failed button works (optional)
- [ ] UI looks good on mobile and desktop

---

## Testing & Validation

### Unit Tests

**File:** `src/__tests__/slskdClient.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SlskdClientService } from '@/services/slskdClient.service';

describe('SlskdClientService', () => {
  describe('formatSearchQuery', () => {
    it('formats basic query correctly', () => {
      expect(SlskdClientService.formatSearchQuery('Pink Floyd', 'Time'))
        .toBe('Pink Floyd - Time 320 MP3');
    });

    it('sanitizes quotes', () => {
      expect(SlskdClientService.formatSearchQuery('Artist', '"Song Title"'))
        .toBe('Artist - Song Title 320 MP3');
    });
  });

  describe('normalizeSearchText', () => {
    it('normalizes to lowercase', () => {
      expect(SlskdClientService.normalizeSearchText('Pink Floyd - Time 320 MP3'))
        .toBe('pink floyd time 320 mp3');
    });

    it('removes special characters', () => {
      expect(SlskdClientService.normalizeSearchText('Artist - "Song" (Remix)'))
        .toBe('artist song remix');
    });
  });

  describe('isSearchDuplicate', () => {
    const existing = [
      { id: '1', searchText: 'Pink Floyd - Time 320 MP3', state: 'InProgress' as const },
    ];

    it('detects exact duplicate', () => {
      expect(SlskdClientService.isSearchDuplicate(existing, 'Pink Floyd - Time 320 MP3'))
        .toBe(true);
    });

    it('detects normalized duplicate', () => {
      expect(SlskdClientService.isSearchDuplicate(existing, 'PINK FLOYD - TIME 320 MP3'))
        .toBe(true);
    });

    it('does not flag non-duplicate', () => {
      expect(SlskdClientService.isSearchDuplicate(existing, 'Other Artist - Other Song 320 MP3'))
        .toBe(false);
    });
  });
});
```

### Integration Testing Checklist

- [ ] Test connection with valid credentials → success
- [ ] Test connection with invalid credentials → error
- [ ] Test connection with wrong URL → error
- [ ] Push 1 track to slskd → verify in slskd UI
- [ ] Push 10 tracks to slskd → verify all added
- [ ] Push duplicate track → verify skipped
- [ ] Push with slskd offline → error handling
- [ ] Multi-user test: User A and User B different configs
- [ ] Test with special characters in track names
- [ ] Test with 100+ tracks (performance)

### Manual Testing Workflow

1. **Post-Download Script:**
   - Download 5 test tracks via slskd
   - Run script manually
   - Verify files moved to correct Supercrates folders
   - Check Unclassified folder for unmapped genres

2. **Mako Sync Integration:**
   - Configure slskd in Settings
   - Test connection
   - Navigate to Missing Tracks
   - Select 2-3 artists
   - Push to slskd
   - Verify tracks in slskd wishlist
   - Wait for downloads
   - Run post-processor
   - Re-scan in Mako Sync
   - Verify tracks no longer "missing"

---

## Deployment Checklist

### Pre-Deployment

- [ ] All phases complete
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Post-download script tested on production paths
- [ ] Database migration tested locally

### Database Migration

- [ ] Backup production database
- [ ] Apply user_preferences migration
- [ ] Verify RLS policies active
- [ ] Test with production credentials

### Frontend Deployment

- [ ] Build production bundle: `npm run build`
- [ ] Deploy to Vercel/hosting
- [ ] Verify deployment successful
- [ ] Test in production environment

### Post-Deployment Validation

- [ ] Test slskd config save/load in production
- [ ] Test connection to real slskd
- [ ] Test sync with 1 track
- [ ] Test sync with 10+ tracks
- [ ] Verify error handling
- [ ] Check RLS isolation (multi-user)
- [ ] Monitor logs for errors
- [ ] Test post-download script in production

### Post-Download Script Deployment

- [ ] Copy script to production server
- [ ] Configure paths for production
- [ ] Test manual run
- [ ] Set up cron job or automation
- [ ] Verify log output
- [ ] Test with real downloads

---

## Success Metrics

### Technical Metrics

- **Connection Success Rate:** >95% of valid credentials connect
- **Sync Accuracy:** 100% of approved tracks added or skipped
- **Duplicate Prevention:** 0% duplicate additions
- **Post-Processor Success:** >90% of downloads correctly categorized

### User Experience Metrics

- **Configuration Time:** <2 minutes to set up slskd
- **Sync Speed:** <5 seconds per track average
- **Error Clarity:** Users understand errors and fixes
- **Automation:** Post-processor runs reliably without intervention

---

## Troubleshooting Guide

### Post-Download Script Issues

**Files not moving:**
- Check DOWNLOAD_DIR and SUPERCRATES_BASE paths
- Verify permissions: `chmod +x organize_downloads.py`
- Check log output for errors

**Wrong genre classifications:**
- Edit GENRE_MAPPING dictionary
- Add missing genres to mappings
- Files go to Unclassified if no match

**Script not running automatically:**
- Check cron job: `crontab -l`
- Check cron logs: `grep organize /var/log/syslog`
- Verify Python path in cron

### Mako Sync Integration Issues

**Connection failed:**
- Verify slskd is running
- Check URL format: `http://localhost:5030` (no trailing slash)
- Verify API key in slskd settings
- Check CORS settings in slskd

**Duplicates added:**
- Check duplicate detection logic
- Verify normalization function
- Check slskd API response format

**Sync timeout:**
- Reduce batch size
- Add longer delays between tracks
- Check network latency to slskd

**Missing tracks not updating:**
- Run Mako Sync local file scan
- Verify Supercrates path in scanner
- Check file permissions

---

## Maintenance & Monitoring

### Regular Tasks

**Weekly:**
- Review Unclassified folder
- Update GENRE_MAPPING as needed
- Check post-processor logs
- Monitor slskd API performance

**Monthly:**
- Review sync metrics
- Update documentation
- Check for slskd API updates
- Backup Supercrates folder

### Log Files

**Post-Processor:**
```bash
# If using cron with output redirection
tail -f /var/log/organize.log
```

**Mako Sync:**
- Browser console for client-side errors
- Supabase logs for database errors
- slskd logs for API errors

---

## Future Enhancements

**Out of Scope for V1:**

1. **Bi-directional sync:** Import download status from slskd
2. **Quality preferences:** Support for FLAC, variable bitrates
3. **Advanced filtering:** BPM, key detection
4. **Automatic metadata lookup:** MusicBrainz integration
5. **Album-level approval:** Group by album instead of artist
6. **Download monitoring:** Track progress within Mako Sync
7. **Web UI for post-processor:** Manage manual review files
8. **Priority queue:** User-defined download priority
9. **Notifications:** Alert when downloads complete
10. **Analytics:** Dashboard for sync stats

---

## Quick Reference

### Commands

```bash
# Post-processor
python3 organize_downloads.py

# View cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Check cron logs
grep organize /var/log/syslog

# Test slskd API
curl http://localhost:5030/api/v0/session -H "X-API-Key: YOUR_KEY"

# Database migration
supabase db push
```

### File Locations

```
/workspaces/mako-sync/
├── docs/
│   └── slskd-complete-implementation.md  (this file)
├── supabase/migrations/
│   └── [timestamp]_create_user_preferences.sql
├── src/
│   ├── types/slskd.ts
│   ├── services/slskdClient.service.ts
│   ├── hooks/
│   │   ├── useSlskdConfig.ts
│   │   └── useSlskdSync.ts
│   ├── components/
│   │   ├── SlskdConfigSection.tsx
│   │   └── SlskdSyncProgress.tsx
│   └── pages/Security.tsx
└── organize_downloads.py  (production server)
```

### API Endpoints

**slskd:**
- GET `/api/v0/session` - Test connection
- GET `/api/v0/searches` - Get wishlist
- POST `/api/v0/searches` - Add track

**Mako Sync:**
- Existing local file scanner
- Existing missing tracks analysis

---

**Document Status:** ✅ Complete Implementation Guide
**Next Action:** Start with Phase 1 (Post-Download Script)
**Estimated Total Time:** 4-5 weeks for all phases
