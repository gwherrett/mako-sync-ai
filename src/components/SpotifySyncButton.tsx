import React, { useEffect, useState, useRef } from 'react';
import { Loader2, Clock, RefreshCw, Play, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnifiedSpotifyAuth } from '@/hooks/useUnifiedSpotifyAuth';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SyncProgressData {
  tracks_processed: number;
  total_tracks: number | null;
  is_full_sync: boolean;
  new_tracks_added: number;
  last_sync_completed_at: string | null;
  status: 'in_progress' | 'completed' | 'failed';
  created_at: string;
  estimated_completion?: string;
}

const SpotifySyncButton = () => {
  const { isConnected, isLoading, isSyncing, connectSpotify, syncLikedSongs } = useUnifiedSpotifyAuth();
  const [syncProgress, setSyncProgress] = useState<SyncProgressData | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<{
    last_completed: string | null;
    total_synced: number;
  } | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
  
  // Add toast debouncing refs
  const lastToastRef = useRef<string | null>(null);
  const toastDebounce = useRef<NodeJS.Timeout | null>(null);

  // Calculate estimated time remaining
  const calculateEstimatedTime = (progress: SyncProgressData) => {
    if (!progress.total_tracks || progress.tracks_processed === 0) return null;
    
    const startTime = new Date(progress.created_at).getTime();
    const currentTime = Date.now();
    const elapsedMs = currentTime - startTime;
    const tracksPerMs = progress.tracks_processed / elapsedMs;
    const remainingTracks = progress.total_tracks - progress.tracks_processed;
    const estimatedRemainingMs = remainingTracks / tracksPerMs;
    
    const minutes = Math.ceil(estimatedRemainingMs / (1000 * 60));
    if (minutes < 1) return "Less than 1 minute";
    if (minutes === 1) return "About 1 minute";
    return `About ${minutes} minutes`;
  };

  useEffect(() => {
    if (!isConnected) return;

    // Check for in-progress sync and last sync info on mount
    const checkProgress = async () => {
      // Check for in-progress sync
      const { data: progressData } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('status', 'in_progress')
        .maybeSingle();

      if (progressData) {
        const progress: SyncProgressData = {
          tracks_processed: progressData.tracks_processed,
          total_tracks: progressData.total_tracks,
          is_full_sync: progressData.is_full_sync,
          new_tracks_added: progressData.new_tracks_added,
          last_sync_completed_at: progressData.last_sync_completed_at,
          status: progressData.status as 'in_progress' | 'completed' | 'failed',
          created_at: progressData.created_at
        };
        setSyncProgress(progress);
        
        const estimatedTime = calculateEstimatedTime(progress);
        setEstimatedTimeRemaining(estimatedTime);
      }

      // Get last sync info
      const { data: lastSync } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('status', 'completed')
        .order('last_sync_completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync) {
        setLastSyncInfo({
          last_completed: lastSync.last_sync_completed_at,
          total_synced: lastSync.tracks_processed
        });
      }
    };

    checkProgress();

    // Subscribe to sync progress updates
    const channel = supabase
      .channel('sync-progress-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_progress'
        },
        (payload: any) => {
          if (payload.new?.status === 'in_progress') {
            const progress: SyncProgressData = {
              tracks_processed: payload.new.tracks_processed,
              total_tracks: payload.new.total_tracks,
              is_full_sync: payload.new.is_full_sync,
              new_tracks_added: payload.new.new_tracks_added,
              last_sync_completed_at: payload.new.last_sync_completed_at,
              status: payload.new.status as 'in_progress' | 'completed' | 'failed',
              created_at: payload.new.created_at
            };
            setSyncProgress(progress);
            
            // Calculate and update estimated time
            const estimatedTime = calculateEstimatedTime(progress);
            setEstimatedTimeRemaining(estimatedTime);
            
            // Show enhanced toast with progress and sync type
            if (progress.total_tracks) {
              const percentage = Math.round((progress.tracks_processed / progress.total_tracks) * 100);
              const syncType = progress.is_full_sync ? "Full Sync" : "Incremental Sync";
              const toastKey = `${progress.tracks_processed}-${progress.total_tracks}`;
              
              // Only show toast if it's different from last one
              if (lastToastRef.current !== toastKey) {
                if (toastDebounce.current) clearTimeout(toastDebounce.current);
                toastDebounce.current = setTimeout(() => {
                  lastToastRef.current = toastKey;
                  toast({
                    title: `${syncType} in progress`,
                    description: `${progress.tracks_processed} / ${progress.total_tracks} tracks (${percentage}%) • ${progress.new_tracks_added} new tracks`,
                  });
                }, 500); // Debounce toasts by 500ms
              }
            }
          } else if (payload.new?.status === 'completed') {
            const completedSync = payload.new;
            setSyncProgress(null);
            setEstimatedTimeRemaining(null);
            
            // Update last sync info
            setLastSyncInfo({
              last_completed: completedSync.last_sync_completed_at,
              total_synced: completedSync.tracks_processed
            });
            
            const syncType = completedSync.is_full_sync ? "Full sync" : "Incremental sync";
            toast({
              title: "Sync completed",
              description: `${syncType} finished • ${completedSync.new_tracks_added} new tracks added`,
            });
          } else if (payload.new?.status === 'failed') {
            setSyncProgress(null);
            setEstimatedTimeRemaining(null);
            toast({
              title: "Sync failed",
              description: "An error occurred during sync. You can resume from where it left off.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConnected]);

  if (isLoading) {
    return (
      <Button disabled className="spotify-gradient text-black font-medium">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Checking...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button 
        onClick={connectSpotify}
        className="spotify-gradient text-black font-medium hover:opacity-90 transition-opacity"
      >
        Connect Spotify
      </Button>
    );
  }

  const progressPercentage = syncProgress && syncProgress.total_tracks 
    ? (syncProgress.tracks_processed / syncProgress.total_tracks) * 100 
    : 0;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <Button 
          onClick={() => syncLikedSongs(false)}
          disabled={isSyncing}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 transition-colors shadow-lg flex-1"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            'Sync Liked Songs'
          )}
        </Button>
        
        <Button 
          onClick={() => syncLikedSongs(true)}
          disabled={isSyncing}
          variant="outline"
          className="px-4 py-2 transition-colors"
          title="Clear all songs and re-sync from scratch"
        >
          Force Full Sync
        </Button>
      </div>
      
      {syncProgress && syncProgress.total_tracks && (
        <div className="space-y-1">
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {syncProgress.tracks_processed} / {syncProgress.total_tracks} tracks
          </p>
        </div>
      )}
    </div>
  );
};

export default SpotifySyncButton;