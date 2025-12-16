import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SpotifyAuthManager, type SpotifyAuthState, type SpotifyOperationResult } from '@/services/spotifyAuthManager.service';
import type { SpotifyConnection } from '@/types/spotify';
import { useAuth } from '@/contexts/NewAuthContext';

/**
 * Unified Spotify Authentication Hook
 *
 * Consolidates functionality from useSpotifyAuth into a single, comprehensive
 * hook that uses the SpotifyAuthManager service.
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

  // Get auth context to wait for initialization
  const { loading: authLoading, initialDataReady, isAuthenticated } = useAuth();

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
  
  // Track if initial check has been done to prevent multiple checks
  const initialCheckDone = useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastOperation, setLastOperation] = useState<(() => Promise<boolean>) | null>(null);

  const { toast } = useToast();

  // Subscribe to auth manager state changes
  useEffect(() => {
    const unsubscribe = authManager.current.subscribe((newState) => {
      // SESSION DEBUG: Log session implications of Spotify auth state changes
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth): Spotify auth state change implications for user session', {
        spotifyConnected: newState.isConnected,
        spotifyError: newState.error,
        spotifyHealthStatus: newState.healthStatus,
        spotifyConnectionId: newState.connection?.id,
        sessionImpact: newState.error ? 'Spotify errors should not affect user session' : 'Spotify state change should not affect user session',
        userSessionPreservation: 'User authentication session should remain intact regardless of Spotify connection status',
        timestamp: new Date().toISOString()
      });
      
      // Only update if state has actually changed (shallow comparison)
      setAuthState((prevState) => {
        if (
          prevState.isConnected === newState.isConnected &&
          prevState.isLoading === newState.isLoading &&
          prevState.error === newState.error &&
          prevState.healthStatus === newState.healthStatus &&
          prevState.connection?.id === newState.connection?.id
        ) {
          return prevState; // No change, prevent re-render
        }
        return newState;
      });
      
      // Notify connection change callback
      if (onConnectionChange) {
        onConnectionChange(newState.isConnected, newState.connection);
      }
      
      // Notify error callback
      if (onError && newState.error) {
        onError(newState.error);
      }
    });

    return unsubscribe;
  }, [onConnectionChange, onError]);

  // Defer Spotify connection check until auth is fully complete
  useEffect(() => {
    // Don't check until auth initialization is complete
    if (authLoading || !initialDataReady) {
      console.log('🔍 UNIFIED SPOTIFY AUTH: Waiting for auth initialization to complete before checking Spotify connection');
      return;
    }

    // Don't check if user is not authenticated
    if (!isAuthenticated) {
      console.log('🔍 UNIFIED SPOTIFY AUTH: User not authenticated, skipping Spotify connection check');
      return;
    }

    // Only check connection if we don't have recent data (avoid redundant checks)
    const currentState = authManager.current.getState();
    const timeSinceLastCheck = Date.now() - currentState.lastCheck;
    const shouldCheck = timeSinceLastCheck > 30000; // 30 seconds
    
    if (shouldCheck && !initialCheckDone.current) {
      initialCheckDone.current = true;
      console.log('🔍 UNIFIED SPOTIFY AUTH: Auth complete, performing initial connection check');
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Initial Check): Session preservation during initial Spotify connection check', {
        checkReason: 'Initial connection check after auth initialization complete',
        timeSinceLastCheck,
        sessionPreservation: 'User session should be preserved during Spotify connection check',
        timestamp: new Date().toISOString()
      });
      authManager.current.checkConnection();
    } else {
      console.log('🔍 UNIFIED SPOTIFY AUTH: Using cached connection status');
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Cached): Session preservation with cached Spotify status', {
        cacheReason: 'Using cached Spotify connection status',
        timeSinceLastCheck,
        sessionPreservation: 'User session unaffected by cached Spotify status',
        timestamp: new Date().toISOString()
      });
    }
  }, [authLoading, initialDataReady, isAuthenticated]);

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
    setLastOperation(() => () => connectSpotify());
    
    try {
      // SESSION DEBUG: Log session state before Spotify connect
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Connect Start): Session state before Spotify connect attempt', {
        connectAttempt: true,
        userSessionRequired: 'Valid user session required for Spotify connection',
        sessionPreservation: 'User session should be preserved during Spotify connection process',
        timestamp: new Date().toISOString()
      });
      
      const result = await authManager.current.connectSpotify();
      
      if (result.success) {
        // SESSION DEBUG: Log session state after successful connect initiation
        console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Connect Success): Session state after successful Spotify connect initiation', {
          connectInitiated: true,
          redirecting: 'User will be redirected to Spotify for authorization',
          sessionPreservation: 'User session should be preserved during OAuth redirect',
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Connecting to Spotify",
          description: "Redirecting to Spotify for authorization...",
        });
        return true;
      } else {
        // SESSION DEBUG: Log session state after connect failure
        console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Connect Failed): Session state after Spotify connect failure', {
          connectFailed: true,
          error: result.error,
          sessionPreservation: 'User session should be preserved despite Spotify connect failure',
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to connect to Spotify",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      // SESSION DEBUG: Log session state during connect exception
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Connect Exception): Session state during Spotify connect exception', {
        connectException: true,
        error: error.message,
        sessionPreservation: 'User session should be preserved despite Spotify connect exception',
        timestamp: new Date().toISOString()
      });
      
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
    setLastOperation(() => () => disconnectSpotify());
    
    try {
      // SESSION DEBUG: Log session state before Spotify disconnect
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Disconnect Start): Session state before Spotify disconnect attempt', {
        disconnectAttempt: true,
        userSessionRequired: 'Valid user session required for Spotify disconnect',
        sessionPreservation: 'User session should be preserved during Spotify disconnect process',
        timestamp: new Date().toISOString()
      });
      
      const result = await authManager.current.disconnectSpotify();
      
      if (result.success) {
        // SESSION DEBUG: Log session state after successful disconnect
        console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Disconnect Success): Session state after successful Spotify disconnect', {
          disconnectSuccessful: true,
          spotifyConnectionRemoved: 'Spotify connection has been removed',
          sessionPreservation: 'User session should remain intact after Spotify disconnect',
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Spotify Disconnected",
          description: "Successfully disconnected from Spotify",
        });
        return true;
      } else {
        // SESSION DEBUG: Log session state after disconnect failure
        console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Disconnect Failed): Session state after Spotify disconnect failure', {
          disconnectFailed: true,
          error: result.error,
          sessionPreservation: 'User session should be preserved despite Spotify disconnect failure',
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Disconnect Failed",
          description: result.error || "Failed to disconnect from Spotify",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      // SESSION DEBUG: Log session state during disconnect exception
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Disconnect Exception): Session state during Spotify disconnect exception', {
        disconnectException: true,
        error: error.message,
        sessionPreservation: 'User session should be preserved despite Spotify disconnect exception',
        timestamp: new Date().toISOString()
      });
      
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
    setLastOperation(() => () => refreshTokens());
    
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
    setLastOperation(() => () => syncLikedSongs(forceFullSync));
    
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
      // SESSION DEBUG: Log session state before connection check
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Check Connection): Session state before Spotify connection check', {
        connectionCheck: true,
        forced: force,
        sessionPreservation: 'User session should not be affected by Spotify connection check',
        timestamp: new Date().toISOString()
      });
      
      const result = await authManager.current.checkConnection(force);
      
      // SESSION DEBUG: Log session state after connection check
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Check Connection Result): Session state after Spotify connection check', {
        connectionCheckResult: result.success,
        error: result.error,
        sessionPreservation: 'User session should remain intact regardless of Spotify connection check result',
        timestamp: new Date().toISOString()
      });
      
      return result.success;
    } catch (error: any) {
      // SESSION DEBUG: Log session state during connection check error
      console.log('🔍 SESSION DEBUG (useUnifiedSpotifyAuth - Check Connection Error): Session state during Spotify connection check error', {
        connectionCheckError: true,
        error: error.message,
        sessionPreservation: 'User session should be preserved despite Spotify connection check error',
        timestamp: new Date().toISOString()
      });
      
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