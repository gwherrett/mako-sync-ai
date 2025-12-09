import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';
import { SpotifyTokenRefreshService } from './spotifyTokenRefresh.service';
import { SpotifyHealthMonitorService } from './spotifyHealthMonitor.service';
import { SpotifySecurityValidatorService } from './spotifySecurityValidator.service';
import { Phase4ErrorHandlerService } from './phase4ErrorHandler.service';

/**
 * Unified Spotify Authentication Manager
 * 
 * Consolidates all Spotify authentication operations into a single service:
 * - Connection management
 * - Token handling and refresh
 * - Health monitoring
 * - Security validation
 * - Error handling
 */

export interface SpotifyAuthState {
  isConnected: boolean;
  isLoading: boolean;
  connection: SpotifyConnection | null;
  error: string | null;
  lastCheck: number;
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';
}

export interface SpotifyAuthConfig {
  autoRefresh: boolean;
  healthMonitoring: boolean;
  securityValidation: boolean;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface SpotifyOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    attempts?: number;
    duration?: number;
    cached?: boolean;
  };
}

export class SpotifyAuthManager {
  private static instance: SpotifyAuthManager | null = null;
  private state: SpotifyAuthState;
  private config: SpotifyAuthConfig;
  private listeners: Set<(state: SpotifyAuthState) => void> = new Set();
  private healthMonitor: SpotifyHealthMonitorService | null = null;
  private checkPromise: Promise<SpotifyOperationResult> | null = null;
  
  // Connection check cooldown to prevent excessive API calls
  private static readonly CONNECTION_CHECK_COOLDOWN = 5000; // 5 seconds
  
  private constructor(config: Partial<SpotifyAuthConfig> = {}) {
    this.config = {
      autoRefresh: true,
      healthMonitoring: true,
      securityValidation: true,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
      },
      ...config,
    };
    
    this.state = {
      isConnected: false,
      isLoading: false,
      connection: null,
      error: null,
      lastCheck: 0,
      healthStatus: 'unknown',
    };
    
    // Initialize health monitoring if enabled
    if (this.config.healthMonitoring) {
      this.initializeHealthMonitoring();
    }
  }

  /**
   * Get singleton instance of SpotifyAuthManager
   */
  static getInstance(config?: Partial<SpotifyAuthConfig>): SpotifyAuthManager {
    if (!this.instance) {
      this.instance = new SpotifyAuthManager(config);
    }
    return this.instance;
  }

  /**
   * Subscribe to authentication state changes
   */
  subscribe(listener: (state: SpotifyAuthState) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current authentication state
   */
  getState(): SpotifyAuthState {
    return { ...this.state };
  }

  /**
   * Check Spotify connection status with caching and error handling
   */
  async checkConnection(force: boolean = false): Promise<SpotifyOperationResult<SpotifyConnection>> {
    const now = Date.now();
    
    // Return cached result if within cooldown period and not forced
    if (!force && (now - this.state.lastCheck) < SpotifyAuthManager.CONNECTION_CHECK_COOLDOWN) {
      console.log('🔍 SPOTIFY AUTH MANAGER: Using cached connection status');
      return {
        success: this.state.isConnected,
        data: this.state.connection,
        error: this.state.error,
        metadata: { cached: true }
      };
    }

    // Prevent multiple simultaneous checks
    if (this.checkPromise && !force) {
      console.log('🔍 SPOTIFY AUTH MANAGER: Returning existing check promise');
      return this.checkPromise;
    }

    console.log('🔍 SPOTIFY AUTH MANAGER: Starting connection check...');
    
    this.checkPromise = this.performConnectionCheck();
    const result = await this.checkPromise;
    this.checkPromise = null;
    
    return result;
  }

  /**
   * Internal connection check implementation
   */
  private async performConnectionCheck(): Promise<SpotifyOperationResult<SpotifyConnection>> {
    const startTime = Date.now();
    
    this.updateState({
      isLoading: true,
      error: null,
      lastCheck: startTime,
    });

    try {
      // Get current user
      const { data: { user }, error: userError } = await Promise.race([
        supabase.auth.getUser(),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('User fetch timeout')), 3000)
        )
      ]);

      if (userError || !user) {
        const error = 'User not authenticated';
        this.updateState({
          isConnected: false,
          connection: null,
          error,
          isLoading: false,
          healthStatus: 'error',
        });
        return { success: false, error };
      }

      // Get Spotify connection
      const { data: connection, error: connectionError } = await Promise.race([
        supabase
          .from('spotify_connections')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Connection query timeout')), 2000)
        )
      ]);

      if (connectionError) {
        const error = `Database error: ${connectionError.message}`;
        this.updateState({
          isConnected: false,
          connection: null,
          error,
          isLoading: false,
          healthStatus: 'error',
        });
        return { success: false, error };
      }

      const duration = Date.now() - startTime;

      if (connection) {
        // Validate token health if security validation is enabled
        let healthStatus: SpotifyAuthState['healthStatus'] = 'healthy';
        
        if (this.config.securityValidation) {
          try {
            const tokenHealth = SpotifyTokenRefreshService.validateTokenHealth(connection);
            if (!tokenHealth.isValid) {
              healthStatus = tokenHealth.status === 'expired' ? 'error' : 'warning';
            }
          } catch (error) {
            console.warn('Token health validation failed:', error);
            healthStatus = 'warning';
          }
        }

        this.updateState({
          isConnected: true,
          connection: connection as SpotifyConnection,
          error: null,
          isLoading: false,
          healthStatus,
        });

        console.log('✅ SPOTIFY AUTH MANAGER: Connection found and validated');
        return {
          success: true,
          data: connection as SpotifyConnection,
          metadata: { duration }
        };
      } else {
        this.updateState({
          isConnected: false,
          connection: null,
          error: null,
          isLoading: false,
          healthStatus: 'unknown',
        });

        console.log('ℹ️ SPOTIFY AUTH MANAGER: No connection found');
        return {
          success: false,
          error: 'No Spotify connection found',
          metadata: { duration }
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Connection check failed';
      
      this.updateState({
        isConnected: false,
        connection: null,
        error: errorMessage,
        isLoading: false,
        healthStatus: 'error',
      });

      console.error('❌ SPOTIFY AUTH MANAGER: Connection check failed:', error);
      
      // Use Phase 4 error handler for consistent error handling
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'checkConnection');
      
      return {
        success: false,
        error: errorMessage,
        metadata: { duration: Date.now() - startTime }
      };
    }
  }

  /**
   * Connect to Spotify using OAuth flow
   */
  async connectSpotify(): Promise<SpotifyOperationResult> {
    console.log('🔵 SPOTIFY AUTH MANAGER: Starting connection process...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        const error = 'Please log in to connect Spotify';
        this.updateState({ error });
        return { success: false, error };
      }

      // Generate secure state parameter
      const state = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Store state in multiple locations for validation
      localStorage.setItem('spotify_auth_state', state);
      sessionStorage.setItem('spotify_auth_state_backup', state);
      
      const scopes = [
        'user-read-private',
        'user-read-email',
        'user-library-read',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-top-read'
      ].join(' ');

      // Get configuration
      const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 
                         `${window.location.origin}/spotify-callback`;
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
      
      if (!clientId) {
        const error = 'Spotify client ID not configured';
        this.updateState({ error });
        return { success: false, error };
      }

      // Construct authorization URL
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('t', Date.now().toString());

      console.log('🔵 SPOTIFY AUTH MANAGER: Redirecting to Spotify authorization');
      
      // Redirect to Spotify
      window.location.href = authUrl.toString();
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = `Spotify auth failed: ${error.message}`;
      this.updateState({ error: errorMessage });
      
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'connectSpotify');
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Disconnect from Spotify
   */
  async disconnectSpotify(): Promise<SpotifyOperationResult> {
    console.log('🔴 SPOTIFY AUTH MANAGER: Disconnecting from Spotify...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'No user found' };
      }

      // Delete connection from database
      const { error } = await supabase
        .from('spotify_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      // Clear stored state
      localStorage.removeItem('spotify_auth_state');
      sessionStorage.removeItem('spotify_auth_state_backup');
      
      // Update state
      this.updateState({
        isConnected: false,
        connection: null,
        error: null,
        lastCheck: 0,
        healthStatus: 'unknown',
      });

      console.log('✅ SPOTIFY AUTH MANAGER: Successfully disconnected');
      return { success: true };
    } catch (error: any) {
      const errorMessage = `Disconnect failed: ${error.message}`;
      this.updateState({ error: errorMessage });
      
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'disconnectSpotify');
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Refresh Spotify tokens
   */
  async refreshTokens(): Promise<SpotifyOperationResult> {
    console.log('🔄 SPOTIFY AUTH MANAGER: Refreshing tokens...');
    
    if (!this.state.connection) {
      return { success: false, error: 'No connection available for token refresh' };
    }

    try {
      const result = await SpotifyTokenRefreshService.refreshTokenWithRetry(
        this.state.connection,
        this.config.retryConfig
      );

      if (result.success) {
        // Update connection state after successful refresh
        await this.checkConnection(true);
        console.log('✅ SPOTIFY AUTH MANAGER: Tokens refreshed successfully');
      }

      return result;
    } catch (error: any) {
      const errorMessage = `Token refresh failed: ${error.message}`;
      this.updateState({ error: errorMessage });
      
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'refreshTokens');
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync liked songs from Spotify
   */
  async syncLikedSongs(forceFullSync: boolean = false): Promise<SpotifyOperationResult> {
    console.log('🎵 SPOTIFY AUTH MANAGER: Starting liked songs sync...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'Please log in to sync liked songs' };
      }

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          force_full_sync: forceFullSync
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log('✅ SPOTIFY AUTH MANAGER: Sync completed successfully');
      return { 
        success: true, 
        data: response.data,
        metadata: {
          duration: Date.now() - Date.now() // Will be calculated properly in real implementation
        }
      };
    } catch (error: any) {
      const errorMessage = `Sync failed: ${error.message}`;
      
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'syncLikedSongs');
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<SpotifyOperationResult> {
    console.log('🏥 SPOTIFY AUTH MANAGER: Performing health check...');
    
    if (!this.state.connection) {
      return { success: false, error: 'No connection available for health check' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'No session available' };
      }

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          health_check: true
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      this.updateState({ healthStatus: 'healthy' });
      
      console.log('✅ SPOTIFY AUTH MANAGER: Health check passed');
      return { success: true, data: response.data };
    } catch (error: any) {
      this.updateState({ healthStatus: 'error' });
      
      const errorMessage = `Health check failed: ${error.message}`;
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'performHealthCheck');
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Validate security
   */
  async validateSecurity(): Promise<SpotifyOperationResult> {
    console.log('🔐 SPOTIFY AUTH MANAGER: Validating security...');
    
    if (!this.state.connection) {
      return { success: false, error: 'No connection available for security validation' };
    }

    try {
      const validation = await SpotifySecurityValidatorService.validateTokenSecurity(
        this.state.connection
      );

      const healthStatus: SpotifyAuthState['healthStatus'] =
        validation.isValid ? 'healthy' :
        validation.issues.some(i => i.severity === 'critical') ? 'error' : 'warning';

      this.updateState({ healthStatus });

      console.log('✅ SPOTIFY AUTH MANAGER: Security validation completed');
      return {
        success: validation.isValid,
        data: validation,
        error: validation.isValid ? undefined : 'Security issues detected'
      };
    } catch (error: any) {
      this.updateState({ healthStatus: 'error' });
      
      const errorMessage = `Security validation failed: ${error.message}`;
      Phase4ErrorHandlerService.handleError(error, 'SpotifyAuthManager', 'validateSecurity');
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Initialize health monitoring
   */
  private initializeHealthMonitoring(): void {
    if (this.healthMonitor) {
      return; // Already initialized
    }

    try {
      this.healthMonitor = SpotifyHealthMonitorService.getInstance({
        checkInterval: 30000, // 30 seconds
        enableAlerts: true,
        enableAutoRefresh: this.config.autoRefresh,
      });

      console.log('✅ SPOTIFY AUTH MANAGER: Health monitoring initialized');
    } catch (error) {
      console.warn('⚠️ SPOTIFY AUTH MANAGER: Failed to initialize health monitoring:', error);
    }
  }

  /**
   * Update internal state and notify listeners
   */
  private updateState(updates: Partial<SpotifyAuthState>): void {
    this.state = { ...this.state, ...updates };
    
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring();
      this.healthMonitor = null;
    }
    
    this.listeners.clear();
    SpotifyAuthManager.instance = null;
  }
}

export default SpotifyAuthManager;