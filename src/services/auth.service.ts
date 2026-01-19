import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { withTimeout } from '@/utils/promiseUtils';
import { sessionCache } from '@/services/sessionCache.service';
import { logger } from '@/utils/logger';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Allowed redirect URLs for OAuth callbacks and email confirmations
   */
  private static readonly ALLOWED_REDIRECT_ORIGINS = [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://mako-sync.vercel.app',
    window.location.origin // Current origin is always allowed
  ];

  /**
   * Validate redirect URL against whitelist
   */
  private static validateRedirectUrl(url: string): string {
    try {
      const redirectUrl = new URL(url);
      const isAllowed = this.ALLOWED_REDIRECT_ORIGINS.some(
        origin => redirectUrl.origin === origin
      );

      if (!isAllowed) {
        logger.auth(`Redirect URL ${url} not in whitelist, using default`, undefined, 'warn');
        return `${window.location.origin}/`;
      }

      return url;
    } catch (error) {
      logger.auth('Invalid redirect URL', { error }, 'error');
      return `${window.location.origin}/`;
    }
  }

  /**
   * Sign up a new user
   */
  static async signUp({ email, password, displayName }: SignUpData): Promise<AuthResult> {
    try {
      const redirectUrl = this.validateRedirectUrl(`${window.location.origin}/`);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName
          }
        }
      });

      return {
        user: data.user,
        session: data.session,
        error
      };
    } catch (error) {
      logger.auth('signUp error', { error }, 'error');
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign in an existing user
   */
  static async signIn({ email, password }: SignInData): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      return {
        user: data.user,
        session: data.session,
        error
      };
    } catch (error) {
      logger.auth('signIn error', { error }, 'error');
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign out the current user with timeout protection and local fallback
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    try {
      logger.auth('Attempting global sign out with timeout');

      // Try global signout with 5 second timeout
      try {
        const result = await withTimeout(
          supabase.auth.signOut({ scope: 'global' }),
          5000,
          'Sign out request timed out'
        );
        logger.auth('Global sign out completed', { hasError: !!result.error });
        return { error: result.error };
      } catch (timeoutError) {
        logger.auth('Global signout timed out, falling back to local signout', undefined, 'warn');

        // Fallback: local signout
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          logger.auth('Local signout also failed, forcing manual cleanup', undefined, 'warn');
        }

        // Force clear all auth storage regardless
        this.clearAuthCache();

        return { error: null }; // Consider success if we cleared local state
      }
    } catch (error) {
      logger.auth('signOut error', { error }, 'error');

      // Last resort: manually clear storage
      this.clearAuthCache();

      return { error: error as AuthError };
    }
  }

  /**
   * Get current session with enhanced caching and race condition protection
   * @param context - Context for the request (initialization, normal, etc.)
   */
  static async getCurrentSession(context: 'initialization' | 'normal' | 'refresh' = 'normal'): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      logger.auth('Starting getCurrentSession', { context });

      // Use session cache with appropriate priority
      const priority = context === 'initialization' ? 'initialization' :
                      context === 'refresh' ? 'normal' : 'background';

      const result = await sessionCache.getSession(false, `auth-service-${context}`, priority);

      logger.auth('Session cache result', {
        context,
        hasSession: !!result.session,
        hasError: !!result.error,
        userId: result.session?.user?.id
      });

      return {
        session: result.session,
        error: result.error as AuthError
      };
    } catch (error) {
      logger.auth('getCurrentSession error', { error }, 'error');
      return {
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.getUser();
      return {
        user: data.user,
        error
      };
    } catch (error) {
      logger.auth('getCurrentUser error', { error }, 'error');
      return {
        user: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const redirectUrl = this.validateRedirectUrl(`${window.location.origin}/reset-password`);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });
      return { error };
    } catch (error) {
      logger.auth('resetPassword error', { error }, 'error');
      return { error: error as AuthError };
    }
  }

  /**
   * Update password
   */
  static async updatePassword(password: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
    } catch (error) {
      logger.auth('updatePassword error', { error }, 'error');
      return { error: error as AuthError };
    }
  }

  /**
   * Resend email confirmation
   */
  static async resendConfirmation(email: string): Promise<{ error: AuthError | null }> {
    try {
      const redirectUrl = this.validateRedirectUrl(`${window.location.origin}/`);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      return { error };
    } catch (error) {
      logger.auth('resendConfirmation error', { error }, 'error');
      return { error: error as AuthError };
    }
  }

  /**
   * Clear all authentication-related cache and storage
   */
  static clearAuthCache(): void {
    try {
      // Clear Supabase auth token
      localStorage.removeItem('sb-bzzstdpfmyqttnzhgaoa-auth-token');

      // Clear all auth-related localStorage items
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

      // Clear all sessionStorage
      sessionStorage.clear();

      // Clear any cached session data
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('auth') || cacheName.includes('session')) {
              caches.delete(cacheName);
            }
          });
        });
      }

      logger.auth('Auth cache cleared successfully');
    } catch (error) {
      logger.auth('Failed to clear auth cache', { error }, 'warn');
    }
  }

  /**
   * Force refresh session by clearing cache and fetching fresh
   */
  static async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      logger.auth('Forcing session refresh');

      // Clear any cached session data first
      this.clearAuthCache();

      // Add cache-busting timestamp to force fresh request
      const timestamp = Date.now();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        logger.auth('Session refresh error', { message: error.message }, 'error');
        return { session: null, error };
      }

      logger.auth('Session refreshed successfully', { timestamp: new Date(timestamp).toISOString() });
      return { session: data.session, error: null };
    } catch (error) {
      logger.auth('refreshSession error', { error }, 'error');
      return { session: null, error: error as AuthError };
    }
  }
}
