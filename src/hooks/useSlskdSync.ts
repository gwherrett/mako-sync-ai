/**
 * useSlskdSync Hook
 *
 * TEMPORARILY DISABLED: The user_preferences table was removed from the schema.
 * This hook is stubbed out until slskd configuration is re-implemented.
 */

import type { SlskdSyncResult, SlskdTrackToSync } from '@/types/slskd';

export function useSlskdSync() {
  return {
    syncToSlskd: (_tracks: SlskdTrackToSync[]) => {
      console.warn('useSlskdSync: user_preferences table not available');
    },
    syncToSlskdAsync: async (_tracks: SlskdTrackToSync[]): Promise<SlskdSyncResult> => {
      console.warn('useSlskdSync: user_preferences table not available');
      return {
        totalTracks: 0,
        addedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: [],
      };
    },
    isSyncing: false,
    syncResult: undefined as SlskdSyncResult | undefined,
    syncError: null as Error | null,
    progress: null as { current: number; total: number; currentTrack: string } | null,
    reset: () => {},
  };
}
