import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Session Cache Service
 * 
 * Prevents multiple concurrent getSession() calls that cause timeouts
 * by caching the session and deduplicating requests.
 */

interface CachedSession {
  session: Session | null;
  error: any;
  timestamp: number;
  isValid: boolean;
}

class SessionCacheService {
  private static instance: SessionCacheService | null = null;
  private cache: CachedSession | null = null;
  private pendingRequest: Promise<{ session: Session | null; error: any }> | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT = 8000; // 8 seconds - less than Supabase's 15s but more than current 5s

  static getInstance(): SessionCacheService {
    if (!this.instance) {
      this.instance = new SessionCacheService();
    }
    return this.instance;
  }

  /**
   * Get session with caching and deduplication
   */
  async getSession(force: boolean = false): Promise<{ session: Session | null; error: any }> {
    const now = Date.now();

    // Return cached session if valid and not forced
    if (!force && this.cache && this.cache.isValid && (now - this.cache.timestamp) < this.CACHE_DURATION) {
      console.log('🔍 SESSION CACHE: Using cached session', {
        age: now - this.cache.timestamp,
        hasSession: !!this.cache.session,
        cached: true
      });
      return {
        session: this.cache.session,
        error: this.cache.error
      };
    }

    // Return existing pending request if one is in progress
    if (this.pendingRequest && !force) {
      console.log('🔍 SESSION CACHE: Returning existing pending request');
      return this.pendingRequest;
    }

    console.log('🔍 SESSION CACHE: Starting new session fetch', {
      force,
      cacheAge: this.cache ? now - this.cache.timestamp : 'no-cache',
      timeout: this.REQUEST_TIMEOUT
    });

    // Create new request with timeout
    this.pendingRequest = this.fetchSessionWithTimeout();
    
    try {
      const result = await this.pendingRequest;
      
      // Cache the result
      this.cache = {
        session: result.session,
        error: result.error,
        timestamp: now,
        isValid: !result.error
      };

      console.log('✅ SESSION CACHE: Session fetch completed', {
        hasSession: !!result.session,
        hasError: !!result.error,
        cached: false
      });

      return result;
    } finally {
      this.pendingRequest = null;
    }
  }

  /**
   * Fetch session with timeout protection
   */
  private async fetchSessionWithTimeout(): Promise<{ session: Session | null; error: any }> {
    const startTime = Date.now();

    try {
      const sessionPromise = supabase.auth.getSession().then(result => {
        const elapsed = Date.now() - startTime;
        console.log('✅ SESSION CACHE: Supabase getSession completed', {
          elapsed,
          hasSession: !!result.data.session,
          hasError: !!result.error
        });
        return result;
      }).catch(error => {
        const elapsed = Date.now() - startTime;
        console.error('❌ SESSION CACHE: Supabase getSession failed', {
          elapsed,
          error: error.message
        });
        throw error;
      });

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.error('❌ SESSION CACHE: Session fetch timeout', {
            elapsed,
            timeout: this.REQUEST_TIMEOUT
          });
          reject(new Error('Session fetch timeout - SessionCache'));
        }, this.REQUEST_TIMEOUT)
      );

      const { data: { session }, error } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]);

      return { session, error };
    } catch (error: any) {
      console.error('❌ SESSION CACHE: Session fetch error:', {
        error: error.message,
        elapsed: Date.now() - startTime
      });
      return { session: null, error };
    }
  }

  /**
   * Clear the cache (useful for sign out)
   */
  clearCache(): void {
    console.log('🧹 SESSION CACHE: Clearing cache');
    this.cache = null;
    this.pendingRequest = null;
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { 
    hasCached: boolean; 
    cacheAge: number | null; 
    isValid: boolean; 
    hasPending: boolean;
  } {
    const now = Date.now();
    return {
      hasCached: !!this.cache,
      cacheAge: this.cache ? now - this.cache.timestamp : null,
      isValid: this.cache?.isValid || false,
      hasPending: !!this.pendingRequest
    };
  }
}

export const sessionCache = SessionCacheService.getInstance();
export default SessionCacheService;