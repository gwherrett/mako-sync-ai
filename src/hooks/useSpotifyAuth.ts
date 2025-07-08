
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
    setIsLoading(true);
    try {
      const { connection, isConnected } = await SpotifyService.checkConnection();
      setConnection(connection);
      setIsConnected(isConnected);
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
    } finally {
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
      await SpotifyService.connectSpotify();
      // Refresh connection state after successful auth
      await checkConnection();
      toast({
        title: "Spotify Connected",
        description: "Successfully connected to Spotify!",
      });
    } catch (error: any) {
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

  const syncLikedSongs = async () => {
    setIsSyncing(true);
    try {
      const { success, message, error } = await SpotifyService.syncLikedSongs();
      
      if (success) {
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
