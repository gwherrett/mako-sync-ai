import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

interface RefreshResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: string;
  error?: string;
  retryAfter?: number; // seconds
}

export class SpotifyTokenRefreshService {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2
  };

  /**
   * Enhanced token refresh with retry logic and exponential backoff
   */
  static async refreshTokenWithRetry(
    connection: SpotifyConnection,
    config: Partial<RetryConfig> = {}
  ): Promise<RefreshResult> {
    const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        console.log(`Token refresh attempt ${attempt + 1}/${retryConfig.maxRetries + 1}`);
        
        const result = await this.performTokenRefresh(connection);
        
        if (result.success) {
          console.log(`Token refresh successful on attempt ${attempt + 1}`);
          return result;
        }
        
        // If it's the last attempt, return the error
        if (attempt === retryConfig.maxRetries) {
          return result;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );
        
        console.log(`Token refresh failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
        
      } catch (error: any) {
        lastError = error;
        console.error(`Token refresh attempt ${attempt + 1} failed:`, error.message);
        
        // If it's a permanent error (like invalid refresh token), don't retry
        if (this.isPermanentError(error)) {
          console.log('Permanent error detected, stopping retries');
          return {
            success: false,
            error: error.message
          };
        }
        
        // If it's the last attempt, return the error
        if (attempt === retryConfig.maxRetries) {
          return {
            success: false,
            error: lastError?.message || 'Token refresh failed after all retries'
          };
        }
        
        // Wait before retrying
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );
        
        console.log(`Retrying token refresh in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Token refresh failed after all retries'
    };
  }

  /**
   * Perform the actual token refresh
   */
  private static async performTokenRefresh(connection: SpotifyConnection): Promise<RefreshResult> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session - please log in again');
    }

    // Call the edge function to refresh tokens
    const response = await supabase.functions.invoke('spotify-sync-liked', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        refresh_only: true // Flag to indicate we only want to refresh tokens
      }
    });

    if (response.error) {
      // Parse error to determine if it's retryable
      const errorMessage = response.error.message || 'Unknown error';
      
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('refresh token is invalid')) {
        throw new Error('Refresh token is invalid - please reconnect your Spotify account');
      }
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        const retryAfter = this.extractRetryAfter(errorMessage);
        return {
          success: false,
          error: 'Rate limited by Spotify',
          retryAfter
        };
      }
      
      throw new Error(errorMessage);
    }

    // Get updated connection info
    const { connection: updatedConnection } = await this.checkConnection();
    
    if (!updatedConnection) {
      throw new Error('Failed to retrieve updated connection after refresh');
    }

    return {
      success: true,
      expiresAt: updatedConnection.expires_at
    };
  }

  /**
   * Check if an error is permanent (shouldn't be retried)
   */
  private static isPermanentError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    const permanentErrors = [
      'invalid_grant',
      'refresh token is invalid',
      'unauthorized',
      'forbidden',
      'please reconnect',
      'no refresh token available'
    ];
    
    return permanentErrors.some(errorType => message.includes(errorType));
  }

  /**
   * Extract retry-after value from error message
   */
  private static extractRetryAfter(errorMessage: string): number {
    const match = errorMessage.match(/retry[_\s]after[:\s]*(\d+)/i);
    return match ? parseInt(match[1], 10) : 60; // Default to 60 seconds
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check current connection status
   */
  private static async checkConnection(): Promise<{ connection: SpotifyConnection | null; isConnected: boolean }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { connection: null, isConnected: false };
      }

      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking Spotify connection:', error);
        return { connection: null, isConnected: false };
      }

      if (data) {
        return { connection: data as SpotifyConnection, isConnected: true };
      }

      return { connection: null, isConnected: false };
    } catch (error) {
      console.error('Error checking connection:', error);
      return { connection: null, isConnected: false };
    }
  }

  /**
   * Validate token health and determine if refresh is needed
   */
  static validateTokenHealth(connection: SpotifyConnection): {
    isValid: boolean;
    needsRefresh: boolean;
    timeUntilExpiry: number; // milliseconds
    status: 'healthy' | 'warning' | 'expired' | 'invalid';
  } {
    if (!connection || !connection.expires_at) {
      return {
        isValid: false,
        needsRefresh: true,
        timeUntilExpiry: 0,
        status: 'invalid'
      };
    }

    const now = new Date();
    const expiresAt = new Date(connection.expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    
    // Token is expired
    if (timeUntilExpiry <= 0) {
      return {
        isValid: false,
        needsRefresh: true,
        timeUntilExpiry: 0,
        status: 'expired'
      };
    }
    
    // Token expires within 5 minutes - needs refresh
    if (timeUntilExpiry < 5 * 60 * 1000) {
      return {
        isValid: true,
        needsRefresh: true,
        timeUntilExpiry,
        status: 'warning'
      };
    }
    
    // Token expires within 30 minutes - warning
    if (timeUntilExpiry < 30 * 60 * 1000) {
      return {
        isValid: true,
        needsRefresh: false,
        timeUntilExpiry,
        status: 'warning'
      };
    }
    
    // Token is healthy
    return {
      isValid: true,
      needsRefresh: false,
      timeUntilExpiry,
      status: 'healthy'
    };
  }

  /**
   * Schedule automatic token refresh
   */
  static scheduleTokenRefresh(
    connection: SpotifyConnection,
    onRefresh?: (result: RefreshResult) => void
  ): () => void {
    const health = this.validateTokenHealth(connection);
    
    if (!health.isValid || health.timeUntilExpiry <= 0) {
      console.log('Token is invalid or expired, not scheduling refresh');
      return () => {}; // Return empty cleanup function
    }
    
    // Schedule refresh 5 minutes before expiry
    const refreshTime = Math.max(1000, health.timeUntilExpiry - (5 * 60 * 1000));
    
    console.log(`Scheduling token refresh in ${Math.round(refreshTime / 1000)} seconds`);
    
    const timeoutId = setTimeout(async () => {
      console.log('Scheduled token refresh triggered');
      const result = await this.refreshTokenWithRetry(connection);
      onRefresh?.(result);
    }, refreshTime);
    
    // Return cleanup function
    return () => {
      console.log('Cancelling scheduled token refresh');
      clearTimeout(timeoutId);
    };
  }
}

export default SpotifyTokenRefreshService;