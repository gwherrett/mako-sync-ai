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
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds - removed aggressive timeout for critical flows
  
  // Track request contexts to prevent cross-contamination
  private requestContexts: Map<string, Promise<{ session: Session | null; error: any }>> = new Map();

  static getInstance(): SessionCacheService {
    if (!this.instance) {
      this.instance = new SessionCacheService();
    }
    return this.instance;
  }

  /**
   * Get session with caching and deduplication - simplified without timeout wrapper
   * @param force - Force fresh session fetch
   * @param context - Request context to prevent cross-contamination between auth flows
   */
  async getSession(force: boolean = false, context?: string): Promise<{ session: Session | null; error: any }> {
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

    // Handle context-specific requests to prevent cross-contamination
    if (context) {
      const existingContextRequest = this.requestContexts.get(context);
      if (existingContextRequest && !force) {
        console.log(`🔍 SESSION CACHE: Returning existing request for context: ${context}`);
        return existingContextRequest;
      }
    }

    // Return existing pending request if one is in progress (only for non-critical contexts)
    if (this.pendingRequest && !force && !context) {
      console.log('🔍 SESSION CACHE: Returning existing pending request');
      return this.pendingRequest;
    }

    console.log('🔍 SESSION CACHE: Starting new session fetch (direct call, no timeout wrapper)', {
      context: context || 'default',
      forced: force
    });

    // Create new request - direct call without timeout wrapper
    const sessionRequest = this.fetchSessionDirect();
    
    // Store request by context if provided
    if (context) {
      this.requestContexts.set(context, sessionRequest);
    } else {
      this.pendingRequest = sessionRequest;
    }
    
    try {
      const result = await sessionRequest;
      
      // Validate session integrity before caching
      const isValidSession = result.session &&
                           result.session.user &&
                           result.session.access_token &&
                           !result.error;
      
      // Only cache valid sessions or clear errors
      if (isValidSession || !result.error) {
        this.cache = {
          session: result.session,
          error: result.error,
          timestamp: now,
          isValid: isValidSession
        };
      }

      console.log('✅ SESSION CACHE: Session fetch completed', {
        hasSession: !!result.session,
        hasError: !!result.error,
        cached: false,
        context: context || 'default',
        sessionValid: isValidSession
      });

      return result;
    } finally {
      if (context) {
        this.requestContexts.delete(context);
      } else {
        this.pendingRequest = null;
      }
    }
  }

  /**
   * Direct session fetch without timeout wrapper - let Supabase SDK handle timeouts naturally
   */
  private async fetchSessionDirect(): Promise<{ session: Session | null; error: any }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      return { session, error };
    } catch (error: any) {
      console.error('❌ SESSION CACHE: Session fetch error:', error.message);
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
    this.requestContexts.clear();
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): {
    hasCached: boolean;
    cacheAge: number | null;
    isValid: boolean;
    hasPending: boolean;
    activeContexts: number;
  } {
    const now = Date.now();
    return {
      hasCached: !!this.cache,
      cacheAge: this.cache ? now - this.cache.timestamp : null,
      isValid: this.cache?.isValid || false,
      hasPending: !!this.pendingRequest,
      activeContexts: this.requestContexts.size
    };
  }
}

export const sessionCache = SessionCacheService.getInstance();
export default SessionCacheService;