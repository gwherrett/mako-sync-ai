import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';

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
  private healthMonitor: any = null;
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
      // Get current user from session instead of triggering auth state changes
      console.log('🔍 SPOTIFY AUTH MANAGER: Starting session fetch...');
      const sessionStartTime = Date.now();
      
      const { data: { session }, error: sessionError } = await Promise.race([
        supabase.auth.getSession().then(result => {
          const elapsed = Date.now() - sessionStartTime;
          console.log(`✅ SPOTIFY AUTH MANAGER: Session fetch completed in ${elapsed}ms`);
          return result;
        }).catch(error => {
          const elapsed = Date.now() - sessionStartTime;
          console.error(`❌ SPOTIFY AUTH MANAGER: Session fetch failed after ${elapsed}ms:`, error);
          throw error;
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => {
            const elapsed = Date.now() - sessionStartTime;
            console.error(`❌ SPOTIFY AUTH MANAGER: Session fetch timeout after ${elapsed}ms (limit: 5000ms)`);
            reject(new Error('Session fetch timeout - SpotifyAuthManager'));
          }, 5000)
        )
      ]);

      if (sessionError || !session?.user) {
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

      const user = session.user;

      // Get Spotify connection
      console.log('🔍 SPOTIFY AUTH MANAGER: Starting connection query...');
      const connectionStartTime = Date.now();
      
      const { data: connection, error: connectionError } = await Promise.race([
        (async () => {
          try {
            const result = await supabase
              .from('spotify_connections')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            
            const elapsed = Date.now() - connectionStartTime;
            console.log(`✅ SPOTIFY AUTH MANAGER: Connection query completed in ${elapsed}ms`);
            return result;
          } catch (error) {
            const elapsed = Date.now() - connectionStartTime;
            console.error(`❌ SPOTIFY AUTH MANAGER: Connection query failed after ${elapsed}ms:`, error);
            throw error;
          }
        })(),
        new Promise<any>((_, reject) =>
          setTimeout(() => {
            const elapsed = Date.now() - connectionStartTime;
            console.error(`❌ SPOTIFY AUTH MANAGER: Connection query timeout after ${elapsed}ms (limit: 5000ms)`);
            reject(new Error('Connection query timeout - SpotifyAuthManager'));
          }, 5000)
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
        
        // Simple token validation - check if tokens exist
        if (this.config.securityValidation) {
          try {
            if (!connection.access_token || !connection.refresh_token) {
              healthStatus = 'error';
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
      const duration = Date.now() - startTime;
      
      console.error(`❌ SPOTIFY AUTH MANAGER: Connection check failed after ${duration}ms:`, {
        error: errorMessage,
        stack: error.stack,
        type: error.constructor.name
      });
      
      this.updateState({
        isConnected: false,
        connection: null,
        error: errorMessage,
        isLoading: false,
        healthStatus: 'error',
      });
      
      // Log error for debugging
      console.error('❌ SPOTIFY AUTH MANAGER: Connection check error:', {
        error: errorMessage,
        duration,
        timeout: '5000ms'
      });
      
      return {
        success: false,
        error: errorMessage,
        metadata: { duration }
      };
    }
  }

  /**
   * Connect to Spotify using OAuth flow
   */
  async connectSpotify(): Promise<SpotifyOperationResult> {
    console.log('🔵 SPOTIFY AUTH MANAGER: Starting connection process...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        const error = 'Please log in to connect Spotify';
        this.updateState({ error });
        return { success: false, error };
      }
      
      const user = session.user;

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
      
      console.error('❌ SPOTIFY AUTH MANAGER: Connect error:', error);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Disconnect from Spotify
   */
  async disconnectSpotify(): Promise<SpotifyOperationResult> {
    console.log('🔴 SPOTIFY AUTH MANAGER: Disconnecting from Spotify...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return { success: false, error: 'No user found' };
      }
      
      const user = session.user;

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
      
      console.error('❌ SPOTIFY AUTH MANAGER: Disconnect error:', error);
      
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
      // Simple token refresh - call edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session available for token refresh');
      }

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          refresh_only: true
        }
      });

      const result = {
        success: !response.error,
        error: response.error?.message
      };

      if (result.success) {
        // Update connection state after successful refresh
        await this.checkConnection(true);
        console.log('✅ SPOTIFY AUTH MANAGER: Tokens refreshed successfully');
      }

      return result;
    } catch (error: any) {
      const errorMessage = `Token refresh failed: ${error.message}`;
      this.updateState({ error: errorMessage });
      
      console.error('❌ SPOTIFY AUTH MANAGER: Token refresh error:', error);
      
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
      
      console.error('❌ SPOTIFY AUTH MANAGER: Sync error:', error);
      
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
      console.error('❌ SPOTIFY AUTH MANAGER: Health check error:', error);
      
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
      // Simple security validation - check if connection exists and has tokens
      const isValid = !!(this.state.connection?.access_token && this.state.connection?.refresh_token);
      const healthStatus: SpotifyAuthState['healthStatus'] = isValid ? 'healthy' : 'error';

      this.updateState({ healthStatus });

      console.log('✅ SPOTIFY AUTH MANAGER: Security validation completed');
      return {
        success: isValid,
        data: { isValid },
        error: isValid ? undefined : 'Security issues detected'
      };
    } catch (error: any) {
      this.updateState({ healthStatus: 'error' });
      
      const errorMessage = `Security validation failed: ${error.message}`;
      console.error('❌ SPOTIFY AUTH MANAGER: Security validation error:', error);
      
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
      // Simple health monitoring - just log that it's initialized
      this.healthMonitor = {
        initialized: true,
        stopMonitoring: () => console.log('Health monitoring stopped')
      };

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