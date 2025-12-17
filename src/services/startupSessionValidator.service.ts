import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/utils/promiseUtils';

/**
 * Startup Session Validator
 * 
 * Aggressively validates cached tokens on app load BEFORE any auth state is processed.
 * This prevents stale localStorage tokens from causing authenticated UI with invalid sessions.
 */

interface ValidationResult {
  isValid: boolean;
  wasCleared: boolean;
  reason?: string;
}

class StartupSessionValidatorService {
  private static instance: StartupSessionValidatorService | null = null;
  private validationComplete = false;
  private validationPromise: Promise<ValidationResult> | null = null;

  static getInstance(): StartupSessionValidatorService {
    if (!this.instance) {
      this.instance = new StartupSessionValidatorService();
    }
    return this.instance;
  }

  /**
   * Check if validation has been completed
   */
  isValidationComplete(): boolean {
    return this.validationComplete;
  }

  /**
   * Validate cached session on startup - must be called BEFORE auth context initializes
   * Returns a promise that resolves when validation is complete
   */
  async validateOnStartup(): Promise<ValidationResult> {
    // If validation is already in progress, return existing promise
    if (this.validationPromise) {
      return this.validationPromise;
    }

    // If already validated, return immediately
    if (this.validationComplete) {
      return { isValid: true, wasCleared: false, reason: 'Already validated' };
    }

    console.log('🔐 STARTUP VALIDATOR: Starting aggressive session validation...');
    
    // Wrap entire validation with a hard 12-second global timeout
    this.validationPromise = (async () => {
      try {
        const result = await withTimeout(
          this.performValidation(),
          12000,
          'Overall startup validation timeout'
        );
        return result;
      } catch (error: any) {
        console.log('⚠️ STARTUP VALIDATOR: Global timeout hit, clearing stale tokens');
        await this.clearStaleTokens('Global validation timeout');
        return { isValid: false, wasCleared: true, reason: 'Global timeout' };
      }
    })();
    
    try {
      const result = await this.validationPromise;
      this.validationComplete = true;
      return result;
    } finally {
      this.validationPromise = null;
    }
  }

  private async performValidation(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Check if there are any cached tokens in localStorage
      const hasCachedTokens = this.hasCachedAuthTokens();
      
      if (!hasCachedTokens) {
        console.log('🔐 STARTUP VALIDATOR: No cached tokens found, skipping validation');
        return { isValid: true, wasCleared: false, reason: 'No cached tokens' };
      }

      console.log('🔐 STARTUP VALIDATOR: Found cached tokens, validating with server...');

      // Step 2: Get cached session WITH TIMEOUT (critical fix for stale token hangs)
      let session = null;
      let sessionError = null;

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          5000, // 5 second timeout - fail fast for better UX
          'Session fetch timeout'
        );
        session = sessionResult.data.session;
        sessionError = sessionResult.error;
      } catch (timeoutError: any) {
        console.log('⚠️ STARTUP VALIDATOR: getSession() timed out after 5s, clearing stale tokens');
        await this.clearStaleTokens('Session fetch timeout');
        return { isValid: false, wasCleared: true, reason: 'Session fetch timeout' };
      }
      
      if (sessionError || !session) {
        console.log('🔐 STARTUP VALIDATOR: No valid session in cache', {
          error: sessionError?.message,
          hasSession: !!session
        });
        // Clear stale tokens if session is invalid
        if (hasCachedTokens) {
          await this.clearStaleTokens('No valid session');
          return { isValid: false, wasCleared: true, reason: 'No valid session' };
        }
        return { isValid: false, wasCleared: false, reason: 'No session' };
      }

      // Step 3: Check if session is expired based on expires_at
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const isExpired = expiresAt <= now;
      
      if (isExpired) {
        console.log('🔐 STARTUP VALIDATOR: Session expired based on timestamp', {
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          now: new Date(now * 1000).toISOString()
        });
        await this.clearStaleTokens('Session expired');
        return { isValid: false, wasCleared: true, reason: 'Session expired' };
      }

      // Step 4: Validate with server using getUser() - this is the critical check
      console.log('🔐 STARTUP VALIDATOR: Validating token with server...');
      
      try {
        const { data: { user }, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          5000, // 5 second timeout - consistent with getSession timeout
          'Startup validation timeout'
        );

        const validationTime = Date.now() - startTime;

        if (userError) {
          const isNetworkError = this.isNetworkError(userError);
          
          if (isNetworkError) {
            console.log(`⚠️ STARTUP VALIDATOR: Network error after ${validationTime}ms, preserving session`, {
              error: userError.message
            });
            // For network errors, trust the cached session temporarily
            return { isValid: true, wasCleared: false, reason: 'Network error - session preserved' };
          }

          console.log(`❌ STARTUP VALIDATOR: Server rejected token after ${validationTime}ms`, {
            error: userError.message
          });
          await this.clearStaleTokens('Server rejected token');
          return { isValid: false, wasCleared: true, reason: 'Server rejected token' };
        }

        if (!user) {
          console.log(`❌ STARTUP VALIDATOR: No user returned after ${validationTime}ms`);
          await this.clearStaleTokens('No user returned');
          return { isValid: false, wasCleared: true, reason: 'No user returned' };
        }

        console.log(`✅ STARTUP VALIDATOR: Session validated successfully in ${validationTime}ms`, {
          userId: user.id,
          email: user.email
        });

        return { isValid: true, wasCleared: false, reason: 'Valid session' };

      } catch (validationError: any) {
        const validationTime = Date.now() - startTime;
        const isTimeoutOrNetwork = this.isTimeoutOrNetworkError(validationError);

        if (isTimeoutOrNetwork) {
          console.log(`⚠️ STARTUP VALIDATOR: Timeout/network error after ${validationTime}ms, preserving session`);
          return { isValid: true, wasCleared: false, reason: 'Timeout - session preserved' };
        }

        console.log(`❌ STARTUP VALIDATOR: Validation failed after ${validationTime}ms`, {
          error: validationError.message
        });
        await this.clearStaleTokens('Validation error');
        return { isValid: false, wasCleared: true, reason: 'Validation error' };
      }

    } catch (error: any) {
      console.error('❌ STARTUP VALIDATOR: Critical error during validation:', error.message);
      // On critical errors, clear tokens to be safe
      await this.clearStaleTokens('Critical error');
      return { isValid: false, wasCleared: true, reason: 'Critical error' };
    }
  }

  /**
   * Check if there are any cached auth tokens in localStorage
   */
  private hasCachedAuthTokens(): boolean {
    try {
      const authKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') || 
        key.includes('supabase') ||
        key.includes('auth-token')
      );
      return authKeys.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Clear stale tokens from localStorage and sign out locally
   */
  private async clearStaleTokens(reason: string): Promise<void> {
    console.log(`🧹 STARTUP VALIDATOR: Clearing stale tokens - ${reason}`);

    try {
      // Clear Supabase auth keys from localStorage
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') || 
        key.includes('supabase') ||
        key.includes('auth-token')
      );

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🧹 STARTUP VALIDATOR: Removed localStorage key: ${key}`);
      });

      // Clear sessionStorage
      const sessionKeysToRemove = Object.keys(sessionStorage).filter(key =>
        key.startsWith('sb-') || 
        key.includes('supabase') ||
        key.includes('auth-token')
      );

      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });

      // Force local signout to clear Supabase internal state
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        // Ignore signout errors - tokens are already cleared
        console.log('⚠️ STARTUP VALIDATOR: Signout error (ignored):', signOutError);
      }

      console.log(`✅ STARTUP VALIDATOR: Cleared ${keysToRemove.length} stale tokens`);

    } catch (error) {
      console.error('❌ STARTUP VALIDATOR: Error clearing tokens:', error);
    }
  }

  /**
   * Check if error is a network-related error
   */
  private isNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      error?.name === 'NetworkError'
    );
  }

  /**
   * Check if error is timeout or network related
   */
  private isTimeoutOrNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('aborted') ||
      error?.name === 'AbortError' ||
      error?.name === 'NetworkError'
    );
  }

  /**
   * Reset validation state (useful for testing or manual re-validation)
   */
  reset(): void {
    this.validationComplete = false;
    this.validationPromise = null;
    console.log('🔄 STARTUP VALIDATOR: Reset validation state');
  }
}

export const startupSessionValidator = StartupSessionValidatorService.getInstance();
export default StartupSessionValidatorService;
