/**
 * useSlskdSync Hook
 *
 * Handles syncing missing tracks to slskd wishlist.
 * Manages the push operation state and results.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SlskdClientService } from '@/services/slskdClient.service';
import { supabase } from '@/integrations/supabase/client';
import type {
  SlskdSyncResult,
  SlskdTrackToSync,
  SlskdConfig,
} from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

export function useSlskdSync() {
  const { toast } = useToast();
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentTrack: string;
  } | null>(null);

  const syncMutation = useMutation({
    mutationFn: async (
      tracks: SlskdTrackToSync[]
    ): Promise<SlskdSyncResult> => {
      // Get user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get slskd config
      const { data: prefs, error: prefsError } = await supabase
        .from('user_preferences')
        .select('slskd_api_endpoint, slskd_api_key')
        .eq('user_id', user.id)
        .single();

      if (prefsError || !prefs?.slskd_api_endpoint || !prefs?.slskd_api_key) {
        throw new Error(
          'slskd not configured. Please configure slskd in Settings.'
        );
      }

      const config: SlskdConfig = {
        apiEndpoint: prefs.slskd_api_endpoint,
        apiKey: prefs.slskd_api_key,
        connectionStatus: true,
      };

      // Test connection first
      const isConnected = await SlskdClientService.testConnection(config);
      if (!isConnected) {
        throw new Error(
          'Cannot connect to slskd. Please check your configuration.'
        );
      }

      // Get existing searches to avoid duplicates
      const existingSearches =
        await SlskdClientService.getExistingSearches(config);

      const result: SlskdSyncResult = {
        totalTracks: tracks.length,
        addedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: [],
      };

      // Process each track
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const artist = track.primary_artist || track.artist;
        const searchText = SlskdClientService.formatSearchQuery(
          artist,
          track.title
        );

        // Update progress
        setProgress({
          current: i + 1,
          total: tracks.length,
          currentTrack: `${artist} - ${track.title}`,
        });

        // Check for duplicate
        if (
          SlskdClientService.isSearchDuplicate(existingSearches, searchText)
        ) {
          result.skippedCount++;
          continue;
        }

        try {
          // Add to wishlist
          const response = await SlskdClientService.addToWishlist(
            config,
            searchText
          );

          // Add to existing searches to catch duplicates within batch
          existingSearches.push(response);
          result.addedCount++;
        } catch (error: unknown) {
          result.failedCount++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            track: `${artist} - ${track.title}`,
            error: errorMessage,
          });
        }

        // Small delay to avoid rate limiting (100ms between requests)
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Clear progress
      setProgress(null);

      return result;
    },
    onSuccess: (result) => {
      const parts = [];
      if (result.addedCount > 0) parts.push(`${result.addedCount} added`);
      if (result.skippedCount > 0)
        parts.push(`${result.skippedCount} skipped`);
      if (result.failedCount > 0) parts.push(`${result.failedCount} failed`);

      toast({
        title: 'Sync Complete',
        description: parts.join(', ') || 'No tracks processed',
        variant: result.failedCount > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error: Error) => {
      setProgress(null);
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    syncToSlskd: syncMutation.mutate,
    syncToSlskdAsync: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
    progress,
    reset: syncMutation.reset,
  };
}
