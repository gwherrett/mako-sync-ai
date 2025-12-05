
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SpotifyService } from '@/services/spotify.service';
import type { SpotifyConnection } from '@/types/spotify';

export const useSpotifyAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connection, setConnection] = useState<SpotifyConnection | null>(null);
  const { toast } = useToast();

  const checkConnection = async () => {
    console.log('🔍 SPOTIFY HOOK: Starting connection check...');
    setIsLoading(true);
    
    try {
      console.log('🔍 SPOTIFY HOOK: Calling SpotifyService.checkConnection()...');
      const result = await SpotifyService.checkConnection();
      
      console.log('🔍 SPOTIFY HOOK: Service returned:', {
        isConnected: result.isConnected,
        hasConnection: !!result.connection,
        connectionId: result.connection?.id,
        expiresAt: result.connection?.expires_at
      });
      
      setConnection(result.connection);
      setIsConnected(result.isConnected);
      
      console.log('✅ SPOTIFY HOOK: State updated successfully');
    } catch (error) {
      console.error('❌ SPOTIFY HOOK ERROR: Exception in checkConnection:', error);
      setIsConnected(false);
      setConnection(null);
    } finally {
      console.log('🔍 SPOTIFY HOOK: Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const refreshTokens = async () => {
    const { success, error } = await SpotifyService.refreshTokens();
    
    if (success) {
      await checkConnection();
      toast({
        title: "Tokens Refreshed",
        description: "Spotify tokens have been refreshed successfully",
      });
    } else {
      toast({
        title: "Refresh Failed",
        description: `Failed to refresh tokens: ${error}`,
        variant: "destructive",
      });
    }
  };

  const connectSpotify = async () => {
    try {
      console.log('🔵 SPOTIFY HOOK: Starting connection process...');
      
      // SpotifyService.connectSpotify() handles the redirect flow
      await SpotifyService.connectSpotify();
      
      console.log('🔵 SPOTIFY HOOK: Connection service call completed');
      
      // Refresh connection state after successful auth
      await checkConnection();
      
      // Show success toast
      toast({
        title: "Spotify Connected",
        description: "Successfully connected to Spotify!",
      });
      
      console.log('✅ SPOTIFY HOOK: Connection process completed successfully');
    } catch (error: any) {
      console.error('❌ SPOTIFY HOOK ERROR: Connection failed:', error);
      
      // Show error toast for failures
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const disconnectSpotify = async () => {
    const { success, error } = await SpotifyService.disconnectSpotify();
    
    if (success) {
      setIsConnected(false);
      setConnection(null);
      toast({
        title: "Spotify Disconnected",
        description: "Successfully disconnected from Spotify. Please reconnect to get fresh tokens.",
      });
    } else {
      toast({
        title: "Disconnect Failed",
        description: error || "Failed to disconnect from Spotify",
        variant: "destructive",
      });
    }
  };

  const syncLikedSongs = async (forceFullSync: boolean = false) => {
    setIsSyncing(true);
    try {
      const { success, message, error } = await SpotifyService.syncLikedSongs(forceFullSync);
      
      if (success) {
        // Trigger a manual refresh of stats
        await checkConnection();
        
        toast({
          title: "Sync Complete",
          description: message,
        });
      } else {
        toast({
          title: "Sync Failed",
          description: `Failed to sync liked songs: ${error}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return {
    isConnected,
    isLoading,
    isSyncing,
    connection,
    connectSpotify,
    disconnectSpotify,
    syncLikedSongs,
    checkConnection,
    refreshTokens,
  };
};
