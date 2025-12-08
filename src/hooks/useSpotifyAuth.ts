
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SpotifyService } from '@/services/spotify.service';
import type { SpotifyConnection } from '@/types/spotify';

// Global state to prevent multiple simultaneous connection checks
let globalConnectionState = {
  isConnected: false,
  isLoading: false, // Start as false to prevent initial blocking
  connection: null as SpotifyConnection | null,
  lastCheck: 0,
  isChecking: false,
  hasInitialCheck: false // Track if we've done the first check
};

const CONNECTION_CHECK_COOLDOWN = 5000; // Increase cooldown to 5 seconds
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

  const checkConnection = async (force: boolean = false) => {
    const now = Date.now();
    
    // Prevent multiple simultaneous checks unless forced
    if (!force && (globalConnectionState.isChecking || (now - globalConnectionState.lastCheck) < CONNECTION_CHECK_COOLDOWN)) {
      console.log('🔍 SPOTIFY HOOK: Skipping check (cooldown or already checking)');
      return;
    }

    console.log('🔍 SPOTIFY HOOK: Starting connection check...');
    globalConnectionState.isChecking = true;
    
    // Only show loading on initial check or forced checks
    if (!globalConnectionState.hasInitialCheck || force) {
      globalConnectionState.isLoading = true;
    }
    
    globalConnectionState.lastCheck = now;
    notifyListeners();
    
    try {
      console.log('🔍 SPOTIFY HOOK: Calling SpotifyService.checkConnection()...');
      
      // Use a shorter timeout for the hook level
      const result = await Promise.race([
        SpotifyService.checkConnection(),
        new Promise<{ connection: null; isConnected: false }>((resolve) =>
          setTimeout(() => {
            console.warn('⚠️ SPOTIFY HOOK: Connection check timeout, returning disconnected');
            resolve({ connection: null, isConnected: false });
          }, 4000) // 4 second timeout at hook level
        )
      ]);
      
      console.log('🔍 SPOTIFY HOOK: Service returned:', {
        isConnected: result.isConnected,
        hasConnection: !!result.connection,
        connectionId: result.connection?.id,
        expiresAt: result.connection?.expires_at
      });
      
      globalConnectionState.connection = result.connection;
      globalConnectionState.isConnected = result.isConnected;
      globalConnectionState.hasInitialCheck = true;
      
      console.log('✅ SPOTIFY HOOK: State updated successfully');
    } catch (error) {
      console.warn('⚠️ SPOTIFY HOOK: Connection check failed, setting disconnected:', error);
      globalConnectionState.isConnected = false;
      globalConnectionState.connection = null;
      globalConnectionState.hasInitialCheck = true;
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
    // Only do initial check if we haven't done one yet
    if (!globalConnectionState.hasInitialCheck) {
      // Use setTimeout to make it non-blocking
      const timeoutId = setTimeout(() => {
        checkConnection();
      }, 100); // Small delay to prevent blocking initial render
      
      return () => clearTimeout(timeoutId);
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
