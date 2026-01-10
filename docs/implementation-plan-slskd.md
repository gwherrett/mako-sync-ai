# slskd Integration - Implementation Plan

**Document Version:** 1.0
**Last Updated:** January 10, 2026
**Status:** Planning Phase
**Epic:** 4.10 - slskd Integration for Missing Track Acquisition

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Integration](#architecture-integration)
3. [Database Schema](#database-schema)
4. [Implementation Phases](#implementation-phases)
5. [Technical Specifications](#technical-specifications)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Checklist](#deployment-checklist)

---

## Overview

### Objectives

Integrate Mako Sync with slskd (Soulseek daemon) to enable automatic wishlist creation for missing tracks identified through the Music Match functionality. This is a **one-way integration** from Mako Sync to slskd.

### Success Criteria

- Users can configure slskd connection with validation
- Missing tracks can be pushed to slskd wishlist in bulk (artist-level approval)
- Duplicate entries are prevented automatically
- Sync state is tracked per track per user
- Error handling provides clear user feedback
- Multi-user scenarios work correctly (isolated configurations)

### Key Constraints

1. **Existing Architecture**: Must integrate with current MissingTracksAnalyzer component
2. **Data Model**: Use existing spotify_liked table, add minimal new tables
3. **User Experience**: Keep approval workflow simple (artist-level checkboxes)
4. **Security**: Row Level Security (RLS) for multi-user isolation

---

## Architecture Integration

### Current Architecture Analysis

**Existing Components:**
```
src/components/
├── MissingTracksAnalyzer.tsx      # Already groups by artist ✓
├── ui/                             # Shadcn components available ✓
└── common/                         # Shared components

src/services/
├── trackMatching.service.ts        # Missing track detection ✓
└── [NEW] slskdClient.service.ts    # To be created

src/hooks/
└── [NEW] useSlskdConfig.ts         # To be created

src/pages/
├── Index.tsx                       # Has Matching tab ✓
└── Security.tsx                    # Settings page - add slskd config here
```

**Integration Points:**

1. **Settings/Configuration**: Add slskd config to `/pages/Security.tsx` (existing settings page)
2. **Missing Tracks UI**: Enhance `MissingTracksAnalyzer.tsx` with selection + sync
3. **Service Layer**: Create `slskdClient.service.ts` for API communication
4. **Data Storage**: Use Supabase `user_preferences` table (create if not exists)

### Data Flow

```
┌─────────────────────────┐
│ User configures slskd   │
│ (API endpoint + key)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Test connection         │
│ GET /api/v0/session     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Save to user_preferences│
│ (Supabase RLS)          │
└─────────────────────────┘

┌─────────────────────────┐
│ Run Missing Tracks      │
│ Analysis (existing)     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Display artist groups   │
│ with checkboxes         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ User selects artists    │
│ + clicks "Push to slskd"│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ For each track in selected artists: │
│ 1. Check if already in slskd        │
│ 2. Format query: "Artist - Track    │
│    320 MP3"                          │
│ 3. POST to /api/v0/searches         │
│ 4. Update sync state                │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ Display results:        │
│ - Added count           │
│ - Skipped count         │
│ - Failed count          │
└─────────────────────────┘
```

---

## Database Schema

### New Table: `user_preferences`

```sql
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

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

-- Index for fast lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
```

### New Table: `slskd_sync_state`

Track which tracks have been synced to slskd.

```sql
CREATE TABLE IF NOT EXISTS public.slskd_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_track_id UUID NOT NULL REFERENCES public.spotify_liked(id) ON DELETE CASCADE,

  -- Sync State
  synced_to_slskd BOOLEAN DEFAULT false,
  sync_timestamp TIMESTAMPTZ,
  sync_attempts INTEGER DEFAULT 0,
  slskd_search_id TEXT,  -- ID returned from slskd API
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, spotify_track_id)
);

-- Row Level Security
ALTER TABLE public.slskd_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync state"
  ON public.slskd_sync_state
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync state"
  ON public.slskd_sync_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync state"
  ON public.slskd_sync_state
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_slskd_sync_user_id ON public.slskd_sync_state(user_id);
CREATE INDEX idx_slskd_sync_spotify_track ON public.slskd_sync_state(spotify_track_id);
CREATE INDEX idx_slskd_sync_synced ON public.slskd_sync_state(user_id, synced_to_slskd);
```

### TypeScript Interfaces

```typescript
// src/types/slskd.ts

export interface SlskdConfig {
  apiEndpoint: string;
  apiKey: string;
  lastConnectionTest?: string;
  connectionStatus: boolean;
}

export interface SlskdSyncState {
  id: string;
  userId: string;
  spotifyTrackId: string;
  syncedToSlskd: boolean;
  syncTimestamp?: string;
  syncAttempts: number;
  slskdSearchId?: string;
  lastError?: string;
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

---

## Implementation Phases

### Phase 1: Configuration & Connection (Week 1)

**Goal:** Enable users to configure and test slskd connection

**Tasks:**

1. **Database Setup** (2 hours)
   - [ ] Create migration for `user_preferences` table
   - [ ] Create migration for `slskd_sync_state` table
   - [ ] Test migrations locally
   - [ ] Apply to production (after testing)

2. **Service Layer** (4 hours)
   - [ ] Create `src/services/slskdClient.service.ts`
   - [ ] Implement `testConnection()` method (GET /api/v0/session)
   - [ ] Implement error handling for connection failures
   - [ ] Add TypeScript types in `src/types/slskd.ts`

3. **Data Hooks** (3 hours)
   - [ ] Create `src/hooks/useSlskdConfig.ts` using Tanstack Query
   - [ ] Implement `useSlskdConfig()` for fetching config
   - [ ] Implement `useSaveSlskdConfig()` mutation
   - [ ] Implement `useTestSlskdConnection()` mutation

4. **UI Components** (5 hours)
   - [ ] Add slskd config section to `src/pages/Security.tsx`
   - [ ] Form fields: API Endpoint (text input), API Key (password input)
   - [ ] "Test Connection" button with loading state
   - [ ] Connection status indicator (green/red badge)
   - [ ] Save/Cancel buttons
   - [ ] Toast notifications for success/failure

5. **Testing** (2 hours)
   - [ ] Unit tests for slskdClient service
   - [ ] Manual testing with real slskd instance
   - [ ] Test error scenarios (invalid credentials, wrong endpoint)

**Acceptance Criteria:**
- ✓ User can enter slskd credentials
- ✓ Connection test validates credentials immediately
- ✓ Success/failure feedback shown via toast
- ✓ Credentials persisted per user with RLS
- ✓ Multiple users can have different slskd configs

**Files Created:**
- `supabase/migrations/[timestamp]_create_user_preferences.sql`
- `supabase/migrations/[timestamp]_create_slskd_sync_state.sql`
- `src/types/slskd.ts`
- `src/services/slskdClient.service.ts`
- `src/hooks/useSlskdConfig.ts`

**Files Modified:**
- `src/pages/Security.tsx` (add slskd config section)

---

### Phase 2: UI Enhancement for Artist Selection (Week 2)

**Goal:** Add artist-level selection to Missing Tracks Analyzer

**Tasks:**

1. **Component Enhancement** (6 hours)
   - [ ] Modify `MissingTracksAnalyzer.tsx` to add checkboxes per artist
   - [ ] Implement select all / deselect all functionality
   - [ ] Add state management for selected artists
   - [ ] Display count of selected tracks
   - [ ] Show slskd connection status in component

2. **Button & Actions** (3 hours)
   - [ ] Add "Push to slskd Wishlist" button
   - [ ] Enable button only when:
     - slskd is connected (check via useSlskdConfig)
     - At least one artist is selected
   - [ ] Add confirmation dialog before sync
   - [ ] Show track count in confirmation message

3. **Styling** (2 hours)
   - [ ] Style checkboxes using Shadcn checkbox component
   - [ ] Add hover states for artist rows
   - [ ] Visual feedback for selected state
   - [ ] Button disabled state styling

4. **Testing** (2 hours)
   - [ ] Manual testing with various artist counts
   - [ ] Test select/deselect interactions
   - [ ] Verify button enable/disable logic
   - [ ] Test with no slskd connection configured

**Acceptance Criteria:**
- ✓ Each artist group has a checkbox
- ✓ Multiple artists can be selected
- ✓ Selected track count displayed
- ✓ Push button only enabled with connection + selection
- ✓ Confirmation dialog shows count before sync

**Files Modified:**
- `src/components/MissingTracksAnalyzer.tsx`

---

### Phase 3: slskd API Integration (Week 3)

**Goal:** Implement communication with slskd for wishlist management

**Tasks:**

1. **Service Methods** (6 hours)
   - [ ] Implement `getExistingSearches()` (GET /api/v0/searches)
   - [ ] Implement `addToWishlist()` (POST /api/v0/searches)
   - [ ] Implement query formatter: `formatSearchQuery(artist, title)`
   - [ ] Add duplicate detection logic (normalize + compare)
   - [ ] Implement retry logic with exponential backoff

2. **Sync State Management** (4 hours)
   - [ ] Create `useSlskdSyncState()` hook to fetch sync state
   - [ ] Create `useSyncToSlskd()` mutation hook
   - [ ] Implement batch sync logic (process multiple tracks)
   - [ ] Update database sync state after each track
   - [ ] Handle partial failures (some succeed, some fail)

3. **Error Handling** (3 hours)
   - [ ] Handle 401 Unauthorized → prompt re-auth
   - [ ] Handle 429 Rate Limited → backoff + retry
   - [ ] Handle 500 Server Error → log + mark for retry
   - [ ] Handle network timeout → stop + preserve state
   - [ ] Handle connection loss mid-sync

4. **Testing** (3 hours)
   - [ ] Unit tests for query formatting
   - [ ] Unit tests for duplicate detection
   - [ ] Integration tests with mock slskd API
   - [ ] Manual testing with real slskd instance
   - [ ] Test error scenarios (connection loss, rate limit)

**Acceptance Criteria:**
- ✓ Duplicates are detected and skipped
- ✓ Queries formatted correctly ("Artist - Title 320 MP3")
- ✓ Sync state tracked per track in database
- ✓ Errors handled gracefully with user feedback
- ✓ Retry logic works for transient failures

**Files Created:**
- `src/hooks/useSlskdSync.ts`

**Files Modified:**
- `src/services/slskdClient.service.ts` (add methods)

---

### Phase 4: Sync Progress & Results UI (Week 4)

**Goal:** Display sync progress and results to user

**Tasks:**

1. **Progress Component** (4 hours)
   - [ ] Create `SlskdSyncProgress.tsx` component
   - [ ] Show progress bar (X/Y tracks synced)
   - [ ] Display real-time status updates during sync
   - [ ] Show spinner/loading state during processing
   - [ ] Update progress as each track completes

2. **Results Display** (3 hours)
   - [ ] Show summary after sync completes:
     - Total tracks processed
     - Successfully added count
     - Skipped duplicates count
     - Failed count with error list
   - [ ] Add "Retry Failed" button (if failures exist)
   - [ ] Add "Close" button to dismiss results

3. **Integration** (3 hours)
   - [ ] Integrate progress component into `MissingTracksAnalyzer`
   - [ ] Wire up state from `useSyncToSlskd` hook
   - [ ] Handle sync completion → show results
   - [ ] Handle retry → re-run failed tracks only

4. **Visual Feedback** (2 hours)
   - [ ] Success toast when sync completes
   - [ ] Error toasts for individual failures
   - [ ] Visual indicators on artist rows (synced/pending/failed)
   - [ ] Disable sync button while sync in progress

5. **Testing** (2 hours)
   - [ ] Test with small dataset (1-2 artists)
   - [ ] Test with large dataset (10+ artists, 100+ tracks)
   - [ ] Test partial failures (some succeed, some fail)
   - [ ] Test retry functionality

**Acceptance Criteria:**
- ✓ Real-time progress shown during sync
- ✓ Results summary displayed after completion
- ✓ Failed tracks can be retried
- ✓ User receives clear feedback at each step
- ✓ UI prevents duplicate sync operations

**Files Created:**
- `src/components/SlskdSyncProgress.tsx`

**Files Modified:**
- `src/components/MissingTracksAnalyzer.tsx` (integrate progress)

---

### Phase 5: Testing & Refinement (Week 5)

**Goal:** Comprehensive testing and bug fixes

**Tasks:**

1. **Unit Tests** (4 hours)
   - [ ] Test query formatting edge cases
   - [ ] Test duplicate detection logic
   - [ ] Test error handling in slskdClient
   - [ ] Test sync state management hooks
   - [ ] Achieve >80% code coverage for new code

2. **Integration Tests** (4 hours)
   - [ ] Test full flow: config → select → sync → results
   - [ ] Test multi-user scenarios (different configs)
   - [ ] Test with real slskd instance (manual)
   - [ ] Test network failure scenarios
   - [ ] Test rate limiting behavior

3. **Performance Testing** (3 hours)
   - [ ] Test with 100+ missing tracks
   - [ ] Test with 50+ artists
   - [ ] Measure API call rate (avoid rate limits)
   - [ ] Optimize batch processing if needed
   - [ ] Test UI responsiveness during sync

4. **Bug Fixes & Polish** (4 hours)
   - [ ] Fix any issues found during testing
   - [ ] Improve error messages for clarity
   - [ ] Add loading skeletons where appropriate
   - [ ] Improve accessibility (keyboard navigation, ARIA labels)
   - [ ] Code review and refactoring

5. **Documentation** (2 hours)
   - [ ] Update user documentation with slskd setup steps
   - [ ] Document slskd API endpoints used
   - [ ] Add troubleshooting guide
   - [ ] Update README with slskd integration info

**Acceptance Criteria:**
- ✓ All tests passing
- ✓ Performance acceptable with large datasets
- ✓ Error messages helpful and actionable
- ✓ Multi-user scenarios verified
- ✓ Documentation complete

---

## Technical Specifications

### slskd API Client Service

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
   * GET /api/v0/session
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
   * GET /api/v0/searches
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
   * POST /api/v0/searches
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
   * Format: "Artist - Track Title 320 MP3"
   */
  static formatSearchQuery(artist: string, title: string): string {
    // Sanitize special characters
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

### Sync Hook

**File:** `src/hooks/useSlskdSync.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlskdClientService } from '@/services/slskdClient.service';
import { supabase } from '@/integrations/supabase/client';
import { SlskdSyncResult } from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

interface MissingTrack {
  spotifyTrack: {
    id: string;
    title: string;
    artist: string;
  };
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
        const searchText = SlskdClientService.formatSearchQuery(
          track.spotifyTrack.artist,
          track.spotifyTrack.title
        );

        // Check for duplicate
        if (SlskdClientService.isSearchDuplicate(existingSearches, searchText)) {
          result.skippedCount++;
          continue;
        }

        try {
          // Add to wishlist
          const searchResult = await SlskdClientService.addToWishlist(config, searchText);

          // Update sync state
          await supabase.from('slskd_sync_state').upsert({
            user_id: user.id,
            spotify_track_id: track.spotifyTrack.id,
            synced_to_slskd: true,
            sync_timestamp: new Date().toISOString(),
            sync_attempts: 1,
            slskd_search_id: searchResult.id,
          });

          result.addedCount++;
        } catch (error: any) {
          result.failedCount++;
          result.errors.push({
            track: `${track.spotifyTrack.artist} - ${track.spotifyTrack.title}`,
            error: error.message || 'Unknown error',
          });

          // Update sync state with error
          await supabase.from('slskd_sync_state').upsert({
            user_id: user.id,
            spotify_track_id: track.spotifyTrack.id,
            synced_to_slskd: false,
            sync_attempts: 1,
            last_error: error.message,
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
      queryClient.invalidateQueries({ queryKey: ['slskd-sync-state'] });
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

---

## Testing Strategy

### Unit Tests

**File:** `src/__tests__/slskdClient.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SlskdClientService } from '@/services/slskdClient.service';

describe('SlskdClientService', () => {
  describe('formatSearchQuery', () => {
    it('should format basic query correctly', () => {
      const result = SlskdClientService.formatSearchQuery('Pink Floyd', 'Time');
      expect(result).toBe('Pink Floyd - Time 320 MP3');
    });

    it('should sanitize quotes', () => {
      const result = SlskdClientService.formatSearchQuery('Artist', '"Song Title"');
      expect(result).toBe('Artist - Song Title 320 MP3');
    });

    it('should handle special characters', () => {
      const result = SlskdClientService.formatSearchQuery('AC/DC', 'T.N.T.');
      expect(result).toBe('AC/DC - T.N.T. 320 MP3');
    });
  });

  describe('normalizeSearchText', () => {
    it('should normalize to lowercase', () => {
      const result = SlskdClientService.normalizeSearchText('Pink Floyd - Time 320 MP3');
      expect(result).toBe('pink floyd time 320 mp3');
    });

    it('should remove special characters', () => {
      const result = SlskdClientService.normalizeSearchText('Artist - "Song" (Remix)');
      expect(result).toBe('artist song remix');
    });

    it('should collapse whitespace', () => {
      const result = SlskdClientService.normalizeSearchText('Artist   -   Song');
      expect(result).toBe('artist song');
    });
  });

  describe('isSearchDuplicate', () => {
    const existingSearches = [
      { id: '1', searchText: 'Pink Floyd - Time 320 MP3', state: 'InProgress' as const },
      { id: '2', searchText: 'Radiohead - Karma Police 320 MP3', state: 'Completed' as const },
    ];

    it('should detect exact duplicate', () => {
      const isDupe = SlskdClientService.isSearchDuplicate(
        existingSearches,
        'Pink Floyd - Time 320 MP3'
      );
      expect(isDupe).toBe(true);
    });

    it('should detect normalized duplicate', () => {
      const isDupe = SlskdClientService.isSearchDuplicate(
        existingSearches,
        'PINK FLOYD - TIME 320 MP3'
      );
      expect(isDupe).toBe(true);
    });

    it('should not flag non-duplicate', () => {
      const isDupe = SlskdClientService.isSearchDuplicate(
        existingSearches,
        'New Artist - New Song 320 MP3'
      );
      expect(isDupe).toBe(false);
    });
  });
});
```

### Integration Test Checklist

- [ ] **Full Flow Test**: Config → Select → Sync → Results
- [ ] **Multi-user Test**: User A and User B with different configs
- [ ] **Error Recovery**: Network failure mid-sync, retry succeeds
- [ ] **Duplicate Prevention**: Same track not added twice
- [ ] **Rate Limiting**: Graceful handling of 429 responses
- [ ] **Large Dataset**: 100+ tracks sync successfully

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing (`npm test`)
- [ ] All integration tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Migrations tested locally
- [ ] Environment variables configured (none needed for this feature)

### Database Migration

1. [ ] Backup production database
2. [ ] Apply migration: `user_preferences` table
3. [ ] Apply migration: `slskd_sync_state` table
4. [ ] Verify RLS policies active
5. [ ] Test with production credentials

### Frontend Deployment

1. [ ] Build production bundle (`npm run build`)
2. [ ] Deploy to Vercel/hosting platform
3. [ ] Verify deployment successful
4. [ ] Test in production environment

### Post-Deployment Validation

- [ ] Test slskd config save/load
- [ ] Test connection to real slskd instance
- [ ] Test sync with small dataset (1-2 tracks)
- [ ] Test sync with larger dataset (10+ tracks)
- [ ] Verify error handling (disconnect slskd mid-sync)
- [ ] Check database for correct RLS isolation
- [ ] Monitor logs for errors

### Rollback Plan

If critical issues found:
1. Revert frontend deployment to previous version
2. Database tables can remain (no breaking changes)
3. Users won't see slskd features in old UI version
4. Investigate and fix issues before redeployment

---

## Risk Mitigation

### High Risks

1. **slskd API Changes**
   - **Mitigation**: Version pin if possible, monitor slskd releases
   - **Impact**: High - integration breaks
   - **Likelihood**: Low

2. **Network Reliability**
   - **Mitigation**: Robust retry logic, state preservation
   - **Impact**: Medium - sync failures
   - **Likelihood**: Medium

3. **Rate Limiting**
   - **Mitigation**: Delay between requests, exponential backoff
   - **Impact**: Medium - slow syncs
   - **Likelihood**: Medium

### Medium Risks

1. **Special Characters in Track Names**
   - **Mitigation**: Comprehensive sanitization, test with edge cases
   - **Impact**: Low - search failures
   - **Likelihood**: Medium

2. **Large Datasets**
   - **Mitigation**: Batch processing, progress updates
   - **Impact**: Low - UI freezes
   - **Likelihood**: Medium

### Low Risks

1. **Configuration Storage Corruption**
   - **Mitigation**: Database backups, validation on save
   - **Impact**: Low - re-enter config
   - **Likelihood**: Low

---

## Success Metrics

### Technical Metrics

- **Connection Success Rate**: >95% of valid credentials connect
- **Sync Accuracy**: 100% of approved tracks added or properly retried
- **Duplicate Prevention**: 0% duplicate additions
- **Error Recovery**: Failed tracks automatically retryable

### User Experience Metrics

- **Configuration Time**: <2 minutes to set up slskd connection
- **Sync Speed**: <5 seconds per track on average
- **Error Clarity**: Users understand errors and how to fix them
- **Feature Adoption**: 50%+ of users with missing tracks try slskd sync

---

## Future Enhancements

These are out of scope for initial implementation but documented for future consideration:

1. **Bi-directional Sync**: Import download status from slskd
2. **Advanced Filtering**: Quality preferences (FLAC, 256kbps, etc.)
3. **Batch Operations**: Sync all missing without approval
4. **Scheduled Syncs**: Automatic periodic sync
5. **Download Monitoring**: Track progress within Mako Sync
6. **Album-Level Approval**: Group by album instead of artist
7. **Search Result Preview**: Show slskd results before adding
8. **Priority Queue**: User-defined priority for tracks
9. **Notifications**: Alert when downloads complete
10. **Analytics Dashboard**: Stats on sync activity

---

**Implementation Owner**: [To be assigned]
**Estimated Total Effort**: 5 weeks (1 developer)
**Target Completion**: [To be scheduled]
