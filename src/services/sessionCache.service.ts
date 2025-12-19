import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { withTimeout } from '@/utils/promiseUtils';

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
  
  // Enhanced request tracking to prevent race conditions
  private requestContexts: Map<string, Promise<{ session: Session | null; error: any }>> = new Map();
  private initializationRequest: Promise<{ session: Session | null; error: any }> | null = null;
  private requestSequence = 0; // Track request order for debugging
  
  // CIRCUIT BREAKER: Prevent too many concurrent validations
  private concurrentValidations = 0;
  private readonly MAX_CONCURRENT_VALIDATIONS = 2;
  private validationInProgress = false;

  static getInstance(): SessionCacheService {
    if (!this.instance) {
      this.instance = new SessionCacheService();
    }
    return this.instance;
  }

  /**
   * Get session with enhanced race condition protection
   * @param force - Force fresh session fetch
   * @param context - Request context to prevent cross-contamination between auth flows
   * @param priority - Request priority (initialization gets highest priority)
   */
  async getSession(
    force: boolean = false,
    context?: string,
    priority: 'initialization' | 'normal' | 'background' = 'normal'
  ): Promise<{ session: Session | null; error: any }> {
    const now = Date.now();
    const requestId = ++this.requestSequence;
    
    console.log('🔍 SESSION CACHE: Session request started', {
      requestId,
      context: context || 'default',
      priority,
      force,
      timestamp: new Date().toISOString()
    });

    // Return cached session if valid and not forced (except for initialization)
    if (!force && priority !== 'initialization' && this.cache && this.cache.isValid && (now - this.cache.timestamp) < this.CACHE_DURATION) {
      console.log('🔍 SESSION CACHE: Using cached session', {
        requestId,
        age: now - this.cache.timestamp,
        hasSession: !!this.cache.session,
        cached: true
      });
      return {
        session: this.cache.session,
        error: this.cache.error
      };
    }

    // CRITICAL: Initialization requests get dedicated handling to prevent race conditions
    if (priority === 'initialization') {
      if (this.initializationRequest && !force) {
        console.log('🔍 SESSION CACHE: Returning existing initialization request', { requestId });
        return this.initializationRequest;
      }
      
      console.log('🔍 SESSION CACHE: Starting new initialization request', { requestId });
      const initRequest = this.fetchSessionDirect(requestId, 'initialization');
      this.initializationRequest = initRequest;
      
      try {
        const result = await initRequest;
        this.cacheResult(result, now, requestId);
        return result;
      } finally {
        this.initializationRequest = null;
      }
    }

    // Handle context-specific requests to prevent cross-contamination
    if (context) {
      const existingContextRequest = this.requestContexts.get(context);
      if (existingContextRequest && !force) {
        console.log(`🔍 SESSION CACHE: Returning existing request for context: ${context}`, { requestId });
        return existingContextRequest;
      }
    }

    // Return existing pending request if one is in progress (only for non-critical contexts)
    if (this.pendingRequest && !force && !context && priority === 'background') {
      console.log('🔍 SESSION CACHE: Returning existing pending request', { requestId });
      return this.pendingRequest;
    }

    console.log('🔍 SESSION CACHE: Starting new session fetch', {
      requestId,
      context: context || 'default',
      priority,
      forced: force
    });

    // Create new request with request tracking
    const sessionRequest = this.fetchSessionDirect(requestId, context || 'default');
    
    // Store request by context if provided
    if (context) {
      this.requestContexts.set(context, sessionRequest);
    } else {
      this.pendingRequest = sessionRequest;
    }
    
    try {
      const result = await sessionRequest;
      this.cacheResult(result, now, requestId);
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
   * Cache session result with validation
   */
  private cacheResult(result: { session: Session | null; error: any }, timestamp: number, requestId: number): void {
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
        timestamp,
        isValid: isValidSession
      };
    }

    console.log('✅ SESSION CACHE: Session fetch completed', {
      requestId,
      hasSession: !!result.session,
      hasError: !!result.error,
      cached: true,
      sessionValid: isValidSession,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Direct session fetch with server validation - prevents stale token issues
   */
  private async fetchSessionDirect(requestId: number, context: string): Promise<{ session: Session | null; error: any }> {
    try {
      console.log('🔍 SESSION CACHE: Fetching session from Supabase', { requestId, context });
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('❌ SESSION CACHE: Session fetch error', { requestId, error: error.message });
        return { session: null, error };
      }
      
      if (!session) {
        console.log('🔍 SESSION CACHE: No session found', { requestId });
        return { session: null, error: null };
      }
      
      // CIRCUIT BREAKER: Limit concurrent validations to prevent hanging
      if (this.concurrentValidations >= this.MAX_CONCURRENT_VALIDATIONS) {
        console.log('⚠️ SESSION CACHE: Too many concurrent validations, returning session without validation', {
          requestId,
          context,
          concurrentValidations: this.concurrentValidations
        });
        return { session, error: null };
      }
      
      // Validate session with server to prevent stale token issues
      console.log('🔍 SESSION CACHE: Validating session with server...', { requestId, context });
      const validationStart = Date.now();
      this.concurrentValidations++;
      this.validationInProgress = true;
      
      try {
        // Use withTimeout utility to prevent hanging validation
        const { data: { user }, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session validation timeout'
        );
        
        const validationTime = Date.now() - validationStart;
        
        if (userError || !user) {
          // Check if this is a network/timeout error vs actual auth error
          const isNetworkError = userError?.message?.includes('timeout') ||
                                userError?.message?.includes('network') ||
                                userError?.message?.includes('fetch');
          
          if (isNetworkError) {
            console.log(`⚠️ SESSION CACHE: Session validation failed due to network issue after ${validationTime}ms`, {
              error: userError?.message,
              networkIssue: true,
              sessionPreserved: 'Session preserved due to network error'
            });
            
            // For network errors, return the session without validation
            // Better to have a potentially stale session than to sign out the user
            return { session, error: null };
          }
          
          console.log(`❌ SESSION CACHE: Session validation failed after ${validationTime}ms`, {
            error: userError?.message,
            hasUser: !!user,
            sessionExpiry: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
            staleTokenDetected: true
          });
          
          // Only sign out for actual auth errors, not network issues
          await supabase.auth.signOut({ scope: 'local' });
          return { session: null, error: userError || new Error('Stale token detected') };
        }
        
        console.log(`✅ SESSION CACHE: Session validated successfully after ${validationTime}ms`, {
          userId: user.id,
          sessionExpiry: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
        });
        
        return { session, error: null };
      } catch (validationError: any) {
        const validationTime = Date.now() - validationStart;
        const isTimeoutError = validationError.message?.includes('timeout');
        const isNetworkError = validationError.message?.includes('network') ||
                              validationError.message?.includes('fetch') ||
                              validationError.name === 'AbortError';
        
        if (isTimeoutError || isNetworkError) {
          console.log(`⚠️ SESSION CACHE: Session validation timeout/network error after ${validationTime}ms`, {
            error: validationError.message,
            timeoutError: isTimeoutError,
            networkError: isNetworkError,
            sessionPreserved: 'Session preserved due to validation timeout/network error'
          });
          
          // For timeout/network errors, return the session without validation
          return { session, error: null };
        }
        
        console.error(`❌ SESSION CACHE: Session validation error after ${validationTime}ms:`, validationError.message);
        
        // Only sign out for actual auth errors, not network/timeout issues
        await supabase.auth.signOut({ scope: 'local' });
        return { session: null, error: validationError };
      } finally {
        this.concurrentValidations--;
        this.validationInProgress = false;
      }
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
    
    // Also clear browser storage to prevent stale data
    this.clearBrowserCache();
  }

  /**
   * Clear browser cache and storage related to authentication
   */
  private clearBrowserCache(): void {
    try {
      // Clear auth-related localStorage items
      const authKeys = Object.keys(localStorage).filter(key =>
        key.includes('auth') ||
        key.includes('token') ||
        key.includes('session') ||
        key.includes('supabase') ||
        key.includes('sb-')
      );
      
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log('🧹 SESSION CACHE: Cleared localStorage key:', key);
      });
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear any auth-related caches
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('auth') || cacheName.includes('session')) {
              caches.delete(cacheName);
              console.log('🧹 SESSION CACHE: Cleared cache:', cacheName);
            }
          });
        });
      }
    } catch (error) {
      console.warn('⚠️ SESSION CACHE: Failed to clear browser cache:', error);
    }
  }

  /**
   * Force refresh session by clearing all caches and fetching fresh
   */
  async forceRefresh(): Promise<{ session: Session | null; error: any }> {
    console.log('🔄 SESSION CACHE: Force refreshing session...');
    
    // Clear all caches first
    this.clearCache();
    
    // Force a fresh fetch
    return this.getSession(true, 'force-refresh');
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
    validationInProgress: boolean;
    concurrentValidations: number;
  } {
    const now = Date.now();
    return {
      hasCached: !!this.cache,
      cacheAge: this.cache ? now - this.cache.timestamp : null,
      isValid: this.cache?.isValid || false,
      hasPending: !!this.pendingRequest,
      activeContexts: this.requestContexts.size,
      validationInProgress: this.validationInProgress,
      concurrentValidations: this.concurrentValidations
    };
  }

  /**
   * Check if auth state is stable (no pending validations)
   */
  isAuthStable(): boolean {
    return !this.validationInProgress && this.concurrentValidations === 0;
  }
}

export const sessionCache = SessionCacheService.getInstance();
export default SessionCacheService;