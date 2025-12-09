import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { MockSpotifyAuthManager, type SpotifyAuthState, type SpotifyOperationResult } from '@/services/spotifyAuthManager.mock.service';
import type { SpotifyConnection } from '@/types/spotify';

/**
 * Mock Unified Spotify Authentication Hook
 * 
 * Provides the same interface as useUnifiedSpotifyAuth but uses mock implementation
 * for testing and development without requiring actual Spotify API access.
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
  
  // Mock-specific utilities
  setMockConnectionState: (connected: boolean, error?: string) => void;
  simulateTokenExpiry: () => void;
  simulateError: (errorType: 'network' | 'auth' | 'api' | 'vault') => void;
}

export const useUnifiedSpotifyAuthMock = (config: UseUnifiedSpotifyAuthConfig = {}): UseUnifiedSpotifyAuthReturn => {
  const {
    autoRefresh = true,
    healthMonitoring = true,
    securityValidation = true,
    onConnectionChange,
    onError
  } = config;

  // Get MockSpotifyAuthManager instance
  const authManager = useRef<MockSpotifyAuthManager>(
    MockSpotifyAuthManager.getInstance()
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

    // Initial connection check
    authManager.current.checkConnection();

    return unsubscribe;
  }, [onConnectionChange, onError]);

  // Clear error function
  const clearError = useCallback(() => {
    console.log('🎭 MOCK: Error cleared by user action');
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
          title: "Mock: Connecting to Spotify",
          description: "Simulating Spotify authorization flow...",
        });
        return true;
      } else {
        toast({
          title: "Mock: Connection Failed",
          description: result.error || "Failed to connect to Spotify",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Mock: Connection Error",
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
          title: "Mock: Spotify Disconnected",
          description: "Successfully disconnected from Spotify",
        });
        return true;
      } else {
        toast({
          title: "Mock: Disconnect Failed",
          description: result.error || "Failed to disconnect from Spotify",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Mock: Disconnect Error",
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
          title: "Mock: Tokens Refreshed",
          description: "Spotify tokens have been refreshed successfully",
        });
        return true;
      } else {
        toast({
          title: "Mock: Refresh Failed",
          description: result.error || "Failed to refresh tokens",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Mock: Refresh Error",
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
          title: "Mock: Sync Complete",
          description: `${syncType} sync completed successfully`,
        });
        return true;
      } else {
        toast({
          title: "Mock: Sync Failed",
          description: result.error || "Failed to sync liked songs",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Mock: Sync Error",
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
      console.error('Mock: Connection check failed:', error);
      return false;
    }
  }, []);

  // Perform health check
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authManager.current.performHealthCheck();
      
      if (result.success) {
        toast({
          title: "Mock: Health Check Passed",
          description: "Spotify connection is healthy",
        });
        return true;
      } else {
        toast({
          title: "Mock: Health Check Failed",
          description: result.error || "Health check failed",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Mock: Health Check Error",
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
          title: "Mock: Security Validation Passed",
          description: "No security issues detected",
        });
        return true;
      } else {
        toast({
          title: "Mock: Security Issues Detected",
          description: result.error || "Security validation failed",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Mock: Security Validation Error",
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
        title: "Mock: No Operation to Retry",
        description: "No previous operation available for retry",
        variant: "destructive",
      });
      return false;
    }

    try {
      return await lastOperation();
    } catch (error: any) {
      toast({
        title: "Mock: Retry Failed",
        description: error.message || "Failed to retry operation",
        variant: "destructive",
      });
      return false;
    }
  }, [lastOperation, toast]);

  // Mock-specific utilities
  const setMockConnectionState = useCallback((connected: boolean, error?: string) => {
    authManager.current.setMockConnectionState(connected, error);
  }, []);

  const simulateTokenExpiry = useCallback(() => {
    authManager.current.simulateTokenExpiry();
  }, []);

  const simulateError = useCallback((errorType: 'network' | 'auth' | 'api' | 'vault') => {
    authManager.current.simulateError(errorType);
  }, []);

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
    
    // Mock-specific utilities
    setMockConnectionState,
    simulateTokenExpiry,
    simulateError,
  };
};

export default useUnifiedSpotifyAuthMock;