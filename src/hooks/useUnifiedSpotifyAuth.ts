import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SpotifyAuthManager, type SpotifyAuthState, type SpotifyOperationResult } from '@/services/spotifyAuthManager.service';
import type { SpotifyConnection } from '@/types/spotify';

/**
 * Unified Spotify Authentication Hook
 * 
 * Consolidates functionality from useSpotifyAuth and useSpotifyTokens
 * into a single, comprehensive hook that uses the SpotifyAuthManager service.
 */

export interface UseUnifiedSpotifyAuthConfig {
  autoRefresh?: boolean;
  healthMonitoring?: boolean;
  securityValidation?: boolean;
  onConnectionChange?: (isConnected: boolean, connection: SpotifyConnection | null) => void;
  onError?: (error: string) => void;
}

export interface UseUnifiedSpotifyAuthReturn {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  connection: SpotifyConnection | null;
  error: string | null;
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';
  
  // Operation states
  isConnecting: boolean;
  isDisconnecting: boolean;
  isSyncing: boolean;
  isRefreshing: boolean;
  
  // Actions
  connectSpotify: () => Promise<boolean>;
  disconnectSpotify: () => Promise<boolean>;
  refreshTokens: () => Promise<boolean>;
  syncLikedSongs: (forceFullSync?: boolean) => Promise<boolean>;
  checkConnection: (force?: boolean) => Promise<boolean>;
  performHealthCheck: () => Promise<boolean>;
  validateSecurity: () => Promise<boolean>;
  
  // Utilities
  clearError: () => void;
  retryLastOperation: () => Promise<boolean>;
}

export const useUnifiedSpotifyAuth = (config: UseUnifiedSpotifyAuthConfig = {}): UseUnifiedSpotifyAuthReturn => {
  const {
    autoRefresh = true,
    healthMonitoring = true,
    securityValidation = true,
    onConnectionChange,
    onError
  } = config;

  // Get SpotifyAuthManager instance
  const authManager = useRef<SpotifyAuthManager>(
    SpotifyAuthManager.getInstance({
      autoRefresh,
      healthMonitoring,
      securityValidation,
    })
  );

  // Local state
  const [authState, setAuthState] = useState<SpotifyAuthState>(() => authManager.current.getState());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastOperation, setLastOperation] = useState<(() => Promise<boolean>) | null>(null);

  const { toast } = useToast();

  // Subscribe to auth manager state changes
  useEffect(() => {
    const unsubscribe = authManager.current.subscribe((newState) => {
      setAuthState(newState);
      
      // Notify connection change callback
      if (onConnectionChange) {
        onConnectionChange(newState.isConnected, newState.connection);
      }
      
      // Notify error callback
      if (onError && newState.error) {
        onError(newState.error);
      }
    });

    // Only check connection if we don't have recent data (avoid redundant checks)
    const currentState = authManager.current.getState();
    const timeSinceLastCheck = Date.now() - currentState.lastCheck;
    const shouldCheck = timeSinceLastCheck > 30000; // 30 seconds
    
    if (shouldCheck) {
      console.log('🔍 UNIFIED SPOTIFY AUTH: Performing initial connection check');
      authManager.current.checkConnection();
    } else {
      console.log('🔍 UNIFIED SPOTIFY AUTH: Using cached connection status');
    }

    return unsubscribe;
  }, [onConnectionChange, onError]);

  // Clear error function
  const clearError = useCallback(() => {
    // The auth manager doesn't expose a clearError method directly,
    // but errors are typically cleared on successful operations
    console.log('Error cleared by user action');
  }, []);

  // Connect to Spotify
  const connectSpotify = useCallback(async (): Promise<boolean> => {
    if (isConnecting) return false;
    
    setIsConnecting(true);
    setLastOperation(() => connectSpotify);
    
    try {
      const result = await authManager.current.connectSpotify();
      
      if (result.success) {
        toast({
          title: "Connecting to Spotify",
          description: "Redirecting to Spotify for authorization...",
        });
        return true;
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to connect to Spotify",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, toast]);

  // Disconnect from Spotify
  const disconnectSpotify = useCallback(async (): Promise<boolean> => {
    if (isDisconnecting) return false;
    
    setIsDisconnecting(true);
    setLastOperation(() => disconnectSpotify);
    
    try {
      const result = await authManager.current.disconnectSpotify();
      
      if (result.success) {
        toast({
          title: "Spotify Disconnected",
          description: "Successfully disconnected from Spotify",
        });
        return true;
      } else {
        toast({
          title: "Disconnect Failed",
          description: result.error || "Failed to disconnect from Spotify",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Disconnect Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  }, [isDisconnecting, toast]);

  // Refresh tokens
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (isRefreshing) return false;
    
    setIsRefreshing(true);
    setLastOperation(() => refreshTokens);
    
    try {
      const result = await authManager.current.refreshTokens();
      
      if (result.success) {
        toast({
          title: "Tokens Refreshed",
          description: "Spotify tokens have been refreshed successfully",
        });
        return true;
      } else {
        toast({
          title: "Refresh Failed",
          description: result.error || "Failed to refresh tokens",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Refresh Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, toast]);

  // Sync liked songs
  const syncLikedSongs = useCallback(async (forceFullSync: boolean = false): Promise<boolean> => {
    if (isSyncing) return false;
    
    setIsSyncing(true);
    setLastOperation(() => syncLikedSongs(forceFullSync));
    
    try {
      const result = await authManager.current.syncLikedSongs(forceFullSync);
      
      if (result.success) {
        const syncType = forceFullSync ? 'Full' : 'Incremental';
        toast({
          title: "Sync Complete",
          description: `${syncType} sync completed successfully`,
        });
        return true;
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || "Failed to sync liked songs",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast]);

  // Check connection
  const checkConnection = useCallback(async (force: boolean = false): Promise<boolean> => {
    try {
      const result = await authManager.current.checkConnection(force);
      return result.success;
    } catch (error: any) {
      console.error('Connection check failed:', error);
      return false;
    }
  }, []);

  // Perform health check
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authManager.current.performHealthCheck();
      
      if (result.success) {
        toast({
          title: "Health Check Passed",
          description: "Spotify connection is healthy",
        });
        return true;
      } else {
        toast({
          title: "Health Check Failed",
          description: result.error || "Health check failed",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Health Check Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Validate security
  const validateSecurity = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authManager.current.validateSecurity();
      
      if (result.success) {
        toast({
          title: "Security Validation Passed",
          description: "No security issues detected",
        });
        return true;
      } else {
        toast({
          title: "Security Issues Detected",
          description: result.error || "Security validation failed",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Security Validation Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Retry last operation
  const retryLastOperation = useCallback(async (): Promise<boolean> => {
    if (!lastOperation) {
      toast({
        title: "No Operation to Retry",
        description: "No previous operation available for retry",
        variant: "destructive",
      });
      return false;
    }

    try {
      return await lastOperation();
    } catch (error: any) {
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to retry operation",
        variant: "destructive",
      });
      return false;
    }
  }, [lastOperation, toast]);

  return {
    // Connection state
    isConnected: authState.isConnected,
    isLoading: authState.isLoading,
    connection: authState.connection,
    error: authState.error,
    healthStatus: authState.healthStatus,
    
    // Operation states
    isConnecting,
    isDisconnecting,
    isSyncing,
    isRefreshing,
    
    // Actions
    connectSpotify,
    disconnectSpotify,
    refreshTokens,
    syncLikedSongs,
    checkConnection,
    performHealthCheck,
    validateSecurity,
    
    // Utilities
    clearError,
    retryLastOperation,
  };
};

export default useUnifiedSpotifyAuth;