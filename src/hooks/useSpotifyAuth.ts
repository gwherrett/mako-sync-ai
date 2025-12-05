
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SpotifyService } from '@/services/spotify.service';
import type { SpotifyConnection } from '@/types/spotify';

// Global state to prevent multiple simultaneous connection checks
let globalConnectionState = {
  isConnected: false,
  isLoading: true,
  connection: null as SpotifyConnection | null,
  lastCheck: 0,
  isChecking: false
};

const CONNECTION_CHECK_COOLDOWN = 2000; // 2 seconds cooldown between checks
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const useSpotifyAuth = () => {
  const [isConnected, setIsConnected] = useState(globalConnectionState.isConnected);
  const [isLoading, setIsLoading] = useState(globalConnectionState.isLoading);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connection, setConnection] = useState<SpotifyConnection | null>(globalConnectionState.connection);
  const { toast } = useToast();
  const mountedRef = useRef(true);

  // Subscribe to global state changes
  useEffect(() => {
    const updateLocalState = () => {
      if (!mountedRef.current) return;
      setIsConnected(globalConnectionState.isConnected);
      setIsLoading(globalConnectionState.isLoading);
      setConnection(globalConnectionState.connection);
    };

    listeners.add(updateLocalState);
    return () => {
      mountedRef.current = false;
      listeners.delete(updateLocalState);
    };
  }, []);

  const checkConnection = async () => {
    const now = Date.now();
    
    // Prevent multiple simultaneous checks
    if (globalConnectionState.isChecking || (now - globalConnectionState.lastCheck) < CONNECTION_CHECK_COOLDOWN) {
      console.log('🔍 SPOTIFY HOOK: Skipping check (cooldown or already checking)');
      return;
    }

    console.log('🔍 SPOTIFY HOOK: Starting connection check...');
    globalConnectionState.isChecking = true;
    globalConnectionState.isLoading = true;
    globalConnectionState.lastCheck = now;
    notifyListeners();
    
    try {
      console.log('🔍 SPOTIFY HOOK: Calling SpotifyService.checkConnection()...');
      const result = await SpotifyService.checkConnection();
      
      console.log('🔍 SPOTIFY HOOK: Service returned:', {
        isConnected: result.isConnected,
        hasConnection: !!result.connection,
        connectionId: result.connection?.id,
        expiresAt: result.connection?.expires_at
      });
      
      globalConnectionState.connection = result.connection;
      globalConnectionState.isConnected = result.isConnected;
      
      console.log('✅ SPOTIFY HOOK: State updated successfully');
    } catch (error) {
      console.error('❌ SPOTIFY HOOK ERROR: Exception in checkConnection:', error);
      globalConnectionState.isConnected = false;
      globalConnectionState.connection = null;
    } finally {
      console.log('🔍 SPOTIFY HOOK: Setting isLoading to false');
      globalConnectionState.isLoading = false;
      globalConnectionState.isChecking = false;
      notifyListeners();
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
      // Update global state
      globalConnectionState.isConnected = false;
      globalConnectionState.connection = null;
      globalConnectionState.lastCheck = 0; // Reset to allow fresh check
      notifyListeners();
      
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
    // Always allow the first check, then use cooldown for subsequent checks
    const now = Date.now();
    if (globalConnectionState.lastCheck === 0 || (now - globalConnectionState.lastCheck) > CONNECTION_CHECK_COOLDOWN) {
      checkConnection();
    }
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
