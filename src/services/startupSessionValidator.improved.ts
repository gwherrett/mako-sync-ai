/**
 * IMPROVED Startup Session Validator
 *
 * Enhanced version with:
 * - Retry logic for slow networks
 * - Better error classification
 * - Adaptive timeouts
 * - Detailed logging
 *
 * This is the PROPOSED FIX for P0 reload issue
 */

import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/utils/promiseUtils';
import { ReloadDebuggerService } from '@/utils/reloadDebugger';

interface ValidationResult {
  isValid: boolean;
  wasCleared: boolean;
  reason?: string;
  validationTime?: number;
  retriesUsed?: number;
}

interface ValidationConfig {
  getSessionTimeout: number;
  getUserTimeout: number;
  globalTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

class ImprovedStartupSessionValidator {
  private static instance: ImprovedStartupSessionValidator | null = null;
  private validationComplete = false;
  private validationPromise: Promise<ValidationResult> | null = null;
  private externallyValidated = false;

  // IMPROVED: Adaptive timeouts based on connection quality
  private config: ValidationConfig = {
    getSessionTimeout: 8000,    // Increased from 5s to 8s
    getUserTimeout: 8000,        // Increased from 5s to 8s
    globalTimeout: 20000,        // Increased from 12s to 20s
    maxRetries: 2,               // NEW: Retry on timeout
    retryDelay: 1000            // NEW: 1s between retries
  };

  static getInstance(): ImprovedStartupSessionValidator {
    if (!this.instance) {
      this.instance = new ImprovedStartupSessionValidator();
    }
    return this.instance;
  }

  /**
   * Check if validation has been completed
   */
  isValidationComplete(): boolean {
    return this.validationComplete || this.externallyValidated;
  }

  /**
   * Mark session as externally validated
   */
  markAsValidated(): void {
    console.log('✅ IMPROVED VALIDATOR: Externally marked as validated');
    this.externallyValidated = true;
    this.validationComplete = true;

    ReloadDebuggerService.logEvent('validator-marked-valid', 'runtime', {
      source: 'external',
      reason: 'TOKEN_REFRESHED or similar'
    });
  }

  /**
   * Validate cached session on startup with retry logic
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

    console.log('🔐 IMPROVED VALIDATOR: Starting validation with retry support...');

    ReloadDebuggerService.logEvent('validation-start', 'startup', {
      config: this.config
    });

    // Wrap with global timeout
    this.validationPromise = (async () => {
      try {
        const result = await withTimeout(
          this.performValidationWithRetry(),
          this.config.globalTimeout,
          'Global validation timeout'
        );

        ReloadDebuggerService.logEvent('validation-complete', 'startup', {
          result,
          success: result.isValid
        });

        return result;
      } catch (error: any) {
        console.log('⚠️ IMPROVED VALIDATOR: Global timeout hit');

        ReloadDebuggerService.logEvent('validation-global-timeout', 'startup', {
          error: error.message,
          action: 'preserving session'
        });

        // IMPROVED: On global timeout, PRESERVE session (network issue)
        // Don't clear tokens - user likely has slow connection
        return {
          isValid: true,
          wasCleared: false,
          reason: 'Global timeout - session preserved',
          validationTime: this.config.globalTimeout
        };
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

  /**
   * Perform validation with retry logic
   */
  private async performValidationWithRetry(): Promise<ValidationResult> {
    let lastError: Error | null = null;
    let retriesUsed = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔐 IMPROVED VALIDATOR: Validation attempt ${attempt + 1}/${this.config.maxRetries + 1}`);

        const result = await this.performValidation(attempt);

        // If validation succeeded, return immediately
        if (result.isValid || !result.wasCleared) {
          return { ...result, retriesUsed };
        }

        // If tokens were actively cleared due to auth error (not timeout), don't retry
        if (result.reason?.includes('rejected') || result.reason?.includes('expired')) {
          console.log('🔐 IMPROVED VALIDATOR: Auth error detected, not retrying');
          return { ...result, retriesUsed };
        }

        // Otherwise, save error and retry
        lastError = new Error(result.reason || 'Validation failed');
        retriesUsed++;

        if (attempt < this.config.maxRetries) {
          console.log(`⚠️ IMPROVED VALIDATOR: Retrying after ${this.config.retryDelay}ms...`);
          await this.sleep(this.config.retryDelay);
        }

      } catch (error: any) {
        console.log(`⚠️ IMPROVED VALIDATOR: Attempt ${attempt + 1} failed:`, error.message);
        lastError = error;
        retriesUsed++;

        if (attempt < this.config.maxRetries) {
          await this.sleep(this.config.retryDelay);
        }
      }
    }

    // All retries exhausted - preserve session
    console.log('⚠️ IMPROVED VALIDATOR: All retries exhausted, preserving session');

    ReloadDebuggerService.logEvent('validation-retries-exhausted', 'startup', {
      retriesUsed,
      lastError: lastError?.message
    });

    return {
      isValid: true,
      wasCleared: false,
      reason: `All retries exhausted - session preserved (${lastError?.message})`,
      retriesUsed
    };
  }

  /**
   * Perform single validation attempt
   */
  private async performValidation(attemptNumber: number): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Check if there are cached tokens
      const hasCachedTokens = this.hasCachedAuthTokens();

      if (!hasCachedTokens) {
        console.log('🔐 IMPROVED VALIDATOR: No cached tokens, skipping validation');
        return { isValid: true, wasCleared: false, reason: 'No cached tokens' };
      }

      console.log('🔐 IMPROVED VALIDATOR: Found cached tokens, validating...');

      // Step 2: Get cached session with timeout
      let session = null;
      let sessionError = null;

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          this.config.getSessionTimeout,
          'Session fetch timeout'
        );
        session = sessionResult.data.session;
        sessionError = sessionResult.error;
      } catch (timeoutError: any) {
        console.log(`⚠️ IMPROVED VALIDATOR: getSession() timed out after ${this.config.getSessionTimeout}ms`);

        // IMPROVED: Don't clear on timeout - might be network issue
        // Let retry logic handle it
        throw new Error('getSession timeout');
      }

      if (sessionError || !session) {
        console.log('🔐 IMPROVED VALIDATOR: No valid session in cache');

        // IMPROVED: Only clear if we're sure tokens are invalid
        if (sessionError && !this.isNetworkError(sessionError)) {
          await this.clearStaleTokens('Invalid session');
          return { isValid: false, wasCleared: true, reason: 'Invalid session' };
        }

        return { isValid: false, wasCleared: false, reason: 'No session' };
      }

      // Step 3: Check expiry
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const isExpired = expiresAt <= now;

      if (isExpired) {
        console.log('🔐 IMPROVED VALIDATOR: Session expired');
        await this.clearStaleTokens('Session expired');
        return { isValid: false, wasCleared: true, reason: 'Session expired' };
      }

      // Step 4: Validate with server
      console.log('🔐 IMPROVED VALIDATOR: Validating with server...');

      try {
        const { data: { user }, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          this.config.getUserTimeout,
          'User validation timeout'
        );

        const validationTime = Date.now() - startTime;

        if (userError) {
          const isNetworkError = this.isNetworkError(userError);

          if (isNetworkError) {
            console.log(`⚠️ IMPROVED VALIDATOR: Network error after ${validationTime}ms`);
            // Network error - preserve session
            return {
              isValid: true,
              wasCleared: false,
              reason: 'Network error - session preserved',
              validationTime
            };
          }

          console.log(`❌ IMPROVED VALIDATOR: Server rejected token after ${validationTime}ms`);
          await this.clearStaleTokens('Server rejected token');
          return {
            isValid: false,
            wasCleared: true,
            reason: 'Server rejected token',
            validationTime
          };
        }

        if (!user) {
          console.log(`❌ IMPROVED VALIDATOR: No user returned after ${validationTime}ms`);
          await this.clearStaleTokens('No user returned');
          return {
            isValid: false,
            wasCleared: true,
            reason: 'No user returned',
            validationTime
          };
        }

        console.log(`✅ IMPROVED VALIDATOR: Session validated in ${validationTime}ms`, {
          userId: user.id,
          attemptNumber
        });

        return {
          isValid: true,
          wasCleared: false,
          reason: 'Valid session',
          validationTime
        };

      } catch (validationError: any) {
        const validationTime = Date.now() - startTime;
        const isTimeoutOrNetwork = this.isTimeoutOrNetworkError(validationError);

        if (isTimeoutOrNetwork) {
          console.log(`⚠️ IMPROVED VALIDATOR: Timeout/network error after ${validationTime}ms`);
          // Let retry logic handle timeouts
          throw validationError;
        }

        console.log(`❌ IMPROVED VALIDATOR: Validation failed after ${validationTime}ms`);
        await this.clearStaleTokens('Validation error');
        return {
          isValid: false,
          wasCleared: true,
          reason: 'Validation error',
          validationTime
        };
      }

    } catch (error: any) {
      // Re-throw to trigger retry
      throw error;
    }
  }

  /**
   * Check if there are cached auth tokens
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
   * Clear stale tokens
   */
  private async clearStaleTokens(reason: string): Promise<void> {
    if (this.externallyValidated) {
      console.log('⚠️ IMPROVED VALIDATOR: Skipping clear - externally validated');
      return;
    }

    console.log(`🧹 IMPROVED VALIDATOR: Clearing stale tokens - ${reason}`);

    ReloadDebuggerService.logEvent('tokens-cleared', 'runtime', { reason });

    try {
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') ||
        key.includes('supabase') ||
        key.includes('auth-token')
      );

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      sessionStorage.clear();

      try {
        await withTimeout(supabase.auth.signOut({ scope: 'local' }), 5000);
      } catch {
        // Ignore signout errors
      }

      console.log(`✅ IMPROVED VALIDATOR: Cleared ${keysToRemove.length} tokens`);
    } catch (error) {
      console.error('❌ IMPROVED VALIDATOR: Error clearing tokens:', error);
    }
  }

  /**
   * IMPROVED: Better network error detection
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;

    const message = error?.message?.toLowerCase() || '';
    const name = error?.name?.toLowerCase() || '';

    return (
      // Network-related messages
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('offline') ||
      message.includes('unreachable') ||
      // Network error types
      name === 'networkerror' ||
      name === 'typeerror' ||
      // HTTP timeouts
      error?.status === 0 ||
      error?.status === 408 ||
      error?.status === 504
    );
  }

  /**
   * Check if error is timeout or network related
   */
  private isTimeoutOrNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const name = error?.name?.toLowerCase() || '';

    return (
      message.includes('timeout') ||
      message.includes('aborted') ||
      name === 'aborterror' ||
      name === 'timeouterror' ||
      this.isNetworkError(error)
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset validation state
   */
  reset(): void {
    this.validationComplete = false;
    this.validationPromise = null;
    this.externallyValidated = false;
    console.log('🔄 IMPROVED VALIDATOR: Reset');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 IMPROVED VALIDATOR: Config updated', this.config);
  }
}

export const improvedStartupValidator = ImprovedStartupSessionValidator.getInstance();
export default ImprovedStartupSessionValidator;
