import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

const SpotifySyncButton = () => {
  const { isConnected, isLoading, isSyncing, connectSpotify, syncLikedSongs } = useSpotifyAuth();
  const [syncProgress, setSyncProgress] = useState<{
    tracks_processed: number;
    total_tracks: number | null;
  } | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Check for in-progress sync on mount
    const checkProgress = async () => {
      const { data } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('status', 'in_progress')
        .maybeSingle();

      if (data) {
        setSyncProgress({
          tracks_processed: data.tracks_processed,
          total_tracks: data.total_tracks
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
            const progress = {
              tracks_processed: payload.new.tracks_processed,
              total_tracks: payload.new.total_tracks
            };
            setSyncProgress(progress);
            
            // Show toast with progress
            if (progress.total_tracks) {
              const percentage = Math.round((progress.tracks_processed / progress.total_tracks) * 100);
              toast({
                title: "Syncing in progress",
                description: `${progress.tracks_processed} / ${progress.total_tracks} tracks (${percentage}%)`,
              });
            }
          } else if (payload.new?.status === 'completed') {
            setSyncProgress(null);
            toast({
              title: "Sync completed",
              description: "All tracks have been synced successfully",
            });
          } else if (payload.new?.status === 'failed') {
            setSyncProgress(null);
            toast({
              title: "Sync failed",
              description: "An error occurred during sync",
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