import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { withTimeout } from '@/utils/promiseUtils';
import { logger } from '@/utils/logger';

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
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  // Enhanced request tracking to prevent race conditions
  private requestContexts: Map<string, Promise<{ session: Session | null; error: any }>> = new Map();
  private initializationRequest: Promise<{ session: Session | null; error: any }> | null = null;
  private requestSequence = 0;

  // CIRCUIT BREAKER: Prevent too many concurrent validations
  private concurrentValidations = 0;
  private readonly MAX_CONCURRENT_VALIDATIONS = 2;
  private validationInProgress = false;

  // Pre-populated session from auth context
  private prePopulatedSession: Session | null = null;
  private prePopulatedTimestamp: number = 0;

  static getInstance(): SessionCacheService {
    if (!this.instance) {
      this.instance = new SessionCacheService();
    }
    return this.instance;
  }

  /**
   * Pre-populate session from auth context to avoid redundant getSession calls
   */
  setSessionFromAuthContext(session: Session | null): void {
    if (session) {
      logger.session('Pre-populated with session from auth context', {
        userId: session.user?.id,
        expiresAt: session.expires_at
      });
      this.prePopulatedSession = session;
      this.prePopulatedTimestamp = Date.now();

      this.cache = {
        session,
        error: null,
        timestamp: Date.now(),
        isValid: true
      };
    }
  }

  /**
   * Check if we have a valid pre-populated session
   */
  private hasValidPrePopulatedSession(): boolean {
    if (!this.prePopulatedSession) return false;
    const age = Date.now() - this.prePopulatedTimestamp;
    return age < this.CACHE_DURATION;
  }

  /**
   * Get session with enhanced race condition protection
   */
  async getSession(
    force: boolean = false,
    context?: string,
    priority: 'initialization' | 'normal' | 'background' = 'normal'
  ): Promise<{ session: Session | null; error: any }> {
    const now = Date.now();
    const requestId = ++this.requestSequence;

    logger.session('Session request started', {
      requestId,
      context: context || 'default',
      priority,
      force
    });

    // Use pre-populated session from auth context if available
    if (!force && this.hasValidPrePopulatedSession()) {
      logger.session('Using pre-populated session from auth context', {
        requestId,
        age: now - this.prePopulatedTimestamp,
        hasSession: !!this.prePopulatedSession
      });
      return {
        session: this.prePopulatedSession,
        error: null
      };
    }

    // Return cached session if valid and not forced
    if (!force && priority !== 'initialization' && this.cache && this.cache.isValid && (now - this.cache.timestamp) < this.CACHE_DURATION) {
      logger.session('Using cached session', {
        requestId,
        age: now - this.cache.timestamp,
        hasSession: !!this.cache.session
      });
      return {
        session: this.cache.session,
        error: this.cache.error
      };
    }

    // Initialization requests get dedicated handling
    if (priority === 'initialization') {
      if (this.initializationRequest && !force) {
        logger.session('Returning existing initialization request', { requestId });
        return this.initializationRequest;
      }

      logger.session('Starting new initialization request', { requestId });
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

    // Handle context-specific requests
    if (context) {
      const existingContextRequest = this.requestContexts.get(context);
      if (existingContextRequest && !force) {
        logger.session(`Returning existing request for context: ${context}`, { requestId });
        return existingContextRequest;
      }
    }

    // Return existing pending request if one is in progress
    if (this.pendingRequest && !force && !context && priority === 'background') {
      logger.session('Returning existing pending request', { requestId });
      return this.pendingRequest;
    }

    logger.session('Starting new session fetch', {
      requestId,
      context: context || 'default',
      priority,
      forced: force
    });

    const sessionRequest = this.fetchSessionDirect(requestId, context || 'default');

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
    const isValidSession = result.session &&
                         result.session.user &&
                         result.session.access_token &&
                         !result.error;

    if (isValidSession || !result.error) {
      this.cache = {
        session: result.session,
        error: result.error,
        timestamp,
        isValid: isValidSession
      };
    }

    logger.session('Session fetch completed', {
      requestId,
      hasSession: !!result.session,
      hasError: !!result.error,
      cached: true,
      sessionValid: isValidSession
    });
  }

  /**
   * Direct session fetch with server validation
   */
  private async fetchSessionDirect(requestId: number, context: string): Promise<{ session: Session | null; error: any }> {
    try {
      logger.session('Fetching session from Supabase', { requestId, context });
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.session('Session fetch error', { requestId, error: error.message }, 'error');
        return { session: null, error };
      }

      if (!session) {
        logger.session('No session found', { requestId });
        return { session: null, error: null };
      }

      // CIRCUIT BREAKER: Limit concurrent validations
      if (this.concurrentValidations >= this.MAX_CONCURRENT_VALIDATIONS) {
        logger.session('Too many concurrent validations, returning session without validation', {
          requestId,
          context,
          concurrentValidations: this.concurrentValidations
        }, 'warn');
        return { session, error: null };
      }

      logger.session('Validating session with server', { requestId, context });
      const validationStart = Date.now();
      this.concurrentValidations++;
      this.validationInProgress = true;

      try {
        const { data: { user }, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session validation timeout'
        );

        const validationTime = Date.now() - validationStart;

        if (userError || !user) {
          const isNetworkError = userError?.message?.includes('timeout') ||
                                userError?.message?.includes('network') ||
                                userError?.message?.includes('fetch');

          if (isNetworkError) {
            logger.session(`Session validation failed due to network issue after ${validationTime}ms`, {
              error: userError?.message,
              networkIssue: true,
              sessionPreserved: true
            }, 'warn');
            return { session, error: null };
          }

          logger.session(`Session validation failed after ${validationTime}ms`, {
            error: userError?.message,
            hasUser: !!user,
            staleTokenDetected: true
          }, 'error');

          await withTimeout(supabase.auth.signOut({ scope: 'local' }), 5000);
          return { session: null, error: userError || new Error('Stale token detected') };
        }

        logger.session(`Session validated successfully after ${validationTime}ms`, {
          userId: user.id
        });

        return { session, error: null };
      } catch (validationError: any) {
        const validationTime = Date.now() - validationStart;
        const isTimeoutError = validationError.message?.includes('timeout');
        const isNetworkError = validationError.message?.includes('network') ||
                              validationError.message?.includes('fetch') ||
                              validationError.name === 'AbortError';

        if (isTimeoutError || isNetworkError) {
          logger.session(`Session validation timeout/network error after ${validationTime}ms`, {
            error: validationError.message,
            sessionPreserved: true
          }, 'warn');
          return { session, error: null };
        }

        logger.session(`Session validation error after ${validationTime}ms`, { error: validationError.message }, 'error');
        await withTimeout(supabase.auth.signOut({ scope: 'local' }), 5000);
        return { session: null, error: validationError };
      } finally {
        this.concurrentValidations--;
        this.validationInProgress = false;
      }
    } catch (error: any) {
      logger.session('Session fetch error', { error: error.message }, 'error');
      return { session: null, error };
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    logger.session('Clearing cache');
    this.cache = null;
    this.pendingRequest = null;
    this.requestContexts.clear();
    this.clearBrowserCache();
  }

  /**
   * Clear browser cache and storage related to authentication
   */
  private clearBrowserCache(): void {
    try {
      const authKeys = Object.keys(localStorage).filter(key =>
        key.includes('auth') ||
        key.includes('token') ||
        key.includes('session') ||
        key.includes('supabase') ||
        key.includes('sb-')
      );

      authKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      sessionStorage.clear();

      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('auth') || cacheName.includes('session')) {
              caches.delete(cacheName);
            }
          });
        });
      }
    } catch (error) {
      logger.session('Failed to clear browser cache', { error }, 'warn');
    }
  }

  /**
   * Force refresh session
   */
  async forceRefresh(): Promise<{ session: Session | null; error: any }> {
    logger.session('Force refreshing session');
    this.clearCache();
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
   * Check if auth state is stable
   */
  isAuthStable(): boolean {
    return !this.validationInProgress && this.concurrentValidations === 0;
  }
}

export const sessionCache = SessionCacheService.getInstance();
export default SessionCacheService;
