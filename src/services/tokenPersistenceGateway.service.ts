import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Token Persistence Gateway Service
 *
 * Solves the race condition where TOKEN_REFRESHED fires before the token
 * is actually persisted to localStorage, causing queries to fail with
 * stale/missing tokens.
 *
 * Also ensures Supabase client's internal auth state is ready before
 * allowing queries to proceed.
 *
 * Console log prefix: 🔐 TOKEN GATEWAY
 */

const STORAGE_KEY_PREFIX = 'sb-';
const DEFAULT_MAX_WAIT_MS = 300;
const POLL_INTERVAL_MS = 10;

class TokenPersistenceGatewayService {
  private static instance: TokenPersistenceGatewayService | null = null;
  private tokenReady = false;
  private pendingCallbacks: (() => void)[] = [];

  static getInstance(): TokenPersistenceGatewayService {
    if (!this.instance) {
      this.instance = new TokenPersistenceGatewayService();
    }
    return this.instance;
  }

  /**
   * Wait for token to appear in localStorage matching the session
   * AND verify Supabase client can use it for queries.
   * Returns true when ready, false after timeout (non-blocking)
   */
  async waitForTokenPersistence(session: Session, maxWaitMs = DEFAULT_MAX_WAIT_MS): Promise<boolean> {
    const startTime = Date.now();
    const accessToken = session.access_token;

    // Quick check - token might already be persisted
    if (this.isTokenPersisted(accessToken)) {
      // Also verify Supabase client is ready by setting the session
      try {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        const elapsed = Date.now() - startTime;
        console.log(`🔐 TOKEN GATEWAY: Token verified and client ready (${elapsed}ms)`);
        this.markTokenReady();
        return true;
      } catch (error) {
        console.warn('🔐 TOKEN GATEWAY: setSession failed, will poll:', error);
      }
    }

    console.log('🔐 TOKEN GATEWAY: Waiting for token persistence...', {
      maxWaitMs,
      tokenPrefix: accessToken.substring(0, 20) + '...'
    });

    return new Promise<boolean>((resolve) => {
      const checkInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;

        if (this.isTokenPersisted(accessToken)) {
          clearInterval(checkInterval);

          // Verify Supabase client is ready
          try {
            await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            });
            console.log(`🔐 TOKEN GATEWAY: Token persisted and client ready (${elapsed}ms)`);
          } catch (error) {
            console.warn(`🔐 TOKEN GATEWAY: setSession failed after ${elapsed}ms:`, error);
          }

          this.markTokenReady();
          resolve(true);
          return;
        }

        if (elapsed >= maxWaitMs) {
          clearInterval(checkInterval);
          console.warn(`🔐 TOKEN GATEWAY: Token persistence timeout after ${elapsed}ms - proceeding anyway`);
          // Still mark as ready to avoid blocking - queries may succeed if token appears soon
          this.markTokenReady();
          resolve(false);
        }
      }, POLL_INTERVAL_MS);
    });
  }

  /**
   * Check if token in localStorage matches the expected access token
   */
  isTokenPersisted(accessToken: string): boolean {
    try {
      // Find the Supabase auth storage key
      const authKey = Object.keys(localStorage).find(key =>
        key.startsWith(STORAGE_KEY_PREFIX) && key.includes('auth-token')
      );

      if (!authKey) {
        return false;
      }

      const storedData = localStorage.getItem(authKey);
      if (!storedData) {
        return false;
      }

      const parsed = JSON.parse(storedData);
      // Check if the stored token matches the session token
      return parsed?.access_token === accessToken;
    } catch (error) {
      console.warn('🔐 TOKEN GATEWAY: Error checking token persistence:', error);
      return false;
    }
  }

  /**
   * Mark token as ready and call all pending callbacks
   */
  markTokenReady(): void {
    this.tokenReady = true;

    // Call all pending callbacks
    const callbacks = [...this.pendingCallbacks];
    this.pendingCallbacks = [];

    callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('🔐 TOKEN GATEWAY: Error in callback:', error);
      }
    });
  }

  /**
   * Register a callback for when token becomes ready
   * Returns cleanup function to unregister
   */
  onTokenReady(callback: () => void): () => void {
    if (this.tokenReady) {
      // Already ready, call immediately
      callback();
      return () => {};
    }

    this.pendingCallbacks.push(callback);

    return () => {
      const index = this.pendingCallbacks.indexOf(callback);
      if (index > -1) {
        this.pendingCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Check if token is marked as ready
   */
  isReady(): boolean {
    return this.tokenReady;
  }

  /**
   * Reset state (useful for sign out or testing)
   */
  reset(): void {
    this.tokenReady = false;
    this.pendingCallbacks = [];
  }
}

export const tokenPersistenceGateway = TokenPersistenceGatewayService.getInstance();
export default TokenPersistenceGatewayService;
