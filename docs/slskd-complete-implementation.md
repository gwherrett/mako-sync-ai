# Mako Sync slskd Complete Implementation Guide

**Document Version:** 4.1
**Last Updated:** January 27, 2026
**Status:** Phases 1-3 Complete, Matching Algorithm Updated

---

## Table of Contents

1. [Overview](#overview)
2. [Track Matching Algorithm](#track-matching-algorithm)
3. [Branching Strategy](#branching-strategy)
4. [slskd Installation (Native Windows)](#slskd-installation-native-windows)
5. [End-to-End Workflow](#end-to-end-workflow)
6. [Phase 1: Local Configuration & Storage](#phase-1-local-configuration--storage)
7. [Phase 2: slskd Wishlist Push](#phase-2-slskd-wishlist-push)
8. [Phase 3: Artist Selection & Sync UI](#phase-3-artist-selection--sync-ui)
9. [Phase 4: Download Processing Service](#phase-4-download-processing-service)
10. [Phase 5: Download Processing UI (Missing Tracks Extension)](#phase-5-download-processing-ui-missing-tracks-extension)
11. [Testing & Validation](#testing--validation)
12. [Release Checklist](#release-checklist)

---

## Track Matching Algorithm

The matching algorithm determines which Spotify tracks are "missing" from your local collection. It uses a **three-tier matching strategy** to reduce false negatives while maintaining accuracy.

### Matching Tiers

| Tier | Strategy | Description |
|------|----------|-------------|
| 1 | **Exact Match** | Full normalized title + artist must match exactly |
| 2 | **Core Title Match** | Core title (without mix/version info) + artist |
| 3 | **Fuzzy Match** | 85% similarity threshold on title, exact artist |

### Normalization Rules

Before comparison, all text is normalized:

1. **Unicode normalization** (NFKC) + lowercase
2. **Remove diacritics** (`Beyoncé` → `beyonce`)
3. **Unify punctuation** (`and` → `&`, various quotes/hyphens unified)
4. **Remove special characters** (keep only alphanumeric + spaces)
5. **Collapse whitespace** (multiple spaces → single space)

### Artist Normalization

- Standard normalization applied
- **"The" prefix stripped** (`The Beatles` → `beatles`, `The Weeknd` → `weeknd`)

### Core Title Extraction

Mix/version info is extracted and ignored for Tier 2 matching:

| Original Title | Core Title |
|----------------|------------|
| `Song (Extended Mix)` | `Song` |
| `Track [Radio Edit]` | `Track` |
| `Title - Club Version` | `Title` |
| `Song (feat. Artist)` | `Song` (feature kept, not mix info) |

**Mix keywords detected:** remix, mix, edit, rework, bootleg, mashup, version, radio, club, extended, vocal, instrumental, dub, original, live, acoustic, unplugged, remaster, demo, vip

### Fuzzy Matching (Tier 3)

Uses Levenshtein distance to calculate similarity:
- **Threshold:** 85% similarity required
- **Artist must match exactly** (after normalization)
- Checks both full title and core title similarity

### Example Matches

| Spotify Track | Local Track | Tier | Match? |
|---------------|-------------|------|--------|
| `Don't Stop - The Beatles` | `Dont Stop - Beatles` | 3 (fuzzy) | ✅ |
| `Song (Club Mix) - Artist` | `Song - Artist` | 2 (core) | ✅ |
| `Track [Remastered] - Band` | `Track - Band` | 2 (core) | ✅ |
| `Title - The Weeknd` | `Title - Weeknd` | 1 (exact after "The" strip) | ✅ |
| `Completely Different - Artist` | `Song - Artist` | - | ❌ |

### Configuration

```typescript
// src/services/trackMatching.service.ts
const FUZZY_MATCH_THRESHOLD = 85; // Percentage similarity required
```

---

## Branching Strategy

This feature is developed on a **separate feature branch** and released as a complete feature once stable.

### Branch Structure

```
main
 │
 └── feature/slskd-integration
      │
      ├── Phase 1: Configuration UI
      ├── Phase 2: Wishlist Push
      ├── Phase 3: Artist Selection
      ├── Phase 4: Download Processing Service
      └── Phase 5: Download Processing UI
```

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/slskd-integration
   ```

2. **Commit strategy**
   - Commit after each phase is complete and tested
   - Use conventional commits: `feat(slskd): add configuration UI`
   - Keep commits atomic and reviewable

3. **Sync with main periodically**
   ```bash
   git fetch origin main
   git rebase origin/main
   ```

4. **Testing before merge**
   - All phases complete
   - End-to-end workflow tested
   - No regressions in existing functionality

5. **Merge to main**
   ```bash
   git checkout main
   git merge feature/slskd-integration --no-ff
   git push origin main
   ```

### Phase Commits

| Phase | Commit Message |
|-------|---------------|
| 1 | `feat(slskd): add localStorage configuration and connection test` |
| 2 | `feat(slskd): add wishlist push service with configurable search format` |
| 3 | `feat(slskd): add artist selection UI to missing tracks page` |
| 4 | `feat(slskd): add download processing service with genre mapping` |
| 5 | `feat(slskd): add download processing UI integrated into missing tracks` |

---

## slskd Installation (Native Windows)

**Recommended:** Native Windows installation (simpler path handling, no Docker overhead)

### Quick Setup

1. **Download slskd**
   - Go to [slskd releases](https://github.com/slskd/slskd/releases)
   - Download the latest `slskd-x.x.x-win-x64.zip`

2. **Extract and Run**
   ```
   C:\Tools\slskd\           ← Extract here
   └── slskd.exe             ← Run this
   ```

3. **First Run Configuration**
   - Open browser to `http://localhost:5030`
   - Login with default credentials: `slskd` / `slskd`
   - Go to **Options** → Set your Soulseek username/password
   - Go to **Options** → **Directories** → Set downloads folder (e.g., `D:\Downloads\slskd`)
   - Go to **Options** → **API** → Enable API and copy your API key

4. **Enable Auto-Download for Wishlist**
   - Go to **Options** → **Downloads**
   - Enable "Auto-download wishlist results"
   - Configure quality preferences (320kbps MP3 recommended)

### Configuration File

After first run, edit `%LOCALAPPDATA%\slskd\slskd.yml`:

```yaml
soulseek:
  username: your_username
  password: your_password

directories:
  downloads: D:\Downloads\slskd

web:
  port: 5030
  api_keys:
    - name: mako-sync
      key: your-api-key-here
```

### Why Native Over Docker?

| Aspect | Native | Docker |
|--------|--------|--------|
| **Path access** | Direct Windows paths | Requires volume mounts |
| **Setup** | Extract and run | Docker Desktop + config |
| **MediaMonkey** | Sees paths directly | Volume mapping complexity |
| **Mako Sync** | Same paths work | Mount same volumes |

For this workflow, native installation keeps everything simpler.

---

## Overview

This document defines the **end-to-end, opinionated integration** between **Mako Sync** and **slskd**, optimized for a DJ workflow where **local crates are the system of record**.

The integration is intentionally simple, resilient, and user-controlled. It avoids background services, server-side jobs, or long-lived sync state in favor of **explicit user actions**, **idempotent operations**, and tooling that can be safely re-run without fear of lock-in.

### What This Integration Does

1. **One-way sync to slskd wishlist**
   Push *missing tracks* from Mako Sync → slskd wishlist. slskd handles downloading automatically.

2. **Download processing in Mako Sync**
   TypeScript-based processing reads genre tags, maps to SuperGenre, and writes `TXXX:CUSTOM1` tag (MediaMonkey Custom 1 field).

3. **File organization via MediaMonkey**
   MediaMonkey handles moving files to Supercrates folders. Mako Sync only tags files.

4. **Fast re-runs, no lock-in**
   Users can safely re-run sync at any time. Duplicate detection is handled dynamically via slskd's API and normalized search logic, not stored sync state.

### Key Architecture Decisions

✅ **Local-only slskd configuration**
- Configuration stored in browser localStorage (not Supabase)
- No server-side storage of slskd credentials
- Simpler implementation, works offline

✅ **Supercrates are the single source of truth for SuperGenres**
- Mako Sync scans Supercrate folders directly
- MediaMonkey handles file organization (not automated)
- Download flow: `slskd → Mako Sync (tag) → MediaMonkey (organize) → Serato`

✅ **Client-side slskd integration**
- Browser makes direct REST calls to slskd
- No edge functions, queues, or background workers
- Assumes slskd is reachable from the user's machine

✅ **No persistent sync state**
- No tables tracking "what was pushed" or "what was downloaded"
- Duplicate detection happens at runtime via slskd search normalization
- Keeps the system debuggable and restart-safe

✅ **Unified genre mapping**
- `spotify_genre_map_base` + `spotify_genre_map_overrides` serve both Spotify and downloaded file genres
- Inline mapping during download processing for unknown genres
- Mako Sync explicitly owns and evolves this mapping

### Non-Goals (Explicitly Out of Scope)

- ❌ Two-way sync or manual download triggering from Mako Sync
- ❌ Real-time background monitoring of slskd
- ❌ Audio fingerprinting or waveform matching
- ❌ Server-side control of local files
- ❌ Automated file organization (MediaMonkey handles this)
- ❌ Server-side storage of slskd credentials

---

## End-to-End Workflow

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
           ▼ (search: "Primary Artist - Title")
┌──────────────────────┐
│ slskd Wishlist       │
│ - Auto-download      │
│ - Downloads to dir   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│ Mako Sync "Process Downloads"│
│ - Scan download folder       │
│ - Read ID3 genre tags        │
│ - Map to SuperGenre          │
│ - Inline mapping for unknown │
│ - Write TXXX:CUSTOM1 tag     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────┐
│ MediaMonkey          │
│ - Review tagged files│
│ - Move to Supercrates│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Supercrates/[genre]/ │
└──────────┬───────────┘
           │
           ├─────────┬
           ▼         ▼
      Mako Sync  Serato
      (re-scan)  (use)
```

### Weekly Cycle

**Daily:**
1. Run Mako Sync "Missing Tracks" analysis
2. Select artists → Push to slskd
3. slskd auto-downloads overnight

**Weekly:**
1. Run "Process Downloads" in Mako Sync
2. Map any unknown genres inline
3. Review in MediaMonkey, organize to Supercrates
4. Re-scan in Mako Sync

**Rest of week:**
- Use tracks in Serato for gigs
- Repeat as needed

---

## Phase 1: Local Configuration & Storage

**Priority:** HIGH - Start here
**Dependencies:** None
**Branch:** `feature/slskd-integration`

### Objective

Create localStorage-based configuration for slskd and build configuration UI. No Supabase tables needed.

### localStorage Schema

Configuration stored under key `mako-sync:slskd-config`:

```typescript
interface SlskdLocalConfig {
  apiEndpoint: string;           // e.g., "http://localhost:5030"
  apiKey: string;                // slskd API key
  downloadsFolder: string;       // e.g., "D:\Downloads\slskd"
  searchFormat: 'primary' | 'full';  // Search query format preference
  lastConnectionTest?: string;   // ISO timestamp
  connectionStatus: boolean;     // Last known connection status
}
```

### TypeScript Types

**File:** `src/types/slskd.ts`

```typescript
export interface SlskdConfig {
  apiEndpoint: string;
  apiKey: string;
  downloadsFolder: string;
  searchFormat: 'primary' | 'full';
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

### localStorage Service

**File:** `src/services/slskdStorage.service.ts`

```typescript
import { SlskdConfig } from '@/types/slskd';

const STORAGE_KEY = 'mako-sync:slskd-config';

const DEFAULT_CONFIG: SlskdConfig = {
  apiEndpoint: '',
  apiKey: '',
  downloadsFolder: '',
  searchFormat: 'primary',
  connectionStatus: false,
};

export class SlskdStorageService {
  /**
   * Get slskd configuration from localStorage
   */
  static getConfig(): SlskdConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save slskd configuration to localStorage
   */
  static saveConfig(config: Partial<SlskdConfig>): SlskdConfig {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }

  /**
   * Clear slskd configuration
   */
  static clearConfig(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if slskd is configured
   */
  static isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config.apiEndpoint && config.apiKey);
  }
}
```

### Configuration Hook

**File:** `src/hooks/useSlskdConfig.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { SlskdStorageService } from '@/services/slskdStorage.service';
import { SlskdClientService } from '@/services/slskdClient.service';
import { SlskdConfig } from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

export function useSlskdConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SlskdConfig>(SlskdStorageService.getConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Reload config if localStorage changes (e.g., another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mako-sync:slskd-config') {
        setConfig(SlskdStorageService.getConfig());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const saveConfig = useCallback(async (
    newConfig: Omit<SlskdConfig, 'connectionStatus' | 'lastConnectionTest'>
  ) => {
    setIsSaving(true);

    try {
      // Test connection before saving
      const testConfig = { ...newConfig, connectionStatus: false };
      const isValid = await SlskdClientService.testConnection(testConfig);

      const updated = SlskdStorageService.saveConfig({
        ...newConfig,
        connectionStatus: isValid,
        lastConnectionTest: new Date().toISOString(),
      });

      setConfig(updated);

      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'slskd configuration saved'
          : 'Could not connect to slskd. Check your endpoint and API key.',
        variant: isValid ? 'default' : 'destructive',
      });

      return isValid;
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const clearConfig = useCallback(() => {
    SlskdStorageService.clearConfig();
    setConfig(SlskdStorageService.getConfig());
  }, []);

  return {
    config,
    isConfigured: SlskdStorageService.isConfigured(),
    saveConfig,
    clearConfig,
    isSaving,
  };
}
```

### Settings UI Component

**File:** `src/components/SlskdConfigSection.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { Loader2, Info } from 'lucide-react';

export function SlskdConfigSection() {
  const { config, saveConfig, isSaving } = useSlskdConfig();

  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [downloadsFolder, setDownloadsFolder] = useState('');
  const [searchFormat, setSearchFormat] = useState<'primary' | 'full'>('primary');

  useEffect(() => {
    setApiEndpoint(config.apiEndpoint);
    setApiKey(config.apiKey);
    setDownloadsFolder(config.downloadsFolder);
    setSearchFormat(config.searchFormat);
  }, [config]);

  const handleSave = () => {
    saveConfig({ apiEndpoint, apiKey, downloadsFolder, searchFormat });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>slskd Integration</CardTitle>
            <CardDescription>
              Connect to your local slskd instance to push missing tracks to wishlist
            </CardDescription>
          </div>
          {config.connectionStatus && (
            <Badge variant="default" className="bg-green-500">
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Configuration is stored locally in your browser. It is not synced to the server.
          </AlertDescription>
        </Alert>

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
            Found in slskd Options → API. Enable the API and copy your key.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slskd-downloads">Downloads Folder</Label>
          <Input
            id="slskd-downloads"
            type="text"
            placeholder="D:\Downloads\slskd"
            value={downloadsFolder}
            onChange={(e) => setDownloadsFolder(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            The folder where slskd saves downloaded files. Used for processing downloads.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Search Query Format</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="searchFormat"
                checked={searchFormat === 'primary'}
                onChange={() => setSearchFormat('primary')}
                className="w-4 h-4"
              />
              <span>Primary artist only (Recommended)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="searchFormat"
                checked={searchFormat === 'full'}
                onChange={() => setSearchFormat('full')}
                className="w-4 h-4"
              />
              <span>Full artist string</span>
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            "Primary artist only" strips featured artists for better search results.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !apiEndpoint || !apiKey}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save & Test Connection
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Phase 1 Completion Checklist

- [ ] `src/types/slskd.ts` created
- [ ] `src/services/slskdStorage.service.ts` created
- [ ] `src/hooks/useSlskdConfig.ts` created
- [ ] `src/components/SlskdConfigSection.tsx` created
- [ ] Component added to Settings/Security page
- [ ] Test connection with real slskd instance
- [ ] Verify config persists across browser refresh
- [ ] Commit: `feat(slskd): add localStorage configuration and connection test`

---

## Phase 2: slskd Wishlist Push

**Priority:** HIGH
**Dependencies:** Phase 1 complete

### Objective

Push missing tracks to slskd wishlist with proper search query formatting.

### Service Layer

**File:** `src/services/slskdClient.service.ts`

```typescript
import { SlskdConfig, SlskdSearchResponse } from '@/types/slskd';

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
      signal: AbortSignal.timeout(10000),
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
      const session = await this.request<{ isLoggedIn: boolean }>(
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
    return this.request<SlskdSearchResponse>(
      config,
      '/api/v0/searches',
      {
        method: 'POST',
        body: JSON.stringify({ searchText }),
      }
    );
  }

  /**
   * Format search query for slskd
   * @param artist - Full artist string from Spotify
   * @param title - Track title
   * @param format - 'primary' strips featured artists, 'full' uses complete artist string
   */
  static formatSearchQuery(
    artist: string,
    title: string,
    format: 'primary' | 'full' = 'primary'
  ): string {
    let processedArtist = artist;

    if (format === 'primary') {
      // Extract primary artist only - additional artists can cause false negatives
      // Handle comma-separated: "Artist1, Artist2" → "Artist1"
      processedArtist = artist.split(',')[0].trim();
      // Also handle "feat." and "ft.": "Artist feat. Other" → "Artist"
      processedArtist = processedArtist.split(/\s+(?:feat\.?|ft\.?)\s+/i)[0].trim();
    }

    // Remove quotes and sanitize
    const sanitize = (str: string) => str.replace(/["]/g, '').trim();

    // Don't include "320 MP3" - causes false negatives on slskd
    return `${sanitize(processedArtist)} - ${sanitize(title)}`;
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

### Sync Hook

**File:** `src/hooks/useSlskdSync.ts`

```typescript
import { useMutation } from '@tanstack/react-query';
import { SlskdClientService } from '@/services/slskdClient.service';
import { SlskdStorageService } from '@/services/slskdStorage.service';
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

  const syncMutation = useMutation({
    mutationFn: async (tracks: MissingTrack[]): Promise<SlskdSyncResult> => {
      const config = SlskdStorageService.getConfig();

      if (!config.apiEndpoint || !config.apiKey) {
        throw new Error('slskd not configured. Go to Settings to configure.');
      }

      const existingSearches = await SlskdClientService.getExistingSearches(config);

      const result: SlskdSyncResult = {
        totalTracks: tracks.length,
        addedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (const track of tracks) {
        const artist = track.primary_artist || track.artist;
        const searchText = SlskdClientService.formatSearchQuery(
          artist,
          track.title,
          config.searchFormat
        );

        if (SlskdClientService.isSearchDuplicate(existingSearches, searchText)) {
          result.skippedCount++;
          continue;
        }

        try {
          await SlskdClientService.addToWishlist(config, searchText);
          result.addedCount++;
          // Add to local list to prevent duplicates within same batch
          existingSearches.push({ id: '', searchText, state: 'InProgress' });
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
  };
}
```

### Phase 2 Completion Checklist

- [ ] `src/services/slskdClient.service.ts` created
- [ ] `src/hooks/useSlskdSync.ts` created
- [ ] Search query uses configurable format (primary/full)
- [ ] Search query does NOT include "320 MP3"
- [ ] Duplicate detection works
- [ ] Test push with real slskd instance
- [ ] Commit: `feat(slskd): add wishlist push service with configurable search format`

---

## Phase 3: Artist Selection & Sync UI

**Priority:** HIGH
**Dependencies:** Phase 2 complete

### Objective

Add **artist-level selection** (not individual tracks) and progress display to Missing Tracks page. Users select artists, and all missing tracks for those artists are pushed to slskd.

### Artist Selection in Missing Tracks

The UI groups missing tracks by artist and allows selecting entire artists (not individual tracks). This keeps the workflow simple and focused.

**Key design decisions:**
- Users select **artists**, not individual tracks
- All missing tracks for selected artists are pushed to slskd
- Artist list shows track count per artist
- "Select All" / "Deselect All" for convenience

Add to `src/components/MissingTracksAnalyzer.tsx`:

```typescript
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { useSlskdSync } from '@/hooks/useSlskdSync';
import { Download, Loader2 } from 'lucide-react';

// Add state
const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
const { isConfigured } = useSlskdConfig();
const { syncToSlskd, isSyncing, syncResult } = useSlskdSync();

// Group tracks by artist
const tracksByArtist = missingTracks.reduce((acc, track) => {
  const artist = track.primary_artist || track.artist;
  if (!acc[artist]) acc[artist] = [];
  acc[artist].push(track);
  return acc;
}, {} as Record<string, typeof missingTracks>);

// Handle push
const handlePushToSlskd = () => {
  const tracksToSync = Array.from(selectedArtists).flatMap(
    artist => tracksByArtist[artist] || []
  );
  syncToSlskd(tracksToSync);
};

// Calculate selection
const selectedTrackCount = Array.from(selectedArtists).reduce(
  (count, artist) => count + (tracksByArtist[artist]?.length || 0),
  0
);
```

### Progress Modal

**File:** `src/components/SlskdSyncProgress.tsx`

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { SlskdSyncResult } from '@/types/slskd';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  result: SlskdSyncResult | null;
}

export function SlskdSyncProgress({ isOpen, onClose, isSyncing, result }: Props) {
  const progress = result
    ? ((result.addedCount + result.skippedCount + result.failedCount) / result.totalTracks) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSyncing ? 'Pushing to slskd' : 'Sync Complete'}</DialogTitle>
          <DialogDescription>
            {isSyncing ? 'Adding tracks to wishlist...' : 'Results'}
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            <Progress value={progress} />

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

            {result.errors.length > 0 && (
              <div className="text-sm text-destructive">
                <div className="font-medium">Errors:</div>
                <ul className="list-disc list-inside">
                  {result.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>{err.track}: {err.error}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>... and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {!isSyncing && <Button onClick={onClose}>Close</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 3 Completion Checklist

- [ ] Artist checkboxes added to Missing Tracks page
- [ ] "Push to slskd" button added (disabled if not configured)
- [ ] `SlskdSyncProgress.tsx` created
- [ ] Progress modal shows during sync
- [ ] Results display correctly
- [ ] Test end-to-end with slskd
- [ ] Commit: `feat(slskd): add artist selection UI to missing tracks page`

---

## Phase 4: Download Processing Service

**Priority:** MEDIUM - Build after Phase 1-3 working
**Dependencies:** Phase 3 complete, downloads available

### Objective

Process downloaded MP3s: read genres, map to SuperGenre, write `TXXX:CUSTOM1` tag.

### SuperGenre ID3 Field

MediaMonkey stores SuperGenre in **Custom 1** field:

| Property | Value |
|----------|-------|
| MediaMonkey Field | Custom 1 (Classification tab) |
| ID3v2 Frame | `TXXX` with description `CUSTOM1` |

### Processing Service

**File:** `src/services/downloadProcessor.service.ts`

```typescript
import * as mm from 'music-metadata-browser';

export interface ProcessedFile {
  filename: string;
  artist: string;
  title: string;
  genres: string[];
  superGenre: string | null;
  status: 'mapped' | 'unmapped' | 'error';
  error?: string;
}

export interface ProcessingResult {
  files: ProcessedFile[];
  unmappedGenres: string[];
}

export class DownloadProcessorService {
  /**
   * Extract metadata from MP3 file
   */
  static async extractMetadata(file: File): Promise<{
    artist: string;
    title: string;
    genres: string[];
  }> {
    const metadata = await mm.parseBlob(file);

    return {
      artist: metadata.common.artist || 'Unknown Artist',
      title: metadata.common.title || file.name.replace('.mp3', ''),
      genres: metadata.common.genre || [],
    };
  }

  /**
   * Map genre(s) to SuperGenre using the genre mapping tables
   */
  static async mapToSuperGenre(
    genres: string[],
    genreMap: Map<string, string>
  ): Promise<string | null> {
    for (const genre of genres) {
      const normalized = genre.toLowerCase().trim();

      // Check exact match
      if (genreMap.has(normalized)) {
        return genreMap.get(normalized)!;
      }

      // Check partial match
      for (const [key, superGenre] of genreMap.entries()) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return superGenre;
        }
      }
    }

    return null;
  }

  /**
   * Process a folder of downloaded files
   */
  static async processFiles(
    files: File[],
    genreMap: Map<string, string>
  ): Promise<ProcessingResult> {
    const results: ProcessedFile[] = [];
    const unmappedGenres = new Set<string>();

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.mp3')) continue;

      try {
        const metadata = await this.extractMetadata(file);
        const superGenre = await this.mapToSuperGenre(metadata.genres, genreMap);

        if (!superGenre && metadata.genres.length > 0) {
          metadata.genres.forEach(g => unmappedGenres.add(g.toLowerCase()));
        }

        results.push({
          filename: file.name,
          artist: metadata.artist,
          title: metadata.title,
          genres: metadata.genres,
          superGenre,
          status: superGenre ? 'mapped' : 'unmapped',
        });
      } catch (error: any) {
        results.push({
          filename: file.name,
          artist: 'Unknown',
          title: file.name,
          genres: [],
          superGenre: null,
          status: 'error',
          error: error.message,
        });
      }
    }

    return {
      files: results,
      unmappedGenres: Array.from(unmappedGenres),
    };
  }
}
```

### Phase 4 Completion Checklist

- [ ] `src/services/downloadProcessor.service.ts` created
- [ ] Metadata extraction works
- [ ] Genre mapping from database works
- [ ] Handles multi-genre files
- [ ] Collects unmapped genres
- [ ] Commit: `feat(slskd): add download processing service with genre mapping`

---

## Phase 5: Download Processing UI (Missing Tracks Extension)

**Priority:** MEDIUM
**Dependencies:** Phase 4 complete

### Objective

Extend the **Missing Tracks page** with download processing functionality. This keeps the workflow in one place rather than creating a separate page.

**Key design decisions:**
- Download processing is a **section/tab** within Missing Tracks, not a separate page
- Uses the configurable downloads folder from localStorage
- Inline genre mapping for unknown genres saves to `spotify_genre_map_overrides`
- **MediaMonkey handles file organization** - Mako Sync only writes the `TXXX:CUSTOM1` tag

### Extended Missing Tracks Page

Add a new section/tab to the existing Missing Tracks page.

**File:** `src/components/DownloadProcessingSection.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DownloadProcessorService, ProcessedFile } from '@/services/downloadProcessor.service';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { FolderOpen, Tag, AlertCircle } from 'lucide-react';

const SUPER_GENRES = [
  'Bass', 'Blues', 'Country', 'Dance', 'Disco', 'Drum & Bass',
  'Electronic', 'Folk', 'Hip Hop', 'House', 'Indie-Alternative',
  'Jazz', 'Latin', 'Metal', 'Pop', 'Reggae-Dancehall', 'Rock',
  'Soul-Funk', 'Techno', 'UK Garage', 'Urban', 'World'
];

interface Props {
  genreMap: Map<string, string>;
  onSaveMapping: (genre: string, superGenre: string) => Promise<void>;
}

export function DownloadProcessingSection({ genreMap, onSaveMapping }: Props) {
  const { config } = useSlskdConfig();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    setIsProcessing(true);

    const result = await DownloadProcessorService.processFiles(
      Array.from(fileList),
      genreMap
    );

    setFiles(result.files);
    setIsProcessing(false);
  };

  const handleSuperGenreChange = async (filename: string, superGenre: string) => {
    const file = files.find(f => f.filename === filename);
    if (!file) return;

    // Update local state
    setFiles(prev => prev.map(f =>
      f.filename === filename ? { ...f, superGenre, status: 'mapped' } : f
    ));

    // Save new mapping for each unmapped genre
    for (const genre of file.genres) {
      if (!genreMap.has(genre.toLowerCase())) {
        await onSaveMapping(genre, superGenre);
      }
    }
  };

  const handleApplyTags = async () => {
    const filesToTag = files.filter(f => f.superGenre);
    // TODO: Write TXXX:CUSTOM1 tags to files using File System Access API
    // Note: Browser cannot write to arbitrary paths - user must grant permission
    console.log('Applying tags to', filesToTag.length, 'files');
  };

  const mappedCount = files.filter(f => f.status === 'mapped').length;
  const unmappedCount = files.filter(f => f.status === 'unmapped').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Process Downloads
        </CardTitle>
        <CardDescription>
          Scan downloaded files, map genres to SuperGenre, and write TXXX:CUSTOM1 tags.
          MediaMonkey will then organize files to Supercrates folders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.downloadsFolder && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configured downloads folder: <code>{config.downloadsFolder}</code>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Input
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderSelect}
            disabled={isProcessing}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Select your slskd downloads folder to scan for new files
          </p>
        </div>

        {files.length > 0 && (
          <>
            <div className="flex gap-4 text-sm">
              <span>Total: {files.length}</span>
              <span className="text-green-600">Mapped: {mappedCount}</span>
              <span className="text-yellow-600">Unmapped: {unmappedCount}</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>ID3 Genre(s)</TableHead>
                  <TableHead>SuperGenre</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map(file => (
                  <TableRow key={file.filename}>
                    <TableCell className="font-medium">
                      {file.artist} - {file.title}
                    </TableCell>
                    <TableCell>
                      {file.genres.join(', ') || <span className="text-muted-foreground">No genre tag</span>}
                    </TableCell>
                    <TableCell>
                      {file.status === 'mapped' ? (
                        <Badge>{file.superGenre}</Badge>
                      ) : (
                        <Select
                          onValueChange={(v) => handleSuperGenreChange(file.filename, v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPER_GENRES.map(sg => (
                              <SelectItem key={sg} value={sg}>{sg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        file.status === 'mapped' ? 'default' :
                        file.status === 'unmapped' ? 'secondary' : 'destructive'
                      }>
                        {file.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-2">
              <Button
                onClick={handleApplyTags}
                disabled={mappedCount === 0}
              >
                <Tag className="h-4 w-4 mr-2" />
                Apply SuperGenre Tags ({mappedCount} files)
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              After tagging, use MediaMonkey to move files to your Supercrates/[genre]/ folders,
              then re-scan in Mako Sync.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### Integration with Missing Tracks Page

Add the `DownloadProcessingSection` as a collapsible section or tab within the Missing Tracks page:

```typescript
// In MissingTracksAnalyzer.tsx or parent page
import { DownloadProcessingSection } from '@/components/DownloadProcessingSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// In the render:
<Tabs defaultValue="missing">
  <TabsList>
    <TabsTrigger value="missing">Missing Tracks</TabsTrigger>
    <TabsTrigger value="downloads">Process Downloads</TabsTrigger>
  </TabsList>
  <TabsContent value="missing">
    {/* Existing missing tracks content with artist selection */}
  </TabsContent>
  <TabsContent value="downloads">
    <DownloadProcessingSection
      genreMap={genreMap}
      onSaveMapping={handleSaveMapping}
    />
  </TabsContent>
</Tabs>
```

### Phase 5 Completion Checklist

- [ ] `src/components/DownloadProcessingSection.tsx` created
- [ ] Integrated into Missing Tracks page as tab/section
- [ ] Uses configured downloads folder from localStorage
- [ ] Folder selection works
- [ ] Preview table displays files with ID3 genres
- [ ] Inline SuperGenre selection works
- [ ] New mappings saved to `spotify_genre_map_overrides`
- [ ] Tags written to files (TXXX:CUSTOM1)
- [ ] Clear messaging that MediaMonkey handles file moves
- [ ] Test end-to-end workflow
- [ ] Commit: `feat(slskd): add download processing UI integrated into missing tracks`

---

## Testing & Validation

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { SlskdClientService } from '@/services/slskdClient.service';
import { SlskdStorageService } from '@/services/slskdStorage.service';

describe('SlskdClientService', () => {
  describe('formatSearchQuery', () => {
    it('uses primary artist only when format is primary', () => {
      expect(SlskdClientService.formatSearchQuery('Artist1, Artist2', 'Title', 'primary'))
        .toBe('Artist1 - Title');
    });

    it('uses full artist when format is full', () => {
      expect(SlskdClientService.formatSearchQuery('Artist1, Artist2', 'Title', 'full'))
        .toBe('Artist1, Artist2 - Title');
    });

    it('strips feat. from primary artist', () => {
      expect(SlskdClientService.formatSearchQuery('Artist feat. Other', 'Title', 'primary'))
        .toBe('Artist - Title');
    });

    it('does not include bitrate', () => {
      expect(SlskdClientService.formatSearchQuery('Artist', 'Title', 'primary'))
        .not.toContain('320');
    });

    it('sanitizes quotes', () => {
      expect(SlskdClientService.formatSearchQuery('Artist', '"Title"', 'primary'))
        .toBe('Artist - Title');
    });
  });
});

describe('SlskdStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default config when nothing stored', () => {
    const config = SlskdStorageService.getConfig();
    expect(config.apiEndpoint).toBe('');
    expect(config.searchFormat).toBe('primary');
  });

  it('saves and retrieves config', () => {
    SlskdStorageService.saveConfig({ apiEndpoint: 'http://test:5030' });
    const config = SlskdStorageService.getConfig();
    expect(config.apiEndpoint).toBe('http://test:5030');
  });

  it('clears config', () => {
    SlskdStorageService.saveConfig({ apiEndpoint: 'http://test:5030' });
    SlskdStorageService.clearConfig();
    expect(SlskdStorageService.isConfigured()).toBe(false);
  });
});
```

### Integration Testing

- [ ] Configure slskd connection → saves to localStorage
- [ ] Config persists across browser refresh
- [ ] Push tracks to wishlist → appears in slskd
- [ ] Search query format respects preference
- [ ] Duplicate detection works
- [ ] Download processing reads genres
- [ ] Inline mapping saves to database
- [ ] TXXX:CUSTOM1 tag written correctly
- [ ] MediaMonkey sees Custom 1 field

---

## Release Checklist

### Pre-Merge Checklist

- [ ] All 5 phases complete and committed
- [ ] All tests passing
- [ ] End-to-end workflow tested with real slskd
- [ ] No regressions in existing functionality
- [ ] Code reviewed

### Merge to Main

```bash
git checkout main
git pull origin main
git merge feature/slskd-integration --no-ff -m "feat: slskd integration for missing tracks workflow"
git push origin main
```

### Post-Merge

- [ ] Deploy to production
- [ ] Test in production environment
- [ ] Document any known issues

---

## Quick Reference

### slskd API Endpoints

- GET `/api/v0/session` - Test connection
- GET `/api/v0/searches` - Get wishlist
- POST `/api/v0/searches` - Add track to wishlist

### localStorage Key

```
mako-sync:slskd-config
```

### Search Query Format

Configurable in settings:

**Primary artist only (default, recommended):**
```
Primary Artist - Title
```
Strips "feat.", "ft.", and comma-separated artists.

**Full artist string:**
```
Artist feat. Other Artist - Title
```
Uses complete artist field from Spotify.

### SuperGenre ID3 Tag

- Frame: `TXXX`
- Description: `CUSTOM1`
- MediaMonkey: Custom 1 (Classification tab)

### Responsibility Split

| Task | Owner |
|------|-------|
| Store slskd config | Browser localStorage |
| Push missing tracks to slskd | Mako Sync |
| Download files | slskd (auto-download) |
| Review downloads | MediaMonkey |
| Read ID3 genres, map to SuperGenre | Mako Sync |
| Write TXXX:CUSTOM1 tag | Mako Sync |
| Move files to Supercrates/[genre]/ | MediaMonkey |
| Re-scan library | Mako Sync |

### File Locations

```
src/
├── types/slskd.ts
├── services/
│   ├── slskdStorage.service.ts
│   ├── slskdClient.service.ts
│   └── downloadProcessor.service.ts
├── hooks/
│   ├── useSlskdConfig.ts
│   └── useSlskdSync.ts
└── components/
    ├── SlskdConfigSection.tsx
    ├── SlskdSyncProgress.tsx
    └── DownloadProcessingSection.tsx
```

Note: No separate Downloads page - processing is integrated into Missing Tracks page.
