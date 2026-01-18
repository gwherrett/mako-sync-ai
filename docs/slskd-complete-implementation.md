# Mako Sync slskd Complete Implementation Guide

**Document Version:** 2.0
**Last Updated:** January 17, 2026
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [End-to-End Workflow](#end-to-end-workflow)
3. [Phase 1: slskd Database & Configuration UI](#phase-1-slskd-database--configuration-ui)
4. [Phase 2: slskd Wishlist Push](#phase-2-slskd-wishlist-push)
5. [Phase 3: Sync Progress UI](#phase-3-sync-progress-ui)
6. [Phase 4: Download Processing Service](#phase-4-download-processing-service)
7. [Phase 5: Download Processing UI](#phase-5-download-processing-ui)
8. [Testing & Validation](#testing--validation)
9. [Deployment Checklist](#deployment-checklist)

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

## Phase 1: slskd Database & Configuration UI

**Priority:** HIGH - Start here
**Dependencies:** Supabase access

### Objective

Create database table to store slskd configuration per user and build configuration UI.

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
```

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

  const saveMutation = useMutation({
    mutationFn: async (newConfig: Omit<SlskdConfig, 'connectionStatus' | 'lastConnectionTest'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const testConfig = { ...newConfig, connectionStatus: false };
      const isValid = await SlskdClientService.testConnection(testConfig);

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
  });

  return {
    config,
    isLoading,
    saveConfig: saveMutation.mutate,
    isSaving: saveMutation.isPending,
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
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { Loader2 } from 'lucide-react';

export function SlskdConfigSection() {
  const { config, isLoading, saveConfig, isSaving } = useSlskdConfig();

  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (config) {
      setApiEndpoint(config.apiEndpoint);
      setApiKey(config.apiKey);
    }
  }, [config]);

  const handleSave = () => {
    saveConfig({ apiEndpoint, apiKey });
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
              Connect to your slskd instance to push missing tracks to wishlist
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
            Found in slskd settings under API. Configure auto-download in slskd for best results.
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

- [ ] Migration file created
- [ ] Migration applied to database
- [ ] `src/types/slskd.ts` created
- [ ] `src/hooks/useSlskdConfig.ts` created
- [ ] `src/components/SlskdConfigSection.tsx` created
- [ ] Component added to Settings/Security page
- [ ] Test connection with real slskd instance

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
   * IMPORTANT: Use primary artist only (before comma) and don't include bitrate
   */
  static formatSearchQuery(artist: string, title: string): string {
    // Extract primary artist only - additional artists cause false negatives
    const primaryArtist = artist.split(',')[0].trim();

    // Remove quotes and sanitize
    const sanitize = (str: string) => str.replace(/["]/g, '').trim();

    // Don't include "320 MP3" - causes false negatives on slskd
    return `${sanitize(primaryArtist)} - ${sanitize(title)}`;
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

  const syncMutation = useMutation({
    mutationFn: async (tracks: MissingTrack[]): Promise<SlskdSyncResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
        const searchText = SlskdClientService.formatSearchQuery(artist, track.title);

        if (SlskdClientService.isSearchDuplicate(existingSearches, searchText)) {
          result.skippedCount++;
          continue;
        }

        try {
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
  };
}
```

### Phase 2 Completion Checklist

- [ ] `src/services/slskdClient.service.ts` created
- [ ] `src/hooks/useSlskdSync.ts` created
- [ ] Search query uses primary artist only (no commas)
- [ ] Search query does NOT include "320 MP3"
- [ ] Duplicate detection works
- [ ] Test push with real slskd instance

---

## Phase 3: Sync Progress UI

**Priority:** HIGH
**Dependencies:** Phase 2 complete

### Objective

Add artist selection and progress display to Missing Tracks page.

### Artist Selection in Missing Tracks

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
const { config } = useSlskdConfig();
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
- [ ] "Push to slskd" button added
- [ ] `SlskdSyncProgress.tsx` created
- [ ] Progress modal shows during sync
- [ ] Results display correctly
- [ ] Test end-to-end with slskd

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

---

## Phase 5: Download Processing UI

**Priority:** MEDIUM
**Dependencies:** Phase 4 complete

### Objective

Build UI for processing downloads with inline genre mapping.

### Processing Page

**File:** `src/pages/Downloads.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DownloadProcessorService, ProcessedFile } from '@/services/downloadProcessor.service';

const SUPER_GENRES = [
  'Bass', 'Blues', 'Country', 'Dance', 'Disco', 'Drum & Bass',
  'Electronic', 'Folk', 'Hip Hop', 'House', 'Indie-Alternative',
  'Jazz', 'Latin', 'Metal', 'Pop', 'Reggae-Dancehall', 'Rock',
  'Soul-Funk', 'Techno', 'UK Garage', 'Urban', 'World'
];

export default function Downloads() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    setIsProcessing(true);

    // TODO: Load genre map from database
    const genreMap = new Map<string, string>();

    const result = await DownloadProcessorService.processFiles(
      Array.from(fileList),
      genreMap
    );

    setFiles(result.files);
    setIsProcessing(false);
  };

  const handleSuperGenreChange = (filename: string, superGenre: string) => {
    setFiles(prev => prev.map(f =>
      f.filename === filename ? { ...f, superGenre, status: 'mapped' } : f
    ));
    // TODO: Save new mapping to spotify_genre_map_overrides
  };

  const handleApplyTags = async () => {
    // TODO: Write TXXX:CUSTOM1 tags to files
    console.log('Applying tags to', files.filter(f => f.superGenre));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Process Downloads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              Select your slskd downloads folder
            </p>
          </div>

          {files.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Genre(s)</TableHead>
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
                        {file.genres.join(', ') || 'No genre'}
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

              <Button
                onClick={handleApplyTags}
                disabled={!files.some(f => f.superGenre)}
              >
                Apply SuperGenre Tags
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Phase 5 Completion Checklist

- [ ] `src/pages/Downloads.tsx` created
- [ ] Route added to App.tsx
- [ ] Folder selection works
- [ ] Preview table displays files
- [ ] Inline SuperGenre selection works
- [ ] New mappings saved to database
- [ ] Tags written to files (TXXX:CUSTOM1)
- [ ] Test end-to-end workflow

---

## Testing & Validation

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { SlskdClientService } from '@/services/slskdClient.service';

describe('SlskdClientService', () => {
  describe('formatSearchQuery', () => {
    it('uses primary artist only', () => {
      expect(SlskdClientService.formatSearchQuery('Artist1, Artist2', 'Title'))
        .toBe('Artist1 - Title');
    });

    it('does not include bitrate', () => {
      expect(SlskdClientService.formatSearchQuery('Artist', 'Title'))
        .not.toContain('320');
    });

    it('sanitizes quotes', () => {
      expect(SlskdClientService.formatSearchQuery('Artist', '"Title"'))
        .toBe('Artist - Title');
    });
  });
});
```

### Integration Testing

- [ ] Configure slskd connection → save works
- [ ] Push tracks to wishlist → appears in slskd
- [ ] No "320 MP3" in search queries
- [ ] Comma-separated artists handled correctly
- [ ] Duplicate detection works
- [ ] Download processing reads genres
- [ ] Inline mapping saves to database
- [ ] TXXX:CUSTOM1 tag written correctly
- [ ] MediaMonkey sees Custom 1 field

---

## Deployment Checklist

### Pre-Deployment

- [ ] All phases complete
- [ ] All tests passing
- [ ] Database migration tested locally

### Database Migration

- [ ] Apply user_preferences migration
- [ ] Verify RLS policies active

### Frontend Deployment

- [ ] Build production bundle: `npm run build`
- [ ] Deploy to hosting
- [ ] Test in production

### Post-Deployment

- [ ] Test slskd config in production
- [ ] Test wishlist push with real tracks
- [ ] Verify download processing works
- [ ] Confirm MediaMonkey compatibility

---

## Quick Reference

### slskd API Endpoints

- GET `/api/v0/session` - Test connection
- GET `/api/v0/searches` - Get wishlist
- POST `/api/v0/searches` - Add track to wishlist

### Search Query Format

```
Primary Artist - Title
```
(No commas, no bitrate, no format)

### SuperGenre ID3 Tag

- Frame: `TXXX`
- Description: `CUSTOM1`
- MediaMonkey: Custom 1 (Classification tab)

### File Locations

```
src/
├── types/slskd.ts
├── services/
│   ├── slskdClient.service.ts
│   └── downloadProcessor.service.ts
├── hooks/
│   ├── useSlskdConfig.ts
│   └── useSlskdSync.ts
├── components/
│   ├── SlskdConfigSection.tsx
│   └── SlskdSyncProgress.tsx
└── pages/
    └── Downloads.tsx
```
