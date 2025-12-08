import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SpotifyService } from '@/services/spotify.service';
import { SpotifyTokenRefreshService } from '@/services/spotifyTokenRefresh.service';
import { SpotifyHealthMonitorService } from '@/services/spotifyHealthMonitor.service';
import { SpotifySecurityValidatorService } from '@/services/spotifySecurityValidator.service';
import type { SpotifyConnection } from '@/types/spotify';

interface TokenHealth {
  status: 'healthy' | 'warning' | 'expired' | 'error';
  expiresIn: number; // minutes
  lastRefresh: Date | null;
  autoRefreshEnabled: boolean;
}

interface UseSpotifyTokensConfig {
  autoRefresh?: boolean;
  warningThreshold?: number; // minutes before expiry to show warning
  refreshThreshold?: number; // minutes before expiry to auto-refresh
}

export const useSpotifyTokens = (config: UseSpotifyTokensConfig = {}) => {
  const {
    autoRefresh = true,
    warningThreshold = 60, // 1 hour warning
    refreshThreshold = 30, // 30 minutes auto-refresh
  } = config;

  const { toast } = useToast();
  
  const [connection, setConnection] = useState<SpotifyConnection | null>(null);
  const [tokenHealth, setTokenHealth] = useState<TokenHealth>({
    status: 'healthy',
    expiresIn: 0,
    lastRefresh: null,
    autoRefreshEnabled: autoRefresh
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Enhanced token health calculation with security validation
  const calculateTokenHealth = useCallback((conn: SpotifyConnection | null): TokenHealth => {
    if (!conn) {
      return {
        status: 'error',
        expiresIn: 0,
        lastRefresh: null,
        autoRefreshEnabled: autoRefresh
      };
    }

    // Use the enhanced token validation from security service
    const validation = SpotifyTokenRefreshService.validateTokenHealth(conn);
    
    let status: TokenHealth['status'] = 'healthy';
    
    switch (validation.status) {
      case 'expired':
        status = 'expired';
        break;
      case 'invalid':
        status = 'error';
        break;
      case 'warning':
        status = 'warning';
        break;
      case 'healthy':
      default:
        status = 'healthy';
        break;
    }

    const expiresInMinutes = Math.max(0, Math.floor(validation.timeUntilExpiry / (1000 * 60)));

    return {
      status,
      expiresIn: expiresInMinutes,
      lastRefresh: tokenHealth.lastRefresh,
      autoRefreshEnabled: autoRefresh
    };
  }, [autoRefresh, tokenHealth.lastRefresh]);

  // Check connection and update token health (non-blocking)
  const checkConnection = useCallback(async () => {
    try {
      // Use a timeout to prevent blocking
      const result = await Promise.race([
        SpotifyService.checkConnection(),
        new Promise<{ connection: null; isConnected: false }>((resolve) =>
          setTimeout(() => {
            console.warn('⚠️ SPOTIFY TOKENS: Connection check timeout');
            resolve({ connection: null, isConnected: false });
          }, 3000) // 3 second timeout
        )
      ]);
      
      const { connection: conn, isConnected } = result;
      setConnection(conn);
      
      if (isConnected && conn) {
        const health = calculateTokenHealth(conn);
        setTokenHealth(health);
        
        // Auto-refresh if needed (but don't block)
        if (autoRefresh && health.expiresIn <= refreshThreshold && health.expiresIn > 0) {
          console.log(`Auto-refreshing tokens (${health.expiresIn} minutes remaining)`);
          // Don't await - let it run in background
          refreshTokens().catch(error =>
            console.warn('Background token refresh failed:', error)
          );
        }
      } else {
        setTokenHealth({
          status: 'error',
          expiresIn: 0,
          lastRefresh: null,
          autoRefreshEnabled: autoRefresh
        });
      }
    } catch (error) {
      console.warn('⚠️ SPOTIFY TOKENS: Connection check failed:', error);
      setTokenHealth({
        status: 'error',
        expiresIn: 0,
        lastRefresh: null,
        autoRefreshEnabled: autoRefresh
      });
    } finally {
      setIsLoading(false);
    }
  }, [autoRefresh, refreshThreshold, calculateTokenHealth]);

  // Enhanced refresh tokens with retry logic
  const refreshTokens = useCallback(async () => {
    if (isRefreshing) return { success: false, error: 'Already refreshing' };
    if (!connection) return { success: false, error: 'No connection available' };

    setIsRefreshing(true);
    try {
      // Use enhanced token refresh service with retry logic
      const result = await SpotifyTokenRefreshService.refreshTokenWithRetry(connection, {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      });
      
      if (result.success) {
        setTokenHealth(prev => ({
          ...prev,
          lastRefresh: new Date()
        }));
        
        // Re-check connection to get updated token info
        await checkConnection();
        
        toast({
          title: "Tokens Refreshed",
          description: "Your Spotify connection has been renewed successfully.",
        });
        
        return { success: true };
      } else {
        // Handle rate limiting
        if (result.retryAfter) {
          toast({
            title: "Rate Limited",
            description: `Please wait ${result.retryAfter} seconds before trying again.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Refresh Failed",
            description: result.error || "Failed to refresh Spotify tokens",
            variant: "destructive",
          });
        }
        
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      
      toast({
        title: "Refresh Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, connection, checkConnection, toast]);

  // Force refresh (manual)
  const forceRefresh = useCallback(async () => {
    return await refreshTokens();
  }, [refreshTokens]);

  // Get time until expiry in human-readable format
  const getTimeUntilExpiry = useCallback(() => {
    if (!connection || tokenHealth.expiresIn <= 0) {
      return 'Expired';
    }

    const minutes = tokenHealth.expiresIn;
    
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      return remainingMinutes > 0 
        ? `${hours}h ${remainingMinutes}m`
        : `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    return remainingHours > 0
      ? `${days}d ${remainingHours}h`
      : `${days} day${days !== 1 ? 's' : ''}`;
  }, [connection, tokenHealth.expiresIn]);

  // Get health status message
  const getHealthMessage = useCallback(() => {
    switch (tokenHealth.status) {
      case 'healthy':
        return 'Connection is healthy';
      case 'warning':
        return `Expires in ${getTimeUntilExpiry()}`;
      case 'expired':
        return 'Connection has expired';
      case 'error':
        return 'Connection error';
      default:
        return 'Unknown status';
    }
  }, [tokenHealth.status, getTimeUntilExpiry]);

  // Set up periodic health checks (non-blocking)
  useEffect(() => {
    // Start with loading false to prevent blocking
    setIsLoading(false);
    
    // Delay initial check to prevent blocking
    const initialTimeout = setTimeout(() => {
      checkConnection();
    }, 500); // 500ms delay
    
    // Check every 10 minutes (reduced frequency)
    const interval = setInterval(checkConnection, 10 * 60 * 1000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkConnection]);

  // Set up auto-refresh timer
  useEffect(() => {
    if (!autoRefresh || !connection || tokenHealth.status === 'expired') {
      return;
    }

    const refreshTime = Math.max(1, tokenHealth.expiresIn - refreshThreshold) * 60 * 1000;
    
    if (refreshTime > 0 && refreshTime < 24 * 60 * 60 * 1000) { // Max 24 hours
      const timeout = setTimeout(() => {
        console.log('Auto-refresh timer triggered');
        refreshTokens();
      }, refreshTime);
      
      return () => clearTimeout(timeout);
    }
  }, [autoRefresh, connection, tokenHealth.expiresIn, refreshThreshold, refreshTokens]);

  return {
    // Connection state
    connection,
    isConnected: !!connection,
    isLoading,
    
    // Token health
    tokenHealth,
    healthMessage: getHealthMessage(),
    timeUntilExpiry: getTimeUntilExpiry(),
    
    // Actions
    refreshTokens: forceRefresh,
    checkConnection,
    isRefreshing,
    
    // Computed values
    needsRefresh: tokenHealth.status === 'warning' || tokenHealth.status === 'expired',
    canAutoRefresh: autoRefresh && tokenHealth.expiresIn > 0,
    
    // Health indicators
    isHealthy: tokenHealth.status === 'healthy',
    isWarning: tokenHealth.status === 'warning',
    isExpired: tokenHealth.status === 'expired',
    hasError: tokenHealth.status === 'error',
  };
};

export default useSpotifyTokens;